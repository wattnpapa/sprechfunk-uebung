import { escapeHtml } from "../utils/html";
import { Nachricht } from "../types/Nachricht";
import { TeilnehmerStorage } from "../types/Storage";
import type { LeitungBestaetigung, LiveSyncState } from "../types/LiveStatus";
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
    /** Abgesetzte, die bei „ausblenden“ noch kurz stehen bleiben. */
    gehalten: ReadonlySet<number>;
    /** Abgesetzte, deren Haltezeit vorbei ist: sie gehen jetzt ab. */
    abgang: ReadonlySet<number>;
    /** Sprüche, deren Änderung noch nicht beim Server angekommen ist. */
    nurLokal: ReadonlySet<number>;
    /** Zustand der Verbindung zur Übungsleitung („aus“ ohne Live-Sync). */
    syncZustand: LiveSyncState;
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

/** Was die Statuszelle eines Spruchs zeigt. */
export interface StatusZellenZustand {
    isUebertragen: boolean;
    uebertragenUm?: string | undefined;
    istNaechster: boolean;
    /** Änderung liegt erst auf diesem Gerät (noch nicht gesendet). */
    nurLokal?: boolean;
    /** Zustand der Verbindung zur Übungsleitung. */
    syncZustand?: LiveSyncState;
    bestaetigung?: LeitungBestaetigung | undefined;
}

/**
 * Wo der abgesetzte Spruch gerade steht: nur hier, gesendet oder von der
 * Leitung bestätigt (field-user P2 und P3, analog-first P3-4, 2026-10-05).
 */
export function zustellText(z: StatusZellenZustand): { text: string; lokal: boolean } {
    if (z.bestaetigung?.abgesetztUm) {
        const uhrzeit = formatUhrzeit(z.bestaetigung.abgesetztUm);
        return { text: `Leitung hat bestätigt${uhrzeit ? ` ${uhrzeit}` : ""}`, lokal: false };
    }
    const zustand = z.syncZustand ?? "aus";
    if (z.nurLokal && (zustand === "live" || zustand === "verbinde")) {
        return { text: "Wird an die Übungsleitung gesendet …", lokal: false };
    }
    if (z.nurLokal) {
        return { text: "Nur auf diesem Gerät – wird gesendet, sobald Netz da ist", lokal: true };
    }
    if (zustand !== "aus") {
        return { text: "An die Übungsleitung gesendet", lokal: false };
    }
    return { text: "Auf diesem Gerät gespeichert", lokal: false };
}

/**
 * Status und Aktion je Spruch. Bewusst getrennt: der Zustand ist eine
 * Anzeige, die Aktion ein großer Knopf. Nach dem Absetzen steht an der
 * Stelle des Knopfs ein Statusfeld ohne Funktion; „Zurücknehmen“ ist klein
 * und liegt darunter. Ein zweiter, auch träger Tipp auf „abgesetzt“ trifft
 * also nie die Gegenaktion (stress-test P2-1, 2026-10-05).
 */
export function renderStatusZelle(id: number, z: StatusZellenZustand): string {
    if (!z.isUebertragen) {
        const lokal = z.nurLokal && z.syncZustand !== "live"
            ? "<span class=\"teilnehmer-lokal-marke\">Rücknahme nur auf diesem Gerät</span>"
            : "";
        return `
                <div class="teilnehmer-status-zeile">
                    <span class="status-chip status-chip--pending">offen</span>
                    ${z.istNaechster ? "<span class=\"teilnehmer-naechster-label\">als Nächstes</span>" : ""}
                    ${lokal}
                </div>
                <button type="button" class="btn btn-primary teilnehmer-absetzen" data-aktion="absetzen" data-id="${id}">
                    Als abgesetzt markieren
                </button>`;
    }
    const uhrzeit = formatUhrzeit(z.uebertragenUm);
    const zustellung = zustellText(z);
    return `
                <div class="teilnehmer-status-zeile">
                    <span class="status-chip status-chip--ok">✓ abgesetzt${uhrzeit ? ` ${uhrzeit}` : ""}</span>
                </div>
                <div class="teilnehmer-abgesetzt-feld${zustellung.lokal ? " ist-lokal" : ""}" data-zustellung="${zustellung.lokal ? "lokal" : "gesendet"}">
                    ${zustellung.lokal ? "<span aria-hidden=\"true\">⚠</span> " : ""}${zustellung.text}
                </div>
                <div class="teilnehmer-zuruecknehmen-zeile">
                    <button type="button" class="btn btn-outline-secondary btn-sm teilnehmer-zuruecknehmen" data-aktion="zuruecknehmen" data-id="${id}" aria-label="Spruch ${id} zurücknehmen (wieder offen)">
                        Zurücknehmen
                    </button>
                </div>`;
}

/** Suchtext und „Abgesetzte ausblenden“; eben abgesetzte bleiben kurz stehen. */
export function filtereNachrichten(nachrichten: Nachricht[], ctx: ZeilenKontext, suche: string): Nachricht[] {
    return nachrichten.filter(n => {
        if (suche) {
            const haystack = `${n.id} ${n.empfaenger.join(" ")} ${n.nachricht}`.toLowerCase();
            if (!haystack.includes(suche)) {
                return false;
            }
        }
        if (ctx.storage.hideTransmitted) {
            return !ctx.storage.nachrichten[n.id]?.uebertragen
                || n.id === ctx.zuletztAbgesetzt
                || ctx.gehalten.has(n.id)
                || ctx.abgang.has(n.id);
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
    const istAbgang = isUebertragen && ctx.storage.hideTransmitted && ctx.abgang.has(n.id);
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
                <td class="teilnehmer-zelle-status">${renderStatusZelle(n.id, {
                    isUebertragen: z.isUebertragen,
                    uebertragenUm,
                    istNaechster: z.istNaechster,
                    nurLokal: ctx.nurLokal.has(n.id),
                    syncZustand: ctx.syncZustand,
                    bestaetigung
                })}</td>
                <td class="teilnehmer-zelle-leitung${bestaetigung?.abgesetztUm ? "" : " ist-leer"}">${renderBestaetigungCell(bestaetigung)}</td>
            </tr>
        `;
}
