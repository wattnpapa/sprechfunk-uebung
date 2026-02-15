import { FunkUebung } from "../models/FunkUebung";
import { store } from "../state/store";
import { FirebaseService } from "../services/FirebaseService";
import { GenerationService } from "../services/GenerationService";
import { GeneratorView } from "./GeneratorView";
import { GeneratorStateService, type LoesungswortOption } from "./GeneratorStateService";
import { GeneratorStatsService } from "./GeneratorStatsService";
import { GeneratorPreviewService } from "./GeneratorPreviewService";
import pdfGenerator from "../services/pdfGenerator";
import { Chart, registerables } from "chart.js";
import { uiFeedback } from "../core/UiFeedback";
import { analytics } from "../services/analytics";

Chart.register(...registerables);

export class GeneratorController {
    private static instance: GeneratorController;
    
    public funkUebung!: FunkUebung;
    private predefinedLoesungswoerter: string[] = [];
    private templatesFunksprueche: Record<string, { text: string; filename: string }> = {};
    private showStellenname = false;
    private firebaseService: FirebaseService;
    private generationService: GenerationService;
    private stateService: GeneratorStateService;
    private statsService: GeneratorStatsService;
    private previewService: GeneratorPreviewService;
    private view: GeneratorView;
    private buildInfo = "dev";
    private initialConfigFingerprint = "";
    private isFreshExercise = true;

    public static getInstance(): GeneratorController {
        if (!GeneratorController.instance) {
            GeneratorController.instance = new GeneratorController();
        }
        return GeneratorController.instance;
    }

    private constructor() {
        const db = store.getState().db;
        if (!db) {
            throw new Error("DB not initialized");
        }
        this.firebaseService = new FirebaseService(db);
        this.generationService = new GenerationService();
        this.stateService = new GeneratorStateService();
        this.statsService = new GeneratorStatsService();
        this.previewService = new GeneratorPreviewService();
        this.view = new GeneratorView();
        
        this.predefinedLoesungswoerter = [
            "Funkverkehr", "Rettungswagen", "Notruf", "Blaulicht", "Funkdisziplin",
            "Einsatzleitung", "Mikrofon", "Durchsage", "Sprechgruppe", "Digitalfunk",
            "Frequenz", "Funkstille", "Antennenmast", "Feuerwehr", "Katastrophenschutz",
            "Alarmierung", "Fernmelder", "Kommunikation", "Verständigung", "Sicherheitszone",
            "Einsatzplan", "Koordination", "Funkgerät", "Signalstärke", "Verbindung",
            "Repeater", "Einsatzbesprechung", "Lautstärke", "Funkkanal", "Empfang",
            "Relaisstation", "Funkraum", "Gruppenruf", "Rückmeldung", "Einsatzgebiet",
            "Wellenlänge", "Übertragung", "Ausfallsicherheit", "Rescue", "Einsatzwagen"
        ].map(word => word.toUpperCase());

        this.templatesFunksprueche = {
            thwleer: { text: "Funksprüche THW Leer", filename: "assets/funksprueche/nachrichten_thw_leer.txt" },
            thwmelle: { text: "Funksprüche THW Melle", filename: "assets/funksprueche/nachrichten_thw_melle.txt" },
            thwessen: { text: "Funksprüche THW Essen", filename: "assets/funksprueche/nachrichten_thw_essen.txt" },
            thwlehrte: { text: "Funksprüche THW Lehrte", filename: "assets/funksprueche/nachrichten_thw_lehrte.txt" },
            vorlageLustig: { text: "Lustige Funksprüche (Chat GPT)", filename: "assets/funksprueche/funksprueche_lustig_kreativ.txt" }
        };

        this.fetchBuildInfo();
        // Initial placeholder
        this.funkUebung = new FunkUebung(this.buildInfo);
    }

    private async fetchBuildInfo() {
        try {
            const res = await fetch("build.json");
            const data = await res.json();
            this.buildInfo = data.buildDate + "-" + data.runNumber + "-" + data.commit;
        } catch {
            // console.warn("⚠️ Build-Info nicht gefunden, setze 'dev'");
        }
    }

    public async handleRoute(params: string[]) {
        const uebungId = params.length >= 1 ? (params[0] ?? null) : null;
        const uebung = await this.loadUebung(uebungId);
        this.funkUebung = uebung;
        this.isFreshExercise = !uebungId;
        this.initialConfigFingerprint = this.createConfigFingerprint(this.funkUebung);
        this.updateUI();
    }

    private updateUI() {
        this.view.render(); // RENDER FIRST!
        this.view.resetBindings();
        this.bindEvents();

        this.applyUebungToView();
        this.renderTeilnehmer();
        this.renderResultIfAvailable();
    }

