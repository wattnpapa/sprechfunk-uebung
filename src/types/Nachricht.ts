/**
 * Übermittlungsart nach BOS-Sprechfunkbetrieb: ein `spruch` wird mit
 * Nachrichtenkopf abgesetzt und von der Gegenstelle in den Vordruck
 * aufgenommen, eine `durchsage` läuft formlos ohne Mitschrift.
 */
export type NachrichtArt = "spruch" | "durchsage";

import type { Meldeart, UebermittlungsWeg } from "./FuehrungsstellenUebung";

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
    /**
     * Globale Erzählreihenfolge im Szenario-Modus (1-basiert, über alle
     * Absender hinweg eindeutig). `id` bleibt die Sende-Reihenfolge je
     * Absender; senderübergreifende Ansichten sortieren nach diesem Feld,
     * damit die Dramaturgie des Szenarios erhalten bleibt.
     */
    szenarioNr?: number;
    /**
     * Nur in Führungsstellen-Übungen gesetzt: Übermittlungsweg, Meldeart,
     * Betreff (Ausdruck und E-Mail) und die Reaktion, die von der beübten
     * Stelle erwartet wird. Ältere Übungen haben die Felder nicht.
     */
    weg?: UebermittlungsWeg;
    meldeart?: Meldeart;
    betreff?: string;
    erwartung?: string;
}