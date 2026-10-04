export interface TeilnehmerStorage {
    version: number;
    uebungId: string;
    teilnehmer: string; // Funkrufname
    lastUpdated: string;
    nachrichten: Record<string, NachrichtenStatusTeilnehmer>;
    hideTransmitted: boolean;
    /**
     * Fokus-Modus (nur X-Zeit): zeigt statt der Tabelle nur die aktuell
     * fällige Meldung mit Countdown. Reine Ansichtseinstellung, gerätelokal.
     */
    fokusModus?: boolean;
    xZeitBasis?: string; // HH:MM – von der Übungsleitung übernommen oder selbst gesetzt
    /** Zeitpunkt der letzten Änderung an xZeitBasis (Basis für Live-Sync-Merge). */
    xZeitBasisGeaendertUm?: string;
    /**
     * Herkunft von `xZeitBasis`: `leitung` = verbindliche Vorgabe der
     * Übungsleitung übernommen, `eigen` = bewusste Abweichung dieses Teilnehmers.
     * Fehlt bei älteren Ständen (dann wie `eigen`). Gerätelokal.
     */
    xZeitBasisQuelle?: "leitung" | "eigen";
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
    /**
     * HH:MM – von der Übungsleitung im Cockpit verbindlich gesetzter
     * Übungsbeginn. Wird über `leitung-public` an alle Leitungs-Arbeitsplätze
     * und Teilnehmer verteilt. Basen einzelner Rollenspieler werden nie
     * stillschweigend übernommen, nur als Vorschlag angeboten.
     */
    xZeitBasis?: string;
    /** Zeitpunkt der letzten Änderung an `xZeitBasis` (Live-Sync-Merge). */
    xZeitBasisGeaendertUm?: string;
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
    /**
     * `abgesetztUm` wurde von Hand eingetragen (Papier-Nachtrag/Korrektur).
     * Solche Zeiten zählen nicht für Tempo und ETA.
     */
    nachgetragen?: boolean;
    /** Zeitpunkt der letzten Änderung an `notiz` (Live-Sync-Merge). */
    notizGeaendertUm?: string;
}