/**
 * Ansichtseinstellungen der Übungsleitung, je Gerät gemerkt (nicht synchron):
 * ob Abgesetzte ausgeblendet und ob die Teilnehmertabelle eingeklappt ist
 * (THW-Review 2026-10-05, command P3-3 und P3-2). Der Speicher kann fehlen
 * (privates Fenster, gesperrte Website-Daten) – dann gelten die Vorgaben.
 */
const SCHLUESSEL = "sprechfunk:leitungsansicht";

export interface LeitungAnsicht {
    hideAbgesetzt: boolean;
    teilnehmerEingeklappt: boolean;
}

export function ladeAnsicht(): LeitungAnsicht {
    try {
        const roh = globalThis.localStorage?.getItem(SCHLUESSEL);
        const daten = roh ? JSON.parse(roh) as Partial<LeitungAnsicht> : {};
        return {
            hideAbgesetzt: daten.hideAbgesetzt === true,
            teilnehmerEingeklappt: daten.teilnehmerEingeklappt === true
        };
    } catch {
        return { hideAbgesetzt: false, teilnehmerEingeklappt: false };
    }
}

export function speichereAnsicht(ansicht: LeitungAnsicht): void {
    try {
        globalThis.localStorage?.setItem(SCHLUESSEL, JSON.stringify(ansicht));
    } catch {
        // Nur eine Bequemlichkeit – ohne Speicher gilt beim nächsten Mal die Vorgabe.
    }
}

const RESET_MARKER = "sprechfunk:leitung-zurueckgesetzt";

/** Vor dem Neuladen nach „für alle zurücksetzen“: Uhrzeit merken. */
export function merkeZurueckgesetzt(uebungId: string, um: Date = new Date()): void {
    try {
        globalThis.sessionStorage?.setItem(RESET_MARKER, JSON.stringify({ uebungId, um: um.toISOString() }));
    } catch {
        // Ohne Speicher entfällt nur die Bestätigung nach dem Neuladen.
    }
}

/** Nach dem Neuladen einmalig: Zeitpunkt des Zurücksetzens oder `null`. */
export function holeZurueckgesetzt(uebungId: string): string | null {
    try {
        const roh = globalThis.sessionStorage?.getItem(RESET_MARKER);
        if (!roh) {
            return null;
        }
        globalThis.sessionStorage?.removeItem(RESET_MARKER);
        const daten = JSON.parse(roh) as { uebungId?: string; um?: string };
        return daten.uebungId === uebungId && daten.um ? daten.um : null;
    } catch {
        return null;
    }
}
