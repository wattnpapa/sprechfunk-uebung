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
}

/** Jeder Einsatzabschnitt braucht mindestens einen eigenen Strang. */
export function fuehrungsstellenMaxAbschnitte(uebung: Pick<FuehrungsstellenUebung, "straenge">): number {
    return uebung.straenge.length;
}

export function fuehrungsstellenNachrichtenAnzahl(
    uebung: Pick<FuehrungsstellenUebung, "straenge" | "uebergeordnet">
): number {
    return uebung.uebergeordnet.nachrichten.length
        + uebung.straenge.reduce((summe, strang) => summe + strang.nachrichten.length, 0);
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
    /** Index des Strangs oder null für den Stab. */
    strangIndex: number | null;
}

/**
 * Alle Nachrichten des Drehbuchs in Sendereihenfolge: nach Minute, bei
 * gleicher Minute Stränge vor dem Stab und in Strangreihenfolge. Stabil,
 * damit Generierung, Drehbuch und Tests dieselbe Reihenfolge sehen.
 */
export function fuehrungsstellenZeitachse(
    uebung: Pick<FuehrungsstellenUebung, "straenge" | "uebergeordnet">
): ZeitachsenEintrag[] {
    const eintraege: ZeitachsenEintrag[] = [];
    uebung.straenge.forEach((strang, strangIndex) => {
        strang.nachrichten.forEach(nachricht => eintraege.push({ nachricht, strangIndex }));
    });
    uebung.uebergeordnet.nachrichten.forEach(nachricht => eintraege.push({ nachricht, strangIndex: null }));
    return eintraege
        .map((eintrag, position) => ({ eintrag, position }))
        .sort((a, b) => a.eintrag.nachricht.zeit - b.eintrag.nachricht.zeit || a.position - b.position)
        .map(({ eintrag }) => eintrag);
}
