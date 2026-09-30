/**
 * Eine Einspielung ist das Drehbuch einer Stabsrahmenübung für genau eine
 * Führungsstelle. Beübt wird eine Einsatzleitung (EL); die Übungsleitung
 * spielt alles andere: die unterstellten Einsatzabschnitte (EA) und die
 * übergeordnete Stelle (Stab). Anders als ein Szenario hat eine Einspielung
 * feste Rollen und eine Zeitachse — jede Einlage trägt die Minute ab
 * Übungsbeginn, ihren Absender, den Übermittlungsweg und die Reaktion, die
 * von der beübten Stelle erwartet wird. Empfänger jeder Einlage ist immer
 * die beübte Führungsstelle; alles läuft über sie.
 */

/** Absender einer Einlage: der Stab oder ein Einsatzabschnitt (ea1, ea2, …). */
export type EinspielungAbsender = "stab" | `ea${number}`;

/** Übermittlungsweg: Sprechfunk, Ausdruck (Fernschreiben/Fax) oder E-Mail. */
export type EinspielungWeg = "funk" | "drucker" | "email";

export const EINSPIELUNG_WEGE: readonly EinspielungWeg[] = ["funk", "drucker", "email"];

/** Meldeart der Einlage — kennzeichnet im Drehbuch, was die Stelle damit tun muss. */
export type EinspielungArt =
    | "betrieb"
    | "lagemeldung"
    | "anforderung"
    | "rueckfrage"
    | "auftrag"
    | "information"
    | "vollzug";

export const EINSPIELUNG_ARTEN: readonly EinspielungArt[] = [
    "betrieb", "lagemeldung", "anforderung", "rueckfrage", "auftrag", "information", "vollzug"
];

export interface EinspielungEinlage {
    /** Minute ab Übungsbeginn; 0 ist der Übungsbeginn. */
    zeit: number;
    von: EinspielungAbsender;
    weg: EinspielungWeg;
    art: EinspielungArt;
    /** Betreffzeile — Pflicht bei drucker und email, bei funk nicht vorgesehen. */
    betreff?: string;
    /**
     * Text der Einlage. Platzhalter {{el}}, {{stab}}, {{ea1}} … werden bei der
     * Generierung durch die Funkrufnamen ersetzt.
     */
    text: string;
    /** Was die beübte Führungsstelle daraufhin tun soll — für die Übungsleitung. */
    erwartung: string;
}

export interface EinspielungRolle {
    bezeichnung: string;
    /**
     * Was die Rolle weiß und hat. Damit kann, wer sie spielt, Rückfragen der
     * Führungsstelle beantworten, die das Drehbuch nicht vorsieht.
     */
    hintergrund: string;
}

export interface Einspielung {
    slug: string;
    titel: string;
    /** Kurzbeschreibung für die Auswahl im Generator. */
    beschreibung: string;
    /** Ausgangslage als Fließtext; geht auch an die beübte Stelle. */
    lage: string;
    /** Auftrag der beübten Führungsstelle zu Übungsbeginn. */
    auftrag: string;
    dauerMinuten: number;
    uebergeordnet: EinspielungRolle;
    einsatzabschnitte: EinspielungRolle[];
    /** Aufsteigend nach `zeit` sortiert. */
    einlagen: EinspielungEinlage[];
}

/**
 * Rollenbesetzung einer konkreten Übung. Wird mit der Übung gespeichert, damit
 * die Ansichten und das Drehbuch die Funkrufnamen den Rollen zuordnen können.
 */
export interface EinspielungKonfiguration {
    slug: string;
    /** Funkrufname der beübten Führungsstelle. */
    beuebteStelle: string;
    /** Funkrufname der übergeordneten Stelle. */
    uebergeordnet: string;
    /** Funkrufnamen der Einsatzabschnitte in der Reihenfolge des Drehbuchs (ea1, ea2, …). */
    unterstellt: string[];
    /** Übungsbeginn als "HH:MM"; optional, nur für Uhrzeiten im Drehbuch. */
    beginn?: string;
}

export function einspielungAbsenderIndex(von: EinspielungAbsender): number | null {
    const treffer = /^ea(\d+)$/.exec(von);
    return treffer?.[1] ? parseInt(treffer[1], 10) : null;
}

/** Löst eine Absender-Rolle zum Funkrufnamen der Übung auf. */
export function einspielungAbsenderName(von: EinspielungAbsender, konfiguration: EinspielungKonfiguration): string {
    if (von === "stab") {
        return konfiguration.uebergeordnet;
    }
    const index = einspielungAbsenderIndex(von);
    return (index !== null ? konfiguration.unterstellt[index - 1] : undefined) ?? konfiguration.uebergeordnet;
}

/** Alle Stellen der Übung in fester Reihenfolge: beübte Stelle, Abschnitte, Stab. */
export function einspielungTeilnehmerListe(konfiguration: EinspielungKonfiguration): string[] {
    return [konfiguration.beuebteStelle, ...konfiguration.unterstellt, konfiguration.uebergeordnet];
}

export function einspielungAnzahlJeWeg(einspielung: Pick<Einspielung, "einlagen">): Record<EinspielungWeg, number> {
    const zaehler: Record<EinspielungWeg, number> = { funk: 0, drucker: 0, email: 0 };
    einspielung.einlagen.forEach(einlage => {
        zaehler[einlage.weg]++;
    });
    return zaehler;
}
