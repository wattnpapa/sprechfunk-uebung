import type { Firestore, QueryDocumentSnapshot } from "firebase/firestore";
import { FirebaseService } from "../services/FirebaseService";
import { AdminView, type JahresEintrag } from "./AdminView";
import { uiFeedback } from "../core/UiFeedback";

type ListenCursor = QueryDocumentSnapshot | { __mockIndex: number } | { __fallbackIndex: number } | null;

type UebungsListe = Awaited<ReturnType<FirebaseService["getAlleUebungen"]>>;

export class AdminController {
    // Firestore database reference
    db: Firestore | null = null;
    // Pagination state
    pagination: {
        totalCount: number;
        pageSize: number;
        currentPage: number;
        lastVisible: ListenCursor;
    };
    private firebaseService: FirebaseService | null = null;
    private view: AdminView;
    private onlyTestExercises = false;
    private searchTerm = "";
    /** Cursor je Seitenindex: `pageCursors[n]` startet Seite n (Seite 0 = null). */
    private pageCursors: ListenCursor[] = [null];
    private hasNextPage = false;
    private statsCache: { ts: number; data: Awaited<ReturnType<FirebaseService["getAdminStats"]>> } | null = null;
    private countCache: Partial<Record<"all" | "test", { ts: number; data: number }>> = {};
    private monatsCache: Record<string, { ts: number; data: number[] }> = {};
    private jahresCache: Partial<Record<"all" | "test", { ts: number; data: JahresEintrag[] }>> = {};
    /** `null` = noch nicht gewählt, `"alle"` = Jahrgänge zusammengefasst. */
    private jahrFilter: number | "alle" | null = null;
    private alleUebungenCache: Partial<Record<"all" | "test", { ts: number; data: UebungsListe }>> = {};
    private readonly cacheTtlMs = 120000;

    constructor() {
        this.view = new AdminView();

        this.pagination = {
            totalCount: 0,
            pageSize: 10,
            currentPage: 0,
            lastVisible: null
        };

        // Bind events once
        this.view.bindListEvents({
            onView: id => this.uebungAnschauen(id),
            onMonitor: id => this.offeneUebungsleitung(id),
            onDelete: id => this.loescheUebung(id),
            onOnlyTestFilterChange: checked => this.setOnlyTestFilter(checked),
            onSearchChange: term => this.setSearchTerm(term),
            onJahrChange: jahr => this.setJahrFilter(jahr)
        });
    }

    public setDb(db: Firestore): void {
        this.db = db;
        this.firebaseService = new FirebaseService(db);
    }

    async ladeAdminStatistik() {
        const service = this.getFirebaseService();
        if (!service) {
            return;
        }
        let stats = this.getCachedStats();
        if (!stats) {
            try {
                stats = await service.getAdminStats();
                this.statsCache = { ts: Date.now(), data: stats };
            } catch (error) {
                console.error("Admin-Statistik konnte nicht geladen werden:", error);
                uiFeedback.error("Admin-Statistik konnte wegen Firestore-Quota aktuell nicht geladen werden.");
                return;
            }
        }

        const avgTeilnehmer = stats.total > 0 ? (stats.totalTeilnehmer / stats.total).toFixed(1) : "0";
        const totalKB = (stats.totalBytes / 1024).toFixed(1) + " kB";

        // 6️⃣ Durchschnittliche Dauer (Schätzung)
        const avgDauerSek = stats.total > 0 ? (stats.totalSprueche * 15) / stats.total : 0;
        const avgMin = Math.floor(avgDauerSek / 60);
        const avgSek = Math.round(avgDauerSek % 60);
        const avgDauer = `${avgMin} Min ${avgSek} Sek`;

        // 7️⃣ Prozentwerte
        const p = (n: number) => (stats.total > 0 ? ((n / stats.total) * 100).toFixed(1) + "%" : "0%");

        // 7️⃣ Durchschnittliche Anzahl an Funksprüchen pro Teilnehmer und Übung
        const avgSpruecheProTeilnehmer =
            stats.totalTeilnehmer > 0 ? (stats.totalSprueche / stats.totalTeilnehmer).toFixed(1) : "0";


        const viewStats = {
            total: stats.total,
            totalKB,
            avgTeilnehmer,
            avgDauer,
            avgSpruecheProTeilnehmer,
            pLoesungswort: p(stats.loesungsCount),
            pStaerke: p(stats.staerkeCount),
            pBuchstabieren: p(stats.buchstabierCount)
        };

        this.view.renderStatistik(viewStats);
    }

