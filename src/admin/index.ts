import { doc, deleteDoc, getFirestore, getCountFromServer, collection } from "firebase/firestore";
import type { Firestore, QueryDocumentSnapshot } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "../firebase-config.js";
import { FirebaseService } from "../services/FirebaseService";
import { AdminView } from "./AdminView";

export class AdminController {
    // Firestore database reference
    db: Firestore;
    // Pagination state
    pagination: {
        totalCount: number;
        pageSize: number;
        currentPage: number;
        lastVisible: QueryDocumentSnapshot | null;
    };
    private firebaseService: FirebaseService;
    private view: AdminView;

    constructor() {
        // Initialize Firebase App
        initializeApp(firebaseConfig);
        // Then get Firestore
        this.db = getFirestore();
        this.firebaseService = new FirebaseService(this.db);
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
            id => this.loescheUebung(id)
        );
    }

    async ladeAdminStatistik() {
        const stats = await this.firebaseService.getAdminStats();

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
        const result = await this.firebaseService.getUebungenPaged(
            this.pagination.pageSize, 
            this.pagination.lastVisible, 
            direction
        );

        if (direction === "initial") {
            // Total count nur einmal laden
            const uebungenCol = collection(this.db, "uebungen");
            const totalSnap = await getCountFromServer(uebungenCol);
            this.pagination.totalCount = totalSnap.data().count;
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
        if (!confirm("Möchtest du diese Übung wirklich löschen?")) {
            return;
        }

        try {
            await deleteDoc(doc(this.db, "uebungen", uebungId));
            // console.log("✅ Übung gelöscht:", uebungId); // Removed console.log
            this.ladeAlleUebungen(); // Ansicht aktualisieren
        } catch (error) {
            console.error("❌ Fehler beim Löschen der Übung:", error);
            alert("Fehler beim Löschen der Übung.");
        }
    };

    offeneUebungsleitung(uebungId: string): void {
        window.open(`#/uebungsleitung/${uebungId}`, "_blank");
    }

    uebungAnschauen(uebungId: string): void {
        window.open(`#/generator/${uebungId}`, "_blank");
    }


    async ladeUebungsStatistik() {
        const snapshot = await this.firebaseService.getUebungenSnapshot();
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

    private updateFooterInfo(version?: string) {
        void version;
        const idEl = document.getElementById("uebungsId");
        if (idEl) {
            idEl.textContent = "-";
        }
    }
}

export const admin = new AdminController();
