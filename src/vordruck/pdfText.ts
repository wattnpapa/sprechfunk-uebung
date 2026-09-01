import type { jsPDF } from "jspdf";

// Textausgabe für die Vordrucke. Freie Funktionen statt Methoden einer
// Basisklasse, damit `src/vordruck/` ohne die PDF-Klassen des Generators
// auskommt und später als eigenes Paket herausgelöst werden kann.

/**
 * Zeichnet Text mehrzeilig mit automatischem Umbruch.
 * - Respektiert explizite Zeilenumbrüche (auch als Text geschriebene)
 * - Nutzt jsPDF-eigenes Wrapping (maxWidth)
 */
export function zeichneMehrzeilig(pdf: jsPDF, options: {
    text: string;
    x: number;
    y: number;
    maxWidth: number;
    lineHeight: number;
    fontSize: number;
    lineSpacing?: number;
}): void {
    const { text, x, y, maxWidth, lineHeight, fontSize, lineSpacing = 0 } = options;
    if (!text) {
        return;
    }

    pdf.setFontSize(fontSize);

    const normalized = String(text).replace(/\\n/g, "\n");
    let currentY = y;

    normalized.split("\n").forEach(paragraph => {
        if (paragraph.trim() === "") {
            currentY += lineHeight;
            return;
        }
        const lines: string[] = pdf.splitTextToSize(paragraph, maxWidth);
        lines.forEach(line => {
            pdf.text(line, x, currentY);
            currentY += lineHeight + lineSpacing;
        });
    });
}

/**
 * Füllt eine Formularzelle: verkleinert die Schrift, bis der umbrochene Text in
 * `height` passt, und zeichnet ihn ab der Oberkante.
 *
 * `height` muss der Zelle im Formular entsprechen und nicht größer sein – sonst
 * greift die Verkleinerung nicht und der Text läuft aus dem Kasten.
 */
export function zeichneInZelle(pdf: jsPDF, options: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}): void {
    const { text, x, y, width, height } = options;
    if (!text || !text.trim()) {
        return;
    }

    const maxFontSize = pdf.getFontSize();
    const minFontSize = 3;
    const lineSpacing = 0.5; // kontrollierter, fixer Zeilenabstand

    let fontSize = maxFontSize;
    let lines: string[] = pdf.splitTextToSize(text, width);
    let lineHeight = fontSize * lineSpacing;

    while (fontSize >= minFontSize) {
        pdf.setFontSize(fontSize);
        lines = pdf.splitTextToSize(text, width);
        lineHeight = fontSize * lineSpacing;
        if (lines.length * lineHeight <= height) {
            break;
        }
        fontSize -= 0.1;
    }

    // Sicherheitsnetz: selbst bei minFontSize alles zeichnen
    pdf.setFontSize(fontSize);

    // jsPDF setzt auf der Grundlinie an, `y` ist die Oberkante der Zelle
    let currentY = y + (fontSize * 0.4);
    for (const line of lines) {
        pdf.text(line, x, currentY);
        currentY += lineHeight;
    }

    pdf.setFontSize(maxFontSize);
}

/**
 * Schreibt einen einzeiligen Wert ab 12 pt und verkleinert in 0,5-pt-Schritten
 * bis 7 pt, damit er in `maxWidth` passt.
 *
 * Entspricht `BasePDF.adjustTextForWidth` und wird für die großen Felder des
 * Meldevordrucks gebraucht, deren Schriftbild sich nicht ändern soll.
 */
export function zeichneAngepasst(pdf: jsPDF, options: {
    text: string;
    x: number;
    y: number;
    maxWidth: number;
}): void {
    const { text, x, y, maxWidth } = options;
    let fontSize = 12;
    pdf.setFontSize(fontSize);
    while (pdf.getTextWidth(text) > maxWidth && fontSize > 7) {
        fontSize -= 0.5;
        pdf.setFontSize(fontSize);
    }
    pdf.text(text, x, y);
}

/**
 * Schreibt einen einzeiligen Wert und verkleinert die Schrift ab `fontSize`, bis
 * er in `maxWidth` passt. Untergrenze 4 pt, damit auch die 6 mm schmalen
 * Handzeichen-Zellen etwas Lesbares abbekommen.
 */
export function zeichneEinzeilig(pdf: jsPDF, options: {
    text: string;
    x: number;
    y: number;
    maxWidth: number;
    fontSize: number;
}): void {
    const { text, x, y, maxWidth, fontSize } = options;
    if (!text) {
        return;
    }

    let aktuell = fontSize;
    pdf.setFontSize(aktuell);
    while (pdf.getTextWidth(text) > maxWidth && aktuell > 4) {
        aktuell -= 0.2;
        pdf.setFontSize(aktuell);
    }
    pdf.text(text, x, y);
}
