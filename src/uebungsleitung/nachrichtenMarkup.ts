import { formatNatoDate } from "../utils/date";
import type { EffektiverNachrichtenStatus } from "../services/liveStatusMerge";
import { escapeHtml } from "../utils/html";
import { nachrichtenArtBadgeClass, nachrichtenArtLabel } from "../utils/nachrichtenArt";
import { renderFuehrungsstellenHinweise } from "../utils/fuehrungsstelle";
import { faelligkeitLabel, statusKey, type Faelligkeit } from "./lagebild";
import { escapeAttr, hhmmAus } from "./markup";
import type { FlattenedNachricht, NachrichtenRenderOptionen } from "./nachrichtenTypen";

/** Zustand der Ansicht, der beim Neuaufbau der Tabelle erhalten bleibt. */
export interface NachrichtenZeilenZustand {
    /** Zeile, deren Absetzzeit gerade von Hand eingetragen wird. */
    zeitEditKey: string | null;
    /** Aufgeklappte Notizfelder – Notizen erscheinen erst auf Wunsch. */
    offeneNotizen: Set<string>;
}

function filterOptionen(werte: string[], gewaehlt: string): string {
    return werte.map(w => `<option value="${escapeAttr(w)}" ${gewaehlt === w ? "selected" : ""}>${escapeHtml(w)}</option>`).join("");
}

