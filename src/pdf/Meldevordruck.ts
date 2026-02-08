import { BasePDF } from "./BasePDF";
import { FunkUebung } from "../FunkUebung";
import { jsPDF } from "jspdf";
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { Nachricht } from "../types/Nachricht";
import { formatNatoDate } from "../utils/date";

export class Meldevordruck extends BasePDFTeilnehmer {

    protected hideBackground: boolean = false;
    protected hideFooter: boolean = false;

    protected nachricht: Nachricht;

    constructor(teilnehmer: string, uebung: FunkUebung, pdfInstance: jsPDF, nachricht: Nachricht, hideBackground: boolean = false, hideFooter: boolean = false) {
        super(teilnehmer, uebung, pdfInstance); // unit default 'mm'
        this.nachricht = nachricht;
        this.hideBackground = hideBackground;
        this.hideFooter = hideFooter;
    }

    draw(offsetX:number = 0): void {
        const template = 'assets/meldevordruck.png';
        const w = 148, h = 210;

        // Hintergrundbild
        if (!this.hideBackground) this.pdf.addImage(template, 'PNG', offsetX, 0, w, h);

        // FM Zentrale
        this.pdf.setFontSize(16);
        this.pdf.text('x', offsetX + 109.5, 10);
        // Nummer
        this.pdf.setFontSize(12);
        this.pdf.text(`${this.nachricht.id}`, offsetX + 80, 12);

        // Absender
        this.pdf.setFontSize(16);
        this.adjustTextForWidth(this.teilnehmer, 70, offsetX + 22, 25);

        this.drawEmpfaenger(offsetX);

        // Verfasser
        this.pdf.setFontSize(12);
        this.adjustTextForWidth(this.teilnehmer, 40, offsetX + 37, 192);

        // Nachricht umbrochen (mit expliziten \n Zeilenumbrüchen)
        this.pdf.setFontSize(11.5);
        this.drawMultilineText(
            this.nachricht.nachricht,
            offsetX + 20,
            55,
            120,
            5
        );

        // Footer
        if (!this.hideFooter) {
            const genTime = formatNatoDate(this.funkUebung.createDate, true);
            this.pdf.setFont("helvetica", "normal");
            this.pdf.setFontSize(8);

            this.pdf.text(this.funkUebung.name, offsetX + (148 / 2), 4, { align: "center" });

            // Hinweis ganz unten (5 mm Abstand vom unteren Rand)
            this.pdf.text("Wörter in GROSSBUCHSTABEN müssen buchstabiert werden.", offsetX + (148 / 2), 210 - 1.5, { align: "center" });

            // Trennlinie direkt darüber (bei 7 mm Abstand vom unteren Rand)
            this.pdf.setDrawColor(0);

            // Vertikaler Text (90° gedreht) an der rechten Seite (5 mm vom rechten Rand)
            this.pdf.setFontSize(6);
            let rightText = `© Johannes Rudolph | Version ${this.funkUebung.buildVersion} | Übung ID: ${this.funkUebung.id} | Generiert: ${genTime} | Generator: https://sprechfunk-uebung.de/`;
            this.pdf.text(rightText, 148- 3 + offsetX, 210 - 5, { angle: 90, align: "left" });
        }
    }

    drawEmpfaenger(offsetX: number): void {
        // Empfänger
        const startX = offsetX + 20;
        const startY = 40;
        const maxWidth = 90;
        const maxHeight = 10;
        const lineHeight = 6;

        //this.drawDebugBox(startX, startY - 5, maxWidth, maxHeight);

        const maxY = startY + maxHeight;
        this.pdf.setFontSize(8);
        let empfaengerListe: string[] = [];

        if (this.nachricht.empfaenger.includes('Alle')) {
            empfaengerListe = ['Alle'];
        } else {
            empfaengerListe = this.nachricht.empfaenger;
        }

        let currentY = startY;
        let currentLine = '';

        for (let i = 0; i < empfaengerListe.length; i++) {
            const part = currentLine
                ? `${currentLine}, ${empfaengerListe[i]}`
                : empfaengerListe[i];

            const textWidth = this.pdf.getTextWidth(part);

            if (textWidth <= maxWidth) {
                // passt noch in die aktuelle Zeile
                currentLine = part;
            } else {
                // Zeile voll → schreiben
                if (currentY + lineHeight > maxY) {
                    this.pdf.text('…', startX + maxWidth - 3, maxY - 1);
                    return;
                }

                this.pdf.text(currentLine, startX, currentY);
                currentY += lineHeight;
                currentLine = empfaengerListe[i];
            }
        }

        // letzte Zeile ausgeben
        if (currentLine && currentY + lineHeight <= maxY) {
            this.pdf.text(currentLine, startX, currentY);
        }
    }

}