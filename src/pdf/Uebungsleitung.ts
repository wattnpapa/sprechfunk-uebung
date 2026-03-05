/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { Uebung } from "../types/Uebung";
import { jsPDF } from "jspdf";
import { formatNatoDate } from "../utils/date";
import { BasePDF } from "./BasePDF";

export class Uebungsleitung extends BasePDF {
    private localData: any;
    private readonly pageMarginTop = 25;
    private readonly pageMarginBottom = 25;
    private readonly pageMarginLeft = 10;
    private readonly pageMarginRight = 10;
    private readonly tableFontSize = 8;

    private get contentWidth(): number {
        return this.pdfWidth - this.pageMarginLeft - this.pageMarginRight;
    }

    constructor(uebung: Uebung, pdfInstance: jsPDF, localData: any = null) {
        super(uebung as any, pdfInstance);
        this.localData = localData;
    }

    draw(): void {
        const generierungszeit = formatNatoDate(this.funkUebung.createDate);
        const datumString = formatNatoDate(this.funkUebung.datum, false);
        const startY = this.drawFirstPageHeader(datumString);
        this.drawTeilnehmerTable(startY);
        this.drawNachrichtenTable();
        this.drawHeaderAndFooter(generierungszeit);
    }

    private drawFirstPageHeader(datumString: string): number {
        let y = this.pageMarginTop;
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(16);
        this.pdf.text(`${this.funkUebung.name} - ${datumString}`, this.pdfWidth / 2, y, { align: "center" });
        y += 8;
        this.pdf.setFontSize(14);
        this.pdf.text(`Übungsleitung: ${this.funkUebung.leitung}`, this.pdfWidth / 2, y, { align: "center" });
        y += 8;
        this.pdf.text(`Rufgruppe: ${this.funkUebung.rufgruppe}`, this.pdfWidth / 2, y, { align: "center" });
        return y + 5;
    }

    private drawTeilnehmerTable(startY: number): void {
        const wTeilnehmer = this.contentWidth * 0.21;
        const wAnmeldung = this.contentWidth * 0.12;
        const wLoesungswort = this.contentWidth * 0.21;
        const wStaerke = this.contentWidth * 0.20;
        const wBemerkungen = this.contentWidth - wTeilnehmer - wAnmeldung - wLoesungswort - wStaerke;

        (this.pdf as any).autoTable({
            head: [["Teilnehmer", "Anmeldung", "Lösungswort", "Stärke", "Bemerkungen"]],
            body: this.buildTeilnehmerRows(),
            startY,
            theme: "grid",
            pageBreak: "auto",
            margin: { left: this.pageMarginLeft, top: this.pageMarginTop + 5, bottom: this.pageMarginBottom },
            tableWidth: this.contentWidth,
            columnStyles: {
                0: { cellWidth: wTeilnehmer },
                1: { cellWidth: wAnmeldung },
                2: { cellWidth: wLoesungswort },
                3: { cellWidth: wStaerke, cellPadding: 2, valign: "top" },
                4: { cellWidth: wBemerkungen }
            },
            styles: {
                fontSize: this.tableFontSize,
                cellPadding: 2,
                lineWidth: 0.1,
                lineColor: [0, 0, 0],
                overflow: "linebreak"
            },
            headStyles: { fillColor: [200, 200, 200] }
        });
    }

    private buildTeilnehmerRows(): string[][] {
        const rows: string[][] = [];
        for (const teilnehmer of this.funkUebung.teilnehmerListe) {
            rows.push(this.createTeilnehmerRow(teilnehmer));
        }
        return rows;
    }

    private createTeilnehmerRow(teilnehmer: string): string[] {
        const teilnehmerLocalData = this.getTeilnehmerLocalData(teilnehmer);
        const anmeldeZeit = teilnehmerLocalData?.angemeldetUm
            ? formatNatoDate(teilnehmerLocalData.angemeldetUm)
            : "";

        return [
            this.getTeilnehmerAnzeige(teilnehmer),
            anmeldeZeit,
            this.funkUebung.loesungswoerter?.[teilnehmer] ?? "",
            this.funkUebung.loesungsStaerken?.[teilnehmer] ?? "0/0/0/0",
            teilnehmerLocalData?.notizen ?? ""
        ];
    }

    private getTeilnehmerAnzeige(teilnehmer: string): string {
        const stellenName = this.funkUebung.teilnehmerStellen?.[teilnehmer];
        return stellenName ? `${stellenName}\n${teilnehmer}` : teilnehmer;
    }

    private getTeilnehmerLocalData(teilnehmer: string): { angemeldetUm?: string; notizen?: string } | null {
        const localTeilnehmer = this.localData?.teilnehmer;
        if (!localTeilnehmer || typeof localTeilnehmer !== "object") {
            return null;
        }
        return localTeilnehmer[teilnehmer] ?? null;
    }

