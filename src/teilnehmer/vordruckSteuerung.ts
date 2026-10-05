import { saveTeilnehmerStorage } from "../services/storage";
import { TeilnehmerStorage } from "../types/Storage";
import { ladePdfGenerator } from "../services/pdfGeneratorLazy";
import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";
import { uiFeedback } from "../core/UiFeedback";
import { TeilnehmerControllerBasis } from "./controllerBasis";
import type { DocMode } from "./teilnehmerEvents";

type NachrichtenEintrag = TeilnehmerStorage["nachrichten"][string] | undefined;

/** Reihenfolge fürs Vorladen: aktuelle Seite, die Nachbarn, dann der Rest. */
export function preloadReihenfolge(docPage: number, total: number): number[] {
    const pages: number[] = [];
    if (docPage >= 1 && docPage <= total) {
        pages.push(docPage);
    }
    if (docPage + 1 <= total) {
        pages.push(docPage + 1);
    }
    if (docPage - 1 >= 1) {
        pages.push(docPage - 1);
    }
    for (let i = 1; i <= total; i++) {
        if (!pages.includes(i)) {
            pages.push(i);
        }
    }
    return pages;
}

/**
 * Statuswechsel, Rückgängig und das Vordruck-Fenster (Melde- und
 * Nachrichtenvordruck mit Blättern, Vorladen und Verlaufseintrag).
 */
export abstract class TeilnehmerVordruckSteuerung extends TeilnehmerControllerBasis {
    /**
     * Das Vordruck-Fenster ist ein eigener Schritt im Verlauf: „Zurück“ am
     * Handy schließt es, statt die Teilnehmeransicht zu verlassen. Der
     * Eintrag hat dieselbe Adresse, der Hash-Router bemerkt ihn nicht.
     */
    private vordruckImVerlauf = false;
    private popstateGebunden = false;

    protected toggleUebertragen(id: number, checked: boolean) {
        if (!this.storage) {
            return;
        }
        const vorher = this.storage.nachrichten[id];
        this.setUebertragen(id, checked);
        this.renderNachrichten();
        this.bieteRueckgaengigAn(id, checked, vorher);
    }

    /**
     * Jeder Statuswechsel bekommt einige Sekunden lang ein „Rückgängig“.
     * Wichtig vor allem bei „Abgesetzte ausblenden“ und im Fokus-Modus: dort
     * verschwindet der Spruch nach dem Tipp aus dem Blick.
     */
    protected bieteRueckgaengigAn(id: number, abgesetzt: boolean, vorher: NachrichtenEintrag): void {
        const text = abgesetzt
            ? `Spruch ${id} als abgesetzt markiert.`
            : `Spruch ${id} wieder offen.`;
        this.view.zeigeRueckgaengig(text, () => this.stelleWiederHer(id, vorher));
    }

    /**
     * Stellt den Eintrag vor dem letzten Wechsel wieder her, samt der
     * ursprünglichen Absetzzeit. geaendertUm ist neu, damit der Live-Sync
     * die Wiederherstellung nicht durch den eben gesendeten Stand ersetzt.
     */
    private stelleWiederHer(id: number, vorher: NachrichtenEintrag): void {
        if (!this.storage) {
            return;
        }
        const now = new Date().toISOString();
        this.storage.nachrichten[id] = vorher?.uebertragen
            ? { uebertragen: true, uebertragenUm: vorher.uebertragenUm ?? now, geaendertUm: now }
            : { uebertragen: false, geaendertUm: now };
        saveTeilnehmerStorage(this.storage);
        this.publishStatus();
        this.renderNachrichten();
        if (this.docMode !== "table") {
            this.invalidateDocCache();
            void this.renderDocPage();
        }
    }

    /** Hält die Vordruckseite nach Schrumpfen der sichtbaren Liste im gültigen Bereich. */
    private begrenzeDocPage(): void {
        const total = this.getDocTotalPages();
        if (this.docPage > total) {
            this.docPage = total;
        }
    }

    protected toggleHide(checked: boolean) {
        if (!this.storage) {
            return;
        }
        this.storage.hideTransmitted = checked;
        saveTeilnehmerStorage(this.storage);
        this.renderNachrichten();
        this.invalidateDocCache();
        if (this.docMode !== "table") {
            this.begrenzeDocPage();
            void this.renderDocPage();
        }
    }

    private bindePopstate(): void {
        if (this.popstateGebunden || typeof window.addEventListener !== "function") {
            return;
        }
        this.popstateGebunden = true;
        window.addEventListener("popstate", () => {
            if (this.vordruckImVerlauf) {
                this.vordruckImVerlauf = false;
                if (this.docMode !== "table") {
                    void this.setDocMode("table", true);
                }
            }
        });
    }

