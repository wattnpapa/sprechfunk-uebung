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
import { GeneratorProfilView } from "./GeneratorProfilView";
import {
    entwurfHatInhalt,
    type GeneratorEntwurf,
    ladeEntwurf,
    speichereEntwurf,
    verwerfeEntwurf,
    wendeEntwurfAn
} from "./GeneratorEntwurf";
import { SZENARIEN } from "../data/szenarien";
import type { Szenario } from "../types/Szenario";
import { FUEHRUNGSSTELLEN_UEBUNGEN } from "../data/fuehrungsstellenUebungen";
import type { AbschnittsGrenzen } from "./GeneratorView";
import {
    createConfigFingerprint,
    type GenerierModus,
    leereBeispielwerte,
    optionAusWoertern,
    VORDEFINIERTE_LOESUNGSWOERTER
} from "./controllerHilfen";
import { bindEvents } from "./controllerBindings";
import {
    aktualisiereModusAnzeige,
    aktualisiereStatusleiste,
    formularGeaendert,
    istGespeichert,
    zeigeWiederhergestelltenEntwurf
} from "./controllerStatus";
import {
    readLoesungswoerterFromView,
    removeTeilnehmer,
    renderTeilnehmer,
    shuffleLoesungswoerter,
    wechsleLoesungswortOption
} from "./controllerLoesungswort";
import { startUebung, validateSpruchVerteilung } from "./controllerGenerieren";
import {
    aendereAbschnitte,
    druckeBlattBeuebteStelle,
    FUEHRUNGSSTELLE_VORBELEGUNG,
    updateFuehrungsstelleInfo,
    zeigeDrehbuchDauer
} from "./controllerFuehrungsstelle";
import { updateSzenarioInfo } from "./controllerQuellen";

export type { GenerierModus } from "./controllerHilfen";

/**
 * Steuert den Generator. Die Logik liegt in den Modulen `controller*.ts`;
 * diese Klasse hält den Zustand und bietet die Einstiegspunkte an. Die
 * Felder sind öffentlich, damit die Module sie lesen und setzen können.
 */
export class GeneratorController {
    private static instance: GeneratorController;

    public funkUebung!: FunkUebung;
    public predefinedLoesungswoerter: string[] = [];
    public templatesFunksprueche: Record<string, { text: string; filename: string }> = {};
    public szenarioCache = new Map<string, Szenario>();
    /** Entwertet überholte Info-Fetches bei schnellem Szenario-Wechsel. */
    public szenarioInfoToken = 0;
    public fuehrungsstelleInfoToken = 0;
    /**
     * Teilnehmer des Formulars, bevor eine Führungsstellen-Übung die Liste mit
     * ihren Rollen überschreibt; beim Wechsel auf eine andere Quelle kommt
     * die Liste zurück.
     */
    public teilnehmerVorFuehrungsstelle: { liste: string[]; stellen: Record<string, string> } | null = null;
    /** Abschnittsspanne des gewählten Drehbuchs; bis zum ersten Laden großzügig. */
    public fuehrungsstelleGrenzen: AbschnittsGrenzen = { min: 1, max: 8 };
    public showStellenname = false;
    public firebaseService: FirebaseService;
    public generationService: GenerationService;
    public stateService: GeneratorStateService;
    public statsService: GeneratorStatsService;
    public previewService: GeneratorPreviewService;
    public view: GeneratorView;
    public hinweise = new GeneratorHinweise();
    public profilView = new GeneratorProfilView();
    public buildInfo = "dev";
    public initialConfigFingerprint = "";
    public isFreshExercise = true;
    /** Läuft gerade eine Generierung? Sperrt Doppelklicks. */
    public laeuft = false;
    /** Wird gerade ein Stand in das Formular geschrieben? Dann sind Änderungen keine Eingaben. */
    public wendeAn = false;
    public ergebnisVeraltet = false;
    public entwurfTimer: ReturnType<typeof setTimeout> | null = null;
    /** Profil, das der nächste Aufruf von handleRoute in eine neue Übung schreibt. */
    public profilZumLaden: { name: string; entwurf: GeneratorEntwurf } | null = null;
    /** Zuletzt gewählte Lösungswort-Option und je Option die eigenen Wörter. */
    public loesungswortOption: LoesungswortOption = "none";
    public loesungswortMerker: Partial<Record<LoesungswortOption, Record<string, string>>> = {};

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

