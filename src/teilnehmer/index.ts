import type {Firestore} from "firebase/firestore";
import {loadTeilnehmerStorage, saveTeilnehmerStorage, clearTeilnehmerStorage} from "../services/storage";
import {TeilnehmerView} from "./TeilnehmerView";
import {FirebaseService} from "../services/FirebaseService";
import {store} from "../state/store";
import {router} from "../core/router";
import {Uebung} from "../types/Uebung";
import {TeilnehmerStorage} from "../types/Storage";
import pdfGenerator from "../services/pdfGenerator";
import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";

type DocMode = "table" | "meldevordruck" | "nachrichtenvordruck";

export class TeilnehmerController {
    private view: TeilnehmerView;
    private firebaseService: FirebaseService;
    private uebungId: string | null = null;
    private teilnehmerId: string | null = null;
    private uebung: Uebung | null = null;
    private teilnehmerName: string | null = null;
    private storage: TeilnehmerStorage | null = null;
    private docMode: DocMode = "table";
    private docPage = 1;
    private currentDocUrl: string | null = null;
    private docRenderToken = 0;
    private docPageByMode: Record<DocMode, number> = {
        table: 1,
        meldevordruck: 1,
        nachrichtenvordruck: 1
    };
    private docBlobInFlight = new Map<DocMode, Set<number>>();
    private preloadToken = 0;

    constructor(db: Firestore) {
        this.view = new TeilnehmerView();
        this.firebaseService = new FirebaseService(db);
    }

    public async init() {
        const {params} = router.parseHash();
        this.uebungId = params[0] ?? null;
        this.teilnehmerId = params[1] ?? null;

        const contentEl = document.getElementById("teilnehmerContent");
        if (!contentEl) {
            return;
        }

        if (!this.uebungId || !this.teilnehmerId) {
            contentEl.innerHTML = "<div class=\"alert alert-danger\">Ungültiger Link.</div>";
            return;
        }

        this.uebung = await this.firebaseService.getUebung(this.uebungId);
        if (!this.uebung) {
            contentEl.innerHTML = "<div class=\"alert alert-warning\">Übung nicht gefunden.</div>";
            return;
        }

        store.setState({aktuelleUebung: this.uebung, aktuelleUebungId: this.uebungId});

        this.teilnehmerName = this.uebung.teilnehmerIds ? (this.uebung.teilnehmerIds[this.teilnehmerId] ?? null) : null;

        if (!this.teilnehmerName) {
            contentEl.innerHTML = "<div class=\"alert alert-danger\">Teilnehmer nicht in dieser Übung gefunden.</div>";
            return;
        }

        this.storage = loadTeilnehmerStorage(this.uebungId, this.teilnehmerName);

        // Initial Render
        this.view.renderHeader(this.uebung, this.teilnehmerName);
        this.renderNachrichten();
        this.view.setDocMode(this.docMode);

        // Bind Events
        this.view.bindEvents(
            (id, checked) => this.toggleUebertragen(id, checked),
            checked => this.toggleHide(checked),
            () => this.resetData(),
            mode => this.setDocMode(mode),
            () => this.changeDocPage(-1),
            () => this.changeDocPage(1),
            () => this.setDocMode("table"),
            () => this.toggleCurrentDocMessage(),
            () => this.downloadTeilnehmerZip()
        );
    }

    private renderNachrichten() {
        if (!this.uebung || !this.storage || !this.teilnehmerName) {
            return;
        }
        const nachrichten = this.uebung.nachrichten[this.teilnehmerName] || [];
        this.view.renderNachrichten(nachrichten, this.storage);
    }

    private toggleUebertragen(id: number, checked: boolean) {
        if (!this.storage) {
            return;
        }

        if (checked) {
            this.storage.nachrichten[id] = {
                uebertragen: true,
                uebertragenUm: new Date().toISOString()
            };
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete this.storage.nachrichten[id];
        }

        saveTeilnehmerStorage(this.storage);
        this.renderNachrichten();
    }

    private toggleHide(checked: boolean) {
        if (!this.storage) {
            return;
        }
        this.storage.hideTransmitted = checked;
        saveTeilnehmerStorage(this.storage);
        this.renderNachrichten();
        this.invalidateDocCache();
        if (this.docMode !== "table") {
            const total = this.getDocTotalPages();
            if (this.docPage > total) {
                this.docPage = total;
            }
            void this.renderDocPage();
        }
    }

    private resetData() {
        if (!this.uebungId || !this.teilnehmerName) {
            return;
        }
        if (confirm("Möchten Sie wirklich alle lokalen Daten für diese Übung löschen? Ihr Übertragungsstatus geht verloren.")) {
            clearTeilnehmerStorage(this.uebungId, this.teilnehmerName);
            this.revokeDocUrl();
            window.location.reload();
        }
    }

    private async setDocMode(mode: DocMode) {
        this.docPageByMode[this.docMode] = this.docPage;
        this.docMode = mode;
        this.docPage = this.docPageByMode[mode] || 1;
        this.view.setDocMode(mode);

        if (mode === "table") {
            return;
        }

        const total = this.getDocTotalPages();
        if (this.docPage > total) {
            this.docPage = total;
        }
        await this.renderDocPage();
        this.preloadPages(mode);
    }

    private getVisibleNachrichten(): Nachricht[] {
        if (!this.uebung || !this.storage || !this.teilnehmerName) {
            return [];
        }
        const all = this.uebung.nachrichten[this.teilnehmerName] || [];
        if (!this.storage.hideTransmitted) {
            return all;
        }
        return all.filter(n => !this.storage?.nachrichten[n.id]?.uebertragen);
    }