    private drawNachrichtenTable(): void {
        const tableData = this.collectNachrichtenRows();
        const empfaengerWidth = this.contentWidth * 0.20;
        const lfdnrWidth = 12;
        const zeitWidth = 24;
        const senderWidth = empfaengerWidth;
        const nachrichtenWidth = this.contentWidth - lfdnrWidth - (empfaengerWidth * 2) - zeitWidth;

        this.pdf.addPage();
        let lastNrValue: number | null = null;

        (this.pdf as any).autoTable({
            head: [["Nr", "Empfänger", "Sender", "Nachricht", "Zeit"]],
            body: tableData,
            startY: this.pageMarginTop + 5,
            theme: "grid",
            margin: { left: this.pageMarginLeft, top: this.pageMarginTop + 5, bottom: 25 },
            tableWidth: this.contentWidth,
            columnStyles: {
                0: { cellWidth: lfdnrWidth },
                1: { cellWidth: empfaengerWidth },
                2: { cellWidth: senderWidth },
                3: { cellWidth: nachrichtenWidth },
                4: { cellWidth: zeitWidth }
            },
            styles: {
                fontSize: this.tableFontSize,
                cellPadding: 1.5,
                lineWidth: 0.1,
                lineColor: [0, 0, 0],
                overflow: "linebreak"
            },
            headStyles: { fillColor: [200, 200, 200] },
            didDrawCell: (data: any) => {
                if (data.section !== "body" || data.column.index !== 0) {
                    return;
                }
                const currentNr = data.cell.raw as number;
                if (currentNr === lastNrValue) {
                    return;
                }
                lastNrValue = currentNr;
                this.drawHorizontalMessageDivider(data);
            }
        });
    }

    private collectNachrichtenRows(): Array<[number, string, string, string, string]> {
        const allMessages: { nr: number; empfaenger: string; sender: string; nachricht: string; zeit: string }[] = [];

        this.funkUebung.teilnehmerListe.forEach(sender => {
            const nachrichten = this.funkUebung.nachrichten[sender];
            if (!Array.isArray(nachrichten)) {
                return;
            }
            nachrichten.forEach((nachricht, index) => {
                allMessages.push(this.buildNachrichtRow(sender, index, nachricht));
            });
        });

        allMessages.sort((a, b) => a.nr - b.nr || a.sender.localeCompare(b.sender));
        return allMessages.map(n => [n.nr, n.empfaenger, n.sender, n.nachricht, n.zeit]);
    }

    private buildNachrichtRow(sender: string, index: number, nachricht: any): {
        nr: number;
        empfaenger: string;
        sender: string;
        nachricht: string;
        zeit: string;
    } {
        const key = `${sender}__${index + 1}`;
        const zeit = this.localData?.nachrichten?.[key]?.abgesetztUm
            ? formatNatoDate(this.localData.nachrichten[key].abgesetztUm)
            : "";
        const notiz = this.localData?.nachrichten?.[key]?.notiz
            ? `\n\nAnmerkung:\n${this.localData.nachrichten[key].notiz}`
            : "";

        return {
            nr: index + 1,
            empfaenger: nachricht.empfaenger.join("\n"),
            sender,
            nachricht: nachricht.nachricht + notiz,
            zeit
        };
    }

    private drawHorizontalMessageDivider(data: any): void {
        const startX = data.cell.x;
        const endX = startX + data.cell.width + data.table.columns.slice(1).reduce((sum: number, col: any) => sum + col.width, 0);
        const y = data.cell.y;
        if (typeof startX !== "number" || typeof endX !== "number" || typeof y !== "number") {
            return;
        }
        data.doc.setDrawColor(0);
        data.doc.setLineWidth(0.75);
        data.doc.line(startX, y, endX, y);
    }

    private drawHeaderAndFooter(generierungszeit: string): void {
        const totalPages = (this.pdf as any).getNumberOfPages();
        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
            this.pdf.setPage(pageNumber);
            if (pageNumber > 1) {
                this.drawPageHeader();
            }
            this.drawPageFooter(pageNumber, totalPages, generierungszeit);
        }
    }

    private drawPageHeader(): void {
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(10);
        this.pdf.text(`Übungsleitung: ${this.funkUebung.leitung} - Rufgruppe: ${this.funkUebung.rufgruppe}`, this.pageMarginLeft, 20);
        const rightText = `${this.funkUebung.name} - ${formatNatoDate(this.funkUebung.datum, false)}`;
        const nameWidth = this.pdf.getTextWidth(rightText);
        this.pdf.text(rightText, this.pdfWidth - this.pageMarginLeft - nameWidth, 20);
        this.pdf.setDrawColor(0);
        this.pdf.line(this.pageMarginLeft, 22, this.pdfWidth - this.pageMarginRight, 22);
    }

    private drawPageFooter(pageNumber: number, totalPages: number, generierungszeit: string): void {
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(8);
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
