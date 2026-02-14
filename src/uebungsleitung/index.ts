import { loadUebungsleitungStorage, saveUebungsleitungStorage } from "../services/storage";
import { UebungsleitungView } from "./UebungsleitungView";
import { FirebaseService } from "../services/FirebaseService";
import { store } from "../state/store";
import { router } from "../core/router";
import { UebungsleitungStorage } from "../types/Storage";
import type { Firestore } from "firebase/firestore";
import {FunkUebung} from "../models/FunkUebung";

interface FlattenedNachricht {
    nr: number;
    sender: string;
    empfaenger: string[];
    text: string;
}

export class UebungsleitungController {
    private view: UebungsleitungView;
    private firebaseService: FirebaseService;
    private uebungId: string | null = null;
    private uebung: FunkUebung | null = null;
    private storage: UebungsleitungStorage | null = null;
    
    // State for filters
    private hideAbgesetzt = false;
    private senderFilter = "";
    private empfaengerFilter = "";
    private showStaerkeDetails = false;

    constructor(db: Firestore) {
        this.view = new UebungsleitungView();
        this.firebaseService = new FirebaseService(db);
    }

    public async init() {
        const { params } = router.parseHash();
        this.uebungId = params[0] ?? null;

        if (!this.uebungId) {
            // Error handling via View? Or simple alert/console for now.
            console.error("Keine Übungs-ID");
            return;
        }

        this.uebung = await this.firebaseService.getUebung(this.uebungId);
        if (!this.uebung) {
            console.error("Übung nicht gefunden");
            return;
        }

        store.setState({ aktuelleUebung: this.uebung, aktuelleUebungId: this.uebungId });
        this.storage = loadUebungsleitungStorage(this.uebungId);
        this.updateFooterInfo();

        // Initial Render
        this.view.renderMeta(this.uebung, this.uebungId);
        this.renderTeilnehmer();
        this.renderNachrichten();

        // Bind Events
        this.view.bindMetaEvents(
            () => this.exportPdf(),
            () => this.resetData()
        );

        this.view.bindTeilnehmerEvents(
            name => this.markAngemeldet(name),
            (name, val) => this.updateLoesungswort(name, val),
            (name, idx, val) => this.updateStaerke(name, idx, val),
            (name, val) => this.updateNotiz(name, val),
            () => this.toggleStaerkeDetails()
        );

        this.view.bindNachrichtenEvents(
            (sender, nr) => this.markNachrichtAbgesetzt(sender, nr),
            (sender, nr) => this.resetNachricht(sender, nr),
            (sender, nr, val) => this.updateNachrichtNotiz(sender, nr, val),
            val => {
                this.senderFilter = val; this.renderNachrichten(); 
            },
            val => {
                this.empfaengerFilter = val; this.renderNachrichten(); 
            },
            val => {
                this.hideAbgesetzt = val; this.renderNachrichten(); 
            }
        );
    }

    private renderTeilnehmer() {
        if (!this.uebung || !this.storage) {
            return;
        }
        this.view.renderTeilnehmerListe(
            this.uebung, 
            this.storage.teilnehmer, 
            this.showStaerkeDetails
        );
    }

    private renderNachrichten() {
        if (!this.uebung || !this.storage) {
            return;
        }
        
        // Build flat list
        const nachrichten: FlattenedNachricht[] = [];
        Object.entries(this.uebung.nachrichten).forEach(([sender, msgs]) => {
            msgs.forEach(msg => {
                nachrichten.push({
                    nr: msg.id,
                    sender,
                    empfaenger: msg.empfaenger,
                    text: msg.nachricht
                });
            });
        });
        nachrichten.sort((a, b) => a.nr - b.nr);

        // Calculate Progress
        let done = 0;
        const storage = this.storage;
        if (!storage) {
            return;
        }
        nachrichten.forEach(n => {
            const key = `${n.sender}__${n.nr}`;
            if (storage.nachrichten[key]?.abgesetztUm) {
                done++;
            }
        });
        this.view.updateProgress(nachrichten.length, done);

        this.view.renderNachrichtenListe(
            nachrichten,
            storage.nachrichten,
            this.hideAbgesetzt,
            this.senderFilter,
            this.empfaengerFilter
        );
    }

