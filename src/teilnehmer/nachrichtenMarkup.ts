import { escapeHtml } from "../utils/html";
import { Nachricht } from "../types/Nachricht";
import { TeilnehmerStorage } from "../types/Storage";
import type { LeitungBestaetigung } from "../types/LiveStatus";
import { parseHHMMtoMs } from "../utils/xzeit";
import { renderFuehrungsstellenHinweise } from "../utils/fuehrungsstelle";
import { formatUhrzeit, nachrichtHtml, renderArtBadge } from "./teilnehmerFormat";

/** Was eine Tabellenzeile außer der Nachricht selbst braucht. */
export interface ZeilenKontext {
    storage: TeilnehmerStorage;
    showXZeit: boolean;
    xZeitBasis: string | undefined;
    bestaetigungen: Record<string, LeitungBestaetigung>;
    zuletztAbgesetzt: number | undefined;
    /** Erster offener Spruch der Liste (ohne X-Zeit der nächste). */
    naechsterId: number | undefined;
}

/** Millisekunden bis zur Fälligkeit eines Slots, null ohne gültige Basis. */
function restMs(slot: number, xZeitBasis: string | undefined, transmitted: boolean): number | null {
    if (transmitted || !xZeitBasis) {
        return null;
    }
    const basisMs = parseHHMMtoMs(xZeitBasis);
    if (basisMs === null) {
        return null;
    }
    return basisMs + slot * 60000 - Date.now();
}

export function xZeitBadgeClass(slot: number, xZeitBasis: string | undefined, transmitted: boolean): string {
    const diffMs = restMs(slot, xZeitBasis, transmitted);
    if (diffMs === null) {
        return "badge bg-secondary";
    }
    if (diffMs > 120000) {
        return "badge bg-success";
    }
    if (diffMs > 0) {
        return "badge bg-warning text-dark";
    }
    return "badge bg-danger";
}

