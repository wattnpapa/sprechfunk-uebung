import { Chart, themeFarben } from "../core/chart";
import { formatHHMM } from "./markup";
import type { HeatmapBin, TeilnehmerTimeline } from "./nachrichtenTypen";

interface TimelinePoint {
    x: number;
    y: number;
    nr: number;
    kind: "S" | "E";
}

const KEINE_DATEN = "<small class=\"text-body-secondary\">Noch keine Daten</small>";

/** Balken je 5-Minuten-Fenster; leere Fenster bleiben als blasse Lücke sichtbar. */
export function renderHeatmap(chart: HTMLElement, bins: HeatmapBin[]): void {
    if (!bins.length) {
        chart.innerHTML = KEINE_DATEN;
        return;
    }
    const max = Math.max(...bins.map(b => b.count), 1);
    chart.innerHTML = bins.map((bin, idx) => {
        const label = formatHHMM(bin.bucket);
        const height = Math.max(8, Math.round((bin.count / max) * 86));
        const showTick = idx % 3 === 0 || idx === bins.length - 1;
        const alpha = bin.count === 0 ? 0.16 : Math.min(0.28 + (bin.count / max) * 0.64, 0.92);
        return `
                  <div class="d-flex flex-column align-items-center flex-fill" title="${label}: ${bin.count}">
                    <div style="width:100%;height:${height}px;background:rgba(54,162,235,${alpha});border-radius:4px 4px 0 0;"></div>
                    <small class="text-body-secondary mt-1" style="font-size:.65rem;line-height:1;">${showTick ? label : "&nbsp;"}</small>
                  </div>
                `;
    }).join("");
}

function yLabel(value: string | number, labels: string[]): string {
    const idx = Number(value);
    return Number.isInteger(idx) && idx >= 0 && idx < labels.length ? (labels[idx] ?? "") : "";
}

function tooltipLabel(raw: TimelinePoint, labels: string[]): string {
    if (!raw) {
        return "";
    }
    const participant = labels[raw.y] ?? "";
    return `${participant} · ${raw.kind}${raw.nr} · ${formatHHMM(raw.x)}`;
}

function renderTimelineChart(
    canvas: HTMLCanvasElement,
    labels: string[],
    sendPoints: TimelinePoint[],
    receivePoints: TimelinePoint[]
): void {
    // Punktfarben aus dem Theme; Achsen und Raster färbt initChartTheme().
    const farben = themeFarben();
    new Chart(canvas, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Senden",
                    data: sendPoints,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: farben.akzentHell
                },
                {
                    label: "Empfangen",
                    data: receivePoints,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: farben.warn
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    type: "linear",
                    ticks: { callback: value => formatHHMM(Number(value)) },
                    title: { display: true, text: "Zeit" }
                },
                y: {
                    type: "linear",
                    min: -0.5,
                    max: labels.length - 0.5,
                    reverse: true,
                    ticks: {
                        stepSize: 1,
                        callback: value => yLabel(value, labels)
                    },
                    title: { display: true, text: "Teilnehmer" }
                }
            },
            plugins: {
                legend: { position: "top" },
                tooltip: {
                    callbacks: {
                        label: context => tooltipLabel(context.raw as TimelinePoint, labels)
                    }
                }
            }
        }
    });
}

/** Senden und Empfangen je Teilnehmer als Punkte auf einer gemeinsamen Zeitachse. */
export function renderTeilnehmerTimeline(container: HTMLElement, entries: TeilnehmerTimeline[]): void {
    const withEvents = entries
        .map(entry => ({ teilnehmer: entry.teilnehmer, events: entry.events.slice().sort((a, b) => a.ts - b.ts) }))
        .filter(entry => entry.events.length > 0);
    if (!withEvents.length) {
        container.innerHTML = KEINE_DATEN;
        return;
    }

    const labels = withEvents.map(entry => entry.teilnehmer);
    const sendPoints: TimelinePoint[] = [];
    const receivePoints: TimelinePoint[] = [];
    withEvents.forEach((entry, idx) => {
        entry.events.forEach(event => {
            const point = { x: event.ts, y: idx, nr: event.nr, kind: event.type } as TimelinePoint;
            (event.type === "S" ? sendPoints : receivePoints).push(point);
        });
    });

    if (!sendPoints.length && !receivePoints.length) {
        container.innerHTML = KEINE_DATEN;
        return;
    }

    const laneHeight = Math.max(180, Math.min(700, labels.length * 26 + 40));
    container.innerHTML = `<div style="height:${laneHeight}px"><canvas id="nachrichtenTimelineChart"></canvas></div>`;
    const canvas = document.getElementById("nachrichtenTimelineChart") as HTMLCanvasElement | null;
    if (!canvas) {
        return;
    }
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.destroy();
    }
    renderTimelineChart(canvas, labels, sendPoints, receivePoints);
}
