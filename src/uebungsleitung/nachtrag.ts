/**
 * Papier-Nachtrag: eine von Hand eingegebene Uhrzeit „HH:MM“ als Zeitpunkt
 * deuten – bezogen auf den Übungstag, nicht auf heute (THW-Review
 * 2026-10-05, analog P2-2).
 */

const TAG_MS = 24 * 60 * 60000;

function tagBeginn(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function gueltigesDatum(wert: string | Date | undefined): Date | null {
    if (!wert) {
        return null;
    }
    const d = wert instanceof Date ? wert : new Date(wert);
    return Number.isFinite(d.getTime()) ? d : null;
}

/** Stunden und Minuten aus „HH:MM“ – `null` bei ungültiger Eingabe. */
function parseUhrzeit(hhmm: string): { h: number; min: number } | null {
    const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
    const h = Number(m?.[1]);
    const min = Number(m?.[2]);
    return m && h <= 23 && min <= 59 ? { h, min } : null;
}

/**
 * Bezugstag eines Nachtrags: der Tag eines schon vorhandenen Zeitpunkts
 * (Korrektur), sofern er der Übungstag oder dessen Folgetag ist (Übung über
 * Mitternacht); sonst das Übungsdatum; ohne Übungsdatum heute.
 */
function bezugstag(referenz: Date | null, uebungstag: Date | null, now: Date): Date {
    if (!uebungstag) {
        return referenz ?? now;
    }
    const abstand = referenz ? tagBeginn(referenz) - tagBeginn(uebungstag) : -1;
    return referenz && abstand >= 0 && abstand <= TAG_MS ? referenz : uebungstag;
}

/** Liegt die Uhrzeit am Übungstag vor der X-Zeit-Basis, ist der Folgetag gemeint. */
function vorDerBasis(uhrzeit: { h: number; min: number }, basis: string | undefined): boolean {
    const b = basis ? parseUhrzeit(basis) : null;
    return Boolean(b) && uhrzeit.h * 60 + uhrzeit.min < (b?.h ?? 0) * 60 + (b?.min ?? 0);
}

/**
 * Deutet eine von Hand eingegebene Uhrzeit „HH:MM“ als Zeitpunkt.
 *
 * Bezugstag ist der eines schon vorhandenen Zeitpunkts (Korrektur), sonst das
 * Übungsdatum – ein Nachtrag Tage später landet so trotzdem am Übungsabend.
 * Liegt die Uhrzeit vor der X-Zeit-Basis, ist bei einer Übung über
 * Mitternacht der Folgetag gemeint. Liegt das Ergebnis in der Zukunft, ist
 * der Vortag gemeint.
 */
export function uhrzeitZuIso(
    hhmm: string,
    referenzIso?: string,
    now: Date = new Date(),
    kontext: { uebungsDatum?: Date; basis?: string } = {}
): string | null {
    const uhrzeit = parseUhrzeit(hhmm);
    if (!uhrzeit) {
        return null;
    }
    const referenz = gueltigesDatum(referenzIso);
    const uebungstag = gueltigesDatum(kontext.uebungsDatum);
    const tag = bezugstag(referenz, uebungstag, now);
    const ziel = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), uhrzeit.h, uhrzeit.min, 0, 0);
    if (!referenz && uebungstag && vorDerBasis(uhrzeit, kontext.basis)) {
        ziel.setDate(ziel.getDate() + 1);
    }
    if (ziel.getTime() > now.getTime()) {
        ziel.setDate(ziel.getDate() - 1);
    }
    return ziel.toISOString();
}