    async ladeAlleUebungen(direction: "next" | "prev" | "initial" | "refresh" = "initial") {
        const service = this.getFirebaseService();
        if (!service) {
            return;
        }

        const zielSeite = this.ermittleZielSeite(direction);
        if (zielSeite === null) {
            // Es gibt keine solche Seite — Zustand bleibt unverändert.
            return;
        }

        if (this.searchTerm) {
            await this.zeigeGefilterteSeite(service, zielSeite);
            return;
        }

        const result = await service.getUebungenPaged(
            this.pagination.pageSize,
            this.pageCursors[zielSeite] ?? null,
            this.onlyTestExercises
        );

        if (direction === "initial" || direction === "refresh") {
            // Count-Aggregation statt Vollscan: kostet konstant wenige Reads.
            this.pagination.totalCount = await this.getUebungenCountCached();
        }

        if (result.uebungen.length === 0 && zielSeite > 0) {
            // Letzter Eintrag der Seite gelöscht: eine Seite zurück statt leerer Tabelle.
            this.pagination.currentPage = zielSeite;
            await this.ladeAlleUebungen("prev");
            return;
        }

        this.pagination.currentPage = zielSeite;
        this.pagination.lastVisible = result.lastVisible;
        this.pageCursors[zielSeite + 1] = result.lastVisible;
        this.hasNextPage = this.berechneHatNaechsteSeite(zielSeite, result.uebungen.length, this.pagination.totalCount);

        this.zeigeSeite(result.uebungen);
    }

    async loescheUebung(uebungId: string) {
        const service = this.getFirebaseService();
        if (!service) {
            return;
        }
        if (!uiFeedback.confirm("Möchtest du diese Übung wirklich löschen?")) {
            return;
        }

        try {
            await service.deleteUebung(uebungId);
            // console.log("✅ Übung gelöscht:", uebungId); // Removed console.log
            this.invalidateCaches();
            // Auf der aktuellen Seite bleiben statt zurück auf Seite 1 zu springen.
            this.ladeAlleUebungen("refresh");
        } catch (error) {
            console.error("❌ Fehler beim Löschen der Übung:", error);
            uiFeedback.error("Fehler beim Löschen der Übung.");
        }
    };

    offeneUebungsleitung(uebungId: string): void {
        window.open(`#/uebungsleitung/${uebungId}`, "_blank");
    }

    uebungAnschauen(uebungId: string): void {
        window.open(`#/generator/${uebungId}`, "_blank");
    }


    async ladeUebungsStatistik() {
        if (!this.ensureDbReady()) {
            return Array(12).fill(0);
        }
        // Index 0 = Januar, ..., 11 = Dezember
        return this.getUebungenMonatsCountsCached();
    }

    async renderUebungsStatistik() {
        await this.ladeAdminStatistik();
        if (!this.ensureDbReady()) {
            return;
        }

        const jahre = await this.ladeJahreOhneAbbruch();
        this.jahrFilter = this.waehleJahr(jahre);
        this.view.renderJahresFilter(jahre, this.jahrFilter);

        try {
            await this.zeichneMonatsDiagramm();
        } catch (error) {
            console.error("Monatsdiagramm konnte nicht geladen werden:", error);
            uiFeedback.error("Das Übungsdiagramm konnte aktuell nicht geladen werden.");
            return;
        }
        await this.zeigeFehlendeStatistikFelder(jahre);
    }

    /**
     * Ohne Jahresliste (etwa bei erschöpftem Firestore-Kontingent) bleibt das
     * Diagramm über alle Jahrgänge stehen, statt ganz zu verschwinden.
     */
    private async ladeJahreOhneAbbruch(): Promise<JahresEintrag[]> {
        try {
            return await this.getJahresCountsCached();
        } catch (error) {
            console.warn("Jahresfilter konnte nicht geladen werden:", error);
            return [];
        }
    }