    // --- Actions ---

    private markAngemeldet(name: string) {
        if (!this.storage) {
            return;
        }
        this.storage.teilnehmer[name] = this.storage.teilnehmer[name] || {};
        this.storage.teilnehmer[name].angemeldetUm = new Date().toISOString();
        this.save();
        this.renderTeilnehmer();
    }

    private updateLoesungswort(name: string, val: string) {
        if (!this.storage) {
            return;
        }
        this.storage.teilnehmer[name] = this.storage.teilnehmer[name] || {};
        this.storage.teilnehmer[name].loesungswortGesendet = val;
        this.save();
    }

    private updateStaerke(name: string, idx: number, val: string) {
        if (!this.storage) {
            return;
        }
        this.storage.teilnehmer[name] = this.storage.teilnehmer[name] || {};
        this.storage.teilnehmer[name].teilstaerken = this.storage.teilnehmer[name].teilstaerken || [];
        this.storage.teilnehmer[name].teilstaerken[idx] = val;
        this.save();
    }

    private updateNotiz(name: string, val: string) {
        if (!this.storage) {
            return;
        }
        this.storage.teilnehmer[name] = this.storage.teilnehmer[name] || {};
        this.storage.teilnehmer[name].notizen = val;
        this.save();
    }

    private toggleStaerkeDetails() {
        this.showStaerkeDetails = !this.showStaerkeDetails;
        this.renderTeilnehmer();
    }

    private markNachrichtAbgesetzt(sender: string, nr: number) {
        if (!this.storage) {
            return;
        }
        const key = `${sender}__${nr}`;
        this.storage.nachrichten[key] = this.storage.nachrichten[key] || {};
        this.storage.nachrichten[key].abgesetztUm = new Date().toISOString();
        this.save();
        this.renderNachrichten();
    }

    private resetNachricht(sender: string, nr: number) {
        if (!this.storage) {
            return;
        }
        const key = `${sender}__${nr}`;
        if (this.storage.nachrichten[key]) {
            delete this.storage.nachrichten[key].abgesetztUm;
        }
        this.save();
        this.renderNachrichten();
    }

    private updateNachrichtNotiz(sender: string, nr: number, val: string) {
        if (!this.storage) {
            return;
        }
        const key = `${sender}__${nr}`;
        this.storage.nachrichten[key] = this.storage.nachrichten[key] || {};
        this.storage.nachrichten[key].notiz = val;
        this.save();
    }

    private async exportPdf() {
        if (!this.uebung || !this.storage) {
            return;
        }
        
        try {
            const { jsPDF } = await import("jspdf");
            const { Uebungsleitung } = await import("../pdf/Uebungsleitung");

            const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            const pdfDoc = new Uebungsleitung(this.uebung, pdf, this.storage);
            pdfDoc.draw();
            
            const filename = `Uebungsleitung_${this.uebung.name}_${this.uebung.id}.pdf`.replace(/\s+/g, "_");
            pdf.save(filename);
        } catch (err) {
            console.error(err);
            alert("Fehler beim PDF Export");
        }
    }

    private resetData() {
        if (!confirm("Wirklich alle lokalen Daten zurücksetzen?")) {
            return;
        }
        if (this.uebungId) {
            localStorage.removeItem(`sprechfunk:uebungsleitung:${this.uebungId}`);
            window.location.reload();
        }
    }

    private save() {
        if (this.storage) {
            saveUebungsleitungStorage(this.storage);
        }
    }

    private updateFooterInfo() {
        if (!this.uebung) {
            return;
        }
        const idEl = document.getElementById("uebungsId");
        if (idEl) {
            idEl.textContent = this.uebung.id || "-";
        }
    }
}

export async function initUebungsleitung(db: Firestore): Promise<void> {
    const controller = new UebungsleitungController(db);
    await controller.init();
    
    // Make area visible
    const area = document.getElementById("uebungsleitungArea");
    if (area) {
        area.style.display = "block";
    }
}
