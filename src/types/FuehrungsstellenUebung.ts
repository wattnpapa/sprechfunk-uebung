/**
 * Eine Führungsstellen-Übung ist das Drehbuch einer Stabsrahmenübung für
 * genau eine Führungsstelle. Beübt wird eine Einsatzleitung (EL); die
 * Übungsleitung spielt alles andere ein: die unterstellten Einsatzabschnitte
 * (EA) und die übergeordnete Stelle (Stab). Empfänger jeder Nachricht ist die
 * beübte Stelle — alles läuft über sie.
 *
 * Damit das Drehbuch mit jeder Zahl von Einsatzabschnitten funktioniert, ist
 * es wie ein Szenario in Handlungsstränge geteilt: Jeder Strang ist eine
 * Einsatzstelle derselben Lage. Bei der Generierung werden die Stränge reihum
 * auf die vorhandenen Einsatzabschnitte verteilt (weniger Abschnitte ->
 * mehrere Einsatzstellen je Abschnitt); höchstens gibt es so viele Abschnitte
 * wie Stränge. Anders als im Szenario hat jede Nachricht eine feste Minute ab
 * Übungsbeginn, einen Übermittlungsweg und die Reaktion, die von der beübten
 * Stelle erwartet wird.
 *
 * Optional spielt die Übungsleitung auch die Führung der beübten Stelle ein
 * (Leitung und Sachgebiete). Dann wird nur deren Fernmeldezentrale beübt: Sie
 * bekommt die Ausgänge der Führung als ausgefüllte Vordrucke und übermittelt
 * sie an die Einsatzabschnitte und an den Stab.
 */

/** Übermittlungsweg: Sprechfunk, Ausdruck (Fernschreiben/Fax) oder E-Mail. */
export type UebermittlungsWeg = "funk" | "drucker" | "email";

export const UEBERMITTLUNGS_WEGE: readonly UebermittlungsWeg[] = ["funk", "drucker", "email"];

/** Meldeart — kennzeichnet im Drehbuch, was die Führungsstelle damit tun muss. */
export type Meldeart =
    | "betrieb"
    | "lagemeldung"
    | "anforderung"
    | "rueckfrage"
    | "auftrag"
    | "information"
    | "vollzug";

export const MELDEARTEN: readonly Meldeart[] = [
    "betrieb", "lagemeldung", "anforderung", "rueckfrage", "auftrag", "information", "vollzug"
];

export interface FuehrungsstellenNachricht {
    /** Minute ab Übungsbeginn; 0 ist der Übungsbeginn. */
    zeit: number;
    weg: UebermittlungsWeg;
    art: Meldeart;
    /** Betreffzeile — Pflicht bei drucker und email, bei funk nicht vorgesehen. */
    betreff?: string;
    /**
     * Nachrichtentext. Platzhalter: {{el}}, {{stab}}, {{ea}} (der Abschnitt,
     * der den eigenen Strang führt; nur in Strängen) und {{ea:<strang>}} (der
     * Abschnitt, der den Strang mit diesem Schlüssel führt).
     */
    text: string;
    /** Was die beübte Führungsstelle daraufhin tun soll — für die Übungsleitung. */
    erwartung: string;
}

export interface FuehrungsstellenRolle {
    bezeichnung: string;
    /**
     * Was die Rolle weiß und hat. Damit kann, wer sie spielt, Rückfragen der
     * Führungsstelle beantworten, die das Drehbuch nicht vorsieht.
     */
    hintergrund: string;
}

/** Eine Einsatzstelle der Lage; wird von genau einem Einsatzabschnitt geführt. */
export interface FuehrungsstellenStrang extends FuehrungsstellenRolle {
    /** Schlüssel für den Platzhalter {{ea:<key>}}; Kleinbuchstaben, Ziffern, Bindestrich. */
    key: string;
    /** Aufsteigend nach `zeit`; alle über Funk. */
    nachrichten: FuehrungsstellenNachricht[];
}

export interface FuehrungsstellenStab extends FuehrungsstellenRolle {
    /** Aufsteigend nach `zeit`; Funk, Ausdruck oder E-Mail. */
    nachrichten: FuehrungsstellenNachricht[];
}

/**
 * Empfänger eines Ausgangs der eigenen Führung: der Stab, der Abschnitt, der
 * einen bestimmten Strang führt („ea:<strang>“), oder alle Abschnitte.
 */
export type AusgangsZiel = "stab" | "alle-ea" | `ea:${string}`;

/** Nachricht, die die Führung der beübten Stelle über ihre Fernmeldezentrale absetzt. */
export interface FuehrungsstellenAusgang extends FuehrungsstellenNachricht {
    /** Mindestens ein Ziel; bei mehreren Zielen ist die Nachricht ein Mehrfachspruch. */
    an: AusgangsZiel[];
}

/** Leitung und Sachgebiete der beübten Stelle, wenn nur die Fernmeldezentrale beübt wird. */
export interface FuehrungsstellenFuehrung extends FuehrungsstellenRolle {
    /** Aufsteigend nach `zeit`. An Abschnitte nur über Funk. */
    nachrichten: FuehrungsstellenAusgang[];
}