    private merkeVordruckImVerlauf(oeffnen: boolean): void {
        const hist = typeof window !== "undefined" ? window.history : undefined;
        if (!hist || typeof hist.pushState !== "function") {
            return;
        }
        this.bindePopstate();
        if (oeffnen && !this.vordruckImVerlauf) {
            hist.pushState({ teilnehmerVordruck: true }, "");
            this.vordruckImVerlauf = true;
        } else if (!oeffnen && this.vordruckImVerlauf) {
            this.vordruckImVerlauf = false;
            hist.back();
        }
    }

    protected async setDocMode(mode: DocMode, ausVerlauf = false) {
        if (mode === "table" && this.docMode === "table") {
            return;
        }
        if (!ausVerlauf) {
            this.merkeVordruckImVerlauf(mode !== "table");
        }
        this.docPageByMode[this.docMode] = this.docPage;
        this.docMode = mode;
        this.docPage = this.docPageByMode[mode] || 1;
        this.view.setDocMode(mode);

        if (mode === "table") {
            return;
        }

        this.begrenzeDocPage();
        await this.renderDocPage();
        this.preloadPages(mode);
    }

    protected changeDocPage(step: number) {
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

    protected async renderDocPage() {
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
        this.view.setDocTransmitted(isTransmitted, !!currentMsg);

        const blob = await this.getDocBlob(previewUebung, this.docMode, this.docPage);

        if (token !== this.docRenderToken) {
            return;
        }

        this.revokeDocUrl();
        this.currentDocUrl = URL.createObjectURL(blob);
        await this.view.renderPdfPage(blob, this.docPage, total);
    }

    protected toggleCurrentDocMessage() {
        const msg = this.getCurrentDocMessage();
        if (!msg || !this.storage) {
            return;
        }
        const vorher = this.storage.nachrichten[msg.id];
        const current = !!vorher?.uebertragen;
        this.setUebertragen(msg.id, !current);
        this.bieteRueckgaengigAn(msg.id, !current, vorher);
        this.renderNachrichten();
        this.invalidateDocCache();
        if (this.storage.hideTransmitted && !current) {
            this.begrenzeDocPage();
        }
        void this.renderDocPage();
    }

    private getCurrentDocMessage(): Nachricht | null {
        if (!this.storage || !this.teilnehmerName) {
            return null;
        }
        // Seite 1 ist Spruch 1 — früher stand hier "<= 1", wodurch sich der
        // erste Spruch im Vordruck nicht abhaken ließ.
        if (this.docMode === "table" || this.docPage < 1) {
            return null;
        }
        const visible = this.getVisibleNachrichten();
        return visible[this.docPage - 1] ?? null;
    }

    protected async downloadTeilnehmerZip() {
        if (!this.uebung || !this.teilnehmerName) {
            return;
        }

        try {
            const pdfGenerator = await ladePdfGenerator();
            const zipBlob = await pdfGenerator.generateTeilnehmerPDFsAsZip(this.uebung as FunkUebung, this.teilnehmerName);
            const link = document.createElement("a");
            link.href = URL.createObjectURL(zipBlob);
            link.download = `${pdfGenerator.sanitizeFileName(this.teilnehmerName)}_${pdfGenerator.sanitizeFileName(this.uebung.name)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            uiFeedback.success("ZIP wurde heruntergeladen.");
        } catch {
            uiFeedback.error("ZIP konnte nicht erstellt werden.");
        }
    }

    protected preloadPages(mode: DocMode) {
        if (mode === "table") {
            return;
        }
        const previewUebung = this.buildPreviewUebung();
        if (!previewUebung || !this.teilnehmerName) {
            return;
        }
        const pages = preloadReihenfolge(this.docPage, this.getDocTotalPages());
        const token = ++this.preloadToken;
        const run = (index: number) => {
            if (token !== this.preloadToken || index >= pages.length) {
                return;
            }
            const weiter = () => setTimeout(() => run(index + 1), 0);
            const page = pages[index];
            if (page === undefined) {
                weiter();
                return;
            }
            const inflight = this.inFlightFuer(mode);
            if (inflight.has(page)) {
                weiter();
                return;
            }
            inflight.add(page);
            this.getDocBlob(previewUebung, mode, page).then(() => {
                inflight.delete(page);
            }).finally(weiter);
        };

        setTimeout(() => run(0), 0);
    }

    private inFlightFuer(mode: DocMode): Set<number> {
        let inflight = this.docBlobInFlight.get(mode);
        if (!inflight) {
            inflight = new Set();
            this.docBlobInFlight.set(mode, inflight);
        }
        return inflight;
    }
}
