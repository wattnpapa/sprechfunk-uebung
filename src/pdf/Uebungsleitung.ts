/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { Uebung } from "../types/Uebung";
import { jsPDF } from "jspdf";
import { formatNatoDate } from "../utils/date";
import { BasePDF } from "./BasePDF";
import { appBasisUrl, teilnehmerCodeVon, uebungCodeVon, uebungsleitungUrl, zeichneQrCode } from "./zugang";

/** Kantenlänge des QR-Codes auf den Leitungs-Link (mm). */
const QR_KANTE = 24;

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
        y = this.drawZugangsdaten(y);
        return y + 5;
    }

    /**
     * Wiedereinstieg vom Papier (THW-Review 2026-10-04, analog-first P2-1,
     * workflow F5): Übungscode für Nachzügler, QR-Code auf den
     * Leitungs-Link, die Teilnehmercodes stehen in der Tabelle.
     */
    private drawZugangsdaten(y: number): number {
        const basis = appBasisUrl();
        if (this.funkUebung.id) {
            const x = this.pdfWidth - this.pageMarginRight - QR_KANTE;
            zeichneQrCode(this.pdf, uebungsleitungUrl(basis, this.funkUebung.id), x, 3, QR_KANTE);
            this.pdf.setFont("helvetica", "normal");
            this.pdf.setFontSize(7);
            this.pdf.text("Übungsleitung", x - 2, 12, { align: "right" });
            this.pdf.text("wieder öffnen", x - 2, 15.5, { align: "right" });
        }
        const uebungCode = uebungCodeVon(this.funkUebung);
        this.pdf.setFont("helvetica", "normal");
        this.pdf.setFontSize(9);
        if (uebungCode) {
            y += 7;
            this.pdf.text(
                `Übungscode: ${uebungCode} – Zugang für Teilnehmer: ${basis}#/teilnehmer, dort Übungs- und Teilnehmercode eingeben.`,
                this.pdfWidth / 2, y, { align: "center" }
            );
        }
        y += 5;
        this.pdf.text(
            "Ohne Netz läuft die Übung auf Papier weiter: Anmeldung, Lösungswort und Stärke unter „Ist“, "
            + "abgesetzte Sprüche mit Uhrzeit eintragen und später in der App nachtragen.",
            this.pdfWidth / 2, y, { align: "center" }
        );
        return y;
    }

    private drawTeilnehmerTable(startY: number): void {
        const wTeilnehmer = this.contentWidth * 0.19;
        const wAnmeldung = this.contentWidth * 0.10;
        const wLoesungswort = this.contentWidth * 0.13;
        const wStaerke = this.contentWidth * 0.12;
        const wBemerkungen = this.contentWidth - wTeilnehmer - wAnmeldung - 2 * wLoesungswort - 2 * wStaerke;

        // „Soll“ steht vorgedruckt, „Ist“ ist das Feld für das, was über Funk
        // ankommt – dieselben Felder wie in der Bildschirmansicht (analog-first P2-3).
        (this.pdf as any).autoTable({
            head: [["Teilnehmer", "Anmeldung", "Lösungswort Soll", "Lösungswort Ist", "Stärke Soll", "Stärke Ist", "Bemerkungen"]],
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
                3: { cellWidth: wLoesungswort },
                4: { cellWidth: wStaerke, cellPadding: 2, valign: "top" },
                5: { cellWidth: wStaerke, cellPadding: 2, valign: "top" },
                6: { cellWidth: wBemerkungen }
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
        const stand = this.getTeilnehmerLocalData(teilnehmer) ?? {};
        return [
            this.getTeilnehmerAnzeige(teilnehmer),
            stand.angemeldetUm ? formatNatoDate(stand.angemeldetUm) : "",
            this.funkUebung.loesungswoerter?.[teilnehmer] ?? "",
            stand.loesungswortGesendet ?? "",
            this.funkUebung.loesungsStaerken?.[teilnehmer] ?? "0/0/0/0",
            this.staerkeIst(stand.teilstaerken),
            stand.notizen ?? ""
        ];
    }

    /** Empfangene Teilstärken als „a/b/c/d“, leer solange nichts eingetragen ist. */
    private staerkeIst(teilstaerken: string[] | undefined): string {
        const werte = (teilstaerken ?? []).map(wert => String(wert ?? "").trim());
        return werte.some(wert => wert !== "") ? werte.map(wert => wert || "-").join("/") : "";
    }

    private getTeilnehmerAnzeige(teilnehmer: string): string {
        const stellenName = this.funkUebung.teilnehmerStellen?.[teilnehmer];
        const name = stellenName ? `${stellenName}\n${teilnehmer}` : teilnehmer;
        // Teilnehmercode zum Weitergeben an Nachzügler; die beübte Stelle hat keinen Zugang.
        const code = this.funkUebung.fuehrungsstelle?.beuebteStelle === teilnehmer
            ? null
            : teilnehmerCodeVon(this.funkUebung, teilnehmer);
        return code ? `${name}\nCode: ${code}` : name;
    }

    private getTeilnehmerLocalData(teilnehmer: string): {
        angemeldetUm?: string;
        notizen?: string;
        loesungswortGesendet?: string;
        teilstaerken?: string[];
    } | null {
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
        // Die dicke Trennlinie markiert Rundengrenzen (alle Nr. 1, dann Nr. 2, …).
        // In Szenario- und Führungsstellen-Übungen ist die Tabelle nach
        // Erzählreihenfolge sortiert, die Nr wechselt dann fast jede Zeile —
        // die Linie entfällt dort.
        const istSzenario = !!this.funkUebung.szenarioSlug || !!this.funkUebung.fuehrungsstelle;

        (this.pdf as any).autoTable({
            head: [["Nr", "Empfänger", "Sender", "Nachricht", "Abgesetzt (Uhrzeit)"]],
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
                if (istSzenario || data.section !== "body" || data.column.index !== 0) {
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
        const allMessages: {
            nr: number; empfaenger: string; sender: string; nachricht: string; zeit: string; szenarioNr?: number
        }[] = [];

        this.funkUebung.teilnehmerListe.forEach(sender => {
            const nachrichten = this.funkUebung.nachrichten[sender];
            if (!Array.isArray(nachrichten)) {
                return;
            }
            nachrichten.forEach((nachricht, index) => {
                allMessages.push(this.buildNachrichtRow(sender, index, nachricht));
            });
        });

        // Szenario-Übungen sortieren nach der globalen Erzählreihenfolge,
        // klassische wie bisher rundenweise nach Nachrichtennummer.
        allMessages.sort((a, b) =>
            (a.szenarioNr ?? a.nr) - (b.szenarioNr ?? b.nr) || a.sender.localeCompare(b.sender)
        );
        return allMessages.map(n => [n.nr, n.empfaenger, n.sender, n.nachricht, n.zeit]);
    }

    private buildNachrichtRow(sender: string, index: number, nachricht: any): {
        nr: number;
        empfaenger: string;
        sender: string;
        nachricht: string;
        zeit: string;
        szenarioNr?: number;
    } {
        // Statuskeys und Nummern hängen an der Nachrichten-id; der Index dient
        // nur als Fallback für Altbestände ohne id (dort gilt id == index + 1).
        const nr = typeof nachricht.id === "number" ? nachricht.id : index + 1;
        const status = this.localData?.nachrichten?.[`${sender}__${nr}`];
        const zeit = status?.abgesetztUm ? formatNatoDate(status.abgesetztUm) : "";
        const notiz = status?.notiz ? `\n\nAnmerkung:\n${status.notiz}` : "";

        return {
            nr,
            empfaenger: nachricht.empfaenger.join("\n"),
            sender,
            nachricht: nachricht.nachricht + notiz,
            zeit,
            ...(typeof nachricht.szenarioNr === "number" ? { szenarioNr: nachricht.szenarioNr } : {})
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
