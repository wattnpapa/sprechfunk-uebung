import { Chart } from "chart.js/auto";
import { formatNatoDate } from "../utils/date";
import { NachrichtenStatus } from "../types/Storage";
import { escapeHtml } from "../utils/html";

export interface FlattenedNachricht {
    nr: number;
    sender: string;
    empfaenger: string[];
    text: string;
}

export interface HeatmapBin {
    bucket: number;
    count: number;
}

interface TimelineEvent {
    ts: number;
    type: "S" | "E";
    nr: number;
}

export interface TeilnehmerTimeline {
    teilnehmer: string;
    events: TimelineEvent[];
}

interface TimelinePoint {
    x: number;
    y: number;
    nr: number;
    kind: "S" | "E";
}

type NachrichtenCallbacks = {
    onAbgesetzt: (sender: string, nr: number) => void;
    onReset: (sender: string, nr: number) => void;
    onNotiz: (sender: string, nr: number, val: string) => void;
    onFilterSender: (val: string) => void;
    onFilterEmpfaenger: (val: string) => void;
    onToggleHide: (val: boolean) => void;
    onFilterText: (val: string) => void;
};

export class UebungsleitungNachrichtenView {
    public render(options: {
        nachrichten: FlattenedNachricht[];
        nachrichtenStatus: Record<string, NachrichtenStatus>;
        hideAbgesetzt: boolean;
        senderFilter: string;
        empfaengerFilter: string;
        textFilter: string;
    }): void {
        const { nachrichten, nachrichtenStatus, hideAbgesetzt, senderFilter, empfaengerFilter, textFilter } = options;
        const container = document.getElementById("uebungsleitungNachrichten");
        if (!container) {
            return;
        }
        if (!nachrichten.length) {
            container.innerHTML = "<em>Keine Nachrichten vorhanden.</em>";
            return;
        }

        const uniqueSenders = Array.from(new Set(nachrichten.map(n => n.sender))).sort();
        const uniqueEmpfaenger = Array.from(new Set(nachrichten.flatMap(n => n.empfaenger))).sort();
        const rows = nachrichten
            .filter(n => this.passesFilter({
                nachricht: n,
                nachrichtenStatus,
                hideAbgesetzt,
                senderFilter,
                empfaengerFilter,
                textFilter
            }))
            .map(n => this.renderNachrichtenRow(n, nachrichtenStatus))
            .join("");

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-bordered table-striped align-middle">
                    <thead>
                      <tr>
                        <th style="width:60px;">Nr</th>
                        <th style="width:220px;">
                          Empfänger
                          <select id="empfaengerFilterSelect" class="form-select form-select-sm mt-1">
                            <option value="">Alle</option>
                            ${uniqueEmpfaenger.map(e => `<option value="${this.escapeAttr(e)}" ${empfaengerFilter === e ? "selected" : ""}>${escapeHtml(e)}</option>`).join("")}
                          </select>
                        </th>
                        <th style="width:200px;">
                          Sender
                          <select id="senderFilterSelect" class="form-select form-select-sm mt-1">
                            <option value="">Alle</option>
                            ${uniqueSenders.map(s => `<option value="${this.escapeAttr(s)}" ${senderFilter === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
                          </select>
                        </th>
                        <th>
                          Nachricht
                          <input id="nachrichtenTextFilterInput" type="search" class="form-control form-control-sm mt-1" placeholder="Suchen..." value="${this.escapeAttr(textFilter)}">
                        </th>
                        <th style="width:140px;" class="text-center">
                          Abgesetzt 
                          <div class="form-check form-switch d-inline-flex ms-2 align-middle">
                            <input class="form-check-input" type="checkbox" id="toggleHideAbgesetzt" ${hideAbgesetzt ? "checked" : ""}>
                            <label class="form-check-label small ms-1" for="toggleHideAbgesetzt">ausblenden</label>
                          </div>
                        </th>
                        <th style="width:90px;">Zeit</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="mt-3">
              <div class="small text-body-secondary mb-2">Heatmap (5 Minuten)</div>
              <div id="nachrichtenHeatmapChart" class="d-flex align-items-end gap-1" style="height: 110px;"></div>
            </div>
            <div class="mt-3">
              <div class="small text-body-secondary mb-2">Timeline je Teilnehmer</div>
              <div id="nachrichtenTeilnehmerTimeline"></div>
            </div>
        `;
    }

    public bindEvents(callbacks: NachrichtenCallbacks): void {
        const container = document.getElementById("uebungsleitungNachrichten");
        if (!container) {
            return;
        }
        container.addEventListener("click", e => {
            const target = e.target as HTMLElement;
            const btn = target.closest("button");
            if (!btn) {
                return;
            }
            const action = btn.dataset["action"];
            const nr = Number(btn.dataset["nr"]);
            const sender = btn.dataset["sender"];
            if (action === "abgesetzt" && sender) {
                callbacks.onAbgesetzt(sender, nr);
            }
            if (action === "reset" && sender) {
                callbacks.onReset(sender, nr);
            }
        });

        container.addEventListener("change", e => {
            const target = e.target as HTMLInputElement | HTMLSelectElement;
            if (target.id === "senderFilterSelect") {
                callbacks.onFilterSender(target.value);
            }
            if (target.id === "empfaengerFilterSelect") {
                callbacks.onFilterEmpfaenger(target.value);
            }
            if (target.id === "toggleHideAbgesetzt") {
                callbacks.onToggleHide((target as HTMLInputElement).checked);
            }
        });

        container.addEventListener("input", e => {
            const target = e.target as HTMLTextAreaElement | HTMLInputElement;
            if (target.id === "nachrichtenTextFilterInput") {
                callbacks.onFilterText(target.value);
                return;
            }
            if (!target.classList.contains("nachricht-notiz")) {
                return;
            }
            const nr = Number(target.dataset["nr"]);
            const sender = target.dataset["sender"];
            if (sender) {
                callbacks.onNotiz(sender, nr, target.value);
            }
        });
    }

    public updateProgress(total: number, done: number, etaLabel: string): void {
        const bar = document.getElementById("nachrichtenProgressBar");
        const label = document.getElementById("nachrichtenProgressLabel");
        const eta = document.getElementById("nachrichtenEtaLabel");
        if (!bar || !label || !eta) {
            return;
        }
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        bar.style.width = `${percent}%`;
        bar.setAttribute("aria-valuenow", String(percent));
        label.textContent = `${done} / ${total}`;
        eta.textContent = etaLabel;
    }

    public updateOperationalStats(tempoLabel: string, loadLabel: string, heatmapLabel: string): void {
        const tempo = document.getElementById("nachrichtenTempoLabel");
        const load = document.getElementById("nachrichtenLoadLabel");
        const heatmap = document.getElementById("nachrichtenHeatmapLabel");
        if (!tempo || !load || !heatmap) {
            return;
        }
        tempo.textContent = tempoLabel;
        load.textContent = loadLabel;
        heatmap.textContent = heatmapLabel;
    }

    public updateHeatmap(bins: HeatmapBin[]): void {
        const chart = document.getElementById("nachrichtenHeatmapChart");
        if (!chart) {
            return;
        }
        if (!bins.length) {
            chart.innerHTML = "<small class=\"text-body-secondary\">Noch keine Daten</small>";
            return;
        }
        const max = Math.max(...bins.map(b => b.count), 1);
        chart.innerHTML = bins.map((bin, idx) => {
            const d = new Date(bin.bucket);
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            const label = `${hh}:${mm}`;
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

    public updateTeilnehmerTimeline(entries: TeilnehmerTimeline[]): void {
        const container = document.getElementById("nachrichtenTeilnehmerTimeline");
        if (!container) {
            return;
        }

        const withEvents = entries
            .map(entry => ({ teilnehmer: entry.teilnehmer, events: entry.events.slice().sort((a, b) => a.ts - b.ts) }))
            .filter(entry => entry.events.length > 0);
        if (!withEvents.length) {
            container.innerHTML = "<small class=\"text-body-secondary\">Noch keine Daten</small>";
            return;
        }

        const labels = withEvents.map(entry => entry.teilnehmer);
        const sendPoints: TimelinePoint[] = [];
        const receivePoints: TimelinePoint[] = [];
        withEvents.forEach((entry, idx) => {
            entry.events.forEach(event => {
                const point = { x: event.ts, y: idx, nr: event.nr, kind: event.type } as TimelinePoint;
                if (event.type === "S") {
                    sendPoints.push(point);
                    return;
                }
                receivePoints.push(point);
            });
        });

        if (!sendPoints.length && !receivePoints.length) {
            container.innerHTML = "<small class=\"text-body-secondary\">Noch keine Daten</small>";
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
        this.renderTimelineChart(canvas, labels, sendPoints, receivePoints);
    }

    private renderNachrichtenRow(
        nachricht: FlattenedNachricht,
        nachrichtenStatus: Record<string, NachrichtenStatus>
    ): string {
        const key = `${nachricht.sender}__${nachricht.nr}`;
        const status = nachrichtenStatus[key];
        const abgesetzt = Boolean(status?.abgesetztUm);
        const notiz = status?.notiz ?? "";
        return `
                <tr class="${abgesetzt ? "status-ok-row" : "status-pending-row"}">
                  <td class="text-center fw-bold">${nachricht.nr}</td>
                  <td>${nachricht.empfaenger.map(e => `<div>${e}</div>`).join("")}</td>
                  <td>${nachricht.sender}</td>
                  <td class="nachricht-text">
                      ${escapeHtml(nachricht.text).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}
                      <textarea
                        class="form-control form-control-sm mt-2 nachricht-notiz"
                        data-nr="${nachricht.nr}"
                        data-sender="${this.escapeAttr(nachricht.sender)}"
                        placeholder="Notiz zur Nachricht…"
                      >${escapeHtml(notiz)}</textarea>
                    </td>
                  <td class="text-center">
                    ${abgesetzt ? `
                      <div class="d-flex gap-2 justify-content-center">
                        <span class="status-chip status-chip--ok">abgesetzt</span>
                        <button class="btn btn-sm btn-outline-danger" data-action="reset" data-analytics-id="uebungsleitung-reset-nachricht-${nachricht.nr}" data-nr="${nachricht.nr}" data-sender="${this.escapeAttr(nachricht.sender)}" title="Status zurücksetzen">↺</button>
                      </div>
                    ` : `
                      <div class="d-flex gap-2 justify-content-center">
                        <span class="status-chip status-chip--pending">offen</span>
                        <button class="btn btn-sm btn-outline-success" data-action="abgesetzt" data-analytics-id="uebungsleitung-abgesetzt-${nachricht.nr}" data-nr="${nachricht.nr}" data-sender="${this.escapeAttr(nachricht.sender)}">✓ abgesetzt</button>
                      </div>
                    `}
                  </td>
                  <td>${status?.abgesetztUm ? formatNatoDate(status.abgesetztUm) : ""}</td>
                </tr>
              `;
    }

    private passesFilter(options: {
        nachricht: FlattenedNachricht;
        nachrichtenStatus: Record<string, NachrichtenStatus>;
        hideAbgesetzt: boolean;
        senderFilter: string;
        empfaengerFilter: string;
        textFilter: string;
    }): boolean {
        const { nachricht: n, nachrichtenStatus, hideAbgesetzt, senderFilter, empfaengerFilter, textFilter } = options;
        if (senderFilter && n.sender !== senderFilter) {
            return false;
        }
        if (empfaengerFilter && !n.empfaenger.includes(empfaengerFilter)) {
            return false;
        }
        if (textFilter && !n.text.toLowerCase().includes(textFilter.toLowerCase())) {
            return false;
        }
        if (!hideAbgesetzt) {
            return true;
        }
        const key = `${n.sender}__${n.nr}`;
        return !nachrichtenStatus[key]?.abgesetztUm;
    }

    private renderTimelineChart(
        canvas: HTMLCanvasElement,
        labels: string[],
        sendPoints: TimelinePoint[],
        receivePoints: TimelinePoint[]
    ): void {
        new Chart(canvas, {
            type: "scatter",
            data: {
                datasets: [
                    {
                        label: "Senden",
                        data: sendPoints,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: "#3b82f6"
                    },
                    {
                        label: "Empfangen",
                        data: receivePoints,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: "#9ca3af"
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
                        ticks: { callback: value => this.toClock(Number(value)) },
                        title: { display: true, text: "Zeit" }
                    },
                    y: {
                        type: "linear",
                        min: -0.5,
                        max: labels.length - 0.5,
                        reverse: true,
                        ticks: {
                            stepSize: 1,
                            callback: value => this.yLabel(value, labels)
                        },
                        title: { display: true, text: "Teilnehmer" }
                    }
                },
                plugins: {
                    legend: { position: "top" },
                    tooltip: {
                        callbacks: {
                            label: context => this.tooltipLabel(context.raw as TimelinePoint, labels)
                        }
                    }
                }
            }
        });
    }

    private toClock(ts: number): string {
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    }

    private yLabel(value: string | number, labels: string[]): string {
        const idx = Number(value);
        return Number.isInteger(idx) && idx >= 0 && idx < labels.length ? (labels[idx] ?? "") : "";
    }

    private tooltipLabel(raw: TimelinePoint, labels: string[]): string {
        if (!raw) {
            return "";
        }
        const participant = labels[raw.y] ?? "";
        return `${participant} · ${raw.kind}${raw.nr} · ${this.toClock(raw.x)}`;
    }

    private escapeAttr(value: string): string {
        return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
}