export function renderNachrichtenTabelle(options: NachrichtenRenderOptionen, rows: string, zeigeXZeit: boolean): string {
    const { nachrichten, hideAbgesetzt, senderFilter, empfaengerFilter, textFilter } = options;
    const uniqueSenders = Array.from(new Set(nachrichten.map(n => n.sender))).sort();
    const uniqueEmpfaenger = Array.from(new Set(nachrichten.flatMap(n => n.empfaenger))).sort();
    return `
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
                            ${filterOptionen(uniqueEmpfaenger, empfaengerFilter)}
                          </select>
                        </th>
                        <th style="width:180px;">
                          Sender
                          <select id="senderFilterSelect" class="form-select form-select-sm mt-1">
                            <option value="">Alle</option>
                            ${filterOptionen(uniqueSenders, senderFilter)}
                          </select>
                        </th>
                        <th>
                          Nachricht
                          <input id="nachrichtenTextFilterInput" type="search" class="form-control form-control-sm mt-1" placeholder="Suchen..." value="${escapeAttr(textFilter)}">
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
}

export function passesFilter(nachricht: FlattenedNachricht, options: NachrichtenRenderOptionen): boolean {
    const { nachrichtenStatus, hideAbgesetzt, senderFilter, empfaengerFilter, textFilter } = options;
    if (senderFilter && nachricht.sender !== senderFilter) {
        return false;
    }
    if (empfaengerFilter && !nachricht.empfaenger.includes(empfaengerFilter)) {
        return false;
    }
    if (textFilter && !nachricht.text.toLowerCase().includes(textFilter.toLowerCase())) {
        return false;
    }
    if (!hideAbgesetzt) {
        return true;
    }
    return !nachrichtenStatus[statusKey(nachricht.sender, nachricht.nr)]?.abgesetztUm;
}

interface ZeilenZustand {
    klasse: string;
    faelligkeit: Faelligkeit | undefined;
}

/** Abgesetzt, nur gemeldet oder offen – offene Zeilen tragen ihre Fälligkeit. */
function zeilenZustand(status: EffektiverNachrichtenStatus, faelligkeit: Faelligkeit | undefined): ZeilenZustand {
    if (status.abgesetztUm) {
        return { klasse: "status-ok-row", faelligkeit: undefined };
    }
    if (status.gemeldetUm) {
        return { klasse: "status-gemeldet-row", faelligkeit: undefined };
    }
    return { klasse: `status-pending-row${faelligkeit ? ` plan-zeile--${faelligkeit.zustand}` : ""}`, faelligkeit };
}

function renderNotiz(nachricht: FlattenedNachricht, notiz: string, offen: boolean): string {
    if (notiz || offen) {
        return `<textarea
                        class="form-control form-control-sm mt-2 nachricht-notiz"
                        data-nr="${nachricht.nr}"
                        data-sender="${escapeAttr(nachricht.sender)}"
                        placeholder="Notiz zur Nachricht…"
                      >${escapeHtml(notiz)}</textarea>`;
    }
    return `<button type="button" class="btn btn-sm btn-link px-0 mt-1 ul-notiz-oeffnen" data-action="notiz-oeffnen" data-nr="${nachricht.nr}" data-sender="${escapeAttr(nachricht.sender)}">+ Notiz</button>`;
}

function renderNachrichtText(nachricht: FlattenedNachricht): string {
    const hinweise = renderFuehrungsstellenHinweise(nachricht);
    const art = nachricht.art
        ? `<span class="${nachrichtenArtBadgeClass(nachricht.art)} me-2">${nachrichtenArtLabel(nachricht.art)}</span>`
        : "";
    return `${art}${hinweise.kopf}${escapeHtml(nachricht.text).replace(/\\n/g, "<br>").replace(/\n/g, "<br>")}${hinweise.fuss}`;
}

export function renderNachrichtenRow(
    nachricht: FlattenedNachricht,
    options: NachrichtenRenderOptionen,
    zeigeXZeit: boolean,
    zustand: NachrichtenZeilenZustand
): string {
    const key = statusKey(nachricht.sender, nachricht.nr);
    const status: EffektiverNachrichtenStatus = options.nachrichtenStatus[key] ?? {};
    const { klasse, faelligkeit } = zeilenZustand(status, options.faelligkeit?.[key]);
    const planNr = nachricht.planNr ?? nachricht.nr;
    const gesperrt = options.ruecknahmeGesperrt?.has(key) ?? false;
    return `
                <tr class="${klasse}" data-plan-nr="${planNr}"${faelligkeit ? ` data-plan-zustand="${faelligkeit.zustand}"` : ""}>
                  <td class="text-center">
                    <div class="fw-bold">${planNr}</div>
                    <small class="text-body-secondary text-nowrap" title="Nummer beim Absender – steht so auf dem Vordruck">Abs.-Nr. ${nachricht.nr}</small>
                  </td>
                  <td class="text-center">${renderStatusCell(nachricht, status, faelligkeit)}</td>
                  <td>${nachricht.empfaenger.map(e => `<div>${escapeHtml(e)}</div>`).join("")}</td>
                  <td>${escapeHtml(nachricht.sender)}</td>
                  <td class="nachricht-text">
                      ${renderNachrichtText(nachricht)}
                      ${renderNotiz(nachricht, status.notiz ?? "", zustand.offeneNotizen.has(key))}
                    </td>
                  ${zeigeXZeit ? `<td>${renderSollCell(nachricht, options.sollUhrzeit?.[key])}</td>` : ""}
                  <td>${renderZeitCell(nachricht, status, gesperrt, zustand.zeitEditKey === key)}</td>
                </tr>
              `;
}

/**
 * Statuszelle: oben der Zustand, darunter die Aktion bzw. die Herkunft.
 * Der Zustand trägt Haken und Füllung, die Aktion ist neutral beschriftet –
 * auch in Graustufen unterscheidbar (THW-Review night-visibility 5). Nach
 * dem Markieren steht an der Stelle des Knopfs nur Text, kein Rücksetzen.
 */
function renderStatusCell(
    nachricht: FlattenedNachricht,
    status: EffektiverNachrichtenStatus,
    faelligkeit: Faelligkeit | undefined
): string {
    const sender = escapeAttr(nachricht.sender);
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
function renderSollCell(nachricht: FlattenedNachricht, soll: string | undefined): string {
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
function renderZeitCell(
    nachricht: FlattenedNachricht,
    status: EffektiverNachrichtenStatus,
    gesperrt: boolean,
    inBearbeitung: boolean
): string {
    const sender = escapeAttr(nachricht.sender);
    const daten = `data-nr="${nachricht.nr}" data-sender="${sender}"`;
    if (inBearbeitung) {
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
