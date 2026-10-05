import { formatNatoDate } from "../utils/date";
import type { EffektiverNachrichtenStatus } from "../services/liveStatusMerge";
import { escapeHtml } from "../utils/html";
import { nachrichtenArtBadgeClass, nachrichtenArtLabel } from "../utils/nachrichtenArt";
import { renderFuehrungsstellenHinweise } from "../utils/fuehrungsstelle";
import { faelligkeitLabel, statusKey, type Faelligkeit } from "./lagebild";
import { escapeAttr, hhmmAus } from "./markup";
import { renderAusgelassenStatus, renderAuslassenKnopf, renderReaktionBlock } from "./planZeileMarkup";
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

/** Erledigt oder ausgelassen – fällt bei „Abgesetzte ausblenden“ weg. */
function istAusgeblendet(status: EffektiverNachrichtenStatus | undefined): boolean {
    return Boolean(status?.abgesetztUm || status?.ausgelassen);
}

/**
 * Filter und Schalter stehen über der Tabelle statt im Tabellenkopf: In der
 * Kartenansicht (Handy, Tablet) gibt es keinen Kopf, und der Schalter
 * „Abgesetzte ausblenden“ nennt, wie viele Zeilen er verbirgt
 * (THW-Review 2026-10-05, night-visibility 2).
 */
function renderFilterLeiste(options: NachrichtenRenderOptionen): string {
    const { nachrichten, nachrichtenStatus, hideAbgesetzt, senderFilter, empfaengerFilter, textFilter } = options;
    const uniqueSenders = Array.from(new Set(nachrichten.map(n => n.sender))).sort();
    const uniqueEmpfaenger = Array.from(new Set(nachrichten.flatMap(n => n.empfaenger))).sort();
    const ausgeblendet = hideAbgesetzt
        ? nachrichten.filter(n => istAusgeblendet(nachrichtenStatus[statusKey(n.sender, n.nr)])).length
        : 0;
    return `
            <div class="ul-plan-filter">
              <div class="form-check form-switch ul-schalter">
                <input class="form-check-input" type="checkbox" role="switch" id="toggleHideAbgesetzt" ${hideAbgesetzt ? "checked" : ""}>
                <label class="form-check-label" for="toggleHideAbgesetzt">Abgesetzte ausblenden${hideAbgesetzt ? ` <span class="badge text-bg-secondary">${ausgeblendet} ausgeblendet</span>` : ""}</label>
              </div>
              <label class="ul-filter-feld">
                <span class="small text-body-secondary">Sender</span>
                <select id="senderFilterSelect" class="form-select form-select-sm">
                  <option value="">Alle</option>
                  ${filterOptionen(uniqueSenders, senderFilter)}
                </select>
              </label>
              <label class="ul-filter-feld">
                <span class="small text-body-secondary">Empfänger</span>
                <select id="empfaengerFilterSelect" class="form-select form-select-sm">
                  <option value="">Alle</option>
                  ${filterOptionen(uniqueEmpfaenger, empfaengerFilter)}
                </select>
              </label>
              <label class="ul-filter-feld ul-filter-feld--text">
                <span class="small text-body-secondary">Text</span>
                <input id="nachrichtenTextFilterInput" type="search" class="form-control form-control-sm" placeholder="Suchen..." value="${escapeAttr(textFilter)}">
              </label>
            </div>`;
}

