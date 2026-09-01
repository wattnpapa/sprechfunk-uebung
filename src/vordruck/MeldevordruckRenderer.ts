import type { jsPDF } from "jspdf";
import { VORDRUCK_BREITE, VORDRUCK_HOEHE } from "./felder";
import type { VordruckDaten } from "./VordruckDaten";
import { zeichneAngepasst, zeichneMehrzeilig } from "./pdfText";
import { zeichneRahmen, type VordruckRenderOptionen } from "./NachrichtenvordruckRenderer";

const HINTERGRUNDBILD = "assets/meldevordruck.png";

/**
 * Empfängerfeld des Meldevordrucks, am Formularbild gemessen: die Zelle reicht
 * von 30,8 bis 45,9 mm, waagerecht von 18,1 bis 112,0 mm. Oben steht die
 * Beschriftung „Empfänger", darunter bleibt Platz für zwei Zeilen.
 *
 * `y` ist die Grundlinie der ersten Zeile, `letzteGrundlinie` die der letzten,
 * die noch vollständig in der Zelle liegt (Unterkante minus Unterlängen).
 */
const EMPFAENGER_ZELLE = {
    x: 20,
    y: 40,
    maxBreite: 90,
    letzteGrundlinie: 45.5,
    zeilenhoehe: 5,
    schriftgroesse: 8
};

/**
 * Zeichnet einen Meldevordruck aus `VordruckDaten` auf die aktuelle Seite.
 *
 * Der Meldevordruck ist der kürzere Bogen: er kennt weder Vermerke noch
 * Verteiler, füllt also nur einen Teil der Felder aus `VordruckDaten`.
 */
export function zeichneMeldevordruck(
    pdf: jsPDF,
    daten: VordruckDaten,
    optionen: VordruckRenderOptionen = {}
): void {
    const offsetX = optionen.offsetX ?? 0;

    if (!optionen.ohneHintergrund) {
        pdf.addImage(HINTERGRUNDBILD, "PNG", offsetX, 0, VORDRUCK_BREITE, VORDRUCK_HOEHE);
    }

    // FM Zentrale
    pdf.setFontSize(16);
    pdf.text("x", offsetX + 109.5, 10);

    pdf.setFontSize(12);
    pdf.text(daten.nummer, offsetX + 80, 12);

    pdf.setFontSize(16);
    zeichneAngepasst(pdf, { text: daten.absender, maxWidth: 70, x: offsetX + 22, y: 25 });

    zeichneEmpfaenger(pdf, daten.empfaenger, offsetX);

    pdf.setFontSize(12);
    zeichneAngepasst(pdf, { text: daten.verfasser, maxWidth: 40, x: offsetX + 37, y: 192 });

    zeichneMehrzeilig(pdf, {
        text: daten.inhalt,
        x: offsetX + 20,
        y: 55,
        maxWidth: 120,
        lineHeight: 5,
        fontSize: 11.5,
        lineSpacing: 0
    });

    if (!optionen.ohneRahmen) {
        zeichneRahmen(pdf, daten, offsetX);
    }
}

/**
 * Setzt die Empfänger in das Empfängerfeld und verkleinert die Schrift, bis alle
 * hineinpassen.
 *
 * Kein Empfänger darf wegfallen: wer nicht auf dem Vordruck steht, wird in der
 * Übung nicht angerufen. Die Vorgängerversion prüfte den Platz für die letzte
 * Zeile mit `grundlinie + zeilenhoehe <= untergrenze` und verwarf sie dadurch
 * schon dann, wenn nur der Abstand *unter* der Grundlinie fehlte – bei drei
 * Empfängern fiel die komplette zweite Zeile still weg.
 *
 * Reichen zwei Zeilen nicht, wird die Schrift verkleinert – mit dem Zeilenabstand
 * im gleichen Verhältnis. So bleibt jeder Empfänger lesbar in der Zelle, statt
 * ganz zu fehlen.
 */
function zeichneEmpfaenger(pdf: jsPDF, empfaenger: string[], offsetX: number): void {
    const text = empfaenger.join(", ");
    if (!text) {
        return;
    }

    const startX = offsetX + EMPFAENGER_ZELLE.x;
    const letzteGrundlinie = EMPFAENGER_ZELLE.letzteGrundlinie;

    let schriftgroesse = EMPFAENGER_ZELLE.schriftgroesse;
    pdf.setFontSize(schriftgroesse);
    let abstand = EMPFAENGER_ZELLE.zeilenhoehe;
    let zeilen: string[] = pdf.splitTextToSize(text, EMPFAENGER_ZELLE.maxBreite);

    while (EMPFAENGER_ZELLE.y + (zeilen.length - 1) * abstand > letzteGrundlinie
        && schriftgroesse > 4) {
        schriftgroesse -= 0.2;
        pdf.setFontSize(schriftgroesse);
        abstand = EMPFAENGER_ZELLE.zeilenhoehe * (schriftgroesse / EMPFAENGER_ZELLE.schriftgroesse);
        zeilen = pdf.splitTextToSize(text, EMPFAENGER_ZELLE.maxBreite);
    }

    zeilen.forEach((zeile, index) => {
        pdf.text(zeile, startX, EMPFAENGER_ZELLE.y + index * abstand);
    });
}
