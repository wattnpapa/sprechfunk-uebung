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
 * An wen ein Spruch geht. "alle" meint wie im Zufallsmodus alle anderen
 * Teilnehmer (ohne Übungsleitung), "leitung" die Übungsleitung.
 */
export type SzenarioEmpfaenger = "leitung" | "alle" | "ich" | "partner";

export interface SzenarioSpruch {
    absender: SzenarioAbsender;
    empfaenger: SzenarioEmpfaenger;
    /**
     * Funkspruchtext. Optionale Platzhalter: {{ich}}, {{partner}}, {{leitung}}
     * werden bei der Generierung durch die echten Funkrufnamen ersetzt.
     */
    text: string;
}

export interface SzenarioStrang {
    titel: string;
    /** Aufeinander aufbauende Sprüche; der erste stammt immer vom Inhaber. */
    sprueche: SzenarioSpruch[];
}

/** Rahmenspruch (Einleitung/Abschluss); der Absender rotiert über die Teilnehmer. */
export interface SzenarioRahmenSpruch {
    empfaenger: "leitung" | "alle";
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