export function renderNachrichtenTabelle(options: NachrichtenRenderOptionen, rows: string, zeigeXZeit: boolean): string {
    return `
            ${renderFilterLeiste(options)}
            <div class="table-responsive ul-plan-wrapper">
                <table class="table table-bordered table-striped align-middle uebungsleitung-plan">
                    <thead>
                      <tr>
                        <th style="width:70px;" title="Fortlaufende Nummer im Plan; darunter die Nummer beim Absender, wie sie auf dem Vordruck steht">Nr</th>
                        <th style="width:170px;" class="text-center">Status</th>
                        <th style="width:200px;">Empfänger</th>
                        <th style="width:180px;">Sender</th>
                        <th>Nachricht</th>
                        ${zeigeXZeit ? "<th style=\"width:110px;\" title=\"Soll-Uhrzeit laut Zeitplan und X-Zeit\">Soll</th>" : ""}
                        <th style="width:150px;">Zeit</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            <div class="mt-3" id="nachrichtenAuswertung">
              <div class="small text-body-secondary mb-2">Heatmap: erledigte Sprüche je 5 Minuten</div>
              <div id="nachrichtenHeatmapChart" class="d-flex align-items-end gap-1" style="height: 110px;"></div>
            </div>
            <div class="mt-3">
              <div class="small text-body-secondary mb-2">Timeline je Teilnehmer (S = gesendet, E = empfangen)</div>
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
    return !istAusgeblendet(nachrichtenStatus[statusKey(nachricht.sender, nachricht.nr)]);
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
    if (status.ausgelassen) {
        return { klasse: "status-ausgelassen-row", faelligkeit: undefined };
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

interface ZeitZeilenZustand {
    gesperrt: boolean;
    inBearbeitung: boolean;
    auslassbar: boolean;
    jetztMs: number;
}

function zeitZeilenZustand(
    options: NachrichtenRenderOptionen,
    key: string,
    faelligkeit: Faelligkeit | undefined,
    zustand: NachrichtenZeilenZustand
): ZeitZeilenZustand {
    return {
        gesperrt: options.ruecknahmeGesperrt?.has(key) ?? false,
        inBearbeitung: zustand.zeitEditKey === key,
        auslassbar: Boolean(faelligkeit && faelligkeit.zustand !== "spaeter"),
        jetztMs: options.jetztMs ?? Date.now()
    };
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
    const zeit = zeitZeilenZustand(options, key, faelligkeit, zustand);
    // data-label: Spaltenname in der Kartenansicht (Handy, Tablet), dort gibt es keinen Tabellenkopf.
    return `
                <tr class="${klasse}" data-plan-nr="${planNr}"${faelligkeit ? ` data-plan-zustand="${faelligkeit.zustand}"` : ""}>
                  <td class="text-center ul-zelle-nr" data-label="Nr">
                    <div class="fw-bold">${planNr}</div>
                    <small class="text-body-secondary text-nowrap" title="Nummer beim Absender – steht so auf dem Vordruck">Abs.-Nr. ${nachricht.nr}</small>
                  </td>
                  <td class="text-center ul-zelle-status" data-label="Status">${renderStatusCell(nachricht, status, faelligkeit)}</td>
                  <td class="ul-zelle-empfaenger" data-label="an">${nachricht.empfaenger.map(e => `<div>${escapeHtml(e)}</div>`).join("")}</td>
                  <td class="ul-zelle-sender" data-label="von">${escapeHtml(nachricht.sender)}</td>
                  <td class="nachricht-text ul-zelle-text" data-label="Nachricht">
                      ${renderNachrichtText(nachricht)}
                      ${renderReaktionBlock(nachricht, status, zeit.jetztMs)}
                      ${renderNotiz(nachricht, status.notiz ?? "", zustand.offeneNotizen.has(key))}
                    </td>
                  ${zeigeXZeit ? `<td class="ul-zelle-soll" data-label="Soll">${renderSollCell(nachricht, options.sollUhrzeit?.[key])}</td>` : ""}
                  <td class="ul-zelle-zeit" data-label="Zeit">${renderZeitCell(nachricht, status, zeit)}</td>
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
        const quelle = status.nachgetragen ? " · nachgetragen" : (status.zeitVomTeilnehmer ? " · Zeit vom TN" : "");
        const herkunft = `Leitung ${hhmmAus(status.abgesetztUm)}${quelle}`;
        const tn = status.gemeldetUm ? `<small class="text-body-secondary">TN ${hhmmAus(status.gemeldetUm)}</small>` : "";
        return `
                      <div class="ul-status-zelle">
                        <span class="status-chip status-chip--ok status-chip--fest">✓ abgesetzt</span>
                        <small class="text-body-secondary">${herkunft}</small>
                        ${tn}
                      </div>`;
    }

    if (status.ausgelassen) {
        return renderAusgelassenStatus(nachricht, status);
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
 * „Als abgesetzt markieren“ – die Rücknahme. „Zeit ändern“ und
 * „zurücknehmen“ liegen mit Abstand untereinander (THW-Review 2026-10-05,
 * glove-touch P2-4).
 */
function renderZeitCell(
    nachricht: FlattenedNachricht,
    status: EffektiverNachrichtenStatus,
    zeile: ZeitZeilenZustand
): string {
    const sender = escapeAttr(nachricht.sender);
    const daten = `data-nr="${nachricht.nr}" data-sender="${sender}"`;
    if (zeile.inBearbeitung) {
        return `
                <div class="d-flex flex-column gap-1">
                  <label class="small text-body-secondary" for="ulZeitInput">Abgesetzt um</label>
                  <input type="time" id="ulZeitInput" class="form-control form-control-sm ul-zeit-input" ${daten} value="${hhmmAus(status.abgesetztUm ?? status.gemeldetUm)}">
                  <div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-primary" data-action="zeit-speichern" ${daten}>OK</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" data-action="zeit-abbrechen" ${daten}>Abbrechen</button>
                  </div>
                </div>`;
    }
    // `erledigtUm` ist der frühere Zeitpunkt aus Teilnehmer-Meldung und Bestätigung.
    const zeitpunkt = status.erledigtUm ?? status.abgesetztUm;
    const zeit = zeitpunkt ? `<div>${formatNatoDate(zeitpunkt)}</div>` : "";
    if (!status.abgesetztUm) {
        const auslassen = zeile.auslassbar && !status.ausgelassen && !status.gemeldetUm ? renderAuslassenKnopf(nachricht) : "";
        return `${zeit}<div class="ul-zeit-aktionen">
                  <button type="button" class="btn btn-sm btn-link px-0" data-action="zeit-bearbeiten" ${daten} title="Auf Papier abgehakt? Absetzzeit von Hand eintragen">Zeit nachtragen</button>
                  ${auslassen}
                </div>`;
    }
    const ruecknahme = zeile.gesperrt
        ? `<button type="button" class="btn btn-sm btn-link px-0 text-danger" data-action="reset" ${daten} disabled title="Kurz gesperrt, damit ein Doppeltipp die Markierung nicht aufhebt">zurücknehmen</button>`
        : `<button type="button" class="btn btn-sm btn-link px-0 text-danger" data-action="reset" ${daten} title="Status zurücksetzen – danach gibt es ein Rückgängig">zurücknehmen</button>`;
    return `${zeit}
                <div class="ul-zeit-aktionen">
                  <button type="button" class="btn btn-sm btn-link px-0" data-action="zeit-bearbeiten" ${daten}>Zeit ändern</button>
                  ${ruecknahme}
                </div>`;
}