        this.predefinedLoesungswoerter = VORDEFINIERTE_LOESUNGSWOERTER.map(word => word.toUpperCase());

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
        const uebungId = params[0] ?? null;
        const { uebung, ladeFehler } = await this.ladeFuerRoute(uebungId);
        this.funkUebung = uebung;
        this.teilnehmerVorFuehrungsstelle = null;
        // Eine nicht gefundene ID behandelt das Formular wie eine neue Übung.
        this.isFreshExercise = !uebungId || ladeFehler !== null;
        this.ergebnisVeraltet = false;
        this.loesungswortMerker = {};
        if (this.isFreshExercise) {
            leereBeispielwerte(this.funkUebung);
        }
        this.initialConfigFingerprint = this.createConfigFingerprint(this.funkUebung);
        const profil = this.isFreshExercise ? this.profilZumLaden : null;
        this.profilZumLaden = null;
        const entwurf = this.wendeAnfangsstandAn(profil?.entwurf ?? null);
        this.loesungswortOption = optionAusWoertern(this.funkUebung.loesungswoerter);
        this.updateUI();
        if (entwurf) {
            zeigeWiederhergestelltenEntwurf(this, entwurf, profil?.name);
        }
        if (ladeFehler) {
            this.hinweise.zeigeFehlerBox(ladeFehler);
        }
    }

    private async ladeFuerRoute(uebungId: string | null): Promise<{ uebung: FunkUebung; ladeFehler: string | null }> {
        let uebung: FunkUebung;
        try {
            uebung = await this.loadUebung(uebungId);
        } catch (error) {
            console.error("Übung konnte nicht geladen werden:", error);
            return {
                uebung: new FunkUebung(this.buildInfo),
                ladeFehler: "Die Übung konnte nicht geladen werden. Prüfe die Internetverbindung und lade die Seite neu."
            };
        }
        if (uebungId && uebung.id !== uebungId) {
            return {
                uebung,
                ladeFehler: `Unter dieser Adresse ist keine Übung gespeichert (ID ${uebungId}). ` +
                    "Prüfe den Link oder lege hier eine neue Übung an."
            };
        }
        return { uebung, ladeFehler: null };
    }

    /** Gespeicherten Entwurf in die neue Übung schreiben; null, wenn es keinen mit Inhalt gibt. */
    private wendeGespeichertenEntwurfAn(): GeneratorEntwurf | null {
        const entwurf = ladeEntwurf();
        if (!entwurf || !entwurfHatInhalt(entwurf)) {
            return null;
        }
        wendeEntwurfAn(this.funkUebung, entwurf);
        return entwurf;
    }

    /**
     * Startstand einer neuen Übung: ein gerade geladenes Profil, sonst der
     * gespeicherte Entwurf. Das Profil wird zugleich der neue Entwurf und
     * gilt auch dann, wenn der Browser-Speicher gesperrt ist.
     */
    private wendeAnfangsstandAn(profilEntwurf: GeneratorEntwurf | null): GeneratorEntwurf | null {
        if (!this.isFreshExercise) {
            return null;
        }
        if (!profilEntwurf) {
            return this.wendeGespeichertenEntwurfAn();
        }
        wendeEntwurfAn(this.funkUebung, profilEntwurf);
        speichereEntwurf(profilEntwurf);
        return profilEntwurf;
    }

    public entwurfVerwerfen(): void {
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
            aktualisiereModusAnzeige(this);
            aktualisiereStatusleiste(this);
        } finally {
            this.wendeAn = false;
        }
    }

    private bindEvents() {
        bindEvents(this);
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
            this.funkUebung.fuehrungsstelle ?? FUEHRUNGSSTELLE_VORBELEGUNG,
            this.fuehrungsstelleGrenzen
        );
        this.view.setFormData(this.funkUebung);
        const quelle = this.funkUebung.fuehrungsstelle
            ? "fuehrungsstelle"
            : this.funkUebung.szenarioSlug ? "szenario" : "vorlagen";
        this.view.setSelectedSource(quelle);
        if (quelle === "szenario") {
            void updateSzenarioInfo(this);
        }
        if (quelle === "fuehrungsstelle") {
            void this.updateFuehrungsstelleInfo();
        }
    }

    private renderResultIfAvailable() {
        if (istGespeichert(this)) {
            this.renderUebungResult();
        }
    }

    public formularGeaendert(): void {
        formularGeaendert(this);
    }

    // --- Teilnehmer und Lösungswörter ---

    renderTeilnehmer(triggerShuffle = true) {
        renderTeilnehmer(this, triggerShuffle);
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

    removeTeilnehmer(index: number) {
        removeTeilnehmer(this, index);
    }

    shuffleLoesungswoerter() {
        shuffleLoesungswoerter(this);
    }

    public wechsleLoesungswortOption(): void {
        wechsleLoesungswortOption(this);
    }

    readLoesungswoerterFromView() {
        readLoesungswoerterFromView(this);
    }

    // --- Generieren ---

    async startUebung(modus: GenerierModus = "neu") {
        await startUebung(this, modus);
    }

    public validateSpruchVerteilung(): boolean {
        return validateSpruchVerteilung(this);
    }

    public createConfigFingerprint(uebung: FunkUebung): string {
        return createConfigFingerprint(uebung);
    }

    // --- Führungsstelle ---

    public druckeBlattBeuebteStelle(): Promise<void> {
        return druckeBlattBeuebteStelle(this);
    }

    public updateFuehrungsstelleInfo(): Promise<void> {
        return updateFuehrungsstelleInfo(this);
    }

    public aendereAbschnitte(aenderung: (zeilen: AbschnittZeile[]) => AbschnittZeile[]): void {
        aendereAbschnitte(this, aenderung);
    }

    /** Neue Abschnittszeile: leer, Beispielwerte stehen als Platzhalter im Formular. */
    public naechsterAbschnitt(_vorhandene: AbschnittZeile[]): AbschnittZeile {
        return { funkrufname: "", stelle: "" };
    }

    // --- Ergebnis ---

    renderUebungResult() {
        const allMsgs = Object.values(this.funkUebung.nachrichten).flat();
        const stats = this.statsService.berechneUebungsdauer(allMsgs);
        const chart = this.statsService.berechneVerteilung(this.funkUebung);

        this.view.renderUebungResult(this.funkUebung, stats, chart);
        this.view.toggleFuehrungsstelleDownloads(!!this.funkUebung.fuehrungsstelle);
        this.hinweise.markiereErgebnisVeraltet(false);
        this.hinweise.zeigeBeuebteStelle(this.funkUebung.fuehrungsstelle?.beuebteStelle ?? null);
        if (this.funkUebung.fuehrungsstelle) {
            void zeigeDrehbuchDauer(this, this.funkUebung.fuehrungsstelle.slug);
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
}
