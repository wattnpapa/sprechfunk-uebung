// Druckfertige A4-Aushänge (AP-12).
//
// Die vier Blätter sollen eigenständig weitergegeben werden können: sie landen
// im Intranet einer Dienststelle, im Ausbildungsordner, an der Pinnwand. Damit
// sie dort auffindbar bleiben, trägt jedes Blatt Quelle, Lizenz und einen
// QR-Code auf die zugehörige Seite.
//
// Inhalte werden NICHT hier gepflegt, sondern beim Build aus den Seiten
// gelesen (Buchstabiertafel, Betriebsworte) bzw. aus der Registry (HowTo-
// Schritte). Eine zweite Fassung derselben Tabelle würde auseinanderlaufen,
// und ein veralteter Aushang ist schlimmer als keiner.
//
// Reine Funktionen ohne Datei- und Netzzugriff; das Zeichnen bekommt ein
// jsPDF-Dokument hereingereicht. scripts/generate-pdfs.mjs macht die I/O.

import { canonicalUrl } from "../site-pages.mjs";
import { qrMatrix } from "./qrcode.mjs";

/** Seitenmaße DIN A4 in Millimetern. */
export const SEITE = { breite: 210, hoehe: 297, rand: 15 };

export const LIZENZ = "EUPL-1.2 – Weitergabe und Druck ausdrücklich erwünscht";
export const HERKUNFT = "sprechfunk-uebung.de";

/**
 * Die Aushänge.
 *
 * `quelle` sagt, woher der Inhalt beim Build kommt:
 *   { art: "tabelle", seite, tabelle } – Tabelle aus einer Inhaltsseite
 *   { art: "howto", seite }            – HowTo-Schritte aus der Registry
 *   { art: "formular" }                – gezeichnet, ohne Datenquelle
 */
export const AUSHAENGE = [
    {
        slug: "buchstabiertafel",
        dateiname: "buchstabiertafel-aushang.pdf",
        titel: "Buchstabiertafel",
        untertitel: "Buchstabieren im BOS-Sprechfunk",
        hinweis: "Zum Aushang an der Funkstelle. Beim Buchstabieren wird das Wort genannt, "
            + "nicht der Buchstabe: „Anton, Berta, Cäsar“.",
        ziel: "buchstabiertafel",
        quelle: { art: "tabelle", seite: "buchstabiertafel", tabelle: 0 },
        spalten: ["Buchstabe", "Buchstabierwort"],
        spaltenAnzahl: 2,
        sortiert: true
    },
    {
        slug: "betriebsworte",
        dateiname: "betriebsworte-uebersicht.pdf",
        titel: "Betriebsworte",
        untertitel: "Sprachwendungen im Sprechfunkverkehr",
        hinweis: "Betriebsworte ersetzen freie Formulierungen. Wer sie benutzt, hält den "
            + "Kanal kurz und wird auf jeder Gegenstelle gleich verstanden.",
        ziel: "betriebsworte",
        quelle: { art: "tabelle", seite: "betriebsworte", tabelle: 0 },
        spalten: ["Betriebswort", "Bedeutung"],
        spaltenAnzahl: 1
    },
    {
        slug: "meldevordruck",
        dateiname: "meldevordruck-vorlage.pdf",
        titel: "Nachrichtenvordruck",
        untertitel: "Leere Vorlage zum Ausfüllen",
        hinweis: "Vor dem Senden ausfüllen, nicht währenddessen. Wer erst beim Sprechen "
            + "formuliert, blockiert den Kanal.",
        ziel: "meldevordruck",
        quelle: { art: "formular" }
    },
    {
        slug: "checkliste-funkuebung",
        dateiname: "checkliste-funkuebung.pdf",
        titel: "Checkliste Funkübung",
        untertitel: "Von der Zielsetzung bis zur Nachbesprechung",
        hinweis: "Die sieben Schritte einer Funkübung. Abhaken, was erledigt ist.",
        ziel: "funkuebung-planen",
        quelle: { art: "howto", seite: "funkuebung-planen" }
    }
];

/** Zieladresse des QR-Codes eines Aushangs. */
export function aushangUrl(aushang) {
    return canonicalUrl(aushang.ziel);
}