export function xZeitBadgeLabel(slot: number, xZeitBasis: string | undefined, transmitted: boolean): string {
    const diffMs = restMs(slot, xZeitBasis, transmitted);
    if (diffMs === null) {
        return `X+${slot}`;
    }
    if (diffMs <= 0) {
        return `X+${slot} !`;
    }
    if (diffMs <= 120000) {
        const mins = Math.floor(diffMs / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `X+${slot} ${mins}:${String(secs).padStart(2, "0")}`;
    }
    return `X+${slot}`;
}

/** Millisekunden bis zur nächsten noch nicht fälligen offenen Nachricht. */
export function naechsteFaelligkeitMs(nachrichten: Nachricht[], storage: TeilnehmerStorage, xZeitBasis: string): number | null {
    const basisMs = parseHHMMtoMs(xZeitBasis);
    if (basisMs === null) {
        return null;
    }
    const now = Date.now();
    let nearest: number | null = null;
    for (const n of nachrichten) {
        if (n.xZeitSlot === undefined || storage.nachrichten[n.id]?.uebertragen) {
            continue;
        }
        const diffMs = basisMs + n.xZeitSlot * 60000 - now;
        if (diffMs > 0 && (nearest === null || diffMs < nearest)) {
            nearest = diffMs;
        }
    }
    return nearest;
}

export function renderBestaetigungCell(bestaetigung?: LeitungBestaetigung): string {
    if (!bestaetigung?.abgesetztUm) {
        return "<span class=\"text-muted small\">–</span>";
    }
    const uhrzeit = formatUhrzeit(bestaetigung.abgesetztUm);
    return `<span class="badge bg-success" title="Von der Übungsleitung bestätigt">Leitung: bestätigt${uhrzeit ? ` ${uhrzeit}` : ""}</span>`;
}

/**
 * Status und Aktion je Spruch. Bewusst getrennt: der Zustand ist eine
 * Anzeige, die Aktion ein großer Knopf. Das Zurücknehmen ist ein eigener,
 * kleiner Knopf an anderer Stelle — ein zweiter Tipp auf „abgesetzt“
 * trifft also nie die Gegenaktion.
 */
export function renderStatusZelle(id: number, isUebertragen: boolean, uebertragenUm: string | undefined, istNaechster: boolean): string {
    if (!isUebertragen) {
        return `
                <div class="teilnehmer-status-zeile">
                    <span class="status-chip status-chip--pending">offen</span>
                    ${istNaechster ? "<span class=\"teilnehmer-naechster-label\">als Nächstes</span>" : ""}
                </div>
                <button type="button" class="btn btn-success teilnehmer-absetzen" data-aktion="absetzen" data-id="${id}">
                    ✓ Als abgesetzt markieren
                </button>`;
    }
    const uhrzeit = formatUhrzeit(uebertragenUm);
    return `
                <div class="teilnehmer-status-zeile">
                    <span class="status-chip status-chip--ok">✓ abgesetzt${uhrzeit ? ` ${uhrzeit}` : ""}</span>
                    <button type="button" class="btn btn-outline-secondary btn-sm teilnehmer-zuruecknehmen" data-aktion="zuruecknehmen" data-id="${id}" aria-label="Spruch ${id} zurücknehmen (wieder offen)">
                        Zurücknehmen
                    </button>
                </div>`;
}

/** Suchtext und „Abgesetzte ausblenden“; die eben abgesetzte bleibt kurz stehen. */
export function filtereNachrichten(nachrichten: Nachricht[], ctx: ZeilenKontext, suche: string): Nachricht[] {
    return nachrichten.filter(n => {
        if (suche) {
            const haystack = `${n.id} ${n.empfaenger.join(" ")} ${n.nachricht}`.toLowerCase();
            if (!haystack.includes(suche)) {
                return false;
            }
        }
        if (ctx.storage.hideTransmitted) {
            return !ctx.storage.nachrichten[n.id]?.uebertragen || n.id === ctx.zuletztAbgesetzt;
        }
        return true;
    });
}

function xZeitZelle(n: Nachricht, ctx: ZeilenKontext, isUebertragen: boolean): string {
    if (!ctx.showXZeit) {
        return "";
    }
    if (n.xZeitSlot === undefined) {
        return "<td class=\"teilnehmer-zelle-xzeit\"></td>";
    }
    const klasse = xZeitBadgeClass(n.xZeitSlot, ctx.xZeitBasis, isUebertragen);
    const label = xZeitBadgeLabel(n.xZeitSlot, ctx.xZeitBasis, isUebertragen);
    return `<td class="teilnehmer-zelle-xzeit"><span class="${klasse}" data-xzeit-slot="${n.xZeitSlot}" data-n-id="${n.id}">${label}</span></td>`;
}

interface ZeilenZustand {
    isUebertragen: boolean;
    istAbgang: boolean;
    istNaechster: boolean;
    klassen: string;
}

function zeilenZustand(n: Nachricht, ctx: ZeilenKontext): ZeilenZustand {
    const isUebertragen = !!ctx.storage.nachrichten[n.id]?.uebertragen;
    const istAbgesetzt = isUebertragen && n.id === ctx.zuletztAbgesetzt;
    const istAbgang = istAbgesetzt && ctx.storage.hideTransmitted;
    const istNaechster = !isUebertragen && n.id === ctx.naechsterId;
    const klassen = [
        isUebertragen ? "status-ok-row" : "status-pending-row",
        istAbgesetzt ? "ist-abgesetzt" : "",
        istAbgang ? "ist-abgang" : "",
        istNaechster ? "ist-naechster" : ""
    ].filter(Boolean).join(" ");
    return { isUebertragen, istAbgang, istNaechster, klassen };
}

/** Eine Tabellenzeile der Spruchliste. */
export function nachrichtZeileHtml(n: Nachricht, ctx: ZeilenKontext): string {
    const z = zeilenZustand(n, ctx);
    const bestaetigung = ctx.bestaetigungen[String(n.id)];
    const hinweise = renderFuehrungsstellenHinweise(n);
    const uebertragenUm = ctx.storage.nachrichten[n.id]?.uebertragenUm;
    return `
            <tr class="${z.klassen}" data-n-id="${n.id}"${z.istAbgang ? " data-abgang=\"1\"" : ""}>
                <td class="teilnehmer-zelle-nr"><span class="teilnehmer-nr-label">Nr. </span>${n.id}</td>
                <td class="teilnehmer-zelle-empfaenger"><span class="teilnehmer-an-label">an </span>${escapeHtml(n.empfaenger.join(", "))}</td>
                <td class="teilnehmer-zelle-text">${renderArtBadge(n)}${hinweise.kopf}${nachrichtHtml(n.nachricht)}${hinweise.fuss}</td>
                ${xZeitZelle(n, ctx, z.isUebertragen)}
                <td class="teilnehmer-zelle-status">${renderStatusZelle(n.id, z.isUebertragen, uebertragenUm, z.istNaechster)}</td>
                <td class="teilnehmer-zelle-leitung${bestaetigung?.abgesetztUm ? "" : " ist-leer"}">${renderBestaetigungCell(bestaetigung)}</td>
            </tr>
        `;
}