export interface FuehrungsstellenUebung {
    slug: string;
    titel: string;
    /** Kurzbeschreibung für die Auswahl im Generator. */
    beschreibung: string;
    /** Ausgangslage als Fließtext; geht auch an die beübte Stelle. */
    lage: string;
    /** Auftrag der beübten Führungsstelle zu Übungsbeginn. */
    auftrag: string;
    dauerMinuten: number;
    /** Kleinste sinnvolle Zahl von Einsatzabschnitten; die größte ist die Stranganzahl. */
    minAbschnitte: number;
    uebergeordnet: FuehrungsstellenStab;
    straenge: FuehrungsstellenStrang[];
    /** Ausgänge der eigenen Führung; ohne diesen Block lässt sich die Führung nicht einspielen. */
    fuehrung?: FuehrungsstellenFuehrung;
}

/**
 * Rollenbesetzung einer konkreten Übung. Wird mit der Übung gespeichert, damit
 * Ansichten und Drehbuch die Funkrufnamen den Rollen zuordnen können.
 */
export interface FuehrungsstellenKonfiguration {
    slug: string;
    /** Funkrufname der beübten Führungsstelle. */
    beuebteStelle: string;
    /** Funkrufname der übergeordneten Stelle. */
    uebergeordnet: string;
    /** Funkrufnamen der Einsatzabschnitte; Reihenfolge bestimmt die Strangverteilung. */
    unterstellt: string[];
    /** Übungsbeginn als "HH:MM"; optional, nur für Uhrzeiten im Drehbuch. */
    beginn?: string;
    /**
     * Stellenname je Funkrufname („Einsatzleitung“, „Führungsstab“), wie
     * `teilnehmerStellen` der klassischen Übung. Steht auf den
     * Nachrichtenvordrucken als Anschrift und in der Übungsleitung neben dem
     * Funkrufnamen. Nur gefüllte Einträge werden geführt.
     */
    stellen?: Record<string, string>;
    /**
     * Die Übungsleitung spielt auch die Führung der beübten Stelle ein; beübt
     * wird nur deren Fernmeldezentrale. Die Ausgänge der Führung werden dann
     * Nachrichten der beübten Stelle.
     */
    fuehrungEingespielt?: boolean;
}

/** Jeder Einsatzabschnitt braucht mindestens einen eigenen Strang. */
export function fuehrungsstellenMaxAbschnitte(uebung: Pick<FuehrungsstellenUebung, "straenge">): number {
    return uebung.straenge.length;
}

/** Eingehende Nachrichten: Stränge und Stab, ohne die Ausgänge der eigenen Führung. */
export function fuehrungsstellenNachrichtenAnzahl(
    uebung: Pick<FuehrungsstellenUebung, "straenge" | "uebergeordnet">
): number {
    return uebung.uebergeordnet.nachrichten.length
        + uebung.straenge.reduce((summe, strang) => summe + strang.nachrichten.length, 0);
}

export function fuehrungsstellenAusgangAnzahl(uebung: Pick<FuehrungsstellenUebung, "fuehrung">): number {
    return uebung.fuehrung?.nachrichten.length ?? 0;
}

/**
 * Strang-Index -> Index des Einsatzabschnitts, reihum. Bewusst ohne Zufall:
 * Wer dasselbe Drehbuch für mehrere Führungsstellen vorbereitet, soll bei
 * jeder dieselbe Zuordnung bekommen.
 */
export function verteileStraenge(anzahlStraenge: number, anzahlAbschnitte: number): number[] {
    const abschnitte = Math.max(1, anzahlAbschnitte);
    return Array.from({ length: anzahlStraenge }, (_, index) => index % abschnitte);
}

/** Alle Stellen der Übung in fester Reihenfolge: beübte Stelle, Abschnitte, Stab. */
export function fuehrungsstellenTeilnehmerListe(konfiguration: FuehrungsstellenKonfiguration): string[] {
    return [konfiguration.beuebteStelle, ...konfiguration.unterstellt, konfiguration.uebergeordnet];
}

export interface ZeitachsenEintrag {
    nachricht: FuehrungsstellenNachricht;
    /** Index des Strangs oder null für den Stab und die eigene Führung. */
    strangIndex: number | null;
    /** Nur bei Ausgängen der eigenen Führung gesetzt. */
    an?: AusgangsZiel[];
}

/**
 * Alle Nachrichten des Drehbuchs in Sendereihenfolge: nach Minute, bei
 * gleicher Minute Stränge vor dem Stab vor der eigenen Führung (sie reagiert
 * auf beide) und in Strangreihenfolge. Die Ausgänge der Führung nur mit
 * `mitFuehrung`. Stabil, damit Generierung, Drehbuch und Tests dieselbe
 * Reihenfolge sehen.
 */
export function fuehrungsstellenZeitachse(
    uebung: Pick<FuehrungsstellenUebung, "straenge" | "uebergeordnet" | "fuehrung">,
    mitFuehrung = false
): ZeitachsenEintrag[] {
    const eintraege: ZeitachsenEintrag[] = [];
    uebung.straenge.forEach((strang, strangIndex) => {
        strang.nachrichten.forEach(nachricht => eintraege.push({ nachricht, strangIndex }));
    });
    uebung.uebergeordnet.nachrichten.forEach(nachricht => eintraege.push({ nachricht, strangIndex: null }));
    if (mitFuehrung) {
        uebung.fuehrung?.nachrichten.forEach(nachricht =>
            eintraege.push({ nachricht, strangIndex: null, an: nachricht.an }));
    }
    return eintraege
        .map((eintrag, position) => ({ eintrag, position }))
        .sort((a, b) => a.eintrag.nachricht.zeit - b.eintrag.nachricht.zeit || a.position - b.position)
        .map(({ eintrag }) => eintrag);
}
