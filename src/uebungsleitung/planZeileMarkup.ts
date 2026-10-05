import type { EffektiverNachrichtenStatus } from "../services/liveStatusMerge";
import { escapeAttr, hhmmAus } from "./markup";
import { REAKTIONEN } from "./reaktion";
import type { FlattenedNachricht } from "./nachrichtenTypen";

/**
 * Bausteine einer Plan-Zeile für Ausgelassen und Reaktionsbewertung
 * (THW-Review 2026-10-05, command P2-1/P2-2).
 */

function daten(nachricht: FlattenedNachricht): string {
    return `data-nr="${nachricht.nr}" data-sender="${escapeAttr(nachricht.sender)}"`;
}

/** Statuszelle einer bewusst ausgelassenen Zeile. */
export function renderAusgelassenStatus(nachricht: FlattenedNachricht, status: EffektiverNachrichtenStatus): string {
    const um = hhmmAus(status.statusGeaendertUm);
    return `
                      <div class="ul-status-zelle">
                        <span class="status-chip status-chip--ausgelassen status-chip--fest">ausgelassen</span>
                        ${um ? `<small class="text-body-secondary">Leitung ${um}</small>` : ""}
                        <button type="button" class="btn btn-sm btn-outline-secondary ul-aktion" data-action="wieder-oeffnen" ${daten(nachricht)}>wieder öffnen</button>
                      </div>`;
}

/**
 * „auslassen“ nur für Zeilen, deren Soll-Zeit schon erreicht ist – dort steht
 * die Entscheidung „nachspielen oder überspringen“ an.
 */
export function renderAuslassenKnopf(nachricht: FlattenedNachricht): string {
    return `<button type="button" class="btn btn-sm btn-link px-0 ul-auslassen" data-action="auslassen" ${daten(nachricht)} title="Bewusst nicht einspielen – zählt dann nicht mehr als überfällig und steht in der Auswertung als ausgelassen">auslassen</button>`;
}

/**
 * Bewertung der Reaktion der beübten Stelle – nur bei Einspielungen mit
 * Erwartung, die schon abgesetzt sind. Ohne Bewertung steht dort, seit wann
 * die Reaktion aussteht.
 */
export function renderReaktionBlock(
    nachricht: FlattenedNachricht,
    status: EffektiverNachrichtenStatus,
    jetztMs: number
): string {
    if (!nachricht.erwartung || !status.abgesetztUm) {
        return "";
    }
    const knoepfe = REAKTIONEN.map(r => {
        const aktiv = status.reaktion === r.wert;
        return `<button type="button" class="btn btn-sm ${aktiv ? "btn-secondary" : "btn-outline-secondary"} ul-reaktion" data-action="reaktion" data-reaktion="${r.wert}" aria-pressed="${aktiv}" ${daten(nachricht)}>${aktiv ? "✓ " : ""}${r.label}</button>`;
    }).join("");
    const seit = Date.parse(status.abgesetztUm);
    const offen = !status.reaktion && Number.isFinite(seit)
        ? `<small class="ul-reaktion-offen">Reaktion ausstehend seit ${Math.max(0, Math.floor((jetztMs - seit) / 60000))} min</small>`
        : "";
    return `
                      <div class="ul-reaktion-block mt-2" role="group" aria-label="Reaktion der beübten Stelle">
                        <small class="text-body-secondary">Reaktion der beübten Stelle:</small>
                        <div class="d-flex flex-wrap gap-2">${knoepfe}</div>
                        ${offen}
                      </div>`;
}
