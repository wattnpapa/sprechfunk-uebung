/* eslint-disable @typescript-eslint/no-explicit-any */
import { BasePDFTeilnehmer } from "./BasePDFTeilnehmer";
import { formatNatoDate } from "../utils/date";
import { Nachricht } from "../types/Nachricht";
import { nachrichtenArtLabel } from "../utils/nachrichtenArt";

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
        const startPage = this.getCurrentPageNumber();
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
        this.drawPageHeadersAndFooters(generierungszeit, startPage);
    }

    /**
     * Seite, auf der die Übersicht dieses Teilnehmers beginnt.
     * Wird die Übersicht an ein bestehendes Dokument angehängt, ist das nicht Seite 1.
     */
    private getCurrentPageNumber(): number {
        const pdf = this.pdf as any;
        const pageNumber = pdf.getCurrentPageInfo?.()?.pageNumber;
        return typeof pageNumber === "number" ? pageNumber : pdf.getNumberOfPages();
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
        // Die Spalte entfällt bei Übungen ohne gekennzeichnete Übermittlungsart,
        // damit dort die volle Breite für den Nachrichtentext bleibt.
        const zeigeArt = nachrichten.some((n: Nachricht) => !!n.art);
        const artWidth = zeigeArt ? 22 : 0;
        const empfaengerWidth = this.contentWidth * 0.20;
        const lfdnrWidth = 12;
        const columnWidths = [
            lfdnrWidth,
            empfaengerWidth,
            this.contentWidth - lfdnrWidth - artWidth - empfaengerWidth,
            artWidth
        ];

        (this.pdf as any).autoTable({
            head: [zeigeArt
                ? ["Nr.", "Empfänger", "Nachrichtentext", "Art"]
                : ["Nr.", "Empfänger", "Nachrichtentext"]],
            body: nachrichten.map((n: Nachricht) => {
                const zeile: (string | number)[] = [
                    n.id,
                    n.empfaenger.join("\n"),
                    String(n.nachricht ?? "").replace(/\\n/g, "\n")
                ];
                if (zeigeArt) {
                    zeile.push(nachrichtenArtLabel(n.art));
                }
                return zeile;
            }),
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
                2: { cellWidth: columnWidths[2] },
                ...(zeigeArt ? { 3: { cellWidth: columnWidths[3] } } : {})
            },
            styles: { fontSize: 10, cellPadding: 1.5, lineWidth: 0.1, lineColor: [0, 0, 0], overflow: "linebreak" },
            headStyles: { fillColor: [200, 200, 200] }
        });
    }

    private drawPageHeadersAndFooters(generierungszeit: string, startPage: number): void {
        const lastPage = (this.pdf as any).getNumberOfPages();
        const seitenGesamt = lastPage - startPage + 1;
        for (let pageNumber = startPage; pageNumber <= lastPage; pageNumber++) {
            this.pdf.setPage(pageNumber);
            const seiteImAbschnitt = pageNumber - startPage + 1;

            if (seiteImAbschnitt > 1) {
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
            const pageNumberText = `Seite ${seiteImAbschnitt} von ${seitenGesamt}`;
            const pageNumberWidth = this.pdf.getTextWidth(pageNumberText);
            this.pdf.text(pageNumberText, this.pdfWidth - this.pageMarginLeft - pageNumberWidth, this.pdfHeight - 10);

            this.pdf.setFontSize(6);
            const leftText = `© Johannes Rudolph | Version ${this.funkUebung.buildVersion} | Übung ID: ${this.funkUebung.id} | Generiert: ${generierungszeit} | Generator: https://sprechfunk-uebung.de/`;
            this.pdf.textWithLink(leftText, this.pageMarginLeft, this.pdfHeight - 10, { url: "https://sprechfunk-uebung.de//" });
        }
    }

}