    /**
     * Nur das Diagramm neu zeichnen — die Kennzahlen darüber hängen nicht am
     * Jahresfilter und müssten sonst unnötig erneut abgefragt werden.
     */
    private async zeichneMonatsDiagramm() {
        const data = await this.ladeUebungsStatistik();
        const labels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
        const titel = this.jahrFilter === "alle" || this.jahrFilter === null
            ? "Übungen pro Monat (alle Jahre)"
            : `Übungen pro Monat ${this.jahrFilter}`;

        this.view.renderChart(data, labels, titel);
    }

    /**
     * Das Diagramm liest die denormalisierten `stat*`-Felder. Übungen aus der
     * Zeit davor besitzen sie nicht und fehlen still — die Differenz zum
     * Gesamtbestand macht genau das sichtbar.
     */
    private async zeigeFehlendeStatistikFelder(jahre: JahresEintrag[]) {
        try {
            const gesamt = await this.getUebungenCountCached();
            const erfasst = jahre.reduce((summe, eintrag) => summe + eintrag.anzahl, 0);
            this.view.renderStatistikHinweis(Math.max(0, gesamt - erfasst));
        } catch (error) {
            console.warn("Abgleich der Statistikfelder nicht möglich:", error);
        }
    }

    /**
     * Zuletzt gewählte Auswahl beibehalten, solange es sie noch gibt; beim
     * ersten Aufruf auf das jüngste Jahr mit Übungen springen, damit das
     * Diagramm nicht mehrere Jahrgänge im selben Monat übereinanderlegt.
     */
    private waehleJahr(jahre: JahresEintrag[]): number | "alle" {
        if (this.jahrFilter === "alle") {
            return "alle";
        }
        if (this.jahrFilter !== null && jahre.some(eintrag => eintrag.jahr === this.jahrFilter)) {
            return this.jahrFilter;
        }
        return jahre[jahre.length - 1]?.jahr ?? "alle";
    }

    private setJahrFilter(jahr: number | "alle"): void {
        if (this.jahrFilter === jahr) {
            return;
        }
        this.jahrFilter = jahr;
        void this.zeichneMonatsDiagramm();
    }

    private getCachedStats() {
        if (!this.statsCache) {
            return null;
        }
        if ((Date.now() - this.statsCache.ts) > this.cacheTtlMs) {
            this.statsCache = null;
            return null;
        }
        return this.statsCache.data;
    }

    private async getUebungenCountCached(): Promise<number> {
        const key: "all" | "test" = this.onlyTestExercises ? "test" : "all";
        const cached = this.countCache[key];
        if (cached && (Date.now() - cached.ts) <= this.cacheTtlMs) {
            return cached.data;
        }
        const data = await this.requireFirebaseService().getUebungenCount(this.onlyTestExercises);
        this.countCache[key] = { ts: Date.now(), data };
        return data;
    }

    private async getUebungenMonatsCountsCached(): Promise<number[]> {
        const jahr = typeof this.jahrFilter === "number" ? this.jahrFilter : undefined;
        const key = `${this.onlyTestExercises ? "test" : "all"}:${jahr ?? "alle"}`;
        const cached = this.monatsCache[key];
        if (cached && (Date.now() - cached.ts) <= this.cacheTtlMs) {
            return cached.data;
        }
        const data = await this.requireFirebaseService().getUebungenMonatsCounts(this.onlyTestExercises, jahr);
        this.monatsCache[key] = { ts: Date.now(), data };
        return data;
    }

    private async getJahresCountsCached(): Promise<JahresEintrag[]> {
        const key: "all" | "test" = this.onlyTestExercises ? "test" : "all";
        const cached = this.jahresCache[key];
        if (cached && (Date.now() - cached.ts) <= this.cacheTtlMs) {
            return cached.data;
        }
        const data = await this.requireFirebaseService().getUebungenJahresCounts(this.onlyTestExercises);
        this.jahresCache[key] = { ts: Date.now(), data };
        return data;
    }

    private requireFirebaseService(): FirebaseService {
        const service = this.getFirebaseService();
        if (!service) {
            throw new Error("AdminController DB is not initialized");
        }
        return service;
    }

    private getFirebaseService(): FirebaseService | null {
        if (!this.ensureDbReady()) {
            return null;
        }
        return this.firebaseService;
    }

    private ensureDbReady(): boolean {
        if (this.db && this.firebaseService) {
            return true;
        }
        console.warn("AdminController: DB ist noch nicht initialisiert. setDb() fehlt.");
        return false;
    }

