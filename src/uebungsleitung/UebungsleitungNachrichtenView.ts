import { Chart } from "../core/chart";
import { formatNatoDate } from "../utils/date";
import type { LiveSyncState } from "../types/LiveStatus";
import type { EffektiverNachrichtenStatus } from "../services/liveStatusMerge";
import { escapeHtml } from "../utils/html";
import type { NachrichtArt } from "../types/Nachricht";
import { nachrichtenArtBadgeClass, nachrichtenArtLabel } from "../utils/nachrichtenArt";
import type { Meldeart, UebermittlungsWeg } from "../types/FuehrungsstellenUebung";
import { renderFuehrungsstellenHinweise } from "../utils/fuehrungsstelle";
import { faelligkeitLabel, statusKey, type Faelligkeit } from "./lagebild";

export interface FlattenedNachricht {
    nr: number;
    sender: string;
    empfaenger: string[];
    text: string;
    xZeitSlot?: number;
    art?: NachrichtArt;
    /** Fortlaufende, eindeutige Nummer im Nachrichtenplan (1 … n). */
    planNr?: number;
    /** Führungsstellen-Übung: Weg, Meldeart, Betreff und erwartete Reaktion der beübten Stelle. */
    weg?: UebermittlungsWeg;
    meldeart?: Meldeart;
    betreff?: string;
    erwartung?: string;
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
    onZeitNachtragen?: (sender: string, nr: number, hhmm: string) => void;
    onNotiz: (sender: string, nr: number, val: string) => void;
    onFilterSender: (val: string) => void;
    onFilterEmpfaenger: (val: string) => void;
    onToggleHide: (val: boolean) => void;
    onFilterText: (val: string) => void;
};

export interface NachrichtenRenderOptionen {
    nachrichten: FlattenedNachricht[];
    nachrichtenStatus: Record<string, EffektiverNachrichtenStatus>;
    hideAbgesetzt: boolean;
    senderFilter: string;
    empfaengerFilter: string;
    textFilter: string;
    /** Fälligkeit je offener Zeile (X-Zeit mit verbindlicher Basis). */
    faelligkeit?: Record<string, Faelligkeit>;
    /** Soll-Uhrzeit „HH:MM“ je Zeile (X-Zeit mit verbindlicher Basis). */
    sollUhrzeit?: Record<string, string>;
    /** Zeilen, deren Rücknahme direkt nach dem Markieren noch gesperrt ist. */
    ruecknahmeGesperrt?: Set<string>;
}

