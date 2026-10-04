import { FunkUebung } from "../models/FunkUebung";
import { FUNKSPRUCH_VORLAGEN } from "../data/funkspruchVorlagen";
import { store } from "../state/store";
import { FirebaseService } from "../services/FirebaseService";
import { GenerationService } from "../services/GenerationService";
import { type AbschnittZeile, GeneratorView } from "./GeneratorView";
import { GeneratorStateService, type LoesungswortOption } from "./GeneratorStateService";
import { GeneratorStatsService } from "./GeneratorStatsService";
import { GeneratorPreviewService } from "./GeneratorPreviewService";
import { GeneratorHinweise } from "./GeneratorHinweise";
import {
    type FeldFehler,
    pruefeFuehrungsstellenRollen,
    pruefeKopfdaten,
    pruefeTeilnehmerListe,
    pruefeVerteilung,
    pruefeXZeit
} from "./GeneratorValidierung";
import {
    entwurfHatInhalt,
    type GeneratorEntwurf,
    ladeEntwurf,
    speichereEntwurf,
    verwerfeEntwurf,
    wendeEntwurfAn
} from "./GeneratorEntwurf";
import { baueBlattBeuebteStelle, druckeBlatt } from "./beuebteStelleBlatt";
import { ladePdfGenerator } from "../services/pdfGeneratorLazy";
import { uiFeedback } from "../core/UiFeedback";
import { SZENARIEN } from "../data/szenarien";
import { parseSzenario } from "../services/SzenarioService";
import { szenarioMaxTeilnehmer, szenarioSpruchAnzahl, type Szenario } from "../types/Szenario";
import { FUEHRUNGSSTELLEN_UEBUNGEN } from "../data/fuehrungsstellenUebungen";
import { ladeFuehrungsstellenUebung } from "../services/FuehrungsstellenUebungService";
import {
    fuehrungsstellenMaxAbschnitte,
    fuehrungsstellenNachrichtenAnzahl,
    type FuehrungsstellenUebung
} from "../types/FuehrungsstellenUebung";
import type { AbschnittsGrenzen, FuehrungsstellenRollenFormular, FunkspruchQuelle } from "./GeneratorView";

/** Wie eine schon gespeicherte Übung erneut generiert wird. */
export type GenerierModus = "neu" | "ueberschreiben";

/** Ohne Antwort des Servers nach dieser Zeit gilt das Speichern als gescheitert. */
const SPEICHERN_ZEITLIMIT_MS = 15000;
const ENTWURF_VERZOEGERUNG_MS = 400;
/** Leere Zeilen einer neuen Übung: Beispielnamen stehen nur als Platzhalter da. */
const LEERE_TEILNEHMERZEILEN = 3;

class ZeitlimitFehler extends Error {}

export class GeneratorController {
    private static instance: GeneratorController;

    public funkUebung!: FunkUebung;
    private predefinedLoesungswoerter: string[] = [];
    private templatesFunksprueche: Record<string, { text: string; filename: string }> = {};
    private szenarioCache = new Map<string, Szenario>();
    /** Entwertet überholte Info-Fetches bei schnellem Szenario-Wechsel. */
    private szenarioInfoToken = 0;
    private fuehrungsstelleInfoToken = 0;
    /**
     * Teilnehmer des Formulars, bevor eine Führungsstellen-Übung die Liste mit
     * ihren Rollen überschreibt; beim Wechsel auf eine andere Quelle kommt
     * die Liste zurück.
     */
    private teilnehmerVorFuehrungsstelle: { liste: string[]; stellen: Record<string, string> } | null = null;
    /** Abschnittsspanne des gewählten Drehbuchs; bis zum ersten Laden großzügig. */
    private fuehrungsstelleGrenzen: AbschnittsGrenzen = { min: 1, max: 8 };
    /**
     * Vorbelegung der Rollen: drei leere Einsatzabschnitte. Beispiel-
     * Funkrufnamen stehen nur als Platzhalter im Formular – als echte Werte
     * landeten sie sonst unbemerkt auf den Vordrucken (THW-Review workflow F7).
     */
    private static readonly FUEHRUNGSSTELLE_VORBELEGUNG: FuehrungsstellenRollenFormular = {
        beuebteStelle: "",
        uebergeordnet: "",
        unterstellt: ["", "", ""],
        stellen: {}
    };
    private showStellenname = false;
    private firebaseService: FirebaseService;
    private generationService: GenerationService;
    private stateService: GeneratorStateService;
    private statsService: GeneratorStatsService;
    private previewService: GeneratorPreviewService;
    private view: GeneratorView;
    private hinweise = new GeneratorHinweise();
    private buildInfo = "dev";
    private initialConfigFingerprint = "";
    private isFreshExercise = true;
    /** Läuft gerade eine Generierung? Sperrt Doppelklicks. */
    private laeuft = false;
    /** Wird gerade ein Stand in das Formular geschrieben? Dann sind Änderungen keine Eingaben. */
    private wendeAn = false;
    private ergebnisVeraltet = false;
    private entwurfTimer: ReturnType<typeof setTimeout> | null = null;
    /** Zuletzt gewählte Lösungswort-Option und je Option die eigenen Wörter. */
    private loesungswortOption: LoesungswortOption = "none";
    private loesungswortMerker: Partial<Record<LoesungswortOption, Record<string, string>>> = {};

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

        this.templatesFunksprueche = { ...FUNKSPRUCH_VORLAGEN };

