import { FunkUebung } from "../models/FunkUebung";
import { store } from "../state/store";
import { UebungHTMLGenerator } from "../services/UebungHTMLGenerator";
import type { Nachricht } from "../types/Nachricht";
import { FirebaseService } from "../services/FirebaseService";
import { GenerationService } from "../services/GenerationService";
import { GeneratorView } from "./GeneratorView";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

export class GeneratorController {
    private static instance: GeneratorController;
    
    public funkUebung!: FunkUebung;
    private predefinedLoesungswoerter: string[] = [];
    private templatesFunksprueche: Record<string, { text: string; filename: string }> = {};
    private htmlSeitenTeilnehmer: string[] = [];
    private currentPageIndex = 0;
    private showStellenname = false;
    private firebaseService: FirebaseService;
    private generationService: GenerationService;
    private view: GeneratorView;
    private buildInfo = "dev";

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
        this.bindEvents();
        this.exposeToWindow();
        
        // Initial placeholder
        this.funkUebung = new FunkUebung(this.buildInfo);
    }

    private async fetchBuildInfo() {
        try {
            const res = await fetch("build.json");
            const data = await res.json();
            this.buildInfo = data.buildDate + "-" + data.runNumber + "-" + data.commit;
            this.view.setVersionInfo(this.funkUebung?.id || "-", this.buildInfo);
            if(this.funkUebung) {
                this.funkUebung.buildVersion = this.buildInfo;
            }
        } catch {
            // console.warn("⚠️ Build-Info nicht gefunden, setze 'dev'");
        }
    }

    public async handleRoute(params: string[]) {
        let uebungId: string | null = null;
        if (params.length >= 1) {
            uebungId = params[0] ?? null;
        }

        if (uebungId) {
            if (this.funkUebung && this.funkUebung.id === uebungId) {
                this.updateUI();
                return;
            }

            const uebung = await this.firebaseService.getUebung(uebungId);
            if (uebung) {
                this.funkUebung = Object.assign(new FunkUebung(this.buildInfo), uebung);
                if (!this.funkUebung.teilnehmerStellen) {
                    this.funkUebung.teilnehmerStellen = {};
                }
                //console.log("📦 Übung aus Datenbank geladen:", this.funkUebung.id);
            } else {
                // console.warn("⚠️ Keine Übung mit dieser ID gefunden. Neue Übung wird erstellt.");
                this.funkUebung = new FunkUebung(this.buildInfo);
            }
        } else {
            this.funkUebung = new FunkUebung(this.buildInfo);
        }

        this.updateUI();
    }

    private updateUI() {
        this.view.render(); // RENDER FIRST!

        this.view.setVersionInfo(this.funkUebung.id, this.buildInfo);
        this.funkUebung.buildVersion = this.buildInfo;
        
        this.view.populateTemplateSelect(this.templatesFunksprueche, this.funkUebung.verwendeteVorlagen);
        this.view.setFormData(this.funkUebung);
        this.view.toggleSourceView("vorlagen"); 

        this.renderTeilnehmer();
        
        if (this.funkUebung.nachrichten && Object.keys(this.funkUebung.nachrichten).length > 0) {
            this.renderUebungResult();
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).app.funkUebung = this.funkUebung;
    }

    private bindEvents() {
        // Input changes for distribution
        const inputs = ["spruecheProTeilnehmer", "prozentAnAlle", "prozentAnMehrere", "prozentAnBuchstabieren"];
        inputs.forEach(id => {
            document.getElementById(id)?.addEventListener("input", () => {
                const data = this.view.getFormData();
                Object.assign(this.funkUebung, data);
                this.view.updateDistributionInputs(this.funkUebung);
            });
        });

        document.getElementById("optionVorlagen")?.addEventListener("change", () => this.view.toggleSourceView("vorlagen"));
        document.getElementById("optionUpload")?.addEventListener("change", () => this.view.toggleSourceView("upload"));

        document.getElementById("showStellennameCheckbox")?.addEventListener("change", e => {
            this.showStellenname = (e.target as HTMLInputElement).checked;
            this.renderTeilnehmer(false);
        });
        
        document.querySelectorAll("input[name=\"loesungswortOption\"]").forEach(el => {
            el.addEventListener("change", () => {
                this.view.setLoesungswortUI(this.funkUebung.loesungswoerter); 
                this.renderTeilnehmer(false);
            });
        });

        const container = document.getElementById("teilnehmer-container");
        if (container) {
            container.addEventListener("input", e => {
                const target = e.target as HTMLElement;
                if (target.classList.contains("teilnehmer-input")) {
                    const index = Number(target.dataset["index"]);
                    const newVal = (target as HTMLInputElement).value;
                    this.updateTeilnehmerName(index, newVal);
                }
                if (target.classList.contains("stellenname-input")) {
                    const teilnehmer = decodeURIComponent(target.getAttribute("data-teilnehmer") || "");
                    const newVal = (target as HTMLInputElement).value;
                    this.updateTeilnehmerStelle(teilnehmer, newVal);
                }
            });

            container.addEventListener("click", e => {
                const target = e.target as HTMLElement;
                const btn = target.closest(".delete-teilnehmer") as HTMLElement;
                if (btn) {
                    const index = Number(btn.dataset["index"]);
                    this.removeTeilnehmer(index);
                }
            });
            
            container.addEventListener("change", e => {
                const target = e.target as HTMLInputElement;
                if (target.id === "showStellennameCheckbox") {
                    this.showStellenname = target.checked;
                    this.renderTeilnehmer(false);
                }
            });
        }
        
        document.getElementById("anmeldungAktiv")?.addEventListener("change", e => {
            const target = e.target as HTMLInputElement;
            this.funkUebung.anmeldungAktiv = target.checked;
        });
    }

    private exposeToWindow() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const app = (window as any).app || {};
        
        app.startUebung = () => this.startUebung();
        app.addTeilnehmer = () => this.addTeilnehmer();
        app.shuffleLoesungswoerter = () => this.shuffleLoesungswoerter();
        app.renderTeilnehmer = () => this.renderTeilnehmer();
        app.calcMsgCount = () => { /* handled by input event now */ };
        app.changePage = (step: number) => this.changePage(step);
        app.copyJSONToClipboard = () => this.copyJSONToClipboard();
        app.funkUebung = this.funkUebung;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).app = app;
    }

    // --- Logic Methods ---

    renderTeilnehmer(triggerShuffle = true) {
        if (!this.showStellenname && this.funkUebung.teilnehmerStellen && Object.keys(this.funkUebung.teilnehmerStellen).length > 0) {
            this.showStellenname = true;
        }

        this.view.renderTeilnehmerListe(
            this.funkUebung.teilnehmerListe,
            this.funkUebung.teilnehmerStellen || {},
            this.funkUebung.loesungswoerter || {},
            this.showStellenname
        );
        
        this.view.setLoesungswortUI(this.funkUebung.loesungswoerter);

        if (triggerShuffle) {
            this.shuffleLoesungswoerter();
        }
    }

    updateTeilnehmerName(index: number, newName: string) {
        const oldName = this.funkUebung.teilnehmerListe[index];
        if (!oldName) {
            return;
        }
        if (oldName !== newName) {
            if (this.funkUebung.teilnehmerStellen && this.funkUebung.teilnehmerStellen[oldName] !== undefined) {
                this.funkUebung.teilnehmerStellen[newName] = this.funkUebung.teilnehmerStellen[oldName];
                this.funkUebung.teilnehmerStellen = this.omitKey(this.funkUebung.teilnehmerStellen, oldName);
            }
            if (this.funkUebung.loesungswoerter && this.funkUebung.loesungswoerter[oldName] !== undefined) {
                this.funkUebung.loesungswoerter[newName] = this.funkUebung.loesungswoerter[oldName];
                this.funkUebung.loesungswoerter = this.omitKey(this.funkUebung.loesungswoerter, oldName);
            }
        }
        this.funkUebung.teilnehmerListe[index] = newName;
    }

    updateTeilnehmerStelle(teilnehmer: string, stelle: string) {
        if (!this.funkUebung.teilnehmerStellen) {
            this.funkUebung.teilnehmerStellen = {};
        }
        if (stelle.trim() === "") {
            this.funkUebung.teilnehmerStellen = this.omitKey(this.funkUebung.teilnehmerStellen, teilnehmer);
        } else {
            this.funkUebung.teilnehmerStellen[teilnehmer] = stelle;
        }
    }

    addTeilnehmer() {
        this.funkUebung.teilnehmerListe.push("");
        this.renderTeilnehmer();
    }

    removeTeilnehmer(index: number) {
        const teilnehmer = this.funkUebung.teilnehmerListe[index];
        if (!teilnehmer) {
            return;
        }
         
        if (this.funkUebung.teilnehmerStellen) {
            this.funkUebung.teilnehmerStellen = this.omitKey(this.funkUebung.teilnehmerStellen, teilnehmer);
        }
         
        if (this.funkUebung.loesungswoerter) {
            this.funkUebung.loesungswoerter = this.omitKey(this.funkUebung.loesungswoerter, teilnehmer);
        }
        
        this.funkUebung.teilnehmerListe.splice(index, 1);
        this.renderTeilnehmer();
    }

    shuffleLoesungswoerter() {
        const option = this.view.getSelectedLoesungswortOption();
        
        // Reset
        this.funkUebung.loesungswoerter = {};

        if (option === "central") {
            if (this.predefinedLoesungswoerter.length === 0) {
                alert("Keine vordefinierten Lösungswörter verfügbar.");
                return;
            }
            const zentralesWort = this.predefinedLoesungswoerter[
                Math.floor(Math.random() * this.predefinedLoesungswoerter.length)
            ] ?? "";
            (document.getElementById("zentralLoesungswortInput") as HTMLInputElement).value = zentralesWort;
            
            this.funkUebung.teilnehmerListe.forEach(t => {
                this.funkUebung.loesungswoerter[t] = zentralesWort;
            });

        } else if (option === "individual") {
            const shuffledWords = [...this.predefinedLoesungswoerter].sort(() => Math.random() - 0.5);
            if (shuffledWords.length === 0) {
                return;
            }
            this.funkUebung.teilnehmerListe.forEach((t, i) => {
                const word = shuffledWords[i % shuffledWords.length];
                if (word) {
                    this.funkUebung.loesungswoerter[t] = word;
                }
            });
        }
        
        this.renderTeilnehmer(false);
    }

    readLoesungswoerterFromView() {
        const option = this.view.getSelectedLoesungswortOption();
        this.funkUebung.loesungswoerter = {};
        
        if (option === "central") {
            const val = this.view.getZentralesLoesungswort().trim().toUpperCase();
            this.funkUebung.teilnehmerListe.forEach(t => this.funkUebung.loesungswoerter[t] = val);
        } else if (option === "individual") {
            this.funkUebung.teilnehmerListe.forEach((t, i) => {
                const input = document.getElementById(`loesungswort-${i}`) as HTMLInputElement;
                if (input) {
                    this.funkUebung.loesungswoerter[t] = input.value.trim().toUpperCase();
                }
            });
        }
    }

    async startUebung() {
        if (this.funkUebung.nachrichten && Object.keys(this.funkUebung.nachrichten).length > 0) {
            if (!confirm("Übung neu generieren? Bestehende Nachrichten gehen verloren.")) {
                return;
            }
        }

        // 1. Daten aus View übernehmen
        const formData = this.view.getFormData();
        Object.assign(this.funkUebung, formData);
        this.readLoesungswoerterFromView();

        // 2. Funksprüche laden
        const source = this.view.getSelectedSource();
        if (source === "vorlagen") {
            const selected = this.view.getSelectedTemplates();
            if (selected.length === 0) {
                alert("Bitte Vorlage wählen");
                return;
            }
            this.funkUebung.verwendeteVorlagen = selected;
            
            const missing = selected.filter(k => !this.templatesFunksprueche[k]);
            if (missing.length > 0) {
                alert("Mindestens eine Vorlage ist nicht verfügbar. Bitte Auswahl prüfen.");
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
                alert("Datei wählen");
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
        
        // 5. Anzeigen
        this.renderUebungResult();
    }

    renderUebungResult() {
        this.currentPageIndex = 0;
        this.htmlSeitenTeilnehmer = this.funkUebung.teilnehmerListe.map(t => 
            UebungHTMLGenerator.generateHTMLPage(t, this.funkUebung)
        );

        this.view.showOutputContainer();
        this.displayPage(0);
        this.view.renderLinks(this.funkUebung);
        
        // Stats berechnen
        const allMsgs = Object.values(this.funkUebung.nachrichten).flat();
        const stats = this.berechneUebungsdauer(allMsgs);
        this.view.renderDuration(stats);
        
        // Chart
        this.berechneVerteilungUndZeigeDiagramm();
    }

    displayPage(index: number) {
        if (index < 0 || index >= this.htmlSeitenTeilnehmer.length) {
            return;
        }
        this.currentPageIndex = index;
        const html = this.htmlSeitenTeilnehmer[index];
        if (!html) {
            return;
        }
        this.view.renderPreview(html, index, this.htmlSeitenTeilnehmer.length);
    }

    changePage(step: number) {
        this.displayPage(this.currentPageIndex + step);
    }

    copyJSONToClipboard() {
        const json = this.funkUebung.toJson();
        this.view.showJsonModal(json); // Populate modal
        navigator.clipboard.writeText(json).then(() => alert("Kopiert!"));
    }

    private omitKey<T extends Record<string, string>>(obj: T, key: string): T {
        return Object.fromEntries(
            Object.entries(obj).filter(([k]) => k !== key)
        ) as T;
    }

    // --- Helper for Stats (could be moved to Service or Utils) ---
    
    berechneUebungsdauer(nachrichtenDaten: Nachricht[]) {
        let gesamtDauerOptimal = 0;
        let gesamtDauerSchlecht = 0;
        let totalMessages = 0;

        nachrichtenDaten.forEach((nachricht: Nachricht) => {
            const textLaenge = nachricht.nachricht.length;
            const empfaengerAnzahl = nachricht.empfaenger.length;

            const zeitVerbindungsaufbau = 5 + (empfaengerAnzahl - 1) * 3;
            const zeitVerbindungsabbau = 3;
            const zeitSprechen = textLaenge / 2;
            const zeitMitschrift = textLaenge;
            const zeitEmpfaenger = (empfaengerAnzahl - 1) * 2;

            const zeitOptimal = zeitSprechen + zeitMitschrift + zeitEmpfaenger + zeitVerbindungsaufbau + zeitVerbindungsabbau;
            gesamtDauerOptimal += zeitOptimal;

            const wiederholungsFaktor = Math.random() < 0.3 ? 1.5 : 1;
            const zeitSchlecht = zeitOptimal * wiederholungsFaktor;
            gesamtDauerSchlecht += zeitSchlecht;

            totalMessages++;
        });

        const format = (min: number) => ({
            stunden: Math.floor(min / 60),
            minuten: Math.floor(min % 60)
        });

        return {
            optimal: gesamtDauerOptimal / 60,
            schlecht: gesamtDauerSchlecht / 60,
            durchschnittOptimal: totalMessages ? gesamtDauerOptimal / totalMessages : 0,
            durchschnittSchlecht: totalMessages ? gesamtDauerSchlecht / totalMessages : 0,
            optimalFormatted: format(gesamtDauerOptimal / 60),
            schlechtFormatted: format(gesamtDauerSchlecht / 60)
        };
    }

    berechneVerteilungUndZeigeDiagramm() {
        const labels: string[] = [];
        const counts: number[] = [];
        const dist: Record<string, number> = {};
        const leitung = this.funkUebung.leitung;

        this.funkUebung.teilnehmerListe.forEach(t => {
            if (t !== leitung) {
                labels.push(t);
                dist[t] = 0;
            }
        });

        this.funkUebung.teilnehmerListe.forEach(t => {
            if (t !== leitung) {
                this.funkUebung.nachrichten[t]?.forEach(n => {
                    n.empfaenger.forEach(e => {
                        if (e === "Alle") {
                            this.funkUebung.teilnehmerListe.forEach(ta => {
                                if (ta !== t && dist[ta] !== undefined) {
                                    dist[ta]++;
                                }
                            });
                        } else if (dist[e] !== undefined) {
                            dist[e]++;
                        }
                    });
                    if (n.empfaenger.includes(t) && dist[t] !== undefined) {
                        dist[t]++;
                    }
                });
            }
        });

        labels.forEach(t => counts.push(dist[t] ?? 0));
        this.view.renderChart(labels, counts);
    }
}
