import type { NachrichtenStatusTeilnehmer, ReaktionBewertung, TeilnehmerStatus } from "./Storage";

/**
 * Live-Sync des Übungsstatus über die Subcollection `uebungen/{uebungId}/status`.
 *
 * Jedes Dokument hat genau einen Schreiber, damit zwischen den Rollen keine
 * Schreibkonflikte entstehen:
 *
 * - `teilnehmer-<teilnehmerId>` – geschrieben vom jeweiligen Teilnehmer
 * - `leitung-public`            – geschrieben von der Übungsleitung, für alle lesbar
 * - `leitung`                   – geschrieben von der Übungsleitung, interne Daten
 *                                 (Notizen, Lösungswörter, Stärken)
 *
 * Die Trennung von `leitung` und `leitung-public` existiert, damit Teilnehmer die
 * Bestätigungen der Leitung abonnieren können, ohne deren interne Notizen zu laden.
 */
export const LIVE_STATUS_VERSION = 1;

export const STATUS_COLLECTION = "status";
export const LEITUNG_DOC_ID = "leitung";
export const LEITUNG_PUBLIC_DOC_ID = "leitung-public";
export const TEILNEHMER_DOC_PREFIX = "teilnehmer-";

export function teilnehmerDocId(teilnehmerId: string): string {
    return `${TEILNEHMER_DOC_PREFIX}${teilnehmerId}`;
}

/** Status, den ein Teilnehmer über sich selbst meldet. */
export interface TeilnehmerLiveDoc {
    version: number;
    teilnehmerId: string;
    teilnehmer: string;
    lastUpdated: string;
    /** Key = Nachrichten-ID als String. */
    nachrichten: Record<string, NachrichtenStatusTeilnehmer>;
    xZeitBasis?: string;
    xZeitBasisGeaendertUm?: string;
}

export interface LeitungBestaetigung {
    abgesetztUm?: string;
    geaendertUm?: string;
    /** Zeit von Hand eingetragen (Papier-Nachtrag), nicht beim Funken geklickt. */
    nachgetragen?: boolean;
    /** Von der Leitung bewusst ausgelassen – nicht mehr fällig, nicht abgesetzt. */
    ausgelassen?: boolean;
    /** Zeit aus der Teilnehmer-Meldung übernommen (Sammelbestätigung). */
    zeitVomTeilnehmer?: boolean;
}

/** Bestätigungen der Übungsleitung – für Teilnehmer sichtbar. */
export interface LeitungPublicLiveDoc {
    version: number;
    lastUpdated: string;
    /** Key = `${sender}__${nachrichtenNr}`. */
    nachrichten: Record<string, LeitungBestaetigung>;
    /**
     * Verbindliche X-Zeit-Basis ("HH:MM"), von der Übungsleitung gesetzt. Die
     * Teilnehmer übernehmen sie; eine eigene Basis ist nur bewusste Abweichung.
     */
    xZeitBasis?: string;
    /** Zeitpunkt der letzten Änderung an `xZeitBasis` – auch beim Löschen. */
    xZeitBasisGeaendertUm?: string;
}

export interface LeitungNotiz {
    notiz?: string;
    geaendertUm?: string;
    /** Reaktion der beübten Stelle (Führungsstellen-Übung), eigener Zeitstempel. */
    reaktion?: ReaktionBewertung;
    reaktionGeaendertUm?: string;
}

/** Interne Daten der Übungsleitung – nicht für Teilnehmer bestimmt. */
export interface LeitungLiveDoc {
    version: number;
    lastUpdated: string;
    teilnehmer: Record<string, TeilnehmerStatus>;
    /** Key = `${sender}__${nachrichtenNr}`. */
    nachrichtenNotizen: Record<string, LeitungNotiz>;
}

/**
 * Zustand des Live-Sync aus Sicht dieses Geräts (siehe LiveStatusService):
 *
 * - `aus`      – Sync deaktiviert, es zählt nur dieses Gerät
 * - `verbinde` – noch keine Antwort vom Server
 * - `live`     – der Server hat die letzten Änderungen bestätigt
 * - `offline`  – keine Verbindung; Änderungen liegen lokal und werden nachgereicht
 * - `fehler`   – der Server lehnt ab; Änderungen werden **nicht** übertragen
 */
export type LiveSyncState = "aus" | "verbinde" | "live" | "offline" | "fehler";
