import { FunkUebung } from "../FunkUebung";
import firebase from "firebase/compat";
import Blob = firebase.firestore.Blob;
import { jsPDF } from "jspdf";
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { Nachricht } from "../types/Nachricht";
import { DateFormatter } from "../DateFormatter";

export class Nachrichtenvordruck extends BasePDFTeilnehmer {

    protected hideBackground: boolean = false;
    protected hideFooter: boolean = false;

    protected nachricht: Nachricht;

    constructor(teilnehmer: string, uebung: FunkUebung, pdfInstance: jsPDF, nachricht: Nachricht, hideBackground: boolean = false, hideFooter: boolean = false) {
        super(teilnehmer, uebung, pdfInstance); // unit default 'mm'
        this.nachricht = nachricht;
        this.hideBackground = hideBackground;
        this.hideFooter = hideFooter;
    }

    draw(offsetX: number = 0): void {
        const templateImageUrl = 'assets/nachrichtenvordruck4fach.png';
        const width = 148, height = 210;
        // Hintergrundbild positionieren
        if (!this.hideBackground) this.pdf.addImage(templateImageUrl, 'PNG', offsetX, 0, width, height);

        // FM Zentrale
        this.pdf.setFontSize(16);
        this.pdf.text('x', offsetX + 15.4, 9);
        this.pdf.setFontSize(10);
        this.pdf.text(`${this.nachricht.id}`, offsetX + 125.5, 17);
        this.pdf.setFontSize(16);
        this.pdf.text('x', offsetX + 122.2, 27.5);
        // Ausgang
        this.pdf.text('x', offsetX + 18.6, 42.5);

        // Absender
        this.pdf.setFontSize(12);
        this.pdf.text(`${this.teilnehmer}`, offsetX + 44, 155);

        // Empfänger und Anschrift
        let empText = this.nachricht.empfaenger.includes('Alle') ? 'Alle' : this.nachricht.empfaenger.join(', ');
        this.adjustTextForWidth(empText, 70, offsetX + 58, 35);
        this.adjustTextForWidth(empText, 70, offsetX + 42, 55);

        // Nachricht umbrochen
        this.pdf.setFontSize(12);
        const lineHeight = 6.5;
        const msgLines = this.pdf.splitTextToSize(this.nachricht.nachricht, 120);
        let startY = 77;
        msgLines.forEach((line: string, i: number) => {
            this.pdf.text(line, offsetX + 17, startY + i * lineHeight);
        });

        // Footer (compact)
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