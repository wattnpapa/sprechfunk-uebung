/**
 * Übermittlungsart nach BOS-Sprechfunkbetrieb: ein `spruch` wird mit
 * Nachrichtenkopf abgesetzt und von der Gegenstelle in den Vordruck
 * aufgenommen, eine `durchsage` läuft formlos ohne Mitschrift.
 */
export type NachrichtArt = "spruch" | "durchsage";

export interface Nachricht {
    id: number;
    empfaenger: string[];
    nachricht: string;
    /**
     * Nur gesetzt, wenn die Übung mit aktivierter Kennzeichnung generiert
     * wurde. Ältere Übungen haben das Feld nicht.
     */
    art?: NachrichtArt;
    loesungsbuchstaben?: string[];
    staerken?: { fuehrer: number; unterfuehrer: number; helfer: number }[];
    xZeitSlot?: number;
}