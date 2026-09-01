// Strukturierung des Funkspruch-Bestands (AP-08).
//
// Reine Funktionen ohne Datei- und Netzzugriff: das Einlesen macht
// lib/funkspruch-bestand.mjs. So lässt sich jede Regel mit synthetischem Text
// prüfen, ohne 350 KB Vorlagen zu laden.
//
// Grundsatz für alle Ableitungen hier: nur was aus Dateiname oder Text
// nachweisbar folgt. Wo das nicht reicht, steht "allgemein" – lieber eine
// ehrliche Sammelkategorie als eine geratene Zuordnung.

import { createHash } from "node:crypto";

/**
 * Die Vorlagen des Bestands, eine je Datei unter assets/funksprueche/.
 *
 * `organisation` und `schwierigkeit` stehen hier, weil sie sich aus dem
 * Dateinamen ergeben und nicht aus dem einzelnen Spruch: "nachrichten_thw_*"
 * ist THW-Material, "*_einfach" ist als einfache Stufe benannt.
 *
 * `imArchiv: false` nimmt eine Vorlage aus dem öffentlichen Archiv, ohne sie
 * dem Generator zu entziehen. Die Dateien bleiben unverändert im Repo und in
 * der Anwendung auswählbar.
 */
export const VORLAGEN = [
    {
        datei: "funksprueche_grundausbildung_einfach.txt",
        slug: "grundausbildung-einfach",
        name: "Grundausbildung, einfache Nachrichten",
        organisation: ["allgemein"],
        schwierigkeit: "einfach",
        imArchiv: true
    },
    {
        datei: "nachrichten_thw_essen.txt",
        slug: "thw-essen",
        name: "THW Essen",
        organisation: ["thw"],
        imArchiv: true
    },
    {
        datei: "nachrichten_thw_leer.txt",
        slug: "thw-leer",
        name: "THW Leer",
        organisation: ["thw"],
        imArchiv: true
    },
    {
        datei: "nachrichten_thw_lehrte.txt",
        slug: "thw-lehrte",
        name: "THW Lehrte",
        organisation: ["thw"],
        imArchiv: true
    },
    {
        datei: "nachrichten_thw_melle.txt",
        slug: "thw-melle",
        name: "THW Melle",
        organisation: ["thw"],
        imArchiv: true
    },
    {
        datei: "nachrichten_thw_saarstedt.txt",
        slug: "thw-saarstedt",
        name: "THW Saarstedt",
        organisation: ["thw"],
        imArchiv: true
    },
    {
        datei: "funksprueche_lustig_kreativ.txt",
        slug: "lustig-kreativ",
        name: "Humorvolle Lagen",
        organisation: ["allgemein"],
        schwierigkeit: "einfach",
        // Bewusst nicht im öffentlichen Archiv: die Vorlage nennt fremde Marken
        // und Figuren wörtlich. Sie in der Anwendung für Übungs-PDFs zu nutzen
        // ist etwas anderes, als sie als durchsuchbares Archiv mit Download auf
        // der eigenen Domain zu veröffentlichen. Im Generator bleibt sie wählbar.
        imArchiv: false,
        grund: "nennt fremde Marken und Figuren wörtlich"
    }
];

/** Vorlagen des öffentlichen Archivs, in Registry-Reihenfolge. */
export const ARCHIV_VORLAGEN = VORLAGEN.filter(vorlage => vorlage.imArchiv);

export function vorlageFuerSlug(slug) {
    return VORLAGEN.find(vorlage => vorlage.slug === slug);
}

/**
 * Stabile Kennung eines Funkspruchs: die ersten 12 Hex-Zeichen des SHA-256 über
 * den Text. Zwei Builds mit gleichem Text liefern dieselbe Kennung, und ein
 * umsortierter oder umbenannter Bestand verschiebt keine Anker.
 */
export function funkspruchId(text) {
    return createHash("sha256").update(String(text), "utf8").digest("hex").slice(0, 12);
}

/**
 * Kategorien in Prüfreihenfolge – die erste zutreffende Regel gewinnt.
 *
 * Die Muster sind absichtlich eng gefasst. Ein weiter Ausdruck wie
 * /anforder|benötig|material/ zieht über 500 Sprüche in die
 * Materialanforderung, darunter Lagemeldungen, die das Wort nur nebenbei
 * enthalten. Eine falsche Kategorie ist schlechter als keine, deshalb landet
 * alles Unklare in "allgemein".
 */
