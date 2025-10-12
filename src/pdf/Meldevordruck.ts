import { BasePDF } from "./BasePDF";
import { FunkUebung } from "../FunkUebung";
import { jsPDF } from "jspdf";
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { Nachricht } from "../types/Nachricht";
import { DateFormatter } from "../DateFormatter";

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

        // Empfänger
        let emp = this.nachricht.empfaenger.includes('Alle') ? 'Alle' : this.nachricht.empfaenger.join(', ');
        this.adjustTextForWidth(emp, 70, offsetX + 22, 40);

        // Verfasser
        this.pdf.setFontSize(12);
        this.adjustTextForWidth(this.teilnehmer, 40, offsetX + 37, 192);

        // Nachricht umbrochen
        this.pdf.setFontSize(11.5);
        const lh = 5;
        const lines = this.pdf.splitTextToSize(this.nachricht.nachricht, 120);
        let y = 55;
        lines.forEach((l: string, i: number) => this.pdf.text(l, offsetX + 20, y + i * lh));

        // Footer
        if (!this.hideFooter) {
            const genTime = DateFormatter.formatNATODate(this.funkUebung.createDate, true);
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

}