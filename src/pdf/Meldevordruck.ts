import { jsPDF } from "jspdf";
import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";

export class Meldevordruck extends BasePDFTeilnehmer {
    private nachricht: Nachricht;
    private hideBackground: boolean;
    private hideFooter: boolean;

    constructor(teilnehmer: string, funkUebung: FunkUebung, pdf: jsPDF, nachricht: Nachricht, hideBackground = false, hideFooter = false) {
        super(teilnehmer, funkUebung, pdf);
        this.nachricht = nachricht;
        this.hideBackground = hideBackground;
        this.hideFooter = hideFooter;
    }

    draw(xOffset = 0) {
        // A5 Format: 148mm x 210mm
        // Ränder: 10mm
        const margin = 10;
        const width = 148 - 2 * margin;
         
        const startX = xOffset + margin;
        const startY = margin;

        // --- Hintergrund (Formular) ---
        if (!this.hideBackground) {
            this.drawFormular(startX, startY, width);
        }

        // --- Inhalt ---
        this.fillContent(startX, startY);

        // --- Footer ---
        if (!this.hideFooter) {
            this.drawFooter(xOffset);
        }
    }

    private drawFormular(x: number, y: number, w: number) {
        // Kopfzeile
        this.addRect(x, y, w, 15);
        this.addText("NACHWEIS", x + w / 2, y + 6, 12, "bold", "center");
        this.addText("über eingegangene / abgegangene Nachrichten", x + w / 2, y + 11, 10, "normal", "center");

        // Zeilen
        let currentY = y + 15;
        const lineHeight = 8;
        
        // 1. Zeile: Lfd. Nr, Annahme, Abgang
        this.addRect(x, currentY, w, lineHeight);
        this.addLine(x + 20, currentY, x + 20, currentY + lineHeight); // Nach Lfd Nr
        this.addLine(x + 74, currentY, x + 74, currentY + lineHeight); // Mitte
        
        this.addText("Lfd. Nr.", x + 2, currentY + 5, 8);
        this.addText("Annahme (Datum, Uhrzeit, von)", x + 22, currentY + 5, 8);
        this.addText("Abgang (Datum, Uhrzeit, an)", x + 76, currentY + 5, 8);

        currentY += lineHeight;

        // 2. Zeile: Inhalt
        const contentHeight = 120;
        this.addRect(x, currentY, w, contentHeight);
        this.addText("Inhalt / Spruch:", x + 2, currentY + 5, 8);

        currentY += contentHeight;

        // 3. Zeile: Vermerke
        this.addRect(x, currentY, w, 20);
        this.addText("Vermerke:", x + 2, currentY + 5, 8);
    }

    private fillContent(x: number, y: number) {
        // Lfd Nr
        this.addText(this.nachricht.id.toString(), x + 10, y + 21, 10, "bold", "center");

        // Inhalt
        const contentY = y + 35;
        const maxWidth = 120;
        this.addWrappedText(this.nachricht.nachricht, x + 5, contentY, maxWidth, 11, "normal");

        // Empfänger (Abgang)
        const empfaenger = this.nachricht.empfaenger.join(", ");
        this.addText(empfaenger, x + 80, y + 21, 9);
    }

    private drawFooter(xOffset: number) {
        const y = 200;
        this.addText(`Seite ${this.pdf.getCurrentPageInfo().pageNumber}`, xOffset + 74, y, 8, "normal", "center");
    }
}
