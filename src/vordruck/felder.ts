// Feldgeometrie des BOS-Nachrichtenvordrucks. Bewusst ohne Bezug zur
// Sprechfunkübung – dieses Verzeichnis soll später als eigenständiges Paket
// „Vordrucke als PDF rendern" herausgelöst werden können.

/** Maße des Vordrucks in Millimetern (A5 hoch). */
export const VORDRUCK_BREITE = 148;
export const VORDRUCK_HOEHE = 210;

/** Übermittlungsart nach BOS-Sprechfunkbetrieb. */
export type VordruckArt = "spruch" | "durchsage";

/** Textanker eines Feldes auf dem Vordruck, in Millimetern. */
export interface VordruckPosition {
    readonly x: number;
    readonly y: number;
}

/**
 * Alle Ankreuzfelder des Nachrichtenvordrucks, bezogen auf das
 * Hintergrundbild `assets/nachrichtenvordruck4fach.png` (148 × 210 mm).
 *
 * Die Werte sind Textanker des „x": `x` liegt auf der linken Kante des
 * Kästchens, `y` auf dessen Unterkante – und damit auf der Grundlinie der
 * Schrift. Ermittelt wurden sie durch Mustererkennung im Formularbild (hohle
 * Quadrate); die Kästchen sind 2,7–3,2 mm groß, die Gesprächsnotiz 4,6 mm.
 *
 * Zum Nachjustieren `npm run vordruck:referenz -- --alle-felder` nutzen: die
 * Referenz-PDF zeigt jede Position mit Millimeter-Raster und Ankerpunkt.
 */
export const NACHRICHTENVORDRUCK_ANKREUZFELDER = {
    // Kopfzeile: Übermittlungsart für das Technische Betriebsbuch
    kopfFunk: { x: 15.4, y: 9 },
    kopfTelefon: { x: 32.6, y: 9 },
    kopfTelefax: { x: 53.2, y: 9 },
    kopfDfue: { x: 73.8, y: 9 },
    kopfKurier: { x: 91.3, y: 9 },

    // Technisches Betriebsbuch: Richtung
    betriebsbuchEingang: { x: 122.2, y: 22.3 },
    betriebsbuchAusgang: { x: 122.2, y: 27.5 },

    // Spruchkopf: Übermittlungsart
    spruchkopfFunk: { x: 18.6, y: 42.5 },
    spruchkopfTelefon: { x: 41.1, y: 42.5 },
    spruchkopfTelefax: { x: 68.4, y: 42.5 },
    spruchkopfDfue: { x: 94.2, y: 42.5 },
    spruchkopfKurier: { x: 116.9, y: 42.5 },

    // Spruchkopf: Art der Übermittlung und Vorrang
    durchsage: { x: 18.6, y: 47.5 },
    spruch: { x: 41.1, y: 47.5 },
    sofort: { x: 94.2, y: 47.5 },
    blitz: { x: 116.9, y: 47.5 },

    /**
     * Kästchen im Feld „GESPRÄCHSNOTIZ" rechts neben der Anschrift.
     *
     * Das einzige größere Kästchen des Vordrucks (126,3–130,9 × 56,5–61,1 mm).
     * Bei den 3-mm-Kästchen füllt das „x" die Breite fast aus, hier bliebe es
     * an der linken Kante sichtbar linksbündig – deshalb ist `x` um die halbe
     * Restbreite eingerückt, damit das Kreuz mittig steht.
     */
    gespraechsnotiz: { x: 127.4, y: 60.4 },

    // Verteiler „TEL / EL / EAL / UEAL" am Fuß des Vordrucks.
    // Drei Ankreuzspalten (x = 34,5 / 53,4 / 72,6 mm) über fünf Zeilen im
    // Abstand von 4 mm. Spalte 1 gehört zur vorgedruckten Stabsfunktion,
    // Spalte 2 und 3 zu den beiden freien Feldern daneben.
    verteilerLeiter: { x: 16.5, y: 187.3 },
    verteilerS1Spalte1: { x: 34.5, y: 186.8 },
    verteilerS1Spalte2: { x: 53.4, y: 186.8 },
    verteilerS1Spalte3: { x: 72.6, y: 186.8 },
    verteilerS2Spalte1: { x: 34.5, y: 190.8 },
    verteilerS2Spalte2: { x: 53.4, y: 190.8 },
    verteilerS2Spalte3: { x: 72.6, y: 190.8 },
    verteilerS3Spalte1: { x: 34.5, y: 194.8 },
    verteilerS3Spalte2: { x: 53.4, y: 194.8 },
    verteilerS3Spalte3: { x: 72.6, y: 194.8 },
    verteilerS4Spalte1: { x: 34.5, y: 198.8 },
    verteilerS4Spalte2: { x: 53.4, y: 198.8 },
    verteilerS4Spalte3: { x: 72.6, y: 198.8 },
    verteilerS6Spalte1: { x: 34.5, y: 202.8 },
    verteilerS6Spalte2: { x: 53.4, y: 202.8 },
    verteilerS6Spalte3: { x: 72.6, y: 202.8 }
} as const satisfies Record<string, VordruckPosition>;

/** Name eines Ankreuzfeldes auf dem Nachrichtenvordruck. */
export type NachrichtenvordruckAnkreuzfeld = keyof typeof NACHRICHTENVORDRUCK_ANKREUZFELDER;

/** Textfeld mit Anker, Standardschriftgröße und verfügbarer Breite. */
export interface VordruckTextfeldPosition extends VordruckPosition {
    /** Schriftgröße in pt. Die schmalen Vermerk-Zellen brauchen kleine Schrift. */
    readonly schriftgroesse: number;
    /** Verfügbare Breite in mm; darüber wird die Schrift verkleinert. */
    readonly maxBreite: number;
}

