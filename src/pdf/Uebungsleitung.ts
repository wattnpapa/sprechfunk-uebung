import { FunkUebung } from "../FunkUebung";
import { jsPDF } from "jspdf";
import { DateFormatter } from "../DateFormatter";
import { Nachricht } from "../types/Nachricht";
import { BasePDF } from "./BasePDF";

export class Uebungsleitung extends BasePDF {

    constructor(uebung: FunkUebung, pdfInstance: jsPDF) {
        super(uebung, pdfInstance)
    }

    draw(): void {

        const pageMarginTop = 25;
        const pageMarginBottom = 25;
        const pageMarginLeft = 10;
        const pageMarginRight = 10;
        const secondPageTableTopMargin = pageMarginTop + 5; // **Garantierter Abstand für die Tabelle auf Seite 2+**
        let contentWidth = (this.pdfWidth - pageMarginLeft - pageMarginRight);

        let y = pageMarginTop;

        const firstTableStartY = 30;

        const generierungszeit = DateFormatter.formatNATODate(this.funkUebung.createDate);
        const tableFontSize = 8;

        // **1. Kopfzeile für erste Seite**
        this.pdf.setFont("helvetica", "bold");
        this.pdf.setFontSize(16);
        this.pdf.text(`${this.funkUebung.name}` + DateFormatter.formatNATODate(this.funkUebung.datum, false), this.pdfWidth / 2, y, { align: "center" });
        y = y + 8;

        this.pdf.setFontSize(14);
        this.pdf.text(`Übungsleitung: ` + this.funkUebung.leitung, this.pdfWidth / 2, y, { align: "center" });
        y = y + 8;

        this.pdf.setFontSize(14);
        this.pdf.text(`Rufgruppe: ` + this.funkUebung.rufgruppe, this.pdfWidth / 2, y, { align: "center" });
        y = y + 5;

        // **3. Teilnehmerliste (rechts)**
        let tableStartY = y

        const stellen = this.funkUebung.teilnehmerStellen;

        let tableBody = this.funkUebung.teilnehmerListe.map((teilnehmer: string) => {
            let teilnehmerAnzeige = teilnehmer;

            if (stellen && stellen[teilnehmer]) {
                teilnehmerAnzeige = `${stellen[teilnehmer]}\n${teilnehmer}`;
            }

            // Stärke-Spalte: Nur Gesamtstärke
            const staerkeValue = this.funkUebung.loesungsStaerken?.[teilnehmer] ?? "0/0/0/0";

            return [
                teilnehmerAnzeige,
                "", // Platz für Anmeldezeitpunkt
                this.funkUebung.loesungswoerter?.[teilnehmer] ?? "", // Lösungswort
                staerkeValue, // Nur Gesamtstärke
                "" // Bemerkungen
            ];
        });

        // Spaltenbreiten relativ zur verfügbaren Breite berechnen (verhindert Überlauf)
        const wTeilnehmer = contentWidth * 0.21;
        const wAnmeldung = contentWidth * 0.12;
        const wLoesungswort = contentWidth * 0.21;
        const wStaerke = contentWidth * 0.20;
        const wBemerkungen = contentWidth - wTeilnehmer - wAnmeldung - wLoesungswort - wStaerke;


        (this.pdf as any).autoTable({
            head: [["Teilnehmer", "Anmeldung", "Lösungswort", "Stärke", "Bemerkungen"]],
            body: tableBody,
            startY: tableStartY,
            theme: "grid",
            pageBreak: "auto",
            margin: { left: pageMarginLeft, top: secondPageTableTopMargin, bottom: pageMarginBottom },
            tableWidth: contentWidth,
            columnStyles: {
                0: { cellWidth: wTeilnehmer },
                1: { cellWidth: wAnmeldung },
                2: { cellWidth: wLoesungswort },
                3: { cellWidth: wStaerke, cellPadding: 2, valign: "top" },
                4: { cellWidth: wBemerkungen }
            },
            styles: {
                fontSize: tableFontSize,
                cellPadding: 2,
                lineWidth: 0.1,
                lineColor: [0, 0, 0],
                overflow: "linebreak"
            },
            headStyles: { fillColor: [200, 200, 200] }
        });


        //Funksprüche der Teilnehmer
        // Funksprüche aller Teilnehmer sammeln
        let alleNachrichten: { nr: number; empfaenger: string; sender: string; nachricht: string }[] = [];
        this.funkUebung.teilnehmerListe.forEach(sender => {
            let nachrichten = this.funkUebung.nachrichten[sender];
            if (!Array.isArray(nachrichten)) return;
            nachrichten.forEach((nachricht, index) => {
                alleNachrichten.push({
                    nr: index + 1,
                    empfaenger: nachricht.empfaenger.join("\n"),
                    sender,
                    nachricht: nachricht.nachricht,
                });
            });
        });

        // Sortieren: zuerst nach Nr, dann Sender
        alleNachrichten.sort((a, b) => a.nr - b.nr || a.sender.localeCompare(b.sender));

        // Tabelle vorbereiten
        const tableData = alleNachrichten.map(n => [n.nr, n.empfaenger, n.sender, n.nachricht, ""]);

        let empfaengerWidth = contentWidth * 0.20;
        let lfdnrWidth = 12;
        let withCheckBox = 12;
        let senderWidth = empfaengerWidth; // gleiche Breite wie Empfänger
        let columnWidthsAll = [lfdnrWidth, empfaengerWidth, senderWidth, contentWidth - lfdnrWidth - (empfaengerWidth * 2) - withCheckBox, withCheckBox];
        // Neuen Y-Startpunkt nach der Teilnehmer-Tabelle
        this.pdf.addPage();
        let nextTableStartY = secondPageTableTopMargin;

        let lastNrValue: number | null = null;

        (this.pdf as any).autoTable({
            head: [["Nr", "Empfänger", "Sender", "Nachricht", "Zeit"]],
            body: tableData,
            startY: nextTableStartY,
            theme: "grid",
            margin: { left: pageMarginLeft, top: secondPageTableTopMargin, bottom: 25 },
            tableWidth: contentWidth,
            columnStyles: {
                0: { cellWidth: columnWidthsAll[0] },
                1: { cellWidth: columnWidthsAll[1] },
                2: { cellWidth: columnWidthsAll[2] },
                3: { cellWidth: columnWidthsAll[3] },
                4: { cellWidth: columnWidthsAll[4] }
            },
            styles: { fontSize: tableFontSize, cellPadding: 1.5, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] },
            didDrawCell: function (data: any) {
                if (data.section === 'body' && data.column.index === 0) {
                    const currentNr = data.cell.raw;

                    if (currentNr !== lastNrValue) {
                        lastNrValue = currentNr;

                        const startX = data.cell.x;
                        const endX = startX + data.cell.width + data.table.columns.slice(1).reduce((sum: number, col: any) => sum + col.width, 0);
                        const y = data.cell.y;

                        if (typeof startX === "number" && typeof endX === "number" && typeof y === "number") {
                            const lineY = y; // Linie direkt über der Zelle
                            data.doc.setDrawColor(0);
                            data.doc.setLineWidth(0.75); // Dicker als Standard
                            data.doc.line(startX, lineY, endX, lineY);
                        }
                    }
                }
            }
        });