function hhmmAus(iso: string | undefined): string {
    const ts = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(ts)) {
        return "";
    }
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export class UebungsleitungNachrichtenView {
    /** Zeile, deren Absetzzeit gerade von Hand eingetragen wird. */
    private zeitEditKey: string | null = null;
    /** Aufgeklappte Notizfelder – Notizen erscheinen erst auf Wunsch. */
    private offeneNotizen = new Set<string>();
    private letzteOptionen: NachrichtenRenderOptionen | null = null;

    public render(options: NachrichtenRenderOptionen): void {
        this.letzteOptionen = options;
        const { nachrichten, nachrichtenStatus, hideAbgesetzt, senderFilter, empfaengerFilter, textFilter } = options;
        const container = document.getElementById("uebungsleitungNachrichten");
        if (!container) {
            return;
        }
        if (!nachrichten.length) {
            container.innerHTML = "<em>Keine Nachrichten vorhanden.</em>";
            return;
        }
        // Seitwärts gescrollte Tabelle (Tablet/Handy) nach dem Neuaufbau nicht nach links springen lassen.
        const scrollLeft = container.querySelector<HTMLElement>(".table-responsive")?.scrollLeft ?? 0;

        const zeigeXZeit = nachrichten.some(n => n.xZeitSlot !== undefined);
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
            .map(n => this.renderNachrichtenRow(n, options, zeigeXZeit))
            .join("");

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-bordered table-striped align-middle uebungsleitung-plan">
                    <thead>
                      <tr>
                        <th style="width:70px;" title="Fortlaufende Nummer im Plan; darunter die Nummer beim Absender, wie sie auf dem Vordruck steht">Nr</th>
                        <th style="width:170px;" class="text-center">
                          Status
                          <div class="form-check form-switch d-flex justify-content-center gap-1 mt-1">
                            <input class="form-check-input" type="checkbox" id="toggleHideAbgesetzt" ${hideAbgesetzt ? "checked" : ""}>
                            <label class="form-check-label small" for="toggleHideAbgesetzt">Abgesetzte ausblenden</label>
                          </div>
                        </th>
                        <th style="width:200px;">
                          Empfänger
                          <select id="empfaengerFilterSelect" class="form-select form-select-sm mt-1">
                            <option value="">Alle</option>
                            ${uniqueEmpfaenger.map(e => `<option value="${this.escapeAttr(e)}" ${empfaengerFilter === e ? "selected" : ""}>${escapeHtml(e)}</option>`).join("")}
                          </select>
                        </th>
                        <th style="width:180px;">
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
                        ${zeigeXZeit ? "<th style=\"width:110px;\" title=\"Soll-Uhrzeit laut Zeitplan und X-Zeit\">Soll</th>" : ""}
                        <th style="width:150px;">Zeit</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="mt-3" id="nachrichtenAuswertung">
              <div class="small text-body-secondary mb-2">Heatmap (5 Minuten)</div>
              <div id="nachrichtenHeatmapChart" class="d-flex align-items-end gap-1" style="height: 110px;"></div>
            </div>
            <div class="mt-3">
              <div class="small text-body-secondary mb-2">Timeline je Teilnehmer</div>
              <div id="nachrichtenTeilnehmerTimeline"></div>
            </div>
        `;
        const tabelle = container.querySelector<HTMLElement>(".table-responsive");
        if (tabelle && scrollLeft) {
            tabelle.scrollLeft = scrollLeft;
        }
    }

    private rerender(): void {
        if (this.letzteOptionen) {
            this.render(this.letzteOptionen);
        }
    }

    public bindEvents(callbacks: NachrichtenCallbacks): void {
        const container = document.getElementById("uebungsleitungNachrichten");
        if (!container) {
            return;
        }
        container.addEventListener("click", e => {
            const target = e.target as HTMLElement;
            const btn = target.closest("button");
            if (!btn || (btn as HTMLButtonElement).disabled) {
                return;
            }
            const action = btn.dataset["action"];
            const nr = Number(btn.dataset["nr"]);
            const sender = btn.dataset["sender"];
            if (!sender) {
                return;
            }
            if (action === "abgesetzt") {
                callbacks.onAbgesetzt(sender, nr);
            } else if (action === "reset") {
                callbacks.onReset(sender, nr);
            } else if (action === "zeit-bearbeiten") {
                this.zeitEditKey = statusKey(sender, nr);
                this.rerender();
                container.querySelector<HTMLInputElement>("input.ul-zeit-input")?.focus();
            } else if (action === "zeit-abbrechen") {
                this.zeitEditKey = null;
                this.rerender();
            } else if (action === "zeit-speichern") {
                this.speichereZeit(container, sender, nr, callbacks);
            } else if (action === "notiz-oeffnen") {
                this.oeffneNotiz(btn, sender, nr);
            }
        });

        container.addEventListener("keydown", e => {
            const target = e.target as HTMLInputElement;
            if (!target.classList?.contains("ul-zeit-input")) {
                return;
            }
            const sender = target.dataset["sender"];
            const nr = Number(target.dataset["nr"]);
            if (e.key === "Enter" && sender) {
                e.preventDefault();
                this.speichereZeit(container, sender, nr, callbacks);
            } else if (e.key === "Escape") {
                this.zeitEditKey = null;
                this.rerender();
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

    private speichereZeit(container: HTMLElement, sender: string, nr: number, callbacks: NachrichtenCallbacks): void {
        const input = container.querySelector<HTMLInputElement>("input.ul-zeit-input");
        const wert = input?.value ?? "";
        this.zeitEditKey = null;
        if (wert && callbacks.onZeitNachtragen) {
            callbacks.onZeitNachtragen(sender, nr, wert);
            return;
        }
        this.rerender();
    }

    /** Notizfeld erst auf Wunsch – hält die Zeilen niedrig. */
    private oeffneNotiz(btn: HTMLElement, sender: string, nr: number): void {
        this.offeneNotizen.add(statusKey(sender, nr));
        const textarea = document.createElement("textarea");
        textarea.className = "form-control form-control-sm mt-2 nachricht-notiz";
        textarea.dataset["nr"] = String(nr);
        textarea.dataset["sender"] = sender;
        textarea.placeholder = "Notiz zur Nachricht…";
        btn.replaceWith(textarea);
        textarea.focus();
    }

    /**
     * @param done       erledigt laut Teilnehmer-Meldung oder Bestätigung der Leitung
     * @param nurGemeldet Teilmenge davon, die die Leitung noch nicht bestätigt hat
     */
    public updateProgress(total: number, done: number, etaLabel: string, nurGemeldet = 0): void {
        const bar = document.getElementById("nachrichtenProgressBar");
        const label = document.getElementById("nachrichtenProgressLabel");
        const eta = document.getElementById("nachrichtenEtaLabel");
        if (!bar || !label || !eta) {
            return;
        }
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;
        bar.style.width = `${percent}%`;
        bar.setAttribute("aria-valuenow", String(percent));
        label.textContent = nurGemeldet > 0
            ? `${done} / ${total} (${nurGemeldet} nur gemeldet)`
            : `${done} / ${total}`;
        eta.textContent = etaLabel;
    }

    /**
     * Zeigt ehrlich, ob die Änderungen beim Server ankommen. „offline“ heißt:
     * liegt lokal und wird nachgereicht; „Fehler“ heißt: wird nicht übertragen.
     */
    public updateLiveSyncState(state: LiveSyncState, offeneAenderungen = 0): void {
        const badge = document.getElementById("uebungsleitungLiveSyncBadge");
        if (!badge) {
            return;
        }
        const offen = offeneAenderungen > 0 ? ` (${offeneAenderungen} offen)` : "";
        const labels: Record<LiveSyncState, { text: string; css: string; title: string }> = {
            aus: { text: "Live-Status: aus", css: "bg-secondary", title: "Live-Sync deaktiviert – es zählt nur, was auf diesem Gerät markiert wird." },
            verbinde: { text: "Live-Status: verbinde…", css: "bg-secondary", title: "Verbindung wird aufgebaut." },
            live: { text: "Live-Status: live", css: "bg-success", title: "Der Server hat die letzten Änderungen bestätigt; Teilnehmer-Meldungen treffen live ein." },
            offline: {
                text: `Live-Status: offline – wird nachgereicht${offen}`,
                css: "bg-warning text-dark",
                title: "Keine Verbindung. Deine Markierungen liegen auf diesem Gerät und werden übertragen, sobald wieder Netz da ist. Lade die Seite bis dahin nicht neu. Angezeigt wird der zuletzt bekannte Stand der Teilnehmer."
            },
            fehler: {
                text: "Live-Status: Fehler – wird nicht übertragen",
                css: "bg-danger",
                title: "Der Server lehnt die Änderungen ab. Sie bleiben nur auf diesem Gerät. Halte den Stand auf Papier fest."
            }
        };
        const label = labels[state];
        badge.className = `badge ${label.css}`;
        badge.textContent = label.text;
        badge.setAttribute("title", label.title);
        badge.dataset["state"] = state;
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
        options: NachrichtenRenderOptionen,
        zeigeXZeit: boolean
    ): string {
        const key = statusKey(nachricht.sender, nachricht.nr);
        const status: EffektiverNachrichtenStatus = options.nachrichtenStatus[key] ?? {};
        const abgesetzt = Boolean(status.abgesetztUm);
        const gemeldet = !abgesetzt && Boolean(status.gemeldetUm);
        const faelligkeit = abgesetzt || gemeldet ? undefined : options.faelligkeit?.[key];
        const notiz = status.notiz ?? "";
        const hinweise = renderFuehrungsstellenHinweise(nachricht);
        const zeilenKlasse = abgesetzt
            ? "status-ok-row"
            : gemeldet
                ? "status-gemeldet-row"
                : `status-pending-row${faelligkeit ? ` plan-zeile--${faelligkeit.zustand}` : ""}`;
        const planNr = nachricht.planNr ?? nachricht.nr;
        const notizHtml = notiz || this.offeneNotizen.has(key)
            ? `<textarea
                        class="form-control form-control-sm mt-2 nachricht-notiz"
                        data-nr="${nachricht.nr}"
                        data-sender="${this.escapeAttr(nachricht.sender)}"
                        placeholder="Notiz zur Nachricht…"
                      >${escapeHtml(notiz)}</textarea>`
            : `<button type="button" class="btn btn-sm btn-link px-0 mt-1 ul-notiz-oeffnen" data-action="notiz-oeffnen" data-nr="${nachricht.nr}" data-sender="${this.escapeAttr(nachricht.sender)}">+ Notiz</button>`;
        return `
                <tr class="${zeilenKlasse}" data-plan-nr="${planNr}"${faelligkeit ? ` data-plan-zustand="${faelligkeit.zustand}"` : ""}>
                  <td class="text-center">
                    <div class="fw-bold">${planNr}</div>
                    <small class="text-body-secondary text-nowrap" title="Nummer beim Absender – steht so auf dem Vordruck">Abs.-Nr. ${nachricht.nr}</small>
                  </td>
                  <td class="text-center">${this.renderStatusCell(nachricht, status, faelligkeit)}</td>
                  <td>${nachricht.empfaenger.map(e => `<div>${escapeHtml(e)}</div>`).join("")}</td>
                  <td>${escapeHtml(nachricht.sender)}</td>
                  <td class="nachricht-text">
                      ${nachricht.art ? `<span class="${nachrichtenArtBadgeClass(nachricht.art)} me-2">${nachrichtenArtLabel(nachricht.art)}</span>` : ""}${hinweise.kopf}${escapeHtml(nachricht.text).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}${hinweise.fuss}
                      ${notizHtml}
                    </td>
                  ${zeigeXZeit ? `<td>${this.renderSollCell(nachricht, options.sollUhrzeit?.[key])}</td>` : ""}
                  <td>${this.renderZeitCell(nachricht, status, options.ruecknahmeGesperrt?.has(key) ?? false)}</td>
                </tr>
              `;
    }

    /**
     * Statuszelle: oben der Zustand, darunter die Aktion bzw. die Herkunft.
     * Der Zustand trägt Haken und Füllung, die Aktion ist neutral beschriftet –
     * auch in Graustufen unterscheidbar (THW-Review night-visibility 5). Nach
     * dem Markieren steht an der Stelle des Knopfs nur Text, kein Rücksetzen.
     */
    private renderStatusCell(
        nachricht: FlattenedNachricht,
        status: EffektiverNachrichtenStatus,
        faelligkeit: Faelligkeit | undefined
    ): string {
        const sender = this.escapeAttr(nachricht.sender);
        if (status.abgesetztUm) {
            const herkunft = `Leitung ${hhmmAus(status.abgesetztUm)}${status.nachgetragen ? " · nachgetragen" : ""}`;
            const tn = status.gemeldetUm ? `<small class="text-body-secondary">TN ${hhmmAus(status.gemeldetUm)}</small>` : "";
            return `
                      <div class="ul-status-zelle">
                        <span class="status-chip status-chip--ok status-chip--fest">✓ abgesetzt</span>
                        <small class="text-body-secondary">${herkunft}</small>
                        ${tn}
                      </div>`;
        }

        if (status.gemeldetUm) {
            return `
                      <div class="ul-status-zelle">
                        <span class="status-chip status-chip--gemeldet" title="Vom Teilnehmer selbst gemeldet, von der Leitung noch nicht bestätigt">gemeldet (TN)</span>
                        <button class="btn btn-sm btn-outline-primary ul-aktion" data-action="abgesetzt" data-nr="${nachricht.nr}" data-sender="${sender}">Bestätigen</button>
                        <small class="text-body-secondary" title="Vom Teilnehmer selbst gemeldet, noch nicht bestätigt">Teilnehmer: ${formatNatoDate(status.gemeldetUm)}</small>
                      </div>`;
        }

        const faellig = faelligkeit
            ? `<span class="badge plan-badge plan-badge--${faelligkeit.zustand}">${escapeHtml(faelligkeitLabel(faelligkeit))}</span>`
            : "";
        return `
                      <div class="ul-status-zelle">
                        <span class="status-chip status-chip--pending">offen</span>
                        <button class="btn btn-sm btn-outline-primary ul-aktion" data-action="abgesetzt" data-nr="${nachricht.nr}" data-sender="${sender}">Als abgesetzt markieren</button>
                        ${faellig}
                      </div>`;
    }

    /** Soll-Uhrzeit (sobald eine Basis gesetzt ist) und X+n. */
    private renderSollCell(nachricht: FlattenedNachricht, soll: string | undefined): string {
        if (nachricht.xZeitSlot === undefined) {
            return "";
        }
        const xzeit = `<span class="badge bg-secondary">X+${nachricht.xZeitSlot}</span>`;
        return soll ? `<div class="fw-semibold font-monospace">${soll}</div>${xzeit}` : xzeit;
    }

    /**
     * Zeit der Erledigung, Papier-Nachtrag und – räumlich getrennt von
     * „Als abgesetzt markieren“ – die Rücknahme.
     */
    private renderZeitCell(nachricht: FlattenedNachricht, status: EffektiverNachrichtenStatus, gesperrt: boolean): string {
        const key = statusKey(nachricht.sender, nachricht.nr);
        const sender = this.escapeAttr(nachricht.sender);
        const daten = `data-nr="${nachricht.nr}" data-sender="${sender}"`;
        if (this.zeitEditKey === key) {
            return `
                <div class="d-flex flex-column gap-1">
                  <label class="small text-body-secondary" for="ulZeitInput">Abgesetzt um</label>
                  <input type="time" id="ulZeitInput" class="form-control form-control-sm ul-zeit-input" ${daten} value="${hhmmAus(status.abgesetztUm ?? status.gemeldetUm)}">
                  <div class="d-flex gap-1">
                    <button type="button" class="btn btn-sm btn-primary" data-action="zeit-speichern" ${daten}>OK</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="zeit-abbrechen" ${daten}>Abbrechen</button>
                  </div>
                </div>`;
        }
        // `erledigtUm` ist der frühere Zeitpunkt aus Teilnehmer-Meldung und Bestätigung.
        const zeitpunkt = status.erledigtUm ?? status.abgesetztUm;
        const zeit = zeitpunkt ? `<div>${formatNatoDate(zeitpunkt)}</div>` : "";
        if (!status.abgesetztUm) {
            return `${zeit}<button type="button" class="btn btn-sm btn-link px-0" data-action="zeit-bearbeiten" ${daten} title="Auf Papier abgehakt? Absetzzeit von Hand eintragen">Zeit nachtragen</button>`;
        }
        const ruecknahme = gesperrt
            ? `<button type="button" class="btn btn-sm btn-link px-0 text-danger" data-action="reset" ${daten} disabled title="Kurz gesperrt, damit ein Doppeltipp die Markierung nicht aufhebt">zurücknehmen</button>`
            : `<button type="button" class="btn btn-sm btn-link px-0 text-danger" data-action="reset" ${daten} title="Status zurücksetzen">zurücknehmen</button>`;
        return `${zeit}
                <div class="d-flex flex-wrap gap-2">
                  <button type="button" class="btn btn-sm btn-link px-0" data-action="zeit-bearbeiten" ${daten}>Zeit ändern</button>
                  ${ruecknahme}
                </div>`;
    }

    private passesFilter(options: {
        nachricht: FlattenedNachricht;
        nachrichtenStatus: Record<string, EffektiverNachrichtenStatus>;
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
        return !nachrichtenStatus[statusKey(n.sender, n.nr)]?.abgesetztUm;
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