        this.fetchBuildInfo();
        // Initial placeholder
        this.funkUebung = new FunkUebung(this.buildInfo);
    }

    private async fetchBuildInfo() {
        // Lokal existiert kein build.json (schreibt erst die CI-Pipeline). Der
        // Fetch würde nur einen 404-Konsolenfehler erzeugen, den Lighthouse als
        // Best-Practices-Verstoß wertet.
        const hostname = typeof window !== "undefined" ? window.location?.hostname : undefined;
        if (!hostname || ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname)) {
            return;
        }
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
        let ladeFehler: string | null = null;
        let uebung: FunkUebung;
        try {
            uebung = await this.loadUebung(uebungId);
        } catch (error) {
            console.error("Übung konnte nicht geladen werden:", error);
            ladeFehler = "Die Übung konnte nicht geladen werden. Prüfe die Internetverbindung und lade die Seite neu.";
            uebung = new FunkUebung(this.buildInfo);
        }
        if (uebungId && !ladeFehler && uebung.id !== uebungId) {
            ladeFehler = `Unter dieser Adresse ist keine Übung gespeichert (ID ${uebungId}). ` +
                "Prüfe den Link oder lege hier eine neue Übung an.";
        }
        this.funkUebung = uebung;
        this.teilnehmerVorFuehrungsstelle = null;
        // Eine nicht gefundene ID behandelt das Formular wie eine neue Übung.
        this.isFreshExercise = !uebungId || ladeFehler !== null;
        this.ergebnisVeraltet = false;
        this.loesungswortMerker = {};
        let entwurf: GeneratorEntwurf | null = null;
        if (this.isFreshExercise) {
            this.leereBeispielwerte(this.funkUebung);
        }
        this.initialConfigFingerprint = this.createConfigFingerprint(this.funkUebung);
        if (this.isFreshExercise) {
            entwurf = ladeEntwurf();
            if (entwurf && entwurfHatInhalt(entwurf)) {
                wendeEntwurfAn(this.funkUebung, entwurf);
            } else {
                entwurf = null;
            }
        }
        this.loesungswortOption = this.optionAusWoertern(this.funkUebung.loesungswoerter);
        this.updateUI();
        if (entwurf) {
            this.zeigeWiederhergestelltenEntwurf(entwurf);
        }
        if (ladeFehler) {
            this.hinweise.zeigeFehlerBox(ladeFehler);
        }
    }

    /**
     * Eine neue Übung startet ohne fremde Beispielwerte: Funkrufnamen,
     * Rufgruppe und Leitung stehen nur als Platzhalter im Formular
     * (THW-Review new-user P1-3, workflow F7).
     */
    private leereBeispielwerte(uebung: FunkUebung): void {
        uebung.teilnehmerListe = Array.from({ length: LEERE_TEILNEHMERZEILEN }, () => "");
        uebung.teilnehmerStellen = {};
        uebung.rufgruppe = "";
        uebung.leitung = "";
    }

    private zeigeWiederhergestelltenEntwurf(entwurf: GeneratorEntwurf): void {
        if (entwurf.quelle === "upload") {
            this.view.setSelectedSource("upload");
        }
        if (entwurf.loesungswortOption !== "none") {
            this.view.selectLoesungswortOption(entwurf.loesungswortOption);
            if (entwurf.loesungswortOption === "central") {
                this.setzeZentralesWortImFormular(Object.values(entwurf.loesungswoerter)[0] ?? "");
            }
            this.renderTeilnehmer(false);
        }
        const zeitpunkt = new Date(entwurf.gespeichertAm);
        this.hinweise.zeigeEntwurfHinweis(
            Number.isNaN(zeitpunkt.getTime()) ? new Date() : zeitpunkt,
            () => this.entwurfVerwerfen()
        );
    }

    private entwurfVerwerfen(): void {
        verwerfeEntwurf();
        void this.handleRoute([]);
    }

    private updateUI() {
        this.wendeAn = true;
        try {
            this.view.render(); // RENDER FIRST!
            this.view.resetBindings();
            this.bindEvents();

            this.applyUebungToView();
            // Ohne Neu-Auslosen: Eine geladene Übung behält ihre Lösungswörter
            // (THW-Review workflow F1 – „FUNKER“ wurde sonst zu einem Zufallswort).
            this.renderTeilnehmer(false);
            this.renderResultIfAvailable();
            this.aktualisiereModusAnzeige();
            this.aktualisiereStatusleiste();
        } finally {
            this.wendeAn = false;
        }
    }

    private bindEvents() {
        this.view.bindDistributionInputs(data => {
            Object.assign(this.funkUebung, data);
        });
        this.view.bindSourceToggle(source => {
            if (source === "szenario" || source === "fuehrungsstelle") {
                // Lösungswörter sind mit Drehbuch deaktiviert — Auswahl,
                // Shuffle-Button und die Spalte in der Teilnehmertabelle sollen
                // das auch zeigen, nicht nur der Hinweistext.
                this.view.selectLoesungswortOption("none");
                this.stateService.resetLoesungswoerter(this.funkUebung);
                this.loesungswortOption = "none";
            }
            if (source !== "fuehrungsstelle") {
                this.stelleTeilnehmerWiederHer();
            }
            // Immer neu zeichnen, damit Tabelle und Teilnehmerliste der Übung
            // nach einem Quellenwechsel nicht auseinanderlaufen.
            this.renderTeilnehmer(false);
            if (source === "szenario") {
                void this.updateSzenarioInfo();
            }
            if (source === "fuehrungsstelle") {
                void this.updateFuehrungsstelleInfo();
            }
        });
        this.view.bindSzenarioChange(() => {
            void this.updateSzenarioInfo();
        });
        this.bindFuehrungsstellenEvents();
        this.view.bindLoesungswortOptionChange(() => this.wechsleLoesungswortOption());
        this.view.bindTeilnehmerEvents(
            (index, newVal) => this.updateTeilnehmerName(index, newVal),
            (index, newVal) => this.updateTeilnehmerStelle(index, newVal),
            index => this.removeTeilnehmer(index),
            checked => {
                this.showStellenname = checked;
                this.renderTeilnehmer(false);
            }
        );
        this.view.bindAnmeldungToggle(checked => {
            this.funkUebung.anmeldungAktiv = checked;
        });
        this.view.bindNachrichtenArtToggle(aktiv => {
            this.funkUebung.nachrichtenArtAktiv = aktiv;
        });
        this.view.bindSpielModusToggle();
        this.view.bindPrimaryActions({
            onAddTeilnehmer: () => this.addTeilnehmer(),
            onStartUebung: () => this.startUebung("neu"),
            onChangePage: (step: number) => this.changePage(step),
            onCopyJson: () => this.copyJSONToClipboard(),
            onZipAllPdfs: () => this.mitDruckFehlermeldung(async () => {
                const pdfGenerator = await ladePdfGenerator();
                await pdfGenerator.generateAllPDFsAsZip(this.funkUebung);
            }),
            onDownloadUebersichtPdf: () => this.mitDruckFehlermeldung(async () => {
                const pdfGenerator = await ladePdfGenerator();
                await pdfGenerator.generateAllTeilnehmerUebersichtPrint(this.funkUebung);
            }),
            onDrehbuchPdf: () => this.mitDruckFehlermeldung(async () => {
                const slug = this.funkUebung.fuehrungsstelle?.slug;
                if (!slug) {
                    return;
                }
                const drehbuch = await this.loadFuehrungsstellenUebung(slug);
                if (!drehbuch) {
                    return;
                }
                const pdfGenerator = await ladePdfGenerator();
                await pdfGenerator.generateDrehbuchPDF(this.funkUebung, drehbuch);
            })
        });
        this.view.bindQuickJoin((uebungCode, teilnehmerCode) => {
            if (!uebungCode || !teilnehmerCode) {
                uiFeedback.error("Bitte Übungscode und Teilnehmercode eingeben.");
                return;
            }
            window.location.hash = `#/teilnehmer?${new URLSearchParams({
                uc: uebungCode,
                tc: teilnehmerCode
            }).toString()}`;
        });
        this.hinweise.bindAktionen({
            onUeberschreiben: () => void this.startUebung("ueberschreiben"),
            onBlattBeuebteStelle: () => void this.druckeBlattBeuebteStelle()
        });
        this.hinweise.bindFormularAenderung(() => this.formularGeaendert());
    }

    /**
     * Druckdaten ohne Netz: Bisher passierte beim Klick gar nichts
     * (THW-Review offline-resilience P0-2). Jetzt kommt eine Meldung.
     */
    private async mitDruckFehlermeldung(aktion: () => Promise<void>): Promise<void> {
        try {
            await aktion();
        } catch (error) {
            console.error("Druckdaten konnten nicht erstellt werden:", error);
            uiFeedback.error("Die Druckdaten konnten nicht erstellt werden. Prüfe die Internetverbindung und versuche es erneut.");
        }
    }

    private bindFuehrungsstellenEvents(): void {
        this.view.bindFuehrungsstelleChange(() => {
            void this.updateFuehrungsstelleInfo();
        });
        this.view.bindFuehrungsstellenAbschnittEvents(
            () => this.aendereAbschnitte(zeilen => [...zeilen, this.naechsterAbschnitt(zeilen)]),
            index => this.aendereAbschnitte(zeilen => zeilen.filter((_, i) => i !== index))
        );
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
        // Ohne gespeicherte Auswahl ist keine Vorlage vorausgewählt – auch
        // nicht „Lustige Funksprüche“ (THW-Review new-user P1-3).
        this.view.populateTemplateSelect(this.templatesFunksprueche, this.funkUebung.verwendeteVorlagen ?? []);
        this.view.populateSzenarioSelect(SZENARIEN, this.funkUebung.szenarioSlug);
        this.view.populateFuehrungsstelleSelect(FUEHRUNGSSTELLEN_UEBUNGEN, this.funkUebung.fuehrungsstelle?.slug);
        this.view.setFuehrungsstellenRollen(
            this.funkUebung.fuehrungsstelle ?? GeneratorController.FUEHRUNGSSTELLE_VORBELEGUNG,
            this.fuehrungsstelleGrenzen
        );
        this.view.setFormData(this.funkUebung);
        const quelle = this.funkUebung.fuehrungsstelle
            ? "fuehrungsstelle"
            : this.funkUebung.szenarioSlug ? "szenario" : "vorlagen";
        this.view.setSelectedSource(quelle);
        if (quelle === "szenario") {
            void this.updateSzenarioInfo();
        }
        if (quelle === "fuehrungsstelle") {
            void this.updateFuehrungsstelleInfo();
        }
    }

    private renderResultIfAvailable() {
        if (this.istGespeichert()) {
            this.renderUebungResult();
        }
    }

    /** Eine Übung mit Nachrichten ist gespeichert: geladen oder erfolgreich generiert. */
    private istGespeichert(): boolean {
        return !!this.funkUebung.nachrichten && Object.keys(this.funkUebung.nachrichten).length > 0;
    }

    private aktualisiereModusAnzeige(): void {
        this.hinweise.zeigeModus({
            gespeichert: this.istGespeichert(),
            name: this.funkUebung.name,
            uebungCode: this.funkUebung.uebungCode
        });
    }

    // --- Formularänderungen: Entwurf, Statusleiste, veraltetes Ergebnis ---

    private formularGeaendert(): void {
        if (this.wendeAn) {
            return;
        }
        if (this.istGespeichert() && !this.ergebnisVeraltet) {
            this.ergebnisVeraltet = true;
            this.hinweise.markiereErgebnisVeraltet(true);
        }
        this.aktualisiereStatusleiste();
        this.planeEntwurf();
    }

    private planeEntwurf(): void {
        if (!this.isFreshExercise || this.istGespeichert()) {
            return;
        }
        if (this.entwurfTimer !== null) {
            clearTimeout(this.entwurfTimer);
        }
        this.entwurfTimer = setTimeout(() => {
            this.entwurfTimer = null;
            this.speichereAktuellenEntwurf();
        }, ENTWURF_VERZOEGERUNG_MS);
    }

    private speichereAktuellenEntwurf(): void {
        if (!this.isFreshExercise || this.istGespeichert()) {
            return;
        }
        const formular = this.view.getFormData();
        const quelle = this.view.getSelectedSource();
        const option = this.view.getSelectedLoesungswortOption();
        const datum = formular.datum instanceof Date && !Number.isNaN(formular.datum.getTime())
            ? formular.datum
            : new Date();
        const entwurf: GeneratorEntwurf = {
            version: 1,
            gespeichertAm: new Date().toISOString(),
            formular: {
                name: formular.name ?? "",
                datum: datum.toISOString(),
                rufgruppe: formular.rufgruppe ?? "",
                leitung: formular.leitung ?? "",
                spruecheProTeilnehmer: this.endlich(formular.spruecheProTeilnehmer, 10),
                spruecheAnAlle: this.endlich(formular.spruecheAnAlle, 0),
                spruecheAnMehrere: this.endlich(formular.spruecheAnMehrere, 0),
                buchstabierenAn: this.endlich(formular.buchstabierenAn, 0),
                anmeldungAktiv: formular.anmeldungAktiv ?? true,
                autoStaerkeErgaenzen: formular.autoStaerkeErgaenzen ?? true,
                nachrichtenArtAktiv: formular.nachrichtenArtAktiv ?? false,
                spruchAnteilProzent: this.endlich(formular.spruchAnteilProzent, 50),
                spielModus: formular.spielModus === "xZeit" ? "xZeit" : "klassisch",
                xZeitIntervallMinuten: this.endlich(formular.xZeitIntervallMinuten, 3),
                xZeitStartOffsetMinuten: this.endlich(formular.xZeitStartOffsetMinuten, 0)
            },
            quelle,
            vorlagen: this.view.getSelectedTemplates(),
            ...(quelle === "szenario" ? { szenarioSlug: this.view.getSelectedSzenario() } : {}),
            ...(quelle === "fuehrungsstelle"
                ? { fuehrungsstelle: { slug: this.view.getSelectedFuehrungsstelle(), ...this.view.getFuehrungsstellenRollen() } }
                : {}),
            teilnehmerListe: [...this.funkUebung.teilnehmerListe],
            teilnehmerStellen: { ...(this.funkUebung.teilnehmerStellen ?? {}) },
            loesungswortOption: option,
            loesungswoerter: option === "none" ? {} : this.leseLoesungswoerterAusFormular(option)
        };
        speichereEntwurf(entwurf);
    }

    private endlich(wert: number | undefined, ersatz: number): number {
        return typeof wert === "number" && Number.isFinite(wert) ? wert : ersatz;
    }

    /** Statusleiste vor dem Generieren aus dem Formular, danach aus dem Ergebnis. */
    private aktualisiereStatusleiste(): void {
        if (this.istGespeichert() && !this.ergebnisVeraltet) {
            return; // renderUebungResult hat die echten Werte gesetzt.
        }
        const quelle = this.leseQuelle();
        const optionLabel: Record<LoesungswortOption, string> = { none: "Keine", central: "Zentral", individual: "Individuell" };
        let teilnehmer: number;
        if (quelle === "fuehrungsstelle") {
            const rollen = this.leseFuehrungsstellenRollen();
            teilnehmer = rollen
                ? [rollen.beuebteStelle, rollen.uebergeordnet, ...rollen.unterstellt].filter(n => n.trim() !== "").length
                : 0;
        } else {
            teilnehmer = this.funkUebung.teilnehmerListe.filter(name => (name ?? "").trim() !== "").length;
        }
        const proTeilnehmer = this.funkUebung.spruecheProTeilnehmer;
        const nachrichten = (quelle === "vorlagen" || quelle === "upload") && teilnehmer > 0 && proTeilnehmer > 0
            ? `ca. ${teilnehmer * proTeilnehmer}`
            : "–";
        this.hinweise.aktualisiereStatusleiste({
            teilnehmer,
            nachrichten,
            loesungswoerter: quelle === "szenario" || quelle === "fuehrungsstelle"
                ? "Keine"
                : optionLabel[this.loesungswortOption],
            dauer: "nach dem Generieren"
        });
    }

    private leseQuelle(): FunkspruchQuelle {
        try {
            return this.view.getSelectedSource();
        } catch {
            return "vorlagen";
        }
    }

    private leseFuehrungsstellenRollen(): FuehrungsstellenRollenFormular | null {
        try {
            return this.view.getFuehrungsstellenRollen();
        } catch {
            return null;
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

    updateTeilnehmerStelle(index: number, stelle: string) {
        const teilnehmer = this.funkUebung.teilnehmerListe[index] ?? "";
        this.stateService.updateTeilnehmerStelle(this.funkUebung, teilnehmer, stelle);
    }

    addTeilnehmer() {
        this.stateService.addTeilnehmer(this.funkUebung);
        this.renderTeilnehmer();
    }

    /**
     * Entfernt eine Zeile ohne Rückfrage, bietet aber kurz „Rückgängig“ an
     * (THW-Review destructive-action P2-2, error-recovery P3-2).
     */
    removeTeilnehmer(index: number) {
        const name = this.funkUebung.teilnehmerListe[index];
        if (name === undefined) {
            return;
        }
        const eintrag = {
            index,
            name,
            stelle: this.funkUebung.teilnehmerStellen?.[name],
            loesungswort: this.leseLoesungswortZeile(index) ?? this.funkUebung.loesungswoerter?.[name]
        };
        this.stateService.removeTeilnehmer(this.funkUebung, index);
        this.renderTeilnehmer(false);
        this.hinweise.zeigeEntferntHinweis(name.trim(), () => {
            this.stateService.restoreTeilnehmer(this.funkUebung, eintrag);
            this.renderTeilnehmer(false);
            this.formularGeaendert();
        });
    }

    private leseLoesungswortZeile(index: number): string | undefined {
        if (typeof document === "undefined") {
            return undefined;
        }
        const input = document.getElementById(`loesungswort-${index}`) as HTMLInputElement | null;
        const wert = input?.value?.trim().toUpperCase();
        return wert ? wert : undefined;
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
            this.setzeZentralesWortImFormular(result.centralWord);
        }
        this.renderTeilnehmer(false);
    }

    private setzeZentralesWortImFormular(wort: string): void {
        if (typeof document === "undefined") {
            return;
        }
        const input = document.getElementById("zentralLoesungswortInput") as HTMLInputElement | null;
        if (input) {
            input.value = wort;
        }
    }

    /**
     * Wechsel der Lösungswort-Option. Eigene Wörter der verlassenen Option
     * werden gemerkt und beim Zurückwechseln wieder eingesetzt, statt sie
     * durch Zufallswörter zu ersetzen (THW-Review error-recovery P3-2).
     */
    private wechsleLoesungswortOption(): void {
        this.view.updateLoesungswortOptionUI();
        const neu = this.view.getSelectedLoesungswortOption();
        const vorher = this.loesungswortOption;
        if (vorher !== "none" && vorher !== neu) {
            const woerter = this.leseLoesungswoerterAusFormular(vorher);
            if (Object.keys(woerter).length > 0) {
                this.loesungswortMerker[vorher] = woerter;
            }
        }
        this.loesungswortOption = neu;
        if (neu === "none") {
            this.stateService.resetLoesungswoerter(this.funkUebung);
            this.renderTeilnehmer(false);
            return;
        }
        const gemerkt = this.loesungswortMerker[neu];
        if (gemerkt && this.funkUebung.teilnehmerListe.some(name => gemerkt[name])) {
            this.stateService.resetLoesungswoerter(this.funkUebung);
            this.funkUebung.teilnehmerListe.forEach(name => {
                const wort = gemerkt[name];
                if (wort) {
                    this.funkUebung.loesungswoerter[name] = wort;
                }
            });
            if (neu === "central") {
                this.setzeZentralesWortImFormular(Object.values(gemerkt)[0] ?? "");
            }
            this.renderTeilnehmer(false);
            return;
        }
        this.shuffleLoesungswoerter();
    }

    /** Lösungswörter, wie sie gerade im Formular stehen, je Teilnehmer. */
    private leseLoesungswoerterAusFormular(option: LoesungswortOption): Record<string, string> {
        const woerter: Record<string, string> = {};
        if (typeof document === "undefined" || option === "none") {
            return woerter;
        }
        if (option === "central") {
            const zentral = (document.getElementById("zentralLoesungswortInput") as HTMLInputElement | null)
                ?.value.trim().toUpperCase() ?? "";
            if (zentral) {
                this.funkUebung.teilnehmerListe.forEach(name => {
                    woerter[name] = zentral;
                });
            }
            return woerter;
        }
        this.funkUebung.teilnehmerListe.forEach((name, i) => {
            const wert = this.leseLoesungswortZeile(i);
            if (wert) {
                woerter[name] = wert;
            }
        });
        return woerter;
    }

    private optionAusWoertern(woerter: Record<string, string> | undefined): LoesungswortOption {
        const werte = Object.values(woerter ?? {}).filter(w => typeof w === "string" && w.trim() !== "");
        if (werte.length === 0) {
            return "none";
        }
        return new Set(werte).size === 1 ? "central" : "individual";
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

    // --- Generieren ---

    /**
     * Erzeugt die Übung und speichert sie.
     *
     * Für eine schon gespeicherte Übung gibt es zwei Wege (THW-Review
     * destructive-action P0-2, workflow F1): `neu` (Standard) legt eine
     * eigene Übung mit neuer ID und neuen Codes an, die bisherige bleibt mit
     * ihren Links und Ausdrucken bestehen. `ueberschreiben` ersetzt die
     * Funksprüche unter denselben Codes und nennt vorher die Folgen.
     *
     * Scheitert etwas (Eingabe, Vorlage, Speichern), bleibt der vorherige
     * Stand im Speicher, und die Meldung steht sichtbar an der Aktionsleiste.
     */
    async startUebung(modus: GenerierModus = "neu") {
        if (this.laeuft) {
            return;
        }
        this.hinweise.entferneFeldFehler();
        this.hinweise.zeigeFehlerBox(null);

        const warGespeichert = this.istGespeichert();
        if (warGespeichert && !uiFeedback.confirm(this.rueckfrageText(modus))) {
            return;
        }

        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            this.meldeFehler(
                "Keine Internetverbindung. Ohne Verbindung lässt sich die Übung nicht speichern, " +
                "und Teilnehmer-Links würden nicht funktionieren. Stell die Verbindung her und versuche es erneut."
            );
            return;
        }

        const sicherung = this.sichereZustand();
        this.laeuft = true;
        this.hinweise.setzeBeschaeftigt(true);
        let erfolg: boolean;
        try {
            erfolg = await this.generiereUndSpeichere(warGespeichert && modus === "neu", warGespeichert);
        } finally {
            this.laeuft = false;
            this.hinweise.setzeBeschaeftigt(false);
        }
        if (!erfolg) {
            this.funkUebung = sicherung;
            return;
        }

        // 5. Anzeigen; die Adresse zeigt jetzt auf diese Übung.
        this.isFreshExercise = false;
        this.ergebnisVeraltet = false;
        verwerfeEntwurf();
        this.hinweise.zeigeEntwurfHinweis(null);
        this.setzeAdresseAufUebung();
        this.renderUebungResult();
        this.aktualisiereModusAnzeige();
        if (warGespeichert) {
            uiFeedback.success(modus === "neu"
                ? `Neue Übung angelegt (Übungscode ${this.funkUebung.uebungCode}). Die bisherige Übung bleibt unverändert.`
                : "Übung überschrieben. Verteile die Unterlagen neu und setze Status in der Übungsleitung zurück.");
        }
    }

    private rueckfrageText(modus: GenerierModus): string {
        const name = this.funkUebung.name || "ohne Namen";
        if (modus === "ueberschreiben") {
            return [
                `Bestehende Übung „${name}“ überschreiben?`,
                "",
                "Die Funksprüche werden neu verteilt, Übungscode und Teilnehmer-Links bleiben gleich. Danach gilt:",
                "• Verteilte Ausdrucke und Vordrucke passen nicht mehr zur Übung.",
                "• Geöffnete Teilnehmer-Links zeigen andere Funksprüche; umbenannte Teilnehmer bekommen einen neuen Code.",
                "• Gesetzte Status (abgesetzt, übertragen, Anmeldungen) hängen an den Nachrichtennummern und passen nicht " +
                "mehr zum neuen Inhalt. Setze sie in der Übungsleitung zurück.",
                "• Geänderte Lösungswörter gelten sofort, auch gegenüber schon ausgedruckten.",
                "",
                "Das lässt sich nicht rückgängig machen."
            ].join("\n");
        }
        return [
            "Als neue Übung anlegen?",
            "",
            "Die Übung bekommt eine neue ID, einen neuen Übungscode und neue Teilnehmercodes. " +
            `Die bisherige Übung „${name}“ bleibt mit ihren Links und Ausdrucken unverändert bestehen.`
        ].join("\n");
    }

    /** Tiefe Kopie der Übung, um nach einem Fehlschlag den alten Stand zurückzuholen. */
    private sichereZustand(): FunkUebung {
        const kopie = typeof structuredClone === "function"
            ? structuredClone({ ...this.funkUebung })
            : JSON.parse(JSON.stringify(this.funkUebung));
        return Object.assign(new FunkUebung(this.buildInfo), kopie);
    }

    /** Neue Identität für eine Kopie: neue ID, neue Codes, neue Verteilung. */
    private alsNeueUebungVorbereiten(): void {
        const frisch = new FunkUebung(this.buildInfo);
        this.funkUebung.id = frisch.id;
        this.funkUebung.uebungCode = "";
        this.funkUebung.teilnehmerIds = {};
        this.funkUebung.nachrichten = {};
        delete this.funkUebung.seed;
        this.funkUebung.createDate = frisch.createDate;
        this.funkUebung.checksumme = "";
    }

    private async generiereUndSpeichere(alsNeueUebung: boolean, warGespeichert: boolean): Promise<boolean> {
        // 1. Daten aus View übernehmen
        const source = this.uebernimmFormular();
        if (alsNeueUebung) {
            this.alsNeueUebungVorbereiten();
        }

        // 2./3. Prüfen und generieren, je nach Quelle
        if (!(await this.generiereNachQuelle(source))) {
            return false;
        }

        // 4. Übungscode gegen den Bestand absichern und speichern
        try {
            const codeIstFrei = await this.mitZeitlimit(this.generationService.ensureUniqueUebungCode(
                this.funkUebung,
                code => this.firebaseService.isUebungCodeVergeben(code, this.funkUebung.id)
            ));
            if (!codeIstFrei) {
                this.meldeFehler("Es konnte kein freier Übungscode vergeben werden. Bitte erneut versuchen.");
                return false;
            }
            await this.mitZeitlimit(this.firebaseService.saveUebung(this.funkUebung));
        } catch (error) {
            console.error("Übung konnte nicht gespeichert werden:", error);
            this.meldeFehler(this.speicherFehlerText(error, warGespeichert));
            return false;
        }
        return true;
    }

    private speicherFehlerText(error: unknown, warGespeichert: boolean): string {
        const grund = error instanceof ZeitlimitFehler
            ? "Der Server hat nicht rechtzeitig geantwortet – vermutlich keine oder eine schwache Internetverbindung."
            : "Prüfe die Internetverbindung.";
        const stand = warGespeichert
            ? "Es wurde nichts verändert: Die angezeigten Links gehören weiter zur zuletzt gespeicherten Fassung."
            : "Gib noch keine Links weiter – es gibt noch keine gespeicherte Übung.";
        return `Die Übung wurde nicht gespeichert. ${grund} ${stand}`;
    }

    private mitZeitlimit<T>(versprechen: Promise<T>): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const ablauf = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new ZeitlimitFehler("Zeitlimit")), SPEICHERN_ZEITLIMIT_MS);
        });
        return Promise.race([versprechen, ablauf]).finally(() => clearTimeout(timer));
    }

    /** Fehler bleibt an der Aktionsleiste stehen; der Toast macht zusätzlich darauf aufmerksam. */
    private meldeFehler(text: string, feldFehler: FeldFehler[] = []): void {
        uiFeedback.error(text);
        this.hinweise.zeigeFehlerBox(text);
        if (feldFehler.length > 0) {
            this.hinweise.zeigeFeldFehler(feldFehler);
        }
    }

    /**
     * Nach dem Generieren steht die Übungs-ID in der Adresse: Reload, Zurück
     * und Lesezeichen führen wieder zum Ergebnis (THW-Review stress-test P2-1).
     * replaceState löst kein hashchange aus, das Formular bleibt, wie es ist.
     */
    private setzeAdresseAufUebung(): void {
        if (typeof window === "undefined" || typeof window.history?.replaceState !== "function") {
            return;
        }
        const ziel = `#/generator/${this.funkUebung.id}`;
        if (window.location?.hash !== ziel) {
            window.history.replaceState(window.history.state, "", ziel);
        }
    }

    /** Formularwerte in die Übung übernehmen; liefert die gewählte Quelle. */
    private uebernimmFormular(): FunkspruchQuelle {
        const formData = this.view.getFormData();
        Object.assign(this.funkUebung, formData);
        this.readLoesungswoerterFromView();
        const source = this.view.getSelectedSource();
        this.funkUebung.szenarioSlug = source === "szenario"
            ? (this.view.getSelectedSzenario() || undefined)
            : undefined;
        this.funkUebung.fuehrungsstelle = source === "fuehrungsstelle"
            ? { slug: this.view.getSelectedFuehrungsstelle(), ...this.view.getFuehrungsstellenRollen() }
            : undefined;
        this.funkUebung.istStandardKonfiguration =
            this.isFreshExercise && this.createConfigFingerprint(this.funkUebung) === this.initialConfigFingerprint;
        return source;
    }

    /** Prüft die Eingaben der Quelle und generiert; false bricht ab (Meldung ist dann gezeigt). */
    private async generiereNachQuelle(source: FunkspruchQuelle): Promise<boolean> {
        if (!this.pruefeEingaben(source)) {
            return false;
        }
        if (source === "fuehrungsstelle") {
            // Rollen statt Teilnehmerliste: Der GenerationService prüft die
            // Besetzung gegen das Drehbuch und baut die Teilnehmerliste selbst.
            return this.generiereFuehrungsstellenUebung();
        }
        if (source === "szenario") {
            return this.generiereSzenarioUebung();
        }
        return this.generiereZufallsUebung();
    }

    /**
     * Prüft Kopfdaten, Teilnehmer und Verteilung auf einmal und markiert alle
     * betroffenen Felder, statt nur den ersten Fehler als Toast zu zeigen
     * (THW-Review error-recovery P2-1).
     */
    private pruefeEingaben(source: FunkspruchQuelle): boolean {
        const fehler: FeldFehler[] = [...this.kopfdatenFehler()];
        const meldungen: string[] = fehler.length > 0 ? [fehler[0]?.text ?? ""] : [];
        let namen: string[] | null = null;
        if (source === "fuehrungsstelle" && this.funkUebung.fuehrungsstelle) {
            const rollen = pruefeFuehrungsstellenRollen(this.funkUebung.fuehrungsstelle);
            if (rollen.length > 0) {
                fehler.push(...rollen);
                meldungen.push("Jede Stelle der Führungsstellen-Übung braucht einen eigenen Funkrufnamen.");
            }
        }
        if (source === "vorlagen" && this.leseVorlagenSicher().length === 0) {
            fehler.push({ feld: "funkspruchVorlage", text: "Bitte mindestens eine Vorlage auswählen, die zu deiner Einheit passt." });
            meldungen.push("Bitte mindestens eine Funkspruch-Vorlage auswählen.");
        }
        if (source !== "fuehrungsstelle") {
            const teilnehmer = pruefeTeilnehmerListe(this.funkUebung.teilnehmerListe || []);
            if (teilnehmer.meldung) {
                fehler.push(...teilnehmer.fehler);
                meldungen.push(teilnehmer.meldung);
            } else {
                namen = teilnehmer.namen;
            }
            if (source === "vorlagen" || source === "upload") {
                const verteilung = this.verteilungsFehler();
                if (verteilung.length > 0) {
                    fehler.push(...verteilung);
                    meldungen.push(`Ungültige Verteilung: ${verteilung[0]?.text ?? ""}`);
                }
            }
        }
        if (fehler.length > 0) {
            this.meldeFehler(meldungen.join(" "), fehler);
            return false;
        }
        if (namen) {
            this.funkUebung.teilnehmerListe = namen;
        }
        return true;
    }

    /** Gewählte Vorlagen; ohne lesbare Auswahl prüft später loadFunkspruecheFromVorlagen. */
    private leseVorlagenSicher(): string[] {
        try {
            return this.view.getSelectedTemplates();
        } catch {
            return ["?"];
        }
    }

    private kopfdatenFehler(): FeldFehler[] {
        const fehler = pruefeKopfdaten({ leitung: this.funkUebung.leitung ?? "" });
        if (this.funkUebung.spielModus === "xZeit") {
            fehler.push(...pruefeXZeit({
                aktiv: true,
                intervall: this.leseZahlAusFormular("xZeitIntervallMinuten"),
                startOffset: this.leseZahlAusFormular("xZeitStartOffsetMinuten")
            }));
        }
        return fehler;
    }

    /** Rohwert eines Zahlenfelds; undefined, wenn es das Feld nicht gibt. */
    private leseZahlAusFormular(id: string): number | undefined {
        if (typeof document === "undefined" || typeof document.getElementById !== "function") {
            return undefined;
        }
        const input = document.getElementById(id) as HTMLInputElement | null;
        if (!input || typeof input.value !== "string") {
            return undefined;
        }
        return input.value.trim() === "" ? Number.NaN : Number(input.value);
    }

    private async generiereSzenarioUebung(): Promise<boolean> {
        const szenario = await this.loadSelectedSzenario();
        if (!szenario || !this.validateSzenarioTeilnehmerzahl(szenario)) {
            return false;
        }
        // Drehbuch statt Pool: Lösungswörter und Spruchquellen entfallen.
        this.stateService.resetLoesungswoerter(this.funkUebung);
        this.funkUebung.funksprueche = [];
        this.funkUebung.verwendeteVorlagen = [];
        this.generationService.generate(this.funkUebung, szenario);
        return true;
    }

    private async generiereZufallsUebung(): Promise<boolean> {
        if (!this.validateSpruchVerteilung()) {
            return false;
        }
        if (!(await this.loadFunkspruecheFromSelectedSource())) {
            return false;
        }
        this.warnIfSpruchPoolTooSmall();
        this.generationService.generate(this.funkUebung);
        return true;
    }

    /** Führungsstellen-Übung erzeugen; false, wenn Auswahl oder Besetzung nicht passen. */
    private async generiereFuehrungsstellenUebung(): Promise<boolean> {
        const slug = this.funkUebung.fuehrungsstelle?.slug ?? "";
        if (!slug || !FUEHRUNGSSTELLEN_UEBUNGEN[slug]) {
            this.meldeFehler("Bitte ein Drehbuch auswählen.", [{ feld: "fuehrungsstelleAuswahl", text: "Bitte ein Drehbuch auswählen." }]);
            return false;
        }
        const rollenFehler = pruefeFuehrungsstellenRollen(this.funkUebung.fuehrungsstelle ?? {
            beuebteStelle: "", uebergeordnet: "", unterstellt: []
        });
        if (rollenFehler.length > 0) {
            this.meldeFehler("Jede Stelle der Führungsstellen-Übung braucht einen eigenen Funkrufnamen.", rollenFehler);
            return false;
        }
        const drehbuch = await this.loadFuehrungsstellenUebung(slug);
        if (!drehbuch) {
            return false;
        }
        this.stateService.resetLoesungswoerter(this.funkUebung);
        this.funkUebung.funksprueche = [];
        this.funkUebung.verwendeteVorlagen = [];
        this.sichereTeilnehmerVorFuehrungsstelle();
        try {
            this.generationService.generateFuehrungsstelle(this.funkUebung, drehbuch);
        } catch (error) {
            this.meldeFehler(error instanceof Error ? error.message : "Die Führungsstellen-Übung konnte nicht erzeugt werden.");
            return false;
        }
        return true;
    }

    private sichereTeilnehmerVorFuehrungsstelle(): void {
        if (this.teilnehmerVorFuehrungsstelle) {
            return;
        }
        this.teilnehmerVorFuehrungsstelle = {
            liste: [...this.funkUebung.teilnehmerListe],
            stellen: { ...(this.funkUebung.teilnehmerStellen ?? {}) }
        };
    }

    private stelleTeilnehmerWiederHer(): void {
        const gesichert = this.teilnehmerVorFuehrungsstelle;
        if (!gesichert) {
            return;
        }
        this.funkUebung.teilnehmerListe = [...gesichert.liste];
        this.funkUebung.teilnehmerStellen = { ...gesichert.stellen };
        this.teilnehmerVorFuehrungsstelle = null;
    }

    private async loadFuehrungsstellenUebung(slug: string): Promise<FuehrungsstellenUebung | null> {
        try {
            return await ladeFuehrungsstellenUebung(slug);
        } catch (error) {
            console.error("Drehbuch konnte nicht geladen werden:", error);
            this.meldeFehler("Das Drehbuch konnte nicht geladen werden. Prüfe die Internetverbindung und versuche es erneut.");
            return null;
        }
    }

    /** Blatt mit Lage und Auftrag für die beübte Stelle (ohne Drehbuch-Erwartungen). */
    private async druckeBlattBeuebteStelle(): Promise<void> {
        const slug = this.funkUebung.fuehrungsstelle?.slug;
        if (!slug) {
            return;
        }
        const drehbuch = await this.loadFuehrungsstellenUebung(slug);
        if (!drehbuch) {
            return;
        }
        if (!druckeBlatt(baueBlattBeuebteStelle(this.funkUebung, drehbuch))) {
            uiFeedback.error("Das Druckfenster wurde blockiert. Erlaube Pop-ups für diese Seite und versuche es erneut.");
        }
    }

    /**
     * Beschreibung und Abschnittsspanne des gewählten Drehbuchs anzeigen und
     * die Abschnittsliste in die erlaubte Spanne bringen.
     */
    private async updateFuehrungsstelleInfo(): Promise<void> {
        const token = ++this.fuehrungsstelleInfoToken;
        const slug = this.view.getSelectedFuehrungsstelle();
        if (!slug || !FUEHRUNGSSTELLEN_UEBUNGEN[slug]) {
            this.view.renderFuehrungsstelleInfo([]);
            return;
        }
        try {
            const drehbuch = await ladeFuehrungsstellenUebung(slug);
            if (token !== this.fuehrungsstelleInfoToken) {
                return; // Inzwischen wurde ein anderes Drehbuch gewählt.
            }
            this.fuehrungsstelleGrenzen = {
                min: Math.max(1, drehbuch.minAbschnitte),
                max: fuehrungsstellenMaxAbschnitte(drehbuch)
            };
            this.aendereAbschnitte(namen => namen);
            this.view.renderFuehrungsstelleInfo([
                drehbuch.beschreibung,
                `Für ${this.fuehrungsstelleGrenzen.min} bis ${this.fuehrungsstelleGrenzen.max} Einsatzabschnitte · ` +
                `${fuehrungsstellenNachrichtenAnzahl(drehbuch)} Nachrichten · ${drehbuch.dauerMinuten} Minuten.`
            ]);
        } catch (error) {
            if (token !== this.fuehrungsstelleInfoToken) {
                return;
            }
            console.error("Drehbuch-Info konnte nicht geladen werden:", error);
            this.view.renderFuehrungsstelleInfo(["Das Drehbuch konnte nicht geladen werden."]);
        }
    }

    /** Abschnittsliste ändern; die Zeilen kommen aus dem Formular, damit getippte Stellennamen erhalten bleiben. */
    private aendereAbschnitte(aenderung: (zeilen: AbschnittZeile[]) => AbschnittZeile[]): void {
        const zeilen = aenderung(this.view.getFuehrungsstellenAbschnitte());
        while (zeilen.length < this.fuehrungsstelleGrenzen.min) {
            zeilen.push(this.naechsterAbschnitt(zeilen));
        }
        this.view.renderFuehrungsstellenAbschnitte(zeilen.slice(0, this.fuehrungsstelleGrenzen.max), this.fuehrungsstelleGrenzen);
    }

    /** Neue Abschnittszeile: leer, Beispielwerte stehen als Platzhalter im Formular. */
    private naechsterAbschnitt(_vorhandene: AbschnittZeile[]): AbschnittZeile {
        return { funkrufname: "", stelle: "" };
    }

    /** Lädt und validiert ein Szenario-JSON; Ergebnisse werden gecacht. */
    private async fetchSzenario(slug: string): Promise<Szenario> {
        const cached = this.szenarioCache.get(slug);
        if (cached) {
            return cached;
        }
        const eintrag = SZENARIEN[slug];
        if (!eintrag) {
            throw new Error(`Unbekanntes Szenario: ${slug}`);
        }
        const response = await fetch(eintrag.filename);
        if (!response.ok) {
            throw new Error(`Szenario ${slug} nicht ladbar (HTTP ${response.status})`);
        }
        const szenario = parseSzenario(slug, await response.json());
        this.szenarioCache.set(slug, szenario);
        return szenario;
    }

    private async loadSelectedSzenario(): Promise<Szenario | null> {
        const slug = this.view.getSelectedSzenario();
        if (!slug || !SZENARIEN[slug]) {
            this.meldeFehler("Bitte ein Szenario auswählen.", [{ feld: "szenarioAuswahl", text: "Bitte ein Szenario auswählen." }]);
            return null;
        }
        try {
            return await this.fetchSzenario(slug);
        } catch (error) {
            console.error("Szenario konnte nicht geladen werden:", error);
            this.meldeFehler("Das Szenario konnte nicht geladen werden. Prüfe die Internetverbindung und versuche es erneut.");
            return null;
        }
    }

    private validateSzenarioTeilnehmerzahl(szenario: Szenario): boolean {
        const anzahl = this.funkUebung.teilnehmerListe.length;
        const min = Math.max(2, szenario.minTeilnehmer);
        const max = szenarioMaxTeilnehmer(szenario);
        if (anzahl < min || anzahl > max) {
            this.meldeFehler(
                `Das Szenario "${szenario.titel}" ist für ${min} bis ${max} Teilnehmer ausgelegt ` +
                `(aktuell: ${anzahl}). Bitte Teilnehmerliste anpassen oder anderes Szenario wählen.`
            );
            return false;
        }
        return true;
    }

    private async updateSzenarioInfo(): Promise<void> {
        const token = ++this.szenarioInfoToken;
        const slug = this.view.getSelectedSzenario();
        if (!slug || !SZENARIEN[slug]) {
            this.view.renderSzenarioInfo([]);
            return;
        }
        try {
            const szenario = await this.fetchSzenario(slug);
            if (token !== this.szenarioInfoToken) {
                return; // Inzwischen wurde ein anderes Szenario gewählt.
            }
            const min = Math.max(2, szenario.minTeilnehmer);
            const max = szenarioMaxTeilnehmer(szenario);
            this.view.renderSzenarioInfo([
                szenario.beschreibung,
                `Für ${min} bis ${max} Teilnehmer · ${szenarioSpruchAnzahl(szenario)} Funksprüche insgesamt.`
            ]);
        } catch (error) {
            if (token !== this.szenarioInfoToken) {
                return;
            }
            console.error("Szenario-Info konnte nicht geladen werden:", error);
            this.view.renderSzenarioInfo(["Szenario konnte nicht geladen werden."]);
        }
    }

    private async loadFunkspruecheFromSelectedSource(): Promise<boolean> {
        const source = this.view.getSelectedSource();
        if (source === "vorlagen") {
            return this.loadFunkspruecheFromVorlagen();
        }
        return this.loadFunkspruecheFromUpload();
    }

    private async loadFunkspruecheFromVorlagen(): Promise<boolean> {
        const selected = this.view.getSelectedTemplates();
        if (selected.length === 0) {
            this.meldeFehler("Bitte mindestens eine Funkspruch-Vorlage auswählen.", [{
                feld: "funkspruchVorlage",
                text: "Bitte mindestens eine Vorlage auswählen, die zu deiner Einheit passt."
            }]);
            return false;
        }
        this.funkUebung.verwendeteVorlagen = selected;

        const missing = selected.filter(k => !this.templatesFunksprueche[k]);
        if (missing.length > 0) {
            this.meldeFehler("Mindestens eine Vorlage ist nicht verfügbar. Bitte Auswahl prüfen.");
            return false;
        }

        try {
            const texts = await Promise.all(selected.map(k => {
                const template = this.templatesFunksprueche[k];
                if (!template) {
                    throw new Error(`Template nicht gefunden: ${k}`);
                }
                return fetch(template.filename).then(r => {
                    if (r.ok === false) {
                        throw new Error(`Vorlage ${k} nicht ladbar (HTTP ${r.status})`);
                    }
                    return r.text();
                });
            }));
            // Reihenfolge bleibt die der Vorlagen: GenerationService mischt den
            // Spruch-Pool ohnehin selbst, und zwar mit dem Seed der Übung. Ein
            // Vorab-Mischen hier würde die Reproduzierbarkeit wieder aushebeln.
            this.funkUebung.funksprueche = this.normalizeFunksprueche(texts.flatMap(t => t.split("\n")));
            return true;
        } catch (error) {
            // Ohne Netz kam hier bisher nur ein Konsoleneintrag (THW-Review
            // offline-resilience P1-2): Der Klick tat scheinbar nichts.
            console.error(error);
            this.meldeFehler(
                "Die Funkspruch-Vorlagen konnten nicht geladen werden. Prüfe die Internetverbindung und versuche es erneut."
            );
            return false;
        }
    }

    private async loadFunkspruecheFromUpload(): Promise<boolean> {
        const file = this.view.getUploadedFile();
        if (!file) {
            this.meldeFehler("Bitte eine Datei mit Funksprüchen wählen.", [{ feld: "funksprueche", text: "Bitte eine .txt-Datei wählen." }]);
            return false;
        }
        const text = await file.text();
        this.funkUebung.funksprueche = this.normalizeFunksprueche(text.split("\n"));
        return true;
    }

    /**
     * Vereinheitlicht Zeilen aus Vorlagen/Upload und entfernt Dubletten.
     * Doppelte Zeilen (auch über mehrere Vorlagen hinweg oder mit abweichender
     * Groß-/Kleinschreibung) würden sonst zwangsläufig bei mehreren Teilnehmern landen.
     */
    private normalizeFunksprueche(lines: string[]): string[] {
        const gesehen = new Set<string>();
        const result: string[] = [];
        for (const line of lines) {
            const text = line.normalize("NFKC").replace(/\s+/g, " ").trim();
            if (text === "") {
                continue;
            }
            const key = text.toLowerCase();
            if (gesehen.has(key)) {
                continue;
            }
            gesehen.add(key);
            result.push(text);
        }
        return result;
    }

    /** Warnt, wenn der Spruch-Pool kleiner ist als der Bedarf der Übung. */
    private warnIfSpruchPoolTooSmall(): void {
        const anmeldungOffset = this.funkUebung.anmeldungAktiv ? 1 : 0;
        const proTeilnehmer = Math.max(0, this.funkUebung.spruecheProTeilnehmer - anmeldungOffset);
        const bedarf = this.funkUebung.teilnehmerListe.length * proTeilnehmer;
        const vorhanden = this.funkUebung.funksprueche.length;
        if (bedarf > 0 && vorhanden < bedarf) {
            uiFeedback.info(
                `Nur ${vorhanden} eindeutige Funksprüche für ${bedarf} benötigte Nachrichten – ` +
                "einzelne Sprüche wiederholen sich zwangsläufig. Wähle mehr Vorlagen aus oder " +
                "reduziere 'Funksprüche pro Teilnehmer'."
            );
        }
    }

    renderUebungResult() {
        const allMsgs = Object.values(this.funkUebung.nachrichten).flat();
        const stats = this.statsService.berechneUebungsdauer(allMsgs);
        const chart = this.statsService.berechneVerteilung(this.funkUebung);

        this.view.renderUebungResult(this.funkUebung, stats, chart);
        this.view.toggleFuehrungsstelleDownloads(!!this.funkUebung.fuehrungsstelle);
        this.hinweise.markiereErgebnisVeraltet(false);
        this.hinweise.zeigeBeuebteStelle(this.funkUebung.fuehrungsstelle?.beuebteStelle ?? null);
        if (this.funkUebung.fuehrungsstelle) {
            void this.zeigeDrehbuchDauer(this.funkUebung.fuehrungsstelle.slug);
        }
    }

    /**
     * Die Führungsstellen-Übung dauert so lange wie ihr Drehbuch; die
     * Funkspruch-Schätzung (sprechen + mitschreiben) passt dort nicht
     * (THW-Review workflow F9: 428 statt 180 Minuten).
     */
    private async zeigeDrehbuchDauer(slug: string): Promise<void> {
        try {
            const drehbuch = await ladeFuehrungsstellenUebung(slug);
            if (this.funkUebung.fuehrungsstelle?.slug === slug) {
                this.hinweise.setzeDauer(`${drehbuch.dauerMinuten} Min (Drehbuch)`);
            }
        } catch {
            // Ohne Drehbuch bleibt die Schätzung stehen.
        }
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
    }

    private validateSpruchVerteilung(): boolean {
        const fehler = this.verteilungsFehler();
        if (fehler.length === 0) {
            return true;
        }
        this.meldeFehler(`Ungültige Verteilung: ${fehler[0]?.text ?? ""}`.trim(), fehler);
        return false;
    }

    private verteilungsFehler(): FeldFehler[] {
        return pruefeVerteilung({
            spruecheProTeilnehmer: this.funkUebung.spruecheProTeilnehmer,
            spruecheAnAlle: this.funkUebung.spruecheAnAlle,
            spruecheAnMehrere: this.funkUebung.spruecheAnMehrere,
            anmeldungAktiv: this.funkUebung.anmeldungAktiv,
            prozent: {
                prozentAnAlle: this.leseZahlAusFormular("prozentAnAlle"),
                prozentAnMehrere: this.leseZahlAusFormular("prozentAnMehrere"),
                prozentAnBuchstabieren: this.leseZahlAusFormular("prozentAnBuchstabieren"),
                ...(this.funkUebung.nachrichtenArtAktiv
                    ? { prozentSprueche: this.leseZahlAusFormular("prozentSprueche") }
                    : {})
            }
        });
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
            nachrichtenArtAktiv: uebung.nachrichtenArtAktiv ?? false,
            spruchAnteilProzent: uebung.spruchAnteilProzent ?? 50,
            loesungswoerter: uebung.loesungswoerter || {},
            loesungsStaerken: uebung.loesungsStaerken || {},
            szenarioSlug: uebung.szenarioSlug ?? null,
            fuehrungsstelle: uebung.fuehrungsstelle ?? null
        });
    }

}
