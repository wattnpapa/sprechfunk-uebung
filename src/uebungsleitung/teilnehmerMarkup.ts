import type { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import type { TeilnehmerStatus } from "../types/Storage";
import type { TeilnehmerFortschritt } from "../services/liveStatusMerge";
import { formatNatoDate } from "../utils/date";
import { escapeHtml } from "../utils/html";
import type { AnmeldeZustand } from "./lagebild";
import { escapeAttr } from "./markup";

/** Ab so vielen Minuten ohne neue Meldung bei offenen Nachrichten wird nachgefragt. */
export const STILL_SEIT_MINUTEN = 10;

/** Was für alle Zeilen der Teilnehmertabelle gleich ist. */
export interface TeilnehmerTabellenKontext {
    uebung: Uebung;
    showLoesungswort: boolean;
    showStaerke: boolean;
    showStaerkeDetails: boolean;
    loesungswoerter: Record<string, string>;
    staerken: Record<string, string>;
    codeByTeilnehmer: Record<string, string>;
    jetztMs: number;
}

export function buildCodeByTeilnehmer(teilnehmerIds?: Record<string, string>): Record<string, string> {
    return Object.entries(teilnehmerIds || {}).reduce<Record<string, string>>((acc, [code, name]) => {
        acc[name] = code.toUpperCase();
        return acc;
    }, {});
}

/** Die beübte Stelle steht oben und getrennt: sie wird beübt, spielt nicht ein. */
export function sortiereTeilnehmer(teilnehmerListe: string[], beuebteStelle: string | undefined): string[] {
    return beuebteStelle && teilnehmerListe.includes(beuebteStelle)
        ? [beuebteStelle, ...teilnehmerListe.filter(n => n !== beuebteStelle)]
        : teilnehmerListe;
}

function quote(f: TeilnehmerFortschritt): number {
    return f.gesamt > 0 ? f.erledigt / f.gesamt : 0;
}

function median(sortiert: number[]): number {
    const mitte = Math.floor(sortiert.length / 2);
    return sortiert.length % 2 === 0
        ? ((sortiert[mitte - 1] ?? 0) + (sortiert[mitte] ?? 0)) / 2
        : (sortiert[mitte] ?? 0);
}

/**
 * Nachzügler sind Teilnehmer, die weniger als die Hälfte des Median-Fortschritts
 * der Gruppe erreicht haben. Erst ab drei aktiven Meldungen sinnvoll auswertbar.
 */
export function findeNachzuegler(
    teilnehmerListe: string[],
    fortschritt: Record<string, TeilnehmerFortschritt>
): Set<string> {
    const aktive = teilnehmerListe
        .map(name => fortschritt[name])
        .filter((f): f is TeilnehmerFortschritt => Boolean(f?.online || (f?.erledigt ?? 0) > 0));
    if (aktive.length < 3) {
        return new Set();
    }
    const mitte = median(aktive.map(quote).sort((a, b) => a - b));
    if (mitte <= 0) {
        return new Set();
    }
    return new Set(aktive.filter(f => quote(f) < mitte / 2).map(f => f.teilnehmer));
}

export function renderTeilnehmerTabelle(kontext: TeilnehmerTabellenKontext, rows: string): string {
    const { showLoesungswort, showStaerke } = kontext;
    return `
        <div class="table-responsive">
          <table class="table table-striped align-middle">
           <thead>
              <tr>
                <th>Teilnehmer</th>
                <th style="width:170px;">Fortschritt</th>
                <th>Angemeldet</th>
                ${showLoesungswort ? "<th>Lösungswort</th>" : ""}
                ${showStaerke ? `<th>
                  Stärke
                  <button
                    class="btn btn-sm btn-outline-secondary ms-2"
                    data-action="toggle-staerke-details"
                   >
                    Details
                  </button>
                </th>` : ""}
                <th>Notizen</th>
                <th style="width:150px;">Debrief</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
}

/**
 * Die beübte Stelle einer Führungsstellen-Übung bekommt keinen
 * Teilnehmerlink und meldet sich nicht an – sie wird beübt
 * (THW-Review command P2-2).
 */
export function renderBeuebteStelleRow(kontext: TeilnehmerTabellenKontext, name: string): string {
    const { uebung, showLoesungswort, showStaerke } = kontext;
    const stelle = uebung.teilnehmerStellen?.[name] ?? uebung.fuehrungsstelle?.stellen?.[name];
    const eingehend = Object.entries(uebung.nachrichten ?? {})
        .reduce((summe, [sender, liste]) => summe + (sender === name
            ? 0
            : liste.filter(n => n.empfaenger.includes(name) || n.empfaenger.includes("Alle")).length), 0);
    const leer = "<td class=\"text-body-secondary\">–</td>";
    return `
          <tr class="uebungsleitung-teilnehmer-zeile uebungsleitung-beuebt" data-beuebt="1">
            <td>
              <span class="badge bg-primary mb-1">beübte Stelle</span><br>
              ${stelle ? `<strong>${escapeHtml(stelle)}</strong><br><small class="text-muted">${escapeHtml(name)}</small>` : `<strong>${escapeHtml(name)}</strong>`}
            </td>
            <td><small>empfängt ${eingehend} Einspielungen</small></td>
            <td><small class="text-body-secondary">kein Teilnehmerlink – wird beübt</small></td>
            ${showLoesungswort ? leer : ""}
            ${showStaerke ? leer : ""}
            ${leer}
            ${leer}
          </tr>`;
}

function renderCodeHint(uebung: Uebung, name: string, codeByTeilnehmer: Record<string, string>): string {
    const code = codeByTeilnehmer[name];
    if (!code) {
        return "";
    }
    const uebungCode = (uebung.uebungCode || "").toUpperCase();
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const joinLink = `${baseUrl}#/teilnehmer?${new URLSearchParams({ uc: uebungCode, tc: code }).toString()}`;
    return `<div class="d-flex align-items-center gap-2 text-muted mb-1">
                    <small>Teilnehmer Code: ${escapeHtml(uebungCode)} / ${escapeHtml(code)}</small>
                    <button
                      class="btn btn-sm btn-outline-secondary py-0 px-1"
                      type="button"
                      data-action="copy-link"
                      data-link="${escapeHtml(joinLink)}"
                      aria-label="Teilnehmer-Link kopieren"
                      title="Teilnehmer-Link kopieren">
                      <i class="fas fa-copy" aria-hidden="true"></i>
                    </button>
                </div>`;
}

export function renderTeilnehmerName(kontext: TeilnehmerTabellenKontext, name: string): string {
    const { uebung, codeByTeilnehmer } = kontext;
    const safeName = escapeHtml(name);
    const codeHtml = renderCodeHint(uebung, name, codeByTeilnehmer);
    if (uebung.teilnehmerStellen && uebung.teilnehmerStellen[name]) {
        return `${codeHtml}<strong>${escapeHtml(uebung.teilnehmerStellen[name])}</strong><br><small class="text-muted">${safeName}</small>`;
    }
    return `${codeHtml}<strong>${safeName}</strong>`;
}

/**
 * „Wie lange nichts vom Gerät?“ – unterscheidet ein Funkloch von einem
 * Teilnehmer, der gerade nur nichts absetzt (THW-Review offline P2-1).
 */
export function renderGeraetHinweis(fortschritt: TeilnehmerFortschritt, jetztMs: number): string {
    if (!fortschritt.online || !fortschritt.zuletztGesehenUm) {
        return fortschritt.online ? "" : "<small class=\"text-body-secondary d-block\">kein Live-Gerät</small>";
    }
    const minuten = Math.floor((jetztMs - Date.parse(fortschritt.zuletztGesehenUm)) / 60000);
    if (!Number.isFinite(minuten) || minuten < 1) {
        return "";
    }
    if (minuten >= STILL_SEIT_MINUTEN && fortschritt.erledigt < fortschritt.gesamt) {
        return `<small class="d-block text-warning-emphasis fw-semibold" title="Seit ${minuten} Minuten keine Änderung vom Gerät – Funkloch oder Pause? Per Funk nachfragen.">seit ${minuten} min nichts vom Gerät</small>`;
    }
    return `<small class="text-body-secondary d-block">Gerät vor ${minuten} min</small>`;
}

/**
 * Fortschritt aus beiden Quellen: was der Teilnehmer gemeldet und was die
 * Leitung bestätigt hat, getrennt ausgewiesen (THW-Review workflow F3).
 *
 * @param startProzent zuletzt gezeigte Balkenlänge – der Balken startet dort
 *                     und bekommt den neuen Wert erst im nächsten Frame.
 */
export function renderFortschrittCell(
    fortschritt: TeilnehmerFortschritt | undefined,
    istNachzuegler: boolean,
    jetztMs: number,
    startProzent?: number
): string {
    if (!fortschritt || (!fortschritt.online && fortschritt.erledigt === 0)) {
        return "<span class=\"badge bg-secondary\" title=\"Noch keine Live-Meldung von diesem Teilnehmer und nichts von der Leitung abgehakt\">keine Meldung</span>";
    }

    const { erledigt, gemeldet, bestaetigt, gesamt, letzteMeldungUm } = fortschritt;
    const percent = gesamt > 0 ? Math.round((erledigt / gesamt) * 100) : 0;
    const barCss = istNachzuegler ? "bg-warning" : "bg-success";
    const herkunft = `<small class="text-body-secondary d-block">TN ${gemeldet} · Leitung ${bestaetigt}</small>`;
    const geraet = renderGeraetHinweis(fortschritt, jetztMs);
    const letzte = letzteMeldungUm
        ? `<small class="text-body-secondary">zuletzt ${formatNatoDate(letzteMeldungUm)}</small>${herkunft}${geraet}`
        : `<small class="text-body-secondary">noch nichts abgesetzt</small>${geraet}`;
    const start = startProzent ?? percent;

    return `
            <div class="progress" style="height:6px;" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar ${barCss}" style="transform:scaleX(${start / 100})" data-fortschritt="${percent}"></div>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-1">
              <small><strong>${erledigt}</strong> / ${gesamt}</small>
              ${istNachzuegler ? "<span class=\"badge bg-warning text-dark\">Nachzügler</span>" : ""}
            </div>
            ${letzte}
        `;
}

/** Ohne gesonderten Anmeldezustand zählt die Anmeldung aus der Tabelle. */
export function anmeldungFuer(anmeldung: AnmeldeZustand | undefined, status: TeilnehmerStatus | undefined): AnmeldeZustand {
    if (anmeldung) {
        return anmeldung;
    }
    return status?.angemeldetUm ? { angemeldetUm: status.angemeldetUm, quelle: "leitung" } : {};
}

const ANMELDE_QUELLE: Partial<Record<NonNullable<AnmeldeZustand["quelle"]>, string>> = {
    funkspruch: "über Anmelde-Funkspruch",
    teilnehmer: "vom Teilnehmer gemeldet"
};

/**
 * Anmeldung und Anmelde-Funkspruch sind ein Vorgang. „Anmeldung erhalten“
 * statt „Anmelden“, damit es nicht wie ein Login aussieht; die Rücknahme
 * steht abgesetzt daneben (THW-Review error-recovery P1-2).
 */
export function renderAnmeldeCell(name: string, anmeldung: AnmeldeZustand): string {
    const safeName = escapeAttr(name);
    if (anmeldung.angemeldetUm) {
        const quelle = (anmeldung.quelle && ANMELDE_QUELLE[anmeldung.quelle]) || "";
        const ruecknahme = anmeldung.quelle === "teilnehmer"
            ? ""
            : `<button type="button" class="btn btn-sm btn-link px-0 text-danger d-block" data-action="anmeldung-zuruecknehmen" data-teilnehmer="${safeName}">Anmeldung zurücknehmen</button>`;
        return `<span class="badge bg-success">angemeldet ${formatNatoDate(anmeldung.angemeldetUm)}</span>
                    ${quelle ? `<small class="text-body-secondary d-block">${quelle}</small>` : ""}
                    ${ruecknahme}`;
    }
    return `<button class="btn btn-sm btn-outline-primary"
                    data-action="anmelden"
                    data-teilnehmer="${safeName}"
                    title="Der Teilnehmer hat sich im Funk angemeldet – sein Anmelde-Funkspruch gilt damit als abgesetzt">
                    Anmeldung erhalten
                  </button>`;
}

export function renderLoesungswortCell(
    name: string,
    status: TeilnehmerStatus | undefined,
    loesungswoerter: Record<string, string>
): string {
    return `
            <td>
              <div class="mb-1">
                <small class="text-muted">Soll:</small>
                <strong>${escapeHtml(loesungswoerter[name] ?? "–")}</strong>
              </div>
              <input
                type="text"
                class="form-control form-control-sm"
                placeholder="Empfangenes Lösungswort"
                data-action="loesungswort"
                data-teilnehmer="${escapeAttr(name)}"
                value="${escapeAttr(status?.loesungswortGesendet ?? "")}"
              />
            </td>
        `;
}

const STAERKE_FELDER = [
    { kurz: "F", lang: "Führer" },
    { kurz: "UF", lang: "Unterführer" },
    { kurz: "H", lang: "Helfer" },
    { kurz: "Ges", lang: "Gesamt" }
];

function renderStaerkeDetails(uebung: Uebung, name: string, show: boolean): string {
    if (!show) {
        return "";
    }

    const nachrichten: Record<string, Nachricht[]> = uebung.nachrichten || {};
    const details: string[] = [];
    Object.entries(nachrichten).forEach(([absender, liste]) => {
        liste.forEach(n => {
            if (!n.empfaenger?.includes(name) || !n.staerken?.length) {
                return;
            }
            n.staerken.forEach(s => {
                const total = (Number(s.fuehrer) || 0) + (Number(s.unterfuehrer) || 0) + (Number(s.helfer) || 0);
                details.push(
                    `<div><small class="text-muted">Von ${absender}:</small><span style="float:right;">${s.fuehrer}/${s.unterfuehrer}/${s.helfer}/${total}</span></div>`
                );
            });
        });
    });
    return details.length ? `<div class="mt-1">${details.join("")}</div>` : "";
}

export function renderStaerkeCell(kontext: TeilnehmerTabellenKontext, name: string, status: TeilnehmerStatus | undefined): string {
    const { uebung, staerken, showStaerkeDetails } = kontext;
    const inputs = STAERKE_FELDER.map((feld, i) => `
                  <input
                    type="text"
                    class="form-control form-control-sm text-center"
                    style="width:3rem"
                    maxlength="3"
                    placeholder="${feld.kurz}"
                    title="Empfangene Stärke: ${feld.lang}"
                    aria-label="Empfangene Stärke ${feld.lang}"
                    data-action="staerke"
                    data-teilnehmer="${escapeAttr(name)}"
                    data-index="${i}"
                    value="${escapeAttr(status?.teilstaerken?.[i] ?? "")}"
                  />
                `).join("");

    return `
            <td>
              <div class="mb-1">
                <small class="text-muted" title="Führer / Unterführer / Helfer / Gesamt">Soll (F/UF/H/Ges):</small>
                <span style="float: right;"><strong>${escapeHtml(staerken[name] ?? "–")}</strong></span>
                ${renderStaerkeDetails(uebung, name, showStaerkeDetails)}
              </div>
              <div class="d-flex gap-1">${inputs}</div>
            </td>
        `;
}

/** Notizfeld und Debrief-Knopf am Ende jeder Teilnehmerzeile. */
export function renderNotizUndDebriefCells(name: string, status: TeilnehmerStatus | undefined): string {
    return `<td>
              <textarea
                class="form-control form-control-sm auto-grow"
                rows="1"
                placeholder="Notiz…"
                data-action="notiz"
                data-teilnehmer="${escapeAttr(name)}"
              >${escapeHtml(status?.notizen ?? "")}</textarea>
            </td>
            <td>
              <button
                class="btn btn-sm btn-outline-secondary"
                data-action="download-debrief"
                data-teilnehmer="${escapeAttr(name)}">
                Debrief PDF
              </button>
            </td>`;
}
