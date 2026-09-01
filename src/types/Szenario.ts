/**
 * Ein Szenario ist ein Drehbuch aus zusammenhängenden Funksprüchen zu einer
 * gemeinsamen Einsatzlage. Damit es mit jeder Teilnehmerzahl funktioniert,
 * besteht es nicht aus festen Rollen, sondern aus Handlungssträngen: Jeder
 * Strang ist eine kleine, in sich geschlossene Einsatzstelle derselben Lage.
 * Bei der Generierung werden die Stränge auf die tatsächlich vorhandenen
 * Teilnehmer verteilt (weniger Teilnehmer -> mehrere Stränge pro Teilnehmer),
 * die maximale Teilnehmerzahl ist die Stranganzahl.
 */

/** Wer einen Strang-Spruch sendet: der Strang-Inhaber oder sein Partner. */
export type SzenarioAbsender = "ich" | "partner";

/**
 * An wen ein Spruch geht. Mit der Übungsleitung wird grundsätzlich nicht
 * kommuniziert (nur der Anmeldungs-Funkspruch geht an sie) — Meldungen eines
 * Strangs empfängt stattdessen die "gegenstelle": ein je Strang fest
 * zugeloster anderer Teilnehmer, der die Meldungen dieses Strangs aufnimmt.
 * "alle" meint wie im Zufallsmodus alle anderen Teilnehmer.
 */
export type SzenarioEmpfaenger = "gegenstelle" | "alle" | "ich" | "partner";

export interface SzenarioSpruch {
    absender: SzenarioAbsender;
    empfaenger: SzenarioEmpfaenger;
    /**
     * Funkspruchtext. Optionale Platzhalter: {{ich}}, {{partner}} und
     * {{gegenstelle}} werden bei der Generierung durch die echten
     * Funkrufnamen ersetzt.
     */
    text: string;
}

export interface SzenarioStrang {
    titel: string;
    /** Aufeinander aufbauende Sprüche; der erste stammt immer vom Inhaber. */
    sprueche: SzenarioSpruch[];
}

/**
 * Rahmenspruch (Einleitung/Abschluss); der Absender rotiert über die
 * Teilnehmer, Empfänger sind immer alle anderen Teilnehmer.
 */
export interface SzenarioRahmenSpruch {
    empfaenger: "alle";
    text: string;
}

export interface Szenario {
    slug: string;
    titel: string;
    /** Kurzbeschreibung für die Auswahl im Generator. */
    beschreibung: string;
    /** Ausgangslage als Fließtext. */
    lage: string;
    minTeilnehmer: number;
    einleitung: SzenarioRahmenSpruch[];
    straenge: SzenarioStrang[];
    abschluss: SzenarioRahmenSpruch[];
}

/** Jeder Teilnehmer braucht mindestens einen eigenen Strang. */
export function szenarioMaxTeilnehmer(szenario: Szenario): number {
    return szenario.straenge.length;
}

export function szenarioSpruchAnzahl(szenario: Szenario): number {
    return (
        szenario.einleitung.length +
        szenario.abschluss.length +
        szenario.straenge.reduce((summe, strang) => summe + strang.sprueche.length, 0)
    );
}
