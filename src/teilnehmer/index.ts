import type {Firestore} from "firebase/firestore";
import {loadTeilnehmerStorage, saveTeilnehmerStorage, clearTeilnehmerStorage} from "../services/storage";
import {TeilnehmerView} from "./TeilnehmerView";
import {FirebaseService} from "../services/FirebaseService";
import {store} from "../state/store";
import {router} from "../core/router";
import {Uebung} from "../types/Uebung";
import {TeilnehmerStorage} from "../types/Storage";

export class TeilnehmerController {
    private view: TeilnehmerView;
    private firebaseService: FirebaseService;
    private uebungId: string | null = null;
    private teilnehmerId: string | null = null;
    private uebung: Uebung | null = null;
    private teilnehmerName: string | null = null;
    private storage: TeilnehmerStorage | null = null;

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

        // Bind Events
        this.view.bindEvents(
            (id, checked) => this.toggleUebertragen(id, checked),
            checked => this.toggleHide(checked),
            () => this.resetData()
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
    }

    private resetData() {
        if (!this.uebungId || !this.teilnehmerName) {
            return;
        }
        if (confirm("Möchten Sie wirklich alle lokalen Daten für diese Übung löschen? Ihr Übertragungsstatus geht verloren.")) {
            clearTeilnehmerStorage(this.uebungId, this.teilnehmerName);
            window.location.reload();
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
