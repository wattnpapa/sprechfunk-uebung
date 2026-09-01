export interface Nachricht {
    id: number;
    empfaenger: string[];
    nachricht: string;
    loesungsbuchstaben?: string[];
    staerken?: { fuehrer: number; unterfuehrer: number; helfer: number }[];
    xZeitSlot?: number;
    /**
     * Globale Erzählreihenfolge im Szenario-Modus (1-basiert, über alle
     * Absender hinweg eindeutig). `id` bleibt die Sende-Reihenfolge je
     * Absender; senderübergreifende Ansichten sortieren nach diesem Feld,
     * damit die Dramaturgie des Szenarios erhalten bleibt.
     */
    szenarioNr?: number;
}