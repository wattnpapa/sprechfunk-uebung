/**
 * Offline-Kopie der zuletzt geöffneten Übungen (THW-Review 2026-10-05,
 * offline P1-2): Ohne sie lud ein Reload im Funkloch – oder ein vom
 * Mobilbrowser verworfener Tab – zwar die App-Hülle aus dem Service Worker,
 * aber nicht die Übung. Der Teilnehmer stand vor dem Code-Formular, obwohl
 * seine Codes stimmten.
 *
 * Gespeichert wird das Übungsdokument so, wie die App es nach dem Laden
 * kennt (`FunkUebung.toJson()`, dasselbe Format wie der Mock-Speicher), dazu
 * der Zeitpunkt. Höchstens MAX_KOPIEN Übungen, die zuletzt geöffnete zuerst;
 * ist der Speicher voll, bleibt es beim Online-Verhalten.
 *
 * Bewusst statt Firestores `persistentLocalCache`: dessen IndexedDB-Schicht
 * hätte das Start-Bundle deutlich vergrößert (Performance-Budget), und die
 * Übung ist das einzige Dokument, das offline gebraucht wird – die
 * Markierungen liegen ohnehin schon lokal.
 */

const PREFIX = "sprechfunk:uebung-offline:";
const INDEX_KEY = `${PREFIX}index`;
export const MAX_KOPIEN = 3;

/** Ereignis an `window`, wenn eine Übung aus der Offline-Kopie angezeigt wird. */
export const OFFLINE_STAND_EREIGNIS = "sprechfunk:offline-stand";

export interface OfflineStandDetail {
    uebungId: string;
    standIso: string;
}

export interface OfflineKopie {
    daten: unknown;
    stand: Date;
}

/** Kein Netz bzw. keine Antwort: die Übung ist nicht auf diesem Gerät gespeichert. */
export class KeineVerbindungFehler extends Error {
    constructor(message = "Keine Verbindung zur Datenbank.") {
        super(message);
        this.name = "KeineVerbindungFehler";
    }
}

function speicher(): Storage | null {
    try {
        return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
        return null;
    }
}

function leseIndex(s: Storage): string[] {
    try {
        const roh = JSON.parse(s.getItem(INDEX_KEY) ?? "[]") as unknown;
        return Array.isArray(roh) ? roh.filter((id): id is string => typeof id === "string") : [];
    } catch {
        return [];
    }
}

export function speichereOfflineKopie(uebungId: string, json: string, jetzt: Date = new Date()): void {
    const s = speicher();
    if (!s || !uebungId) {
        return;
    }
    const index = [uebungId, ...leseIndex(s).filter(id => id !== uebungId)];
    try {
        index.slice(MAX_KOPIEN).forEach(id => s.removeItem(PREFIX + id));
        s.setItem(PREFIX + uebungId, JSON.stringify({ stand: jetzt.toISOString(), json }));
        s.setItem(INDEX_KEY, JSON.stringify(index.slice(0, MAX_KOPIEN)));
    } catch {
        // Speicher voll oder gesperrt: dann eben ohne Offline-Kopie.
        try {
            s.removeItem(PREFIX + uebungId);
        } catch {
            // nichts zu tun
        }
    }
}

export function ladeOfflineKopie(uebungId: string): OfflineKopie | null {
    const s = speicher();
    if (!s || !uebungId) {
        return null;
    }
    try {
        const roh = JSON.parse(s.getItem(PREFIX + uebungId) ?? "null") as { stand?: unknown; json?: unknown } | null;
        if (!roh || typeof roh.json !== "string" || typeof roh.stand !== "string") {
            return null;
        }
        const stand = new Date(roh.stand);
        return Number.isNaN(stand.getTime()) ? null : { daten: JSON.parse(roh.json), stand };
    } catch {
        return null;
    }
}

export function entferneOfflineKopie(uebungId: string): void {
    const s = speicher();
    if (!s) {
        return;
    }
    try {
        s.removeItem(PREFIX + uebungId);
        s.setItem(INDEX_KEY, JSON.stringify(leseIndex(s).filter(id => id !== uebungId)));
    } catch {
        // nichts zu tun
    }
}

/** Meldet der Oberfläche, dass ein gespeicherter Stand angezeigt wird. */
export function meldeOfflineStand(uebungId: string, stand: Date): void {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof CustomEvent !== "function") {
        return;
    }
    const detail: OfflineStandDetail = { uebungId, standIso: stand.toISOString() };
    window.dispatchEvent(new CustomEvent(OFFLINE_STAND_EREIGNIS, { detail }));
}

/** Weiß der Browser schon, dass kein Netz da ist? */
export function istOffline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Ist der Fehler ein Verbindungsproblem und kein „gibt es nicht“ / „darf
 * nicht“? Firestore meldet fehlendes Netz als Code `unavailable` bzw. mit
 * „client is offline“; ein Zeitlimit zählt ebenfalls dazu.
 */
export function istVerbindungsfehler(err: unknown): boolean {
    if (err instanceof KeineVerbindungFehler) {
        return true;
    }
    const code = (err as { code?: unknown } | null)?.code;
    if (code === "unavailable" || code === "deadline-exceeded") {
        return true;
    }
    const text = err instanceof Error ? err.message : String(err ?? "");
    return /offline|failed to fetch|network|zeitlimit/i.test(text) || istOffline();
}

/** Wartet höchstens `ms`; danach gilt die Anfrage als Verbindungsproblem. */
export function mitVerbindungsZeitlimit<T>(versprechen: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ablauf = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new KeineVerbindungFehler("Zeitlimit beim Laden.")), ms);
    });
    return Promise.race([versprechen, ablauf]).finally(() => clearTimeout(timer));
}
