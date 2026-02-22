import type { Firestore, QueryDocumentSnapshot, QuerySnapshot, DocumentData } from "firebase/firestore";
import { FirebaseService } from "../services/FirebaseService";
import { AdminView } from "./AdminView";
import { uiFeedback } from "../core/UiFeedback";
import { analytics } from "../services/analytics";

export class AdminController {
    // Firestore database reference
    db: Firestore | null = null;
    // Pagination state
    pagination: {
        totalCount: number;
        pageSize: number;
        currentPage: number;
        lastVisible: QueryDocumentSnapshot | { __mockIndex: number } | { __fallbackIndex: number } | null;
    };
    private firebaseService: FirebaseService | null = null;
    private view: AdminView;
    private onlyTestExercises = false;
    private statsCache: { ts: number; data: Awaited<ReturnType<FirebaseService["getAdminStats"]>> } | null = null;
    private snapshotCache: Partial<Record<"all" | "test", { ts: number; data: QuerySnapshot<DocumentData> }>> = {};
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
        this.view.bindListEvents(
            id => this.uebungAnschauen(id),
            id => this.offeneUebungsleitung(id),
            id => this.loescheUebung(id),
            checked => this.setOnlyTestFilter(checked)
        );
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

    async ladeAlleUebungen(direction: "next" | "prev" | "initial" = "initial") {
        const service = this.getFirebaseService();
        if (!service) {
            return;
        }
        const result = await service.getUebungenPaged(
            this.pagination.pageSize, 
            this.pagination.lastVisible, 
            direction,
            this.onlyTestExercises
        );

        if (direction === "initial") {
            // Keine AggregationQuery (Quota): Count über Snapshotgröße ermitteln
            const totalSnap = await this.getUebungenSnapshotCached();
            this.pagination.totalCount = totalSnap.size;
            this.pagination.currentPage = 0;
        } else if (direction === "next") {
            this.pagination.currentPage++;
        }

        this.pagination.lastVisible = result.lastVisible;

        this.view.renderUebungsListe(result.uebungen);
        this.view.renderPaginationInfo(
            this.pagination.currentPage, 
            this.pagination.pageSize, 
            result.uebungen.length, 
            this.pagination.totalCount
        );
        this.updateFooterInfo(result.uebungen[0]?.buildVersion);
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
            analytics.track("admin_delete_uebung");
            // console.log("✅ Übung gelöscht:", uebungId); // Removed console.log
            this.invalidateCaches();
            this.ladeAlleUebungen(); // Ansicht aktualisieren
        } catch (error) {
            console.error("❌ Fehler beim Löschen der Übung:", error);
            uiFeedback.error("Fehler beim Löschen der Übung.");
        }
    };

    offeneUebungsleitung(uebungId: string): void {
        analytics.track("admin_open_uebungsleitung");
        window.open(`#/uebungsleitung/${uebungId}`, "_blank");
    }

    uebungAnschauen(uebungId: string): void {
        analytics.track("admin_open_generator");
        window.open(`#/generator/${uebungId}`, "_blank");
    }


    async ladeUebungsStatistik() {
        if (!this.ensureDbReady()) {
            return Array(12).fill(0);
        }
        const snapshot = await this.getUebungenSnapshotCached();
        const countsByMonth = Array(12).fill(0); // Index 0 = Januar, ..., 11 = Dezember

        snapshot.forEach(doc => {
            const data = doc.data();
            // Datum parsen
            let datum = new Date();
            if (data["datum"]) {
                if (typeof data["datum"].toDate === "function") {
                    datum = data["datum"].toDate();
                } else {
                    datum = new Date(data["datum"]);
                }
            }
            
            if (!isNaN(datum.getTime())) {
                const monat = datum.getMonth(); // 0-basiert: Januar = 0
                countsByMonth[monat]++;
            }
        });

        return countsByMonth;
    }

    async renderUebungsStatistik() {
        await this.ladeAdminStatistik();
        const data = await this.ladeUebungsStatistik();
        const labels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
        
        this.view.renderChart(data, labels);
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

    private async getUebungenSnapshotCached() {
        const service = this.getFirebaseService();
        if (!service) {
            throw new Error("AdminController DB is not initialized");
        }
        const key: "all" | "test" = this.onlyTestExercises ? "test" : "all";
        const cached = this.snapshotCache[key];
        if (cached && (Date.now() - cached.ts) <= this.cacheTtlMs) {
            return cached.data;
        }
        const snap = await service.getUebungenSnapshot(this.onlyTestExercises);
        this.snapshotCache[key] = { ts: Date.now(), data: snap };
        return snap;
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
        this.pagination.lastVisible = null;
        this.pagination.currentPage = 0;
        void this.ladeAlleUebungen("initial");
    }

    private invalidateCaches(): void {
        this.snapshotCache = {};
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
