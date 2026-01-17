import { FunkUebung } from "../FunkUebung";
import { jsPDF } from "jspdf";
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { DateFormatter } from "../DateFormatter";
import { Nachricht } from "../types/Nachricht";

export class Teilnehmer extends BasePDFTeilnehmer {

    constructor(teilnehmer: string, uebung: FunkUebung, pdfInstance: jsPDF) {
        super(teilnehmer, uebung, pdfInstance)
    }

    draw(): void {
        const generierungszeit = DateFormatter.formatNATODate(this.funkUebung.createDate, true); // NATO-Datum für Fußzeile

        let nachrichten = this.funkUebung.nachrichten[this.teilnehmer];

        const pageMarginTop = 25;
        const pageMarginBottom = 25;
        const pageMarginLeft = 10;
        const pageMarginRight = 10;
        const secondPageTableTopMargin = pageMarginTop + 5; // **Garantierter Abstand für die Tabelle auf Seite 2+**
        let contentWidth = (this.pdfWidth - pageMarginLeft - pageMarginRight);

        let y = pageMarginTop;

        // **1. Kopfzeile für erste Seite**
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(16);
        this.pdf.text(`${this.funkUebung.name}`, this.pdfWidth / 2, y, { align: "center" });
        y = y + 5;

        this.pdf.setFontSize(14);
        this.pdf.text(`${this.teilnehmer}`, this.pdfWidth / 2, y, { align: "center" });
        y = y + 5;

        // **2. Kopfdaten-Tabelle (links)**
        let kopfdatenWidth = contentWidth * 0.35;
        //this.drawKopfdatenTable(pdf, funkUebung, firstTableStartY, pageMargin, kopfdatenWidth);
        (this.pdf as any).autoTable({
            head: [["Beschreibung", "Wert"]],
            body: [
                ["Datum", DateFormatter.formatNATODate(this.funkUebung.datum, false)],
                ["Rufgruppe", this.funkUebung.rufgruppe],
                ["Betriebsleitung", this.funkUebung.leitung]
            ],
            startY: y,
            margin: { left: pageMarginLeft },
            tableWidth: kopfdatenWidth,
            theme: "grid",
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] }
        });

        // **3. Teilnehmerliste (rechts)**
        let teilnehmerWidth = contentWidth * 0.60;
        //this.drawTeilnehmerTable(this.pdf, this.funkUebung, firstTableStartY, this.pdfWidth - pageMargin - teilnehmerWidth, teilnehmerWidth);
        let teilnehmerColumns = 2;
        let teilnehmerRows = Math.ceil(this.funkUebung.teilnehmerListe.length / teilnehmerColumns);
        let teilnehmerTable = [];

        for (let r = 0; r < teilnehmerRows; r++) {
            let row = [];
            for (let c = 0; c < teilnehmerColumns; c++) {
                let index = r + c * teilnehmerRows;
                if (index < this.funkUebung.teilnehmerListe.length) {
                    const rufname = this.funkUebung.teilnehmerListe[index];
                    const stellen = this.funkUebung.teilnehmerStellen;

                    if (stellen && stellen[rufname]) {
                        row.push(`${stellen[rufname]}\n${rufname}`);
                    } else {
                        row.push(rufname);
                    }
                } else {
                    row.push("");
                }
            }
            teilnehmerTable.push(row);
        }

        (this.pdf as any).autoTable({
            head: [["Teilnehmer", ""]],
            body: teilnehmerTable,
            startY: y,
            margin: { left: this.pdfWidth - pageMarginLeft - teilnehmerWidth },
            tableWidth: teilnehmerWidth,
            theme: "grid",
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] }
        });

        // **4. Nachrichten-Tabelle**
        y = Math.max((this.pdf as any).lastAutoTable.finalY + 10, 75);


        let empfaengerWidth = contentWidth * 0.20;
        let lfdnrWidth = 12;
        let columnWidths = [lfdnrWidth, empfaengerWidth, contentWidth - lfdnrWidth - empfaengerWidth];

        (this.pdf as any).autoTable({
            head: [["Nr.", "Empfänger", "Nachrichtentext"]],
            body: nachrichten.map((n: Nachricht) => [n.id, n.empfaenger.join("\n"), n.nachricht]),
            startY: y,
            theme: "grid",
            margin: { left: pageMarginLeft, top: secondPageTableTopMargin, bottom: pageMarginBottom },
            tableWidth: contentWidth,
            columnStyles: {
                0: { cellWidth: columnWidths[0] },
                1: { cellWidth: columnWidths[1] },
                2: { cellWidth: columnWidths[2] }
            },
            styles: { fontSize: 10, cellPadding: 1.5, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] }
        });

        // **5. Setze Kopfzeilen & Seitenzahlen auf allen Seiten**
        let totalPages = (this.pdf as any).getNumberOfPages();
        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
            this.pdf.setPage(pageNumber);

            //Header
            if (pageNumber > 1) {
                this.pdf.setFont("helvetica", "normal");
                this.pdf.setFontSize(10);

                // **Links: Funkrufname**
                this.pdf.text(`Eigener Funkrufname: ${this.teilnehmer}`, pageMarginLeft, 20);

                // **Rechts: Name der Übung**
                let rightText = this.funkUebung.name + " - " + DateFormatter.formatNATODate(this.funkUebung.datum, false)
                let nameWidth = this.pdf.getTextWidth(rightText);
                this.pdf.text(rightText, this.pdfWidth - pageMarginLeft - nameWidth, 20);

                // **Trennlinie unter der Kopfzeile**
                this.pdf.setDrawColor(0);
                this.pdf.line(pageMarginLeft, 22, this.pdfWidth - pageMarginRight, 22);
            }

            //Footer
            this.pdf.setFont("helvetica", "normal");
            this.pdf.setFontSize(8);

            // Hinweis über der Linie
            this.pdf.text("Wörter in GROSSBUCHSTABEN müssen buchstabiert werden.", pageMarginLeft, this.pdfHeight - 20);

            // Trennlinie unter dem Hinweis
            this.pdf.setDrawColor(0);
            this.pdf.line(pageMarginLeft, this.pdfHeight - 15, this.pdfWidth - pageMarginRight, this.pdfHeight - 15);

            // Seitenzahl
            this.pdf.setFontSize(10);
            let pageNumberText = `Seite ${pageNumber} von ${totalPages}`;
            let pageNumberWidth = this.pdf.getTextWidth(pageNumberText);
            this.pdf.text(pageNumberText, this.pdfWidth - pageMarginLeft - pageNumberWidth, this.pdfHeight - 10);

            // Link und Copyright-Infos linksbündig
            this.pdf.setFontSize(6);
            let leftText = `© Johannes Rudolph | Version ${this.funkUebung.buildVersion} | Übung ID: ${this.funkUebung.id} | Generiert: ${generierungszeit} | Generator: https://sprechfunk-uebung.de/`;
            this.pdf.textWithLink(leftText, pageMarginLeft, this.pdfHeight - 10, { url: "https://sprechfunk-uebung.de//" });
        }
    }

}