/**
 * Beschreibbare Felder des Nachrichtenvordrucks. Anker wie bei den
 * Ankreuzfeldern: `x` linke Kante der Zelle (mit ~1 mm Luft), `y` Grundlinie
 * knapp über der Zellunterkante.
 *
 * Zellgrenzen aus dem Formularbild (senkrechte und waagerechte Trennlinien):
 * Vermerk-Block 14,7–116,3 mm mit Spalten bei 26,7 / 39,7 / 47,7 / 61,4 /
 * 74,6 / 82,1 / 95,2 / 108,3 mm, Schreibfläche 16,1–26,7 mm. Unten die Zeilen
 * 149,8 / 156,2 / 162,8 / 167,8 / 174,3 mm mit Spalten bei 39,2 / 92,5 mm.
 */
export const NACHRICHTENVORDRUCK_TEXTFELDER = {
    // Aufnahmevermerk (Eingang)
    aufnahmevermerkDatum: { x: 15.7, y: 23.8, schriftgroesse: 8, maxBreite: 10.5 },
    aufnahmevermerkUhrzeit: { x: 27.7, y: 23.8, schriftgroesse: 8, maxBreite: 11.5 },
    aufnahmevermerkHdz: { x: 40.7, y: 23.8, schriftgroesse: 8, maxBreite: 6 },

    // Annahmevermerk (Ausgang)
    annahmevermerkDatum: { x: 48.7, y: 23.8, schriftgroesse: 8, maxBreite: 12 },
    annahmevermerkUhrzeit: { x: 62.4, y: 23.8, schriftgroesse: 8, maxBreite: 11.5 },
    annahmevermerkHdz: { x: 75.6, y: 23.8, schriftgroesse: 8, maxBreite: 5.5 },

    // Beförderungsvermerk (Ausgang)
    befoerderungsvermerkDatum: { x: 83.1, y: 23.8, schriftgroesse: 8, maxBreite: 11.5 },
    befoerderungsvermerkUhrzeit: { x: 96.2, y: 23.8, schriftgroesse: 8, maxBreite: 11.5 },
    befoerderungsvermerkHdz: { x: 109.3, y: 23.8, schriftgroesse: 8, maxBreite: 6 },

    /** Abfassungszeit im NATO-Format, z. B. „311131aug26" (`formatNatoDate`). */
    abfassungszeit: { x: 40.2, y: 161.2, schriftgroesse: 11, maxBreite: 51 },

    /** Handzeichen des Verfassers, üblich 2–4 Zeichen. */
    zeichen: { x: 93.6, y: 161.2, schriftgroesse: 11, maxBreite: 23 },

    /** Funktion des Verfassers, z. B. „S 2". */
    funktion: { x: 118.8, y: 161.2, schriftgroesse: 11, maxBreite: 22 },

    // Quittung: die grauen Beschriftungen „Uhrzeit" und „Zeichen" liegen unter
    // der Zeile, eine Trennlinie gibt es dort nicht – die Grenze zwischen den
    // Teilfeldern ist aus der Lage der Beschriftungen abgeleitet.
    quittungUhrzeit: { x: 40.3, y: 173.2, schriftgroesse: 11, maxBreite: 12.5 },
    quittungZeichen: { x: 63.7, y: 173.2, schriftgroesse: 11, maxBreite: 13 },
    quittungStelle: { x: 78, y: 173.2, schriftgroesse: 11, maxBreite: 14 },

    /** Freifläche rechts der Beschriftung „Vermerke". */
    vermerke: { x: 118.8, y: 173.2, schriftgroesse: 9, maxBreite: 22 }
} as const satisfies Record<string, VordruckTextfeldPosition>;

/** Name eines Textfeldes auf dem Nachrichtenvordruck. */
export type NachrichtenvordruckTextfeld = keyof typeof NACHRICHTENVORDRUCK_TEXTFELDER;

/** Übermittlungsweg – wird in Kopfzeile und Spruchkopf gleich angekreuzt. */
export type Uebermittlungsweg = "funk" | "telefon" | "telefax" | "dfue" | "kurier";

/** Richtung im Technischen Betriebsbuch. */
export type Vordruckrichtung = "eingang" | "ausgang";

/** Vorrangstufe im Spruchkopf. */
export type Vorrang = "sofort" | "blitz";

/** Ankreuzfeld der Übermittlungsart in der Kopfzeile. */
export const KOPF_UEBERMITTLUNGSWEG: Record<Uebermittlungsweg, NachrichtenvordruckAnkreuzfeld> = {
    funk: "kopfFunk",
    telefon: "kopfTelefon",
    telefax: "kopfTelefax",
    dfue: "kopfDfue",
    kurier: "kopfKurier"
};

/** Ankreuzfeld der Übermittlungsart im Spruchkopf. */
export const SPRUCHKOPF_UEBERMITTLUNGSWEG: Record<Uebermittlungsweg, NachrichtenvordruckAnkreuzfeld> = {
    funk: "spruchkopfFunk",
    telefon: "spruchkopfTelefon",
    telefax: "spruchkopfTelefax",
    dfue: "spruchkopfDfue",
    kurier: "spruchkopfKurier"
};

/** Ankreuzfeld der Richtung im Technischen Betriebsbuch. */
export const BETRIEBSBUCH_RICHTUNG: Record<Vordruckrichtung, NachrichtenvordruckAnkreuzfeld> = {
    eingang: "betriebsbuchEingang",
    ausgang: "betriebsbuchAusgang"
};
