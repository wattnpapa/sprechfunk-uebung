import { getDocs, collection, query, orderBy, limit, startAfter, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

class Admin {

    constructor() {
        this.db = null;
        this.pagination = null;
    }

    async ladeAlleUebungen(direction = "initial") {
        const uebungCol = collection(this.db, "uebungen");

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
        const tbody = document.getElementById("adminUebungslisteBody");
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

    async loescheUebung (uebungId) {
        if (!confirm("Möchtest du diese Übung wirklich löschen?")) return;

        try {
            await deleteDoc(doc(this.db, "uebungen", uebungId));
            console.log("✅ Übung gelöscht:", uebungId);
            this.ladeAlleUebungen(); // Ansicht aktualisieren
        } catch (error) {
            console.error("❌ Fehler beim Löschen der Übung:", error);
            alert("Fehler beim Löschen der Übung.");
        }
        };

    async ladeUebungsStatistik() {
        const snapshot = await getDocs(collection(this.db, "uebungen"));
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
        const data = await this.ladeUebungsStatistik();
        const labels = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    
        new Chart(document.getElementById("chartUebungenProTag"), {
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