/**
 * Rechenhelfer für den X-Zeit-Modus: Basiszeit, Laufzeit, Soll-Fortschritt
 * und Plan-Status. Alle Funktionen sind pur und arbeiten auf Millisekunden,
 * damit Cockpit (Übungsleitung) und Fokus-Modus (Teilnehmer) dieselbe Logik
 * verwenden.
 */

/** Deutet "HH:MM" als Uhrzeit des heutigen Tages und liefert Millisekunden. */
export function parseHHMMtoMs(value: string, now: Date = new Date()): number | null {
    const m = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!m || !m[1] || !m[2]) {
        return null;
    }
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) {
        return null;
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min, 0, 0).getTime();
}

/** Anzahl der Nachrichten, die laut Zeitplan bis `nowMs` fällig sind. */
export function berechneSollFortschritt(
    nachrichten: { xZeitSlot?: number }[],
    basisMs: number,
    nowMs: number
): number {
    return nachrichten.filter(
        n => n.xZeitSlot !== undefined && basisMs + n.xZeitSlot * 60000 <= nowMs
    ).length;
}

export interface PlanStatus {
    label: string;
    /** Bootstrap-Badge-Klassen für die Anzeige. */
    css: string;
}

/**
 * Soll-Ist-Vergleich für den Plan-Indikator. `ist` zählt erledigte
 * Nachrichten, `soll` die laut Zeitplan bereits fälligen.
 */
export function berechnePlanStatus(ist: number, soll: number): PlanStatus {
    const diff = ist - soll;
    if (diff >= 0) {
        return { label: "im Plan", css: "bg-success" };
    }
    if (diff >= -2) {
        return { label: `${-diff} hinter Plan`, css: "bg-warning text-dark" };
    }
    return { label: `${-diff} hinter Plan`, css: "bg-danger" };
}

/** Formatiert eine Dauer als "H:MM:SS" bzw. "MM:SS" unterhalb einer Stunde. */
export function formatLaufzeit(ms: number): string {
    if (ms < 0) {
        return "–";
    }
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return hours > 0 ? `${hours}:${mmss}` : mmss;
}

/** X-Zeit-Notation seit Basis, z. B. "X + 12 min"; vor Beginn "vor X". */
export function formatXZeit(msSeitBasis: number): string {
    if (msSeitBasis < 0) {
        return "vor X";
    }
    return `X + ${Math.floor(msSeitBasis / 60000)} min`;
}

/** Formatiert einen Countdown in "M:SS". Negative Werte werden zu "0:00". */
export function formatCountdown(ms: number): string {
    const clamped = Math.max(0, ms);
    const mins = Math.floor(clamped / 60000);
    const secs = Math.floor((clamped % 60000) / 1000);
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Früheste als "HH:MM" angegebene Basiszeit, z. B. aus den Live-Meldungen
 * der Teilnehmer. Liefert `null`, wenn keine gültige Angabe vorhanden ist.
 */
export function fruehesteBasis(werte: (string | undefined)[], now: Date = new Date()): string | null {
    let best: { value: string; ms: number } | null = null;
    for (const value of werte) {
        if (!value) {
            continue;
        }
        const ms = parseHHMMtoMs(value, now);
        if (ms === null) {
            continue;
        }
        if (!best || ms < best.ms) {
            best = { value, ms };
        }
    }
    return best?.value ?? null;
}
