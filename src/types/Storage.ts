export interface TeilnehmerStorage {
    version: number;
    uebungId: string;
    teilnehmer: string; // Funkrufname
    lastUpdated: string;
    nachrichten: Record<string, NachrichtenStatusTeilnehmer>;
    hideTransmitted: boolean;
    xZeitBasis?: string; // HH:MM – vom Teilnehmer selbst gesetzt
    /** Zeitpunkt der letzten Änderung an xZeitBasis (Basis für Live-Sync-Merge). */
    xZeitBasisGeaendertUm?: string;
}

export interface NachrichtenStatusTeilnehmer {
    uebertragen: boolean;
    uebertragenUm?: string;
    /**
     * Zeitpunkt der letzten Änderung an diesem Eintrag – auch beim Zurücksetzen.
     * Basis für den Last-Write-Wins-Merge zwischen Geräten.
     */
    geaendertUm?: string;
}

export interface UebungsleitungStorage {
    version: number;
    uebungId: string;
    lastUpdated: string;
    teilnehmer: Record<string, TeilnehmerStatus>;
    nachrichten: Record<string, NachrichtenStatus>;
}

export interface TeilnehmerStatus {
    angemeldetUm?: string;

    // Lösungswort (empfangen)
    loesungswortGesendet?: string;

    // Teilstärken (empfangen, 4 Felder)
    teilstaerken?: string[];

    // optional: später Gesamtstärke
    staerkeGesendet?: string;

    // Notizen Übungsleitung
    notizen?: string;

    /** Zeitpunkt der letzten Änderung an diesem Eintrag (Live-Sync-Merge). */
    geaendertUm?: string;
}

export interface NachrichtenStatus {
    abgesetztUm?: string;
    bestaetigt?: boolean;
    notiz?: string;
    /** Zeitpunkt der letzten Änderung an `abgesetztUm` (Live-Sync-Merge). */
    statusGeaendertUm?: string;
    /** Zeitpunkt der letzten Änderung an `notiz` (Live-Sync-Merge). */
    notizGeaendertUm?: string;
}