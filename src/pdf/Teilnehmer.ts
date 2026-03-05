/* eslint-disable @typescript-eslint/no-explicit-any */
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { formatNatoDate } from "../utils/date";
import { Nachricht } from "../types/Nachricht";

export class Teilnehmer extends BasePDFTeilnehmer {
    private readonly pageMarginTop = 25;
    private readonly pageMarginBottom = 25;
    private readonly pageMarginLeft = 10;
    private readonly pageMarginRight = 10;
    private readonly secondPageTableTopMargin = this.pageMarginTop + 5;

    private get contentWidth(): number {
        return this.pdfWidth - this.pageMarginLeft - this.pageMarginRight;
    }

    draw(): void {
        const generierungszeit = formatNatoDate(this.funkUebung.createDate, true);
        const nachrichten = this.funkUebung.nachrichten[this.teilnehmer] || [];
        let y = this.pageMarginTop;

        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(16);
        this.pdf.text(`${this.funkUebung.name}`, this.pdfWidth / 2, y, { align: "center" });
        y = y + 5;

        this.pdf.setFontSize(14);
        this.pdf.text(`${this.teilnehmer}`, this.pdfWidth / 2, y, { align: "center" });
        y = y + 5;

        const kopfdatenWidth = this.contentWidth * 0.35;
        (this.pdf as any).autoTable({
            head: [["Beschreibung", "Wert"]],
            body: [
                ["Datum", formatNatoDate(this.funkUebung.datum, false)],
                ["Rufgruppe", this.funkUebung.rufgruppe],
                ["Betriebsleitung", this.funkUebung.leitung]
            ],
            startY: y,
            margin: { left: this.pageMarginLeft },
            tableWidth: kopfdatenWidth,
            theme: "grid",
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] }
        });

        this.drawTeilnehmerTable(y);
        y = Math.max((this.pdf as any).lastAutoTable.finalY + 10, 75);
        this.drawNachrichtenTable(nachrichten, y);
        this.drawPageHeadersAndFooters(generierungszeit);
    }

    private drawTeilnehmerTable(startY: number): void {
        const teilnehmerWidth = this.contentWidth * 0.60;

        (this.pdf as any).autoTable({
            head: [["Teilnehmer", ""]],
            body: this.buildTeilnehmerTableBody(),
            startY,
            margin: { left: this.pdfWidth - this.pageMarginLeft - teilnehmerWidth },
            tableWidth: teilnehmerWidth,
            theme: "grid",
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] }
        });
    }

    private buildTeilnehmerTableBody(): string[][] {
        const teilnehmerColumns = 2;
        const teilnehmerRows = Math.ceil(this.funkUebung.teilnehmerListe.length / teilnehmerColumns);
        const table: string[][] = [];
        for (let rowIndex = 0; rowIndex < teilnehmerRows; rowIndex++) {
            table.push(this.buildTeilnehmerTableRow(rowIndex, teilnehmerRows, teilnehmerColumns));
        }
        return table;
    }

    private buildTeilnehmerTableRow(rowIndex: number, teilnehmerRows: number, teilnehmerColumns: number): string[] {
        const row: string[] = [];
        for (let column = 0; column < teilnehmerColumns; column++) {
            const index = rowIndex + column * teilnehmerRows;
            row.push(this.resolveTeilnehmerDisplay(index));
        }
        return row;
    }

    private resolveTeilnehmerDisplay(index: number): string {
        if (index >= this.funkUebung.teilnehmerListe.length) {
            return "";
        }
        const rufname = this.funkUebung.teilnehmerListe[index];
        if (!rufname) {
            return "";
        }
        const stellen = this.funkUebung.teilnehmerStellen;
        if (stellen && stellen[rufname]) {
            return `${stellen[rufname]}\n${rufname}`;
        }
        return rufname;
    }

    private drawNachrichtenTable(nachrichten: Nachricht[], startY: number): void {
        const empfaengerWidth = this.contentWidth * 0.20;
        const lfdnrWidth = 12;
        const columnWidths = [lfdnrWidth, empfaengerWidth, this.contentWidth - lfdnrWidth - empfaengerWidth];

        (this.pdf as any).autoTable({
            head: [["Nr.", "Empfänger", "Nachrichtentext"]],
            body: nachrichten.map((n: Nachricht) => [
                n.id,
                n.empfaenger.join("\n"),
                String(n.nachricht ?? "").replace(/\\n/g, "\n")
            ]),
            startY,
            theme: "grid",
            margin: {
                left: this.pageMarginLeft,
                top: this.secondPageTableTopMargin,
                bottom: this.pageMarginBottom
            },
            tableWidth: this.contentWidth,
            columnStyles: {
                0: { cellWidth: columnWidths[0] },
                1: { cellWidth: columnWidths[1] },
                2: { cellWidth: columnWidths[2] }
            },
            styles: { fontSize: 10, cellPadding: 1.5, lineWidth: 0.1, lineColor: [0, 0, 0], overflow: "linebreak" },
            headStyles: { fillColor: [200, 200, 200] }
        });
    }

    private drawPageHeadersAndFooters(generierungszeit: string): void {
        const totalPages = (this.pdf as any).getNumberOfPages();
        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
            this.pdf.setPage(pageNumber);

            if (pageNumber > 1) {
                this.pdf.setFont("helvetica", "normal");
                this.pdf.setFontSize(10);
                this.pdf.text(`Eigener Funkrufname: ${this.teilnehmer}`, this.pageMarginLeft, 20);
                const rightText = this.funkUebung.name + " - " + formatNatoDate(this.funkUebung.datum, false);
                const nameWidth = this.pdf.getTextWidth(rightText);
                this.pdf.text(rightText, this.pdfWidth - this.pageMarginLeft - nameWidth, 20);
                this.pdf.setDrawColor(0);
                this.pdf.line(this.pageMarginLeft, 22, this.pdfWidth - this.pageMarginRight, 22);
            }

            this.pdf.setFont("helvetica", "normal");
            this.pdf.setFontSize(8);
            this.pdf.text("Wörter in GROSSBUCHSTABEN müssen buchstabiert werden.", this.pageMarginLeft, this.pdfHeight - 20);
            this.pdf.setDrawColor(0);
            this.pdf.line(this.pageMarginLeft, this.pdfHeight - 15, this.pdfWidth - this.pageMarginRight, this.pdfHeight - 15);

            this.pdf.setFontSize(10);
            const pageNumberText = `Seite ${pageNumber} von ${totalPages}`;
            const pageNumberWidth = this.pdf.getTextWidth(pageNumberText);
            this.pdf.text(pageNumberText, this.pdfWidth - this.pageMarginLeft - pageNumberWidth, this.pdfHeight - 10);

            this.pdf.setFontSize(6);
            const leftText = `© Johannes Rudolph | Version ${this.funkUebung.buildVersion} | Übung ID: ${this.funkUebung.id} | Generiert: ${generierungszeit} | Generator: https://sprechfunk-uebung.de/`;
            this.pdf.textWithLink(leftText, this.pageMarginLeft, this.pdfHeight - 10, { url: "https://sprechfunk-uebung.de//" });
        }
    }

}
