/**
 * Registry der mitgelieferten Funkspruch-Vorlagen. Die Texte liegen unter
 * assets/funksprueche/ und werden erst bei Auswahl per fetch geladen.
 *
 * Der Schlüssel wird in der Übung als `verwendeteVorlagen` gespeichert; die
 * Admin-Übersicht löst ihn darüber wieder in den Anzeigenamen auf.
 *
 * `beschreibung`, `herkunft` und `anzahl` erscheinen in der Vorlagenauswahl
 * des Generators, damit man vor dem Generieren sieht, welche Lage in einer
 * Sammlung steckt (THW-Review 2026-10-05, new-user P2-1). Herkunft und Anzahl
 * prüft `tests/generator/vorlagenRegistry.test.ts` gegen den gezählten Bestand
 * (`scripts/lib/funkspruch-bestand.mjs`); nach jeder Änderung an einer
 * Textdatei schlägt er fehl, bis die Zahl hier nachgezogen ist.
 */
export type VorlagenHerkunft = "uebung" | "geschrieben";

export interface FunkspruchVorlage {
    text: string;
    filename: string;
    /** Lage und Schwerpunkt in einem Satz, ohne Zahlen. */
    beschreibung?: string;
    herkunft?: VorlagenHerkunft;
    /** Anzahl der Funksprüche in der Datei (nach Entfernen von Dubletten). */
    anzahl?: number;
    /** Nur zum Auflockern, nicht für die fachliche Ausbildung. */
    nebenbei?: boolean;
}

export const HERKUNFT_TEXT: Record<VorlagenHerkunft, string> = {
    uebung: "aus einer gefunkten Übung",
    geschrieben: "für den Generator geschrieben"
};

export const FUNKSPRUCH_VORLAGEN: Record<string, FunkspruchVorlage> = {
    grundausbildung: {
        text: "Einfache Funksprüche für die Grundausbildung",
        filename: "assets/funksprueche/funksprueche_grundausbildung_einfach.txt",
        beschreibung: "Kurze Nachrichten für die erste Funkübung: Anruf, Anrufantwort und Standortmeldung ohne langen Text.",
        herkunft: "uebung",
        anzahl: 462
    },
    thwleer: {
        text: "Funksprüche THW Leer",
        filename: "assets/funksprueche/nachrichten_thw_leer.txt",
        beschreibung: "Sturm- und Hochwasserlage in Ostfriesland: versperrte Straßen, volle Keller, Bergungsaufträge, drohende Uferüberläufe.",
        herkunft: "uebung",
        anzahl: 118
    },
    thwmelle: {
        text: "Funksprüche THW Melle",
        filename: "assets/funksprueche/nachrichten_thw_melle.txt",
        beschreibung: "Hohe Fachdichte: Pegelmeldungen, Behandlungsplätze, Einsatzabschnitte, Kanalzuweisungen, Stärkemeldungen mehrerer Organisationen.",
        herkunft: "uebung",
        anzahl: 400
    },
    thwessen: {
        text: "Funksprüche THW Essen",
        filename: "assets/funksprueche/nachrichten_thw_essen.txt",
        beschreibung: "Hochwasserlage im Essener Stadtgebiet: Erkundungsaufträge, Stärkemeldungen, Lotsenanforderung, Koordinaten im UTM-Format.",
        herkunft: "uebung",
        anzahl: 92
    },
    thwlehrte: {
        text: "Funksprüche THW Lehrte",
        filename: "assets/funksprueche/nachrichten_thw_lehrte.txt",
        beschreibung: "Große Unwetterlage im Raum Lehrte und Burgdorf: überflutete Straßenzüge, beschädigte Bahnanlagen, ausgefallene Versorgung.",
        herkunft: "uebung",
        anzahl: 752
    },
    thwsaarstedt: {
        text: "Funksprüche THW Saarstedt",
        filename: "assets/funksprueche/nachrichten_thw_saarstedt.txt",
        beschreibung: "Kurze Nachrichten mit Straßen- und Ortsnamen in Großbuchstaben, für das Buchstabieren und für Standortmeldungen.",
        herkunft: "uebung",
        anzahl: 200
    },
    feuerwehrUnwetter: {
        text: "Funksprüche Feuerwehr, Unwetterlage",
        filename: "assets/funksprueche/nachrichten_feuerwehr_unwetter.txt",
        beschreibung: "Sturmlage für die Feuerwehr: Bäume auf Straßen, Keller unter Wasser, Dachstuhlbrand, Atemschutz, Ablösung.",
        herkunft: "geschrieben",
        anzahl: 224
    },
    sanitaetBetreuungEvakuierung: {
        text: "Funksprüche Sanitäts- und Betreuungsdienst, Evakuierung",
        filename: "assets/funksprueche/nachrichten_sanitaet_betreuung_evakuierung.txt",
        beschreibung: "Räumung nach Kampfmittelfund: Betreuungsstelle, Registrierung, Verpflegung, Krankentransport.",
        herkunft: "geschrieben",
        anzahl: 139
    },
    wasserrettungHochwasser: {
        text: "Funksprüche Wasserrettung, Hochwasser",
        filename: "assets/funksprueche/nachrichten_wasserrettung_hochwasser.txt",
        beschreibung: "Hochwasser mit Evakuierung über Boote: Pegelmeldungen, Strömungsretter, Taucher, Personensuche am Fluss.",
        herkunft: "geschrieben",
        anzahl: 131
    },
    rettungsdienstManv: {
        text: "Funksprüche Rettungsdienst, Busunfall mit MANV",
        filename: "assets/funksprueche/nachrichten_rettungsdienst_manv.txt",
        beschreibung: "Busunfall mit vielen Verletzten: Sichtung, Patientenablage, Transportziele, Klinikkapazitäten, Hubschrauber.",
        herkunft: "geschrieben",
        anzahl: 136
    },
    vorlageLustig: {
        text: "Zum Auflockern: humorvolle Funksprüche",
        filename: "assets/funksprueche/funksprueche_lustig_kreativ.txt",
        beschreibung: "Erfundene, absichtlich alberne Lagen mit Figuren aus Film und Comic. Für einen lockeren Abend, nicht für die fachliche Ausbildung.",
        herkunft: "geschrieben",
        anzahl: 1660,
        nebenbei: true
    }
};