    private getDocTotalPages(): number {
        if (!this.uebung || !this.teilnehmerName) {
            return 1;
        }
        const visible = this.getVisibleNachrichten();
        return Math.max(1, visible.length);
    }

    private buildPreviewUebung(): FunkUebung | null {
        if (!this.uebung || !this.teilnehmerName) {
            return null;
        }
        const visible = this.getVisibleNachrichten();
        const preview = { ...this.uebung } as FunkUebung;
        preview.nachrichten = { ...this.uebung.nachrichten, [this.teilnehmerName]: visible };
        return preview;
    }

    private changeDocPage(step: number) {
        if (this.docMode === "table") {
            return;
        }
        const total = this.getDocTotalPages();
        if (!total) {
            return;
        }
        const next = this.docPage + step;
        if (next < 1 || next > total) {
            return;
        }
        this.docPage = next;
        void this.renderDocPage();
    }

    private async renderDocPage() {
        if (this.docMode === "table") {
            return;
        }
        if (!this.uebung || !this.teilnehmerName) {
            return;
        }
        const total = this.getDocTotalPages();
        const token = ++this.docRenderToken;
        const previewUebung = this.buildPreviewUebung();
        if (!previewUebung) {
            return;
        }

        const currentMsg = this.getVisibleNachrichten()[this.docPage - 1];
        const isTransmitted = !!currentMsg && !!this.storage?.nachrichten[currentMsg.id]?.uebertragen;
        this.view.setDocTransmitted(isTransmitted);

        let blob: Blob;
        if (this.docMode === "meldevordruck") {
            blob = await pdfGenerator.generateMeldevordruckPageBlob(previewUebung, this.teilnehmerName, this.docPage);
        } else {
            blob = await pdfGenerator.generateNachrichtenvordruckPageBlob(previewUebung, this.teilnehmerName, this.docPage);
        }

        if (token !== this.docRenderToken) {
            return;
        }

        this.revokeDocUrl();
        this.currentDocUrl = URL.createObjectURL(blob);
        await this.view.renderPdfPage(blob, this.docPage, total);
    }

    private toggleCurrentDocMessage() {
        if (!this.storage || !this.teilnehmerName) {
            return;
        }
        if (this.docMode === "table") {
            return;
        }
        if (this.docPage <= 1) {
            return;
        }
        const visible = this.getVisibleNachrichten();
        const msg = visible[this.docPage - 1];
        if (!msg) {
            return;
        }
        const current = !!this.storage.nachrichten[msg.id]?.uebertragen;
        if (current) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete this.storage.nachrichten[msg.id];
        } else {
            this.storage.nachrichten[msg.id] = {
                uebertragen: true,
                uebertragenUm: new Date().toISOString()
            };
        }
        saveTeilnehmerStorage(this.storage);
        this.renderNachrichten();
        this.invalidateDocCache();
        if (this.storage.hideTransmitted && !current) {
            const total = this.getDocTotalPages();
            if (this.docPage > total) {
                this.docPage = total;
            }
        }
        void this.renderDocPage();
    }

    private async downloadTeilnehmerZip() {
        if (!this.uebung || !this.teilnehmerName) {
            return;
        }

        const zipBlob = await pdfGenerator.generateTeilnehmerPDFsAsZip(this.uebung as FunkUebung, this.teilnehmerName);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = `${pdfGenerator.sanitizeFileName(this.teilnehmerName)}_${pdfGenerator.sanitizeFileName(this.uebung.name)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    private invalidateDocCache() {
        this.preloadToken += 1;
        this.docBlobInFlight.clear();
    }

    private preloadPages(mode: DocMode) {
        if (mode === "table") {
            return;
        }
        const previewUebung = this.buildPreviewUebung();
        if (!previewUebung || !this.teilnehmerName) {
            return;
        }
        const total = this.getDocTotalPages();
        const pages: number[] = [];
        if (this.docPage >= 1 && this.docPage <= total) {
            pages.push(this.docPage);
        }
        if (this.docPage + 1 <= total) {
            pages.push(this.docPage + 1);
        }
        if (this.docPage - 1 >= 1) {
            pages.push(this.docPage - 1);
        }
        for (let i = 1; i <= total; i++) {
            if (!pages.includes(i)) {
                pages.push(i);
            }
        }

        const token = ++this.preloadToken;
        const run = (index: number) => {
            if (token !== this.preloadToken) {
                return;
            }
            if (index >= pages.length) {
                return;
            }
            const page = pages[index];
            if (page === undefined) {
                setTimeout(() => run(index + 1), 0);
                return;
            }
            let inflight = this.docBlobInFlight.get(mode);
            if (!inflight) {
                inflight = new Set();
                this.docBlobInFlight.set(mode, inflight);
            }
            if (inflight.has(page)) {
                setTimeout(() => run(index + 1), 0);
                return;
            }
            inflight.add(page);
            const task = mode === "meldevordruck"
                ? pdfGenerator.generateMeldevordruckPageBlob(previewUebung, this.teilnehmerName as string, page)
                : pdfGenerator.generateNachrichtenvordruckPageBlob(previewUebung, this.teilnehmerName as string, page);
            task.then(() => {
                inflight?.delete(page);
            }).finally(() => {
                setTimeout(() => run(index + 1), 0);
            });
        };

        setTimeout(() => run(0), 0);
    }

    private revokeDocUrl() {
        if (this.currentDocUrl) {
            URL.revokeObjectURL(this.currentDocUrl);
            this.currentDocUrl = null;
        }
    }
}

export async function initTeilnehmer(db: Firestore): Promise<void> {
    const controller = new TeilnehmerController(db);
    await controller.init();

    // Make area visible
    const area = document.getElementById("teilnehmerArea");
    if (area) {
        area.style.display = "block";
    }
}
