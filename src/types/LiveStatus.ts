import type { NachrichtenStatusTeilnehmer, TeilnehmerStatus } from "./Storage";

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
}

/** Bestätigungen der Übungsleitung – für Teilnehmer sichtbar. */
export interface LeitungPublicLiveDoc {
    version: number;
    lastUpdated: string;
    /** Key = `${sender}__${nachrichtenNr}`. */
    nachrichten: Record<string, LeitungBestaetigung>;
}

export interface LeitungNotiz {
    notiz?: string;
    geaendertUm?: string;
}

/** Interne Daten der Übungsleitung – nicht für Teilnehmer bestimmt. */
export interface LeitungLiveDoc {
    version: number;
    lastUpdated: string;
    teilnehmer: Record<string, TeilnehmerStatus>;
    /** Key = `${sender}__${nachrichtenNr}`. */
    nachrichtenNotizen: Record<string, LeitungNotiz>;
}

export type LiveSyncState = "aus" | "verbinde" | "live" | "fehler";