export const KATEGORIE_REGELN = [
    ["staerkemeldung", "Stärkemeldung", /\bStärke:?\s*\d|\bStärkemeldung\b|\bMannschaftsstärke\b/],
    ["unwetter-hochwasser", "Unwetter und Hochwasser", /überflut|Überschwemmung|Hochwasser|\bPegel\b|\bDeich|Sandsäck|Starkregen|Unwetter|Sturmschaden|umgestürzt/i],
    ["brandeinsatz", "Brandeinsatz", /\bBrand\b|\bbrennt\b|Löschzug|Löschwasser|Brandbekämpfung/],
    ["sanitaetsdienst", "Sanitätsdienst", /Verletzt|verletzte|Verbandmaterial|Sanität|Rettungswagen|Notarzt|\bBHP\b|Medikament/],
    ["technische-hilfeleistung", "Technische Hilfeleistung", /\bBergung\b|\bbergen\b|geborgen|Abstütz|abstütz|Verschütt|Räumung|Trennschleif|Hebekissen/],
    ["erkundung", "Erkundung", /\bErkund/],
    ["logistik", "Logistik", /Transport|Verpflegung|Kraftstoff|Betankung|Stromerzeuger|Trinkwasser|Pumpanlage/],
    ["personalmeldung", "Personalmeldung", /Ablösung|ablösen|Dienstschluss|Voralarm/],
    ["materialanforderung", "Materialanforderung", /\banfordern\b|angefordert|\bAnforderung\b|\berbitten\b/],
    ["uebungsorganisation", "Übungsorganisation", /\bÜbung\b|Funkprobe|Sprechprobe|Lösungswort|Funkkanal/],
    ["standortmeldung", "Standortmeldung", /\bStandort\b|Einsatzstelle erreicht|Treffpunkt erreicht/]
];

export const KATEGORIE_ALLGEMEIN = { key: "allgemein", name: "Allgemeiner Funkverkehr" };

/** Alle Kategorien inklusive der Sammelkategorie, für Filter und Auswertung. */
export const KATEGORIEN = [
    ...KATEGORIE_REGELN.map(([key, name]) => ({ key, name })),
    KATEGORIE_ALLGEMEIN
];

export function kategorieFuer(text) {
    const treffer = KATEGORIE_REGELN.find(([, , muster]) => muster.test(text));
    return treffer ? treffer[0] : KATEGORIE_ALLGEMEIN.key;
}

export function kategorieName(key) {
    return KATEGORIEN.find(kategorie => kategorie.key === key)?.name ?? key;
}

/**
 * Schwierigkeit aus der Textlänge, weil die Mitschrift den Aufwand bestimmt:
 * Wer 300 Zeichen aufnimmt, schreibt bei etwa einem Zeichen je Sekunde fünf
 * Minuten. Trägt die Vorlage schon eine Stufe im Namen, gilt die.
 */
export const SCHWIERIGKEIT_GRENZEN = { einfachBis: 80, schwerAb: 180 };

export function schwierigkeitFuer(text, vorlage = {}) {
    if (vorlage.schwierigkeit) return vorlage.schwierigkeit;
    const zeichen = String(text).length;
    if (zeichen <= SCHWIERIGKEIT_GRENZEN.einfachBis) return "einfach";
    if (zeichen >= SCHWIERIGKEIT_GRENZEN.schwerAb) return "schwer";
    return "mittel";
}

/**
 * Enthält der Spruch ein Wort in Großbuchstaben, ist er als Buchstabieraufgabe
 * geeignet: Ortsnamen, Straßen und Codewörter stehen im Bestand durchgängig so.
 */
export function hatBuchstabieranteil(text) {
    return /\p{Lu}{3,}/u.test(String(text));
}

/** Zeilen einer Vorlagendatei zu Einträgen. Leerzeilen fallen weg. */
export function parseVorlage(vorlage, inhalt) {
    return String(inhalt)
        .split(/\r?\n/)
        .map(zeile => zeile.trim())
        .filter(zeile => zeile !== "")
        .map(text => ({
            id: funkspruchId(text),
            text,
            vorlage: vorlage.slug,
            kategorie: kategorieFuer(text),
            organisation: vorlage.organisation,
            schwierigkeit: schwierigkeitFuer(text, vorlage),
            buchstabieren: hatBuchstabieranteil(text),
            zeichen: text.length
        }));
}

/**
 * Baut den vollständigen Bestand.
 *
 * `inhalte` ist ein Objekt { <dateiname>: <inhalt> }. Fehlt eine Datei aus
 * VORLAGEN, wirft die Funktion: ein stillschweigend halber Bestand würde die
 * überall ausgewiesene Anzahl falsch machen.
 */
export function baueBestand(inhalte) {
    const alle = [];
    for (const vorlage of VORLAGEN) {
        const inhalt = inhalte[vorlage.datei];
        if (inhalt === undefined) {
            throw new Error(`Vorlage "${vorlage.datei}" fehlt – Bestand wäre unvollständig.`);
        }
        alle.push(...parseVorlage(vorlage, inhalt));
    }

    const archivSlugs = new Set(ARCHIV_VORLAGEN.map(vorlage => vorlage.slug));
    const archiv = alle.filter(eintrag => archivSlugs.has(eintrag.vorlage));

    const nachVorlage = new Map();
    for (const vorlage of VORLAGEN) {
        nachVorlage.set(vorlage.slug, alle.filter(eintrag => eintrag.vorlage === vorlage.slug));
    }

    const nachKategorie = new Map();
    for (const kategorie of KATEGORIEN) {
        nachKategorie.set(kategorie.key, archiv.filter(eintrag => eintrag.kategorie === kategorie.key));
    }

    return {
        alle,
        archiv,
        nachVorlage,
        nachKategorie,
        anzahlGesamt: alle.length,
        anzahlArchiv: archiv.length
    };
}

/** Deutsche Tausendertrennung, damit die Zahl im Text lesbar bleibt. */
export function deutscheZahl(wert) {
    return new Intl.NumberFormat("de-DE").format(wert);
}