    private bindEvents() {
        this.view.bindDistributionInputs(data => {
            Object.assign(this.funkUebung, data);
        });
        this.view.bindSourceToggle();
        this.view.bindLoesungswortOptionChange(() => {
            this.view.updateLoesungswortOptionUI();
            const option = this.view.getSelectedLoesungswortOption();
            if (option === "none") {
                this.stateService.resetLoesungswoerter(this.funkUebung);
                this.renderTeilnehmer(false);
                return;
            }
            this.shuffleLoesungswoerter();
        });
        this.view.bindTeilnehmerEvents(
            (index, newVal) => this.updateTeilnehmerName(index, newVal),
            (teilnehmer, newVal) => this.updateTeilnehmerStelle(teilnehmer, newVal),
            index => this.removeTeilnehmer(index),
            checked => {
                this.showStellenname = checked;
                this.renderTeilnehmer(false);
            }
        );
        this.view.bindAnmeldungToggle(checked => {
            this.funkUebung.anmeldungAktiv = checked;
        });
        this.view.bindPrimaryActions({
            onAddTeilnehmer: () => this.addTeilnehmer(),
            onStartUebung: () => this.startUebung(),
            onChangePage: (step: number) => this.changePage(step),
            onCopyJson: () => this.copyJSONToClipboard(),
            onZipAllPdfs: async () => {
                await pdfGenerator.generateAllPDFsAsZip(this.funkUebung);
                analytics.track("download_all_pdfs_zip", {
                    teilnehmer_count: this.funkUebung.teilnehmerListe.length
                });
            }
        });
    }

    private async loadUebung(uebungId: string | null): Promise<FunkUebung> {
        if (uebungId) {
            if (this.funkUebung && this.funkUebung.id === uebungId) {
                return this.funkUebung;
            }
            const uebung = await this.firebaseService.getUebung(uebungId);
            if (uebung) {
                const loaded = Object.assign(new FunkUebung(this.buildInfo), uebung);
                if (!loaded.teilnehmerStellen) {
                    loaded.teilnehmerStellen = {};
                }
                return loaded;
            }
        }
        return new FunkUebung(this.buildInfo);
    }

    private applyUebungToView() {
        this.funkUebung.buildVersion = this.buildInfo;
        this.view.setVersionInfo(this.funkUebung.id, this.buildInfo);
        this.view.populateTemplateSelect(this.templatesFunksprueche, this.funkUebung.verwendeteVorlagen);
        this.view.setFormData(this.funkUebung);
        this.view.toggleSourceView("vorlagen");
    }

    private renderResultIfAvailable() {
        if (this.funkUebung.nachrichten && Object.keys(this.funkUebung.nachrichten).length > 0) {
            this.renderUebungResult();
        }
    }

    // --- Logic Methods ---

    renderTeilnehmer(triggerShuffle = true) {
        if (!this.showStellenname && this.funkUebung.teilnehmerStellen && Object.keys(this.funkUebung.teilnehmerStellen).length > 0) {
            this.showStellenname = true;
        }

        this.view.renderTeilnehmerSection(
            this.funkUebung.teilnehmerListe,
            this.funkUebung.teilnehmerStellen || {},
            this.funkUebung.loesungswoerter || {},
            this.showStellenname
        );

        if (triggerShuffle) {
            this.shuffleLoesungswoerter();
        }
    }

    updateTeilnehmerName(index: number, newName: string) {
        this.stateService.updateTeilnehmerName(this.funkUebung, index, newName);
    }

    updateTeilnehmerStelle(teilnehmer: string, stelle: string) {
        this.stateService.updateTeilnehmerStelle(this.funkUebung, teilnehmer, stelle);
    }

    addTeilnehmer() {
        this.stateService.addTeilnehmer(this.funkUebung);
        this.renderTeilnehmer();
        analytics.track("generator_add_teilnehmer", {
            teilnehmer_count: this.funkUebung.teilnehmerListe.length
        });
    }

    removeTeilnehmer(index: number) {
        this.stateService.removeTeilnehmer(this.funkUebung, index);
        this.renderTeilnehmer();
        analytics.track("generator_remove_teilnehmer", {
            teilnehmer_count: this.funkUebung.teilnehmerListe.length
        });
    }

    shuffleLoesungswoerter() {
        const option: LoesungswortOption = this.view.getSelectedLoesungswortOption();
        const result = this.stateService.shuffleLoesungswoerter(
            this.funkUebung,
            option,
            this.predefinedLoesungswoerter
        );
        if (result.error) {
            uiFeedback.error(result.error);
            return;
        }
        if (result.centralWord !== undefined) {
            const input = document.getElementById("zentralLoesungswortInput") as HTMLInputElement | null;
            if (input) {
                input.value = result.centralWord;
            }
        }
        this.renderTeilnehmer(false);
    }

    readLoesungswoerterFromView() {
        const option: LoesungswortOption = this.view.getSelectedLoesungswortOption();
        this.stateService.resetLoesungswoerter(this.funkUebung);
        
        if (option === "central") {
            const val = this.view.getZentralesLoesungswort().trim().toUpperCase();
            this.stateService.setZentralesLoesungswort(this.funkUebung, val);
        } else if (option === "individual") {
            const woerter: string[] = [];
            this.funkUebung.teilnehmerListe.forEach((_, i) => {
                const input = document.getElementById(`loesungswort-${i}`) as HTMLInputElement | null;
                if (input) {
                    woerter.push(input.value.trim().toUpperCase());
                }
            });
            this.stateService.setIndividuelleLoesungswoerter(this.funkUebung, woerter);
        }
    }

