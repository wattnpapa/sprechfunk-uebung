// Soll-Liste der Aufnahmen (AP-10).
//
// Eine Stelle, an der alle benannten Ansichten stehen. Das Skript
// generate-anleitung-screenshots.mjs prüft am Ende, dass jeder Eintrag
// entstanden ist – fehlt einer, bricht es ab, statt eine Aufnahme
// stillschweigend zu verlieren.
//
// Die Aufnahmen sind nicht unabhängig voneinander: der Generator erzeugt die
// Übung, deren Kennungen die späteren Ansichten brauchen. Deshalb steht die
// Navigation im Skript und hier nur, was aufgenommen werden soll.

/** Phasen in Ausführungsreihenfolge. */
export const PHASEN = ["generator", "xzeit", "teilnehmer", "uebungsleitung"];

/**
 * name         – Dateiname ohne Endung unter assets/anleitung/
 * phase        – siehe PHASEN
 * beschreibung – wofür die Aufnahme da ist; erscheint in der Prüfausgabe
 * viewport     – abweichende Fenstergröße, sonst 1440x1000
 */
export const AUFNAHMEN = [
    {
        name: "generator-kopfdaten",
        phase: "generator",
        beschreibung: "Kopfdaten-Karte mit Datum, Name, Rufgruppe und Übungsleitung"
    },
    {
        name: "generator-einstellungen",
        phase: "generator",
        beschreibung: "Einstellungen: Verteilung, Quelle, Lösungswörter"
    },
    {
        name: "generator-teilnehmer",
        phase: "generator",
        beschreibung: "Teilnehmerverwaltung mit Rufnamen und Lösungswörtern"
    },
    {
        name: "generator-uebersicht",
        phase: "generator",
        beschreibung: "Die drei Karten des Generators nebeneinander"
    },
    {
        name: "generator-links",
        phase: "generator",
        beschreibung: "Ergebnis-Links je Teilnehmer und der ZIP-Download"
    },
    {
        name: "generator-statistik",
        phase: "generator",
        beschreibung: "Statistik-Ansicht mit Verteilung und geschätzter Dauer"
    },
    {
        name: "generator-x-zeit",
        phase: "xzeit",
        beschreibung: "X-Zeit-Konfiguration mit Intervall und Start-Offset"
    },
    {
        name: "teilnehmer-uebersicht",
        phase: "teilnehmer",
        beschreibung: "Teilnehmeransicht mit Funkspruch-Tabelle und Status"
    },
    {
        name: "teilnehmer-vordruck",
        phase: "teilnehmer",
        beschreibung: "Generierter Meldevordruck in der Vordruckansicht"
    },
    {
        name: "teilnehmer-smartphone",
        phase: "teilnehmer",
        beschreibung: "Teilnehmeransicht auf dem Smartphone",
        viewport: { width: 390, height: 844 }
    },
    {
        name: "uebungsleitung-uebersicht",
        phase: "uebungsleitung",
        beschreibung: "Übungsleitung mit Teilnehmertabelle und Fortschritt"
    },
    {
        name: "uebungsleitung-nachrichten",
        phase: "uebungsleitung",
        beschreibung: "Nachrichtenplan mit Filter, Status und Empfängern"
    },
    {
        name: "uebungsleitung-cockpit",
        phase: "xzeit",
        beschreibung: "Live-Status mit Laufzeit, Plan-Vergleich und Funklast"
    }
];

export const AUFNAHME_NAMEN = AUFNAHMEN.map(eintrag => eintrag.name);

/** Aufnahmen einer Phase, in Reihenfolge. */
export function aufnahmenDerPhase(phase) {
    return AUFNAHMEN.filter(eintrag => eintrag.phase === phase);
}