        // **4. Kopf- und Fußzeilen für alle Seiten**
        let totalPages = (this.pdf as any).getNumberOfPages();
        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
            this.pdf.setPage(pageNumber);

            //Header
            if (pageNumber > 1) {
                this.pdf.setFont("helvetica", "normal");
                this.pdf.setFontSize(10);
                // **Links: Funkrufname**
                this.pdf.text(`Übungsleitung: ` + this.funkUebung.leitung + ' - Rufgruppe: ' + this.funkUebung.rufgruppe, pageMarginLeft, 20);

                // **Rechts: Name der Übung**
                let rightText = this.funkUebung.name + " - " + DateFormatter.formatNATODate(this.funkUebung.datum, false)
                let nameWidth = this.pdf.getTextWidth(rightText);
                this.pdf.text(rightText, this.pdfWidth - pageMarginLeft - nameWidth, 20);

                // **Trennlinie unter der Kopfzeile**
                this.pdf.setDrawColor(0);
                this.pdf.line(pageMarginLeft, 22, this.pdfWidth - pageMarginRight, 22);
            }

            //this.drawHeader(pdf, "Übungsleitung", j, pdfWidth, pageMargin, funkUebung);
            this.pdf.setFont("helvetica", "normal");
            this.pdf.setFontSize(8);
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