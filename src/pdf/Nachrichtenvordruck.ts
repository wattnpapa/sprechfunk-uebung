import {FunkUebung} from "../FunkUebung";
import firebase from "firebase/compat";
import Blob = firebase.firestore.Blob;
import {jsPDF} from "jspdf";
import {BasePDFTeilnehmer} from "./BasePDFTeilnehmer";
import {Nachricht} from "../types/Nachricht";
import { formatNatoDate } from "../utils/date";

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

        let funkrufnamenEmpfaenger = this.nachricht.empfaenger.includes('Alle') ? 'Alle' : this.nachricht.empfaenger.join(', ');
        const stellen = this.funkUebung.teilnehmerStellen;

        let stellenEmpfaenger = this.nachricht.empfaenger
            .map((funkrufname: string) => {
                const stellenName = stellen?.[funkrufname];
                return (stellenName && stellenName.trim().length > 0)
                    ? stellenName
                    : funkrufname;
            })
            .join(", ");

        // Obere Zeile (Empfänger)
        //this.adjustTextForWidth(funkrufnamenEmpfaenger, 70, offsetX + 58, 35);

        // Untere Zeile (Anschrift)
        //this.adjustTextForWidth(stellenEmpfaenger, 70, offsetX + 42, 55);
        //this.drawDebugBox(offsetX + 58, 30, 84, 10);
        //this.drawDebugBox(offsetX + 39.5, 48, 76, 18);


        this.drawTextInBox(
            funkrufnamenEmpfaenger,
            offsetX + 58,
            30,
            83,
            9.5
        );

        // Anschrift (unten)
        this.drawTextInBox(
            stellenEmpfaenger,
            offsetX + 42,
            48,
            75,
            17.5
        );

        // Nachricht umbrochen (mit expliziten \n Zeilenumbrüchen)
        this.pdf.setFontSize(12);
        this.drawMultilineText(
            this.nachricht.nachricht,
            offsetX + 17,
            77,
            120,
            6.5
        );

        // Footer (compact)
        if (!this.hideFooter) {
            const genTime = formatNatoDate(this.funkUebung.createDate, true);
            this.pdf.setFont("helvetica", "normal");
            this.pdf.setFontSize(8);

            this.pdf.text(this.funkUebung.name, offsetX + (148 / 2), 4, {align: "center"});

            // Hinweis ganz unten (5 mm Abstand vom unteren Rand)
            this.pdf.text("Wörter in GROSSBUCHSTABEN müssen buchstabiert werden.", offsetX + (148 / 2), 210 - 1.5, {align: "center"});

            // Trennlinie direkt darüber (bei 7 mm Abstand vom unteren Rand)
            this.pdf.setDrawColor(0);

            // Vertikaler Text (90° gedreht) an der rechten Seite (5 mm vom rechten Rand)
            this.pdf.setFontSize(6);
            let rightText = `© Johannes Rudolph | Version ${this.funkUebung.buildVersion} | Übung ID: ${this.funkUebung.id} | Generiert: ${genTime} | Generator: https://sprechfunk-uebung.de/`;
            this.pdf.text(rightText, 148 - 3 + offsetX, 210 - 5, {angle: 90, align: "left"});
        }
    }

    private drawTextInBox(
        text: string,
        x: number,
        y: number,
        width: number,
        height: number
    ): void {
        if (!text || !text.trim()) return;

        const pdf = this.pdf;

        const maxFontSize = pdf.getFontSize(); // aktuelle Schriftgröße
        const minFontSize = 3;
        const lineSpacing = 0.5; // kontrollierter, fixer Zeilenabstand

        let fontSize = maxFontSize;
        let lines: string[] = [];
        let lineHeight = fontSize * 0.5;
        let totalHeight = 0;

        lines = pdf.splitTextToSize(text, width);


        while (fontSize >= minFontSize) {
            pdf.setFontSize(fontSize);

            lines = pdf.splitTextToSize(text, width);
            lineHeight = fontSize * lineSpacing;
            totalHeight = lines.length * lineHeight;

            if (totalHeight <= height) {
                break; // passt
            }

            fontSize -= 0.1;
        }

        // Sicherheitsnetz: selbst bei minFontSize alles zeichnen
        pdf.setFontSize(fontSize);

        // 2️⃣ Start-Y = OBERKANTE + Baseline-Korrektur
        // jsPDF nutzt Baseline → wir rechnen sauber um
        let currentY = y + (fontSize * 0.4);

        // 3️⃣ Zeichnen (OHNE weitere Bedingungen oder Abbrüche)
        for (const line of lines) {
            pdf.text(line, x, currentY);
            currentY += lineHeight;
        }

        // 4️⃣ Ursprüngliche Schriftgröße wiederherstellen
        pdf.setFontSize(maxFontSize);
    }

}