/** Pfad, unter dem der Aushang ausgeliefert wird. */
export function aushangPfad(aushang) {
    return `/downloads/${aushang.dateiname}`;
}

// ------------------------------------------------------------- Zeichnen

/**
 * QR-Code als zusammengefasste Rechtecke.
 *
 * Waagerechte Läufe werden verschmolzen: ein Modul je Rechteck bläht die PDF
 * um ein Vielfaches auf, ohne dass ein Scanner mehr sieht.
 */
export function qrRechtecke(text, { x, y, kante }) {
    const { matrix, groesse } = qrMatrix(text);
    const modul = kante / (groesse + 8); // vier Module Ruhezone je Seite
    const rechtecke = [];
    for (let zeile = 0; zeile < groesse; zeile++) {
        let start = null;
        for (let spalte = 0; spalte <= groesse; spalte++) {
            const dunkel = spalte < groesse && matrix[zeile][spalte];
            if (dunkel && start === null) start = spalte;
            if (!dunkel && start !== null) {
                rechtecke.push({
                    x: x + (start + 4) * modul,
                    y: y + (zeile + 4) * modul,
                    breite: (spalte - start) * modul,
                    hoehe: modul
                });
                start = null;
            }
        }
    }
    return { rechtecke, modul, groesse };
}

