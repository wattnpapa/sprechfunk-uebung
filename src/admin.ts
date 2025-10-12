import { getDocs, collection, query, orderBy, limit, startAfter, doc, deleteDoc, getFirestore, getCountFromServer, where } from 'firebase/firestore';
import type { Firestore, QueryDocumentSnapshot } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase-config.js';
import Chart from 'chart.js/auto';

class Admin {
    // Firestore database reference
    db: Firestore;
    // Pagination state
    pagination: {
        totalCount: number;
        pageSize: number;
        currentPage: number;
        lastVisible: QueryDocumentSnapshot | null;
    };

    constructor() {
        // Initialize Firebase App
        initializeApp(firebaseConfig);
        // Then get Firestore
        this.db = getFirestore();
        this.pagination = {
            totalCount: 0,
            pageSize: 10,
            currentPage: 0,
            lastVisible: null
        };
    }

    async ladeAdminStatistik() {
        const uebungenCol = collection(this.db, "uebungen");

        // 1️⃣ Gesamtzahl aller Übungen
        const totalSnap = await getCountFromServer(uebungenCol);
        const total = totalSnap.data().count;

        // 2️⃣ Übungen mit Lösungswörtern
        const loesungsSnap = await getCountFromServer(
            query(uebungenCol, where("loesungswoerter", "!=", null))
        );
        const loesungsCount = loesungsSnap.data().count;

        // 3️⃣ Übungen mit Stärkemeldungen
        const staerkeSnap = await getCountFromServer(
            query(uebungenCol, where("loesungsStaerken", "!=", null))
        );
        const staerkeCount = staerkeSnap.data().count;

        // 4️⃣ Übungen mit Buchstabieraufgaben
        const buchstabierSnap = await getCountFromServer(
            query(uebungenCol, where("buchstabierenAn", ">", 0))
        );
        const buchstabierCount = buchstabierSnap.data().count;

        // 5️⃣ Durchschnittliche Teilnehmerzahl (erfordert 1x Abruf, weil Firestore keine Aggregation unterstützt)
        const snapshot = await getDocs(uebungenCol);
        let totalTeilnehmer = 0;
        let totalBytes = 0;
        let totalSprueche = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            totalTeilnehmer += data.teilnehmerListe?.length || 0;
            totalBytes += JSON.stringify(data).length;
            totalSprueche += Object.values(data.nachrichten || {}).flat().length;
        });

        const avgTeilnehmer = total > 0 ? (totalTeilnehmer / total).toFixed(1) : "0";
        const totalKB = (totalBytes / 1024).toFixed(1) + " kB";

        // 6️⃣ Durchschnittliche Dauer (Schätzung)
        const avgDauerSek = total > 0 ? (totalSprueche * 15) / total : 0;
        const avgMin = Math.floor(avgDauerSek / 60);
        const avgSek = Math.round(avgDauerSek % 60);
        const avgDauer = `${avgMin} Min ${avgSek} Sek`;

        // 7️⃣ Prozentwerte
        const p = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) + "%" : "0%");

        // 7️⃣ Durchschnittliche Anzahl an Funksprüchen pro Teilnehmer und Übung
        const avgSpruecheProTeilnehmer =
            totalTeilnehmer > 0 ? (totalSprueche / totalTeilnehmer).toFixed(1) : "0";


        return {
            total,
            totalKB,
            avgTeilnehmer,
            avgDauer,
            avgSpruecheProTeilnehmer,
            pLoesungswort: p(loesungsCount),
            pStaerke: p(staerkeCount),
            pBuchstabieren: p(buchstabierCount),
        };
    }

    async ladeAlleUebungen(direction = "initial") {
        const uebungCol = collection(this.db!, "uebungen");

        // Zähle die Gesamtzahl
        const allDocs = await getDocs(uebungCol);
        this.pagination.totalCount = allDocs.size;

        let q;
        if (direction === "next" && this.pagination.lastVisible) {
            q = query(uebungCol, orderBy("createDate", "desc"), startAfter(this.pagination.lastVisible), limit(this.pagination.pageSize));
            this.pagination.currentPage++;
        } else if (direction === "prev" && this.pagination.currentPage > 0) {
            // Nicht implementiert ohne vorherige Snapshots
            return;
        } else {
            q = query(uebungCol, orderBy("createDate", "desc"), limit(this.pagination.pageSize));
            this.pagination.currentPage = 0;
        }

        const querySnapshot = await getDocs(q);
        const tbody = document.getElementById("adminUebungslisteBody") as HTMLTableSectionElement | null;
        if (!tbody) return;
        // tbody is now non-null
        tbody.innerHTML = "";

        let lastVisible = null;
        querySnapshot.forEach((row) => {
            const uebung = row.data();
            const tr = document.createElement("tr");
            tr.innerHTML = `
            <td>${new Date(uebung.createDate).toLocaleString()}</td>
            <td><a href="?id=${uebung.id}" target="_blank">${uebung.name}</a></td>
            <td>${new Date(uebung.datum).toLocaleDateString()}</td>
            <td>${uebung.rufgruppe}</td>
            <td>${uebung.leitung}</td>
            <td title="${(uebung.teilnehmerListe || []).join('\n')}">${uebung.teilnehmerListe?.length ?? 0}</td>
            <td>${uebung.id}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="admin.loescheUebung('${uebung.id}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
            tbody.appendChild(tr);
            lastVisible = row;
        });

        this.pagination.lastVisible = lastVisible;

        const info = document.getElementById("adminUebungslisteInfo");
        if (info) {
            const from = this.pagination.currentPage * this.pagination.pageSize + 1;
            const to = from + querySnapshot.size - 1;
            info.innerText = `Zeige ${from} - ${to} von ${this.pagination.totalCount}`;
        }
    }

    async loescheUebung(uebungId: string) {
        if (!confirm("Möchtest du diese Übung wirklich löschen?")) return;

        try {
            await deleteDoc(doc(this.db!, "uebungen", uebungId));
            console.log("✅ Übung gelöscht:", uebungId);
            this.ladeAlleUebungen(); // Ansicht aktualisieren
        } catch (error) {
            console.error("❌ Fehler beim Löschen der Übung:", error);
            alert("Fehler beim Löschen der Übung.");
        }
    };

    async ladeUebungsStatistik() {
        const snapshot = await getDocs(collection(this.db!, "uebungen"));
        const countsByMonth = Array(12).fill(0); // Index 0 = Januar, ..., 11 = Dezember

        snapshot.forEach(doc => {
            const data = doc.data();
            const datum = new Date(data.datum);
            const monat = datum.getMonth(); // 0-basiert: Januar = 0
            countsByMonth[monat]++;
        });

        return countsByMonth;
    }

    async renderUebungsStatistik() {
        const stats = await this.ladeAdminStatistik();

        (document.getElementById("infoGroesse") as HTMLElement).innerText = stats.totalKB;
        (document.getElementById("infoTeilnehmer") as HTMLElement).innerText = stats.avgTeilnehmer;
        (document.getElementById("infoDauer") as HTMLElement).innerText = stats.avgDauer;
        (document.getElementById("infoLoesungswort") as HTMLElement).innerText = stats.pLoesungswort;
        (document.getElementById("infoStaerke") as HTMLElement).innerText = stats.pStaerke;
        (document.getElementById("infoBuchstabieren") as HTMLElement).innerText = stats.pBuchstabieren;
        (document.getElementById("infoGesamtUebungen") as HTMLElement).innerText = stats.total.toString();
        (document.getElementById("infoSpruecheProTeilnehmer") as HTMLElement).innerText = stats.avgSpruecheProTeilnehmer;

        const data = await this.ladeUebungsStatistik();
        const labels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

        const canvas = document.getElementById("chartUebungenProTag") as HTMLCanvasElement | null;
        if (!canvas) return; // Falls das Element nicht existiert, abbrechen

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Übungen pro Monat',
                    data: data,
                    backgroundColor: 'rgba(54, 162, 235, 0.7)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    x: { title: { display: true, text: 'Monat' } },
                    y: { title: { display: true, text: 'Anzahl Übungen' }, beginAtZero: true }
                }
            }
        });
    }
}

export const admin = new Admin();