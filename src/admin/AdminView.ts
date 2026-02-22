import { Uebung } from "../types/Uebung";
import { Chart } from "chart.js/auto";

export class AdminView {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public renderStatistik(stats: any) {
        this.setText("infoGroesse", stats.totalKB);
        this.setText("infoTeilnehmer", stats.avgTeilnehmer);
        this.setText("infoDauer", stats.avgDauer);
        this.setText("infoLoesungswort", stats.pLoesungswort);
        this.setText("infoStaerke", stats.pStaerke);
        this.setText("infoBuchstabieren", stats.pBuchstabieren);
        this.setText("infoGesamtUebungen", stats.total.toString());
        this.setText("infoSpruecheProTeilnehmer", stats.avgSpruecheProTeilnehmer);
    }

    public renderUebungsListe(uebungen: Uebung[]) {
        const tbody = document.getElementById("adminUebungslisteBody");
        if (!tbody) {
            return;
        }
        
        tbody.innerHTML = "";

        uebungen.forEach(uebung => {
            const tr = document.createElement("tr");
            tr.setAttribute("data-search", `${uebung.id} ${uebung.name} ${uebung.rufgruppe} ${uebung.leitung}`.toLowerCase());
            if (uebung.istStandardKonfiguration) {
                tr.classList.add("admin-standard-uebung-row");
            }
            tr.innerHTML = `
                <td>${uebung.createDate ? new Date(uebung.createDate).toLocaleString() : "-"}</td>
                <td><a href="#/generator/${uebung.id}" target="_blank">${uebung.name}</a></td>
                <td>${uebung.datum ? new Date(uebung.datum).toLocaleDateString() : "-"}</td>
                <td>${uebung.rufgruppe}</td>
                <td>${uebung.leitung}</td>
                <td title="${(uebung.teilnehmerListe || []).join("\n")}">${uebung.teilnehmerListe?.length ?? 0}</td>
                <td>
                     <button class="btn btn-sm btn-warning" data-action="view" data-analytics-id="admin-view-${uebung.id}" data-id="${uebung.id}">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                    <button class="btn btn-sm btn-success" data-action="monitor" data-analytics-id="admin-monitor-${uebung.id}" data-id="${uebung.id}">
                        <i class="fas fa-display"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-analytics-id="admin-delete-${uebung.id}" data-id="${uebung.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.applySearchFilter();
    }

    public renderPaginationInfo(currentPage: number, pageSize: number, currentCount: number, totalCount: number) {
        const info = document.getElementById("adminUebungslisteInfo");
        if (info) {
            const from = currentPage * pageSize + 1;
            const to = from + currentCount - 1;
            info.innerText = `Zeige ${from} - ${to} von ${totalCount}`;
        }
    }

    public renderChart(data: number[], labels: string[]) {
        const canvas = document.getElementById("chartUebungenProTag") as HTMLCanvasElement | null;
        if (!canvas) {
            return;
        }

        const existingChart = Chart.getChart(canvas);
        if (existingChart) {
            existingChart.destroy();
        }

        new Chart(canvas, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Übungen pro Monat",
                    data: data,
                    backgroundColor: "rgba(54, 162, 235, 0.7)",
                    borderColor: "rgba(54, 162, 235, 1)",
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    x: { title: { display: true, text: "Monat" } },
                    y: { title: { display: true, text: "Anzahl Übungen" }, beginAtZero: true }
                }
            }
        });
    }

    public bindListEvents(
        onView: (id: string) => void,
        onMonitor: (id: string) => void,
        onDelete: (id: string) => void,
        onOnlyTestFilterChange?: (checked: boolean) => void
    ) {
        const tbody = document.getElementById("adminUebungslisteBody");
        if (!tbody) {
            return;
        }

        tbody.addEventListener("click", e => {
            const target = e.target as HTMLElement;
            const btn = target.closest("button");
            if (!btn) {
                return;
            }

            const action = btn.dataset["action"];
            const id = btn.dataset["id"];

            if (id) {
                if (action === "view") {
                    onView(id);
                }
                if (action === "monitor") {
                    onMonitor(id);
                }
                if (action === "delete") {
                    onDelete(id);
                }
            }
        });

        document.getElementById("adminSearchInput")?.addEventListener("input", () => {
            this.applySearchFilter();
        });
        document.getElementById("adminOnlyTestFilter")?.addEventListener("change", e => {
            const checked = (e.target as HTMLInputElement).checked;
            onOnlyTestFilterChange?.(checked);
        });
    }

    private applySearchFilter() {
        const q = (document.getElementById("adminSearchInput") as HTMLInputElement | null)?.value?.trim().toLowerCase() ?? "";
        const rows = document.querySelectorAll<HTMLTableRowElement>("#adminUebungslisteBody tr");
        rows.forEach(row => {
            const haystack = row.getAttribute("data-search") || "";
            row.style.display = !q || haystack.includes(q) ? "" : "none";
        });
    }

    private setText(id: string, text: string) {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = text;
        }
    }
}
