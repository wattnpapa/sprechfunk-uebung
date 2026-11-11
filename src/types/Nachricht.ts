/**
 * Formlose Nachrichtenart nach BOS-Fernmeldebetrieb, wie sie die Übung
 * kennzeichnet: eine `durchsage` schreibt die Gegenstelle grundsätzlich mit
 * (Regelfall), ein `gespraech` ist unmittelbarer Austausch ohne Mitschrift.
 *
 * Der formgebundene Spruch (Spruchkopf, Anschrift, Inhalt unveränderlich)
 * ist im Betrieb die Ausnahme und wird hier bewusst nicht vergeben.
 * Übungen vor dieser Unterscheidung speicherten `spruch` für „mitschreiben“
 * und `durchsage` für „nur hören“; `firestoreMapping` übersetzt sie beim Laden.
 */
export type NachrichtArt = "durchsage" | "gespraech";

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