/** Kopfbereich: Titel, Untertitel, Hinweissatz. */
function zeichneKopf(doc, aushang) {
    const { rand, breite } = SEITE;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(13, 110, 253);
    doc.text(aushang.titel, rand, rand + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(aushang.untertitel, rand, rand + 15);

    doc.setDrawColor(13, 110, 253);
    doc.setLineWidth(0.8);
    doc.line(rand, rand + 19, breite - rand, rand + 19);

    doc.setFontSize(9.5);
    doc.setTextColor(90, 90, 90);
    const zeilen = doc.splitTextToSize(aushang.hinweis, breite - rand * 2);
    doc.text(zeilen, rand, rand + 25);
    return rand + 25 + zeilen.length * 4.5 + 4;
}

/**
 * Fußzeile mit Herkunft, Lizenz, Stand und QR-Code.
 * Steht auf jedem Blatt an derselben Stelle — das Blatt soll auch dann noch
 * zuzuordnen sein, wenn es zehnmal kopiert wurde.
 */
function zeichneFuss(doc, aushang, stand) {
    const { rand, breite, hoehe } = SEITE;
    const qrKante = 24;
    const qrX = breite - rand - qrKante;
    const qrY = hoehe - rand - qrKante;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(rand, qrY - 4, breite - rand, qrY - 4);

    const url = aushangUrl(aushang);
    const { rechtecke } = qrRechtecke(url, { x: qrX, y: qrY, kante: qrKante });
    doc.setFillColor(255, 255, 255);
    doc.rect(qrX, qrY, qrKante, qrKante, "F");
    doc.setFillColor(0, 0, 0);
    for (const feld of rechtecke) {
        doc.rect(feld.x, feld.y, feld.breite, feld.hoehe, "F");
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(13, 110, 253);
    doc.text(HERKUNFT, rand, qrY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text([
        "Kostenloser Übungsgenerator für BOS-Sprechfunk – ohne Anmeldung, ohne Installation.",
        LIZENZ,
        `Quelle: ${url}`,
        `Stand: ${stand}`
    ], rand, qrY + 10.5, { lineHeightFactor: 1.45 });
}

/** Verfügbare Höhe zwischen Kopfbereich und Fußzeile. */
function inhaltsHoehe(oben) {
    return SEITE.hoehe - SEITE.rand - 44 - oben;
}

/**
 * Kurzeinträge in mehreren Spalten (Buchstabiertafel).
 * Die Zeilenhöhe füllt die Seite aus: ein Aushang soll aus zwei Metern
 * Entfernung lesbar sein, nicht ein Drittel Blatt belegen.
 */
function zeichneSpaltenTabelle(doc, aushang, zeilen, oben) {
    const { rand, breite } = SEITE;
    const spalten = aushang.spaltenAnzahl ?? 1;
    const spaltenBreite = (breite - rand * 2) / spalten;
    const proSpalte = Math.ceil(zeilen.length / spalten);
    const zeilenHoehe = Math.min(11, inhaltsHoehe(oben) / proSpalte);
    const schrift = Math.min(13, zeilenHoehe * 1.25);

    for (let spalte = 0; spalte < spalten; spalte++) {
        const x = rand + spalte * spaltenBreite;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(aushang.spalten[0], x + 1, oben);
        doc.text(aushang.spalten[1], x + spaltenBreite * 0.3, oben);

        zeilen.slice(spalte * proSpalte, (spalte + 1) * proSpalte).forEach((eintrag, i) => {
            const kopf = oben + 3 + i * zeilenHoehe;
            if (i % 2 === 0) {
                doc.setFillColor(244, 246, 249);
                doc.rect(x, kopf, spaltenBreite - 3, zeilenHoehe, "F");
            }
            const grundlinie = kopf + zeilenHoehe * 0.72;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(schrift);
            doc.setTextColor(20, 20, 20);
            doc.text(String(eintrag.name), x + 1, grundlinie);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(50, 50, 50);
            doc.text(String(eintrag.description), x + spaltenBreite * 0.3, grundlinie);
        });
    }
}

/**
 * Einspaltige Liste mit vollständigem Beschreibungstext.
 * Die Zeilenhöhe richtet sich nach dem längsten Eintrag — eine mitten im Satz
 * abgeschnittene Erklärung wäre auf einem Aushang wertlos.
 */
function zeichneListenTabelle(doc, aushang, zeilen, oben) {
    const { rand, breite } = SEITE;
    const innen = breite - rand * 2;
    const begriffBreite = innen * 0.28;
    const textBreite = innen - begriffBreite - 2;

    // Schriftgröße so wählen, dass alle Einträge auf ein Blatt passen.
    let schrift = 10.5;
    let umbrueche = [];
    for (;;) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(schrift);
        umbrueche = zeilen.map(eintrag => doc.splitTextToSize(String(eintrag.description), textBreite));
        const zeilenAbstand = schrift * 0.42;
        const gesamt = umbrueche.reduce(
            (summe, teile) => summe + Math.max(2, teile.length + 0.6) * zeilenAbstand, 0
        );
        if (gesamt <= inhaltsHoehe(oben) || schrift <= 7) break;
        schrift -= 0.5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(aushang.spalten[0], rand + 1, oben);
    doc.text(aushang.spalten[1], rand + begriffBreite, oben);

    const zeilenAbstand = schrift * 0.42;
    let y = oben + 3;
    zeilen.forEach((eintrag, i) => {
        const teile = umbrueche[i];
        const blockHoehe = Math.max(2, teile.length + 0.6) * zeilenAbstand;
        if (i % 2 === 0) {
            doc.setFillColor(244, 246, 249);
            doc.rect(rand, y, innen, blockHoehe, "F");
        }
        const grundlinie = y + zeilenAbstand * 0.95;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(schrift);
        doc.setTextColor(20, 20, 20);
        doc.text(String(eintrag.name), rand + 1, grundlinie);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        doc.text(teile, rand + begriffBreite, grundlinie);
        y += blockHoehe;
    });
}

/**
 * Checkliste mit ankreuzbaren Kästchen.
 * Der Abstand wächst so, dass Schritte und Notizfeld das Blatt ausfüllen —
 * beim Abhaken im Dienst wird neben den Zeilen geschrieben.
 */
function zeichneCheckliste(doc, schritte, oben) {
    const { rand, breite } = SEITE;
    const innen = breite - rand * 2 - 8;

    doc.setFontSize(9.5);
    const umbrueche = schritte.map(schritt => doc.splitTextToSize(schritt.text, innen));
    const grundHoehe = umbrueche.reduce((summe, zeilen) => summe + 9 + zeilen.length * 4.4, 0);
    const notizen = 34;
    const luft = Math.max(0, (inhaltsHoehe(oben) - grundHoehe - notizen) / schritte.length);

    let y = oben + 3;
    schritte.forEach((schritt, i) => {
        doc.setDrawColor(110, 110, 110);
        doc.setLineWidth(0.4);
        doc.rect(rand, y - 3.8, 5, 5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(20, 20, 20);
        doc.text(`${i + 1}. ${schritt.name}`, rand + 8, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(70, 70, 70);
        doc.text(umbrueche[i], rand + 8, y + 5);
        y += 9 + umbrueche[i].length * 4.4 + luft;
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(13, 110, 253);
    doc.text("Notizen", rand, y);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    for (let i = 0; i < 4; i++) {
        const linie = y + 6 + i * 7;
        doc.line(rand, linie, breite - rand, linie);
    }
}

/** Leerer Nachrichtenvordruck zum Ausfüllen. */
function zeichneFormular(doc, oben) {
    const { rand, breite } = SEITE;
    const innen = breite - rand * 2;

    const kasten = (y, hoehe, beschriftung, anteil = 1, versatz = 0) => {
        const x = rand + innen * versatz;
        const kastenBreite = innen * anteil - (versatz + anteil < 1 ? 3 : 0);
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.4);
        doc.rect(x, y, kastenBreite, hoehe);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(110, 110, 110);
        doc.text(beschriftung.toUpperCase(), x + 2, y + 4);
        return y + hoehe + 3;
    };

    let y = oben;
    kasten(y, 14, "Von (Funkrufname)", 0.5, 0);
    y = kasten(y, 14, "An (Funkrufname)", 0.5, 0.5);

    kasten(y, 14, "Nummer", 0.25, 0);
    kasten(y, 14, "Uhrzeit", 0.25, 0.25);
    kasten(y, 14, "Vorrang", 0.25, 0.5);
    y = kasten(y, 14, "Angenommen von", 0.25, 0.75);

    // Das Textfeld nimmt den Rest der Seite bis zur Fußzeile ein.
    const textOben = y;
    const textHoehe = SEITE.hoehe - SEITE.rand - 44 - 17 - 8 - textOben;
    y = kasten(y, textHoehe, "Text der Nachricht");
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.2);
    for (let linie = textOben + 14; linie < textOben + textHoehe - 3; linie += 8) {
        doc.line(rand + 2, linie, breite - rand - 2, linie);
    }

    kasten(y, 14, "Bestätigt (Uhrzeit)", 0.5, 0);
    y = kasten(y, 14, "Bemerkungen", 0.5, 0.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(180, 60, 60);
    doc.text("Bei Übungen: jede Nachricht mit dem Vermerk „Übung“ beginnen und beenden.", rand, y + 4);
}

/**
 * Zeichnet einen Aushang in ein leeres jsPDF-Dokument.
 *
 * @param doc      jsPDF-Instanz im Format A4 hochkant
 * @param aushang  Eintrag aus AUSHAENGE
 * @param inhalt   Zeilen bzw. Schritte, beim Build eingelesen
 * @param stand    Datum im Format TT.MM.JJJJ
 */
export function zeichneAushang(doc, aushang, inhalt, stand) {
    const oben = zeichneKopf(doc, aushang);

    if (aushang.quelle.art === "tabelle") {
        if (inhalt.length === 0) throw new Error(`Aushang "${aushang.slug}": keine Tabellenzeilen gefunden.`);
        // Die Extraktion liest die Seitentabelle zeilenweise; bei einer
        // zweispaltigen Tabelle verschränken sich dabei zwei Alphabete.
        // Für den Aushang wird deshalb neu sortiert (deutsche Reihenfolge:
        // Ä nach A, CH nach C, ß nach SCH).
        const zeilen = aushang.sortiert
            ? [...inhalt].sort((a, b) => String(a.name).localeCompare(String(b.name), "de"))
            : inhalt;
        if ((aushang.spaltenAnzahl ?? 1) > 1) {
            zeichneSpaltenTabelle(doc, aushang, zeilen, oben);
        } else {
            zeichneListenTabelle(doc, aushang, zeilen, oben);
        }
    } else if (aushang.quelle.art === "howto") {
        if (inhalt.length === 0) throw new Error(`Aushang "${aushang.slug}": keine Schritte gefunden.`);
        zeichneCheckliste(doc, inhalt, oben);
    } else {
        zeichneFormular(doc, oben);
    }

    zeichneFuss(doc, aushang, stand);
    return doc;
}