    async startUebung() {
        if (this.funkUebung.nachrichten && Object.keys(this.funkUebung.nachrichten).length > 0) {
            if (!uiFeedback.confirm("Übung neu generieren? Bestehende Nachrichten gehen verloren.")) {
                return;
            }
        }

        // 1. Daten aus View übernehmen
        const formData = this.view.getFormData();
        Object.assign(this.funkUebung, formData);
        this.readLoesungswoerterFromView();
        this.funkUebung.istStandardKonfiguration =
            this.isFreshExercise && this.createConfigFingerprint(this.funkUebung) === this.initialConfigFingerprint;

        if (!this.validateSpruchVerteilung()) {
            return;
        }

        // 2. Funksprüche laden
        const source = this.view.getSelectedSource();
        if (source === "vorlagen") {
            const selected = this.view.getSelectedTemplates();
            if (selected.length === 0) {
                uiFeedback.error("Bitte Vorlage wählen");
                return;
            }
            this.funkUebung.verwendeteVorlagen = selected;
            
            const missing = selected.filter(k => !this.templatesFunksprueche[k]);
            if (missing.length > 0) {
                uiFeedback.error("Mindestens eine Vorlage ist nicht verfügbar. Bitte Auswahl prüfen.");
                return;
            }
            const promises = selected.map(k => {
                const template = this.templatesFunksprueche[k];
                if (!template) {
                    throw new Error(`Template nicht gefunden: ${k}`);
                }
                return fetch(template.filename).then(r => r.text());
            });
            try {
                const texts = await Promise.all(promises);
                this.funkUebung.funksprueche = texts
                    .flatMap(t => t.split("\n").filter(s => s.trim() !== ""))
                    .sort(() => Math.random() - 0.5);
            } catch (e) {
                console.error(e);
                return;
            }
        } else {
            const file = this.view.getUploadedFile();
            if (!file) {
                uiFeedback.error("Datei wählen");
                return;
            }
            const text = await file.text();
            this.funkUebung.funksprueche = text
                .normalize("NFKC")
                .split("\n")
                .filter(s => s.trim() !== "");
        }

        // 3. Generieren
        this.generationService.generate(this.funkUebung);
        
        // 4. Speichern
        await this.firebaseService.saveUebung(this.funkUebung);
        analytics.track("generator_start_uebung", {
            teilnehmer_count: this.funkUebung.teilnehmerListe.length,
            sprueche_pro_teilnehmer: this.funkUebung.spruecheProTeilnehmer
        });
        
        // 5. Anzeigen
        this.renderUebungResult();
    }

    renderUebungResult() {
        const allMsgs = Object.values(this.funkUebung.nachrichten).flat();
        const stats = this.statsService.berechneUebungsdauer(allMsgs);
        const chart = this.statsService.berechneVerteilung(this.funkUebung);

        this.view.renderUebungResult(this.funkUebung, stats, chart);
    }

    displayPage(index: number) {
        this.view.renderPreviewPage(this.previewService.getAt(index));
    }

    changePage(step: number) {
        this.view.renderPreviewPage(this.previewService.change(step));
    }

    copyJSONToClipboard() {
        const json = this.funkUebung.toJson();
        this.view.copyJsonToClipboard(json);
        analytics.track("generator_copy_json");
    }

    private validateSpruchVerteilung(): boolean {
        const anmeldungOffset = this.funkUebung.anmeldungAktiv ? 1 : 0;
        const minRequired = anmeldungOffset + this.funkUebung.spruecheAnAlle + this.funkUebung.spruecheAnMehrere;
        if (this.funkUebung.spruecheProTeilnehmer < minRequired) {
            uiFeedback.error("Ungültige Verteilung: 'Sprüche pro Teilnehmer' ist kleiner als die Summe aus Anmeldung + An Alle + An Mehrere.");
            return false;
        }
        if (this.funkUebung.spruecheProTeilnehmer < anmeldungOffset) {
            uiFeedback.error("Ungültige Verteilung: 'Sprüche pro Teilnehmer' darf nicht kleiner als die Anmelde-Nachricht sein.");
            return false;
        }
        return true;
    }

    private createConfigFingerprint(uebung: FunkUebung): string {
        const date = new Date(uebung.datum);
        const dateOnly = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        return JSON.stringify({
            name: uebung.name,
            datum: dateOnly,
            rufgruppe: uebung.rufgruppe,
            leitung: uebung.leitung,
            teilnehmerListe: uebung.teilnehmerListe,
            teilnehmerStellen: uebung.teilnehmerStellen || {},
            spruecheProTeilnehmer: uebung.spruecheProTeilnehmer,
            spruecheAnAlle: uebung.spruecheAnAlle,
            spruecheAnMehrere: uebung.spruecheAnMehrere,
            buchstabierenAn: uebung.buchstabierenAn,
            anmeldungAktiv: uebung.anmeldungAktiv,
            loesungswoerter: uebung.loesungswoerter || {},
            loesungsStaerken: uebung.loesungsStaerken || {}
        });
    }

}