    private setOnlyTestFilter(checked: boolean): void {
        if (this.onlyTestExercises === checked) {
            return;
        }
        this.onlyTestExercises = checked;
        void this.ladeAlleUebungen("initial");
    }

    private setSearchTerm(term: string): void {
        const normalisiert = term.trim().toLowerCase();
        if (this.searchTerm === normalisiert) {
            return;
        }
        this.searchTerm = normalisiert;
        void this.ladeAlleUebungen("initial");
    }

    /**
     * Liefert den Index der anzuzeigenden Seite oder `null`, wenn es in die
     * gewünschte Richtung keine Seite gibt. Ohne diese Prüfung landete "Nächste"
     * hinter dem Ende auf einer leeren oder — mangels Cursor — wieder auf der
     * ersten Seite.
     */
    private ermittleZielSeite(direction: "next" | "prev" | "initial" | "refresh"): number | null {
        if (direction === "initial") {
            this.pagination.lastVisible = null;
            this.pageCursors = [null];
            this.hasNextPage = false;
            return 0;
        }
        if (direction === "refresh") {
            return this.pagination.currentPage;
        }
        if (direction === "next") {
            return this.hasNextPage ? this.pagination.currentPage + 1 : null;
        }
        return this.pagination.currentPage > 0 ? this.pagination.currentPage - 1 : null;
    }

    /**
     * Textsuche über den kompletten Bestand: Firestore kann keine Teilstring-
     * Suche, also wird einmal alles geladen (gecacht) und im Speicher gefiltert
     * und paginiert — so bleiben auch gefilterte Seiten voll.
     */
    private async zeigeGefilterteSeite(service: FirebaseService, zielSeite: number): Promise<void> {
        const alle = await this.getAlleUebungenCached(service);
        const treffer = alle.filter(uebung => this.passtZurSuche(uebung));
        const seitenGroesse = this.pagination.pageSize;
        const letzteSeite = Math.max(0, Math.ceil(treffer.length / seitenGroesse) - 1);
        const seite = Math.min(zielSeite, letzteSeite);
        const start = seite * seitenGroesse;

        this.pagination.currentPage = seite;
        this.pagination.totalCount = treffer.length;
        this.pagination.lastVisible = null;
        this.hasNextPage = start + seitenGroesse < treffer.length;

        this.zeigeSeite(treffer.slice(start, start + seitenGroesse));
    }

    private zeigeSeite(uebungen: UebungsListe): void {
        this.view.renderUebungsListe(uebungen);
        this.view.renderPaginationInfo(
            this.pagination.currentPage,
            this.pagination.pageSize,
            uebungen.length,
            this.pagination.totalCount
        );
        this.view.setPaginationButtons(this.pagination.currentPage > 0, this.hasNextPage);
        this.updateFooterInfo(uebungen[0]?.buildVersion);
    }

    private berechneHatNaechsteSeite(seite: number, geladen: number, gesamt: number): boolean {
        if (gesamt > 0) {
            return (seite + 1) * this.pagination.pageSize < gesamt;
        }
        return geladen === this.pagination.pageSize;
    }

    private passtZurSuche(uebung: UebungsListe[number]): boolean {
        const heuhaufen = `${uebung.id} ${uebung.name} ${uebung.rufgruppe} ${uebung.leitung}`.toLowerCase();
        return heuhaufen.includes(this.searchTerm);
    }

    private async getAlleUebungenCached(service: FirebaseService): Promise<UebungsListe> {
        const key: "all" | "test" = this.onlyTestExercises ? "test" : "all";
        const cached = this.alleUebungenCache[key];
        if (cached && (Date.now() - cached.ts) <= this.cacheTtlMs) {
            return cached.data;
        }
        const data = await service.getAlleUebungen(this.onlyTestExercises);
        this.alleUebungenCache[key] = { ts: Date.now(), data };
        return data;
    }

    private invalidateCaches(): void {
        this.countCache = {};
        this.monatsCache = {};
        this.jahresCache = {};
        this.alleUebungenCache = {};
        this.statsCache = null;
    }

    private updateFooterInfo(version?: string) {
        void version;
        const idEl = document.getElementById("uebungsId");
        if (idEl) {
            idEl.textContent = "-";
        }
    }
}

export const admin = new AdminController();
