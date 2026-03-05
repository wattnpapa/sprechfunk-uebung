import { Chart } from "chart.js";
import { FunkUebung } from "../models/FunkUebung";
import type { PreviewPage } from "./GeneratorPreviewService";
import type { UebungsDauerStats, VerteilungsStats } from "./GeneratorStatsService";

export class GeneratorResultRenderer {
    public renderPreview(page: PreviewPage | null): void {
        if (!page) {
            return;
        }
        const iframe = document.getElementById("resultFrame") as HTMLIFrameElement;
        if (iframe) {
            iframe.srcdoc = page.html;
        }
        const pageInfo = document.getElementById("current-page");
        if (pageInfo) {
            pageInfo.textContent = `Seite ${page.index + 1} / ${page.total}`;
        }
    }

    public renderGeneratorStatus(uebung: FunkUebung, stats: UebungsDauerStats, mode: "none" | "central" | "individual"): void {
        const teilnehmerCount = uebung.teilnehmerListe?.filter(Boolean).length ?? 0;
        const nachrichtenCount = Object.values(uebung.nachrichten || {}).reduce((sum, list) => sum + list.length, 0);
        const modeLabel = mode === "none" ? "Keine" : mode === "central" ? "Zentral" : "Individuell";
        this.setText("statusTeilnehmerCount", String(teilnehmerCount));
        this.setText("statusNachrichtenCount", String(nachrichtenCount));
        this.setText("statusLoesungswortMode", modeLabel);
        this.setText("statusDauerEstimate", `${stats.optimal.toFixed(0)} Min`);
    }

    public renderDuration(stats: UebungsDauerStats): void {
        this.setText("dauerOptimalMinuten", `${stats.optimal.toFixed()} Min`);
        this.setText("dauerOptimalStundenMinuten", `${stats.optimalFormatted.stunden} Std ${stats.optimalFormatted.minuten.toFixed(0)} Min`);
        this.setText("durchschnittOptimal", `${stats.durchschnittOptimal.toFixed(2)} Sek`);
        this.setText("dauerLangsamMinuten", `${stats.schlecht.toFixed()} Min`);
        this.setText("dauerLangsamStundenMinuten", `${stats.schlechtFormatted.stunden} Std ${stats.schlechtFormatted.minuten.toFixed(0)} Min`);
        this.setText("durchschnittLangsam", `${stats.durchschnittSchlecht.toFixed(2)} Sek`);
    }

    public renderChart(chart: VerteilungsStats): void {
        const canvas = document.getElementById("distributionChart") as HTMLCanvasElement;
        if (!canvas) {
            return;
        }
        if (window.chart) {
            window.chart.destroy();
        }
        window.chart = new Chart(canvas, {
            type: "bar",
            data: {
                labels: chart.labels,
                datasets: [{
                    label: "Empfangene Nachrichten",
                    data: chart.counts,
                    backgroundColor: "#4CAF50",
                    borderColor: "#388E3C",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { beginAtZero: true, title: { display: true, text: "Teilnehmer" } },
                    y: { beginAtZero: true, title: { display: true, text: "Anzahl der Nachrichten" } }
                }
            }
        });
    }

    private setText(id: string, value: string): void {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }
}
