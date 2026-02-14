import { jsPDF } from "jspdf";
import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";

export class Nachrichtenvordruck extends BasePDFTeilnehmer {
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
        const margin = 10;
        const width = 148 - 2 * margin;
        const startX = xOffset + margin;
        const startY = margin;

        if (!this.hideBackground) {
            this.drawFormular(startX, startY, width);
        }

        this.fillContent(startX, startY);

        if (!this.hideFooter) {
            this.drawFooter(xOffset);
        }
    }

    private drawFormular(x: number, y: number, w: number) {
        // Header
        this.addRect(x, y, w, 10);
        this.addText("NACHRICHTENVORDRUCK", x + w / 2, y + 7, 14, "bold", "center");

        let currentY = y + 10;

        // Absender / Empfänger Zeile
        this.addRect(x, currentY, w, 15);
        this.addLine(x + w / 2, currentY, x + w / 2, currentY + 15);
        this.addText("Von:", x + 2, currentY + 5, 8);
        this.addText("An:", x + w / 2 + 2, currentY + 5, 8);

        currentY += 15;

        // Inhalt
        const contentHeight = 100;
        this.addRect(x, currentY, w, contentHeight);
        this.addText("Inhalt:", x + 2, currentY + 5, 8);
    }

    private fillContent(x: number, y: number) {
        // Von
        this.addText(this.teilnehmer, x + 5, y + 20, 11);

        // An
        const empfaenger = this.nachricht.empfaenger.join(", ");
        this.addText(empfaenger, x + 74 + 5, y + 20, 11);

        // Inhalt
        const contentY = y + 35;
        const maxWidth = 120;
        this.addWrappedText(this.nachricht.nachricht, x + 5, contentY, maxWidth, 11);
    }

    private drawFooter(xOffset: number) {
        const y = 200;
        this.addText(`Seite ${this.pdf.getCurrentPageInfo().pageNumber}`, xOffset + 74, y, 8, "normal", "center");
    }
}
