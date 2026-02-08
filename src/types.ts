export interface TeilnehmerStorage {
    version: number;
    uebungId: string;
    teilnehmer: string; // Funkrufname
    lastUpdated: string;
    nachrichten: Record<string, NachrichtenStatusTeilnehmer>;
    hideTransmitted: boolean;
}

export interface NachrichtenStatusTeilnehmer {
    uebertragen: boolean;
    uebertragenUm?: string;
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
}

export interface NachrichtenStatus {
    abgesetztUm?: string;
    bestaetigt?: boolean;
    notiz?: string;
}