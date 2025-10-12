import dateFormatter, { DateFormatter } from "./DateFormatter.js";
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Uebung } from './types/Uebung';
import type { Nachricht } from './types/Nachricht';

import JSZip from "jszip";
import { DeckblattTeilnehmer } from "./pdf/DeckblattTeilnehmer.js";
import { FunkUebung } from "./FunkUebung.js";
import { Meldevordruck } from "./pdf/Meldevordruck.js";
import { Nachrichtenvordruck } from "./pdf/Nachrichtenvordruck.js";

class PDFGenerator {
    constructor() {
        if (typeof (jsPDF as any).API.autoTable !== "function") {
            // @ts-expect-error Plugin-Binding für jsPDF
            autoTable(jsPDF);
        }
    }

    generateTeilnehmerPDFs(funkUebung: Uebung): void {
        this.generateTeilnehmerPDFsBlob(funkUebung).then(blobMap => {
            blobMap.forEach((blob, teilnehmer) => {
                const fileName = `${teilnehmer}.pdf`;
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            });

            alert("Alle Teilnehmer PDFs wurden erfolgreich erstellt!");
        });
    }

    /**
     * Erstellt die Teilnehmer PDFs.
     */
    async generateTeilnehmerPDFsBlob(funkUebung: Uebung): Promise<Map<string, Blob>> {
        const generierungszeit = DateFormatter.formatNATODate(funkUebung.createDate, true); // NATO-Datum für Fußzeile
        const blobMap = new Map();

        funkUebung.teilnehmerListe.forEach(teilnehmer => {

            let nachrichten = funkUebung.nachrichten[teilnehmer]

            let pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const pageMargin = 10;
            const firstTableStartY = 30;
            const secondPageTableTopMargin = 30; // **Garantierter Abstand für die Tabelle auf Seite 2+**

            // **1. Kopfzeile für erste Seite**
            this.drawFirstPageHeader(pdf, funkUebung, teilnehmer, pdfWidth);

            // **2. Kopfdaten-Tabelle (links)**
            let kopfdatenWidth = (pdfWidth - 2 * pageMargin) * 0.35;
            this.drawKopfdatenTable(pdf, funkUebung, firstTableStartY, pageMargin, kopfdatenWidth);

            // **3. Teilnehmerliste (rechts)**
            let teilnehmerWidth = (pdfWidth - 2 * pageMargin) * 0.60;
            this.drawTeilnehmerTable(pdf, funkUebung, firstTableStartY, pdfWidth - pageMargin - teilnehmerWidth, teilnehmerWidth);

            // **4. Nachrichten-Tabelle**
            let tableStartY = Math.max((pdf as any).lastAutoTable.finalY + 10, 75);

            this.drawNachrichtenTable(pdf, nachrichten, tableStartY, pageMargin, pdfWidth, secondPageTableTopMargin);

            // **5. Setze Kopfzeilen & Seitenzahlen auf allen Seiten**
            let totalPages = (pdf as any).getNumberOfPages();
            for (let j = 1; j <= totalPages; j++) {
                pdf.setPage(j);
                this.drawHeader(pdf, teilnehmer, j, pdfWidth, pageMargin, funkUebung);
                this.drawFooter(pdf, generierungszeit, funkUebung, j, totalPages, pdfWidth, pdfHeight, pageMargin);
            }

            // **6. PDF speichern**
            const blob = pdf.output("blob");
            blobMap.set(teilnehmer, blob);
        });

        return blobMap;
    }

    /**
     * Erstellt ein DIN A5 Deckblatt im Hochformat mit folgendem Aufbau:
     *   Sprechfunkübung Bravo Meldung 2025
     *   Heros Jever 21/10
     *   19jul25
     *
     *   Übungsleitung:
     *   Heros Wind 10
     *
     *   Teilnehmer
     *   <Liste, kleiner & eng zeilenabständig>
     */
    async generateDeckblaetterA5Blob(funkUebung: FunkUebung): Promise<Blob> {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5" });
        // Pro Teilnehmer eine Seite
        funkUebung.teilnehmerListe.forEach((teilnehmer: string, idx: number) => {
            if (idx > 0) pdf.addPage();
            new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf).draw();
        });
        return pdf.output("blob");
    }

    /**
     * Erstellt eine A4-Quer-PDF mit 2 Nachrichtenvordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateAllNachrichtenvordruckPrintA4Blob(funkUebung: FunkUebung): Promise<Blob> {
        const pdf = new jsPDF('l', 'mm', 'a4');
        const parts = funkUebung.teilnehmerListe;
        for (let i = 0; i < parts.length; i += 2) {
            if (i > 0) {
                pdf.addPage();
            }

            const left = parts[i];
            const right = parts[i + 1];

            let deckblattLeft = new DeckblattTeilnehmer(left, funkUebung, pdf);
            deckblattLeft.draw(0); // left -> offset 0  
            
            if (right) {
                let deckblattRight = new DeckblattTeilnehmer(right, funkUebung, pdf);
                deckblattRight.draw(148); // right -> offset 148
            }

            // Nachrichtenvordrucke
            const leftMsgs = funkUebung.nachrichten[left] || [];
            const rightMsgs = right ? funkUebung.nachrichten[right] || [] : [];
            const max = Math.max(leftMsgs.length, rightMsgs.length);
            for (let j = 0; j < max; j++) {
                pdf.addPage();
                if (j < leftMsgs.length) new Nachrichtenvordruck(left, funkUebung, pdf, leftMsgs[j]).draw();
                if (right && j < rightMsgs.length) new Nachrichtenvordruck(right, funkUebung, pdf, rightMsgs[j]).draw(148)
            }
        }
        return pdf.output('blob');
    }

    /**
     * Erstellt eine A4-Quer-PDF mit 2 Meldevordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateAllMeldevordruckPrintA4Blob(funkUebung: FunkUebung): Promise<Blob> {
        const pdf = new jsPDF('l', 'mm', 'a4');
        const parts = funkUebung.teilnehmerListe;
        for (let i = 0; i < parts.length; i += 2) {
            if (i > 0) {
                pdf.addPage();
            }

            const left = parts[i];
            const right = parts[i + 1];
            
            let deckblattLeft = new DeckblattTeilnehmer(left, funkUebung, pdf);
            deckblattLeft.draw(0); // left -> offset 0
            
            if (right) {
                let deckblattRight = new DeckblattTeilnehmer(right, funkUebung, pdf);
                deckblattRight.draw(148); // right -> offset 148
            }
            const leftMsgs = funkUebung.nachrichten[left] || [];
            const rightMsgs = right ? funkUebung.nachrichten[right] || [] : [];
            const max = Math.max(leftMsgs.length, rightMsgs.length);
            for (let j = 0; j < max; j++) {
                pdf.addPage();
                if (j < leftMsgs.length) new Meldevordruck(left, funkUebung, pdf, leftMsgs[j]).draw();
                if (right && j < rightMsgs.length) new Meldevordruck(right, funkUebung, pdf, leftMsgs[j]).draw(148);
            }            
        }
        return pdf.output('blob');
    }

    /**
     * Erstellt die Teilnehmerliste-Tabelle.
     */
    drawTeilnehmerTable(
      pdf: jsPDF,
      funkUebung: Uebung,
      startY: number,
      marginLeft: number,
      width: number
    ): void {
        let teilnehmerColumns = 2;
        let teilnehmerRows = Math.ceil(funkUebung.teilnehmerListe.length / teilnehmerColumns);
        let teilnehmerTable = [];

        for (let r = 0; r < teilnehmerRows; r++) {
            let row = [];
            for (let c = 0; c < teilnehmerColumns; c++) {
                let index = r + c * teilnehmerRows;
                if (index < funkUebung.teilnehmerListe.length) {
                    row.push(funkUebung.teilnehmerListe[index]);
                } else {
                    row.push("");
                }
            }
            teilnehmerTable.push(row);
        }

        (pdf as any).autoTable({
            head: [["Teilnehmer", ""]],
            body: teilnehmerTable,
            startY: startY,
            margin: { left: marginLeft },
            tableWidth: width,
            theme: "grid",
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] }
        });
    }

    /**
     * Erstellt die Nachrichten-Tabelle.
     */
    drawNachrichtenTable(
      pdf: jsPDF,
      nachrichten: Nachricht[],
      startY: number,
      marginLeft: number,
      pdfWidth: number,
      secondPageTableTopMargin: number
    ): void {
        let tableWidth = pdfWidth - 2 * marginLeft;
        let empfaengerWidth = tableWidth * 0.20;
        let lfdnrWidth = 12;
        let columnWidths = [lfdnrWidth, empfaengerWidth, tableWidth - lfdnrWidth - empfaengerWidth];

        (pdf as any).autoTable({
            head: [["Nr.", "Empfänger", "Nachrichtentext"]],
            body: nachrichten.map((n: Nachricht) => [n.id, n.empfaenger.join("\n"), n.nachricht]),
            startY: startY,
            theme: "grid",
            margin: { left: marginLeft, top: secondPageTableTopMargin, bottom: 20 },
            tableWidth: tableWidth,
            columnStyles: {
                0: { cellWidth: columnWidths[0] },
                1: { cellWidth: columnWidths[1] },
                2: { cellWidth: columnWidths[2] }
            },
            styles: { fontSize: 10, cellPadding: 1.5, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] }
        });
    }

    fixEncoding(text: string): string {
        return text.normalize("NFC") // Korrigiert Zeichensatz-Probleme
            .replace(/ /g, "\u00A0"); // Non-Breaking Space für Leerzeichen
    }

    /**
     * Erstellt die Kopfzeile der ersten Seite (größer & fett).
     */
    drawFirstPageHeader(
      pdf: jsPDF,
      funkUebung: Uebung,
      teilnehmer: string,
      pdfWidth: number
    ): void {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(`${funkUebung.name}`, pdfWidth / 2, 15, { align: "center" });

        pdf.setFontSize(14);
        pdf.text(`${teilnehmer}`, pdfWidth / 2, 20, { align: "center" });
    }

    /**
     * Erstellt die Kopfdaten-Tabelle.
     */
    drawKopfdatenTable(
      pdf: jsPDF,
      funkUebung: Uebung,
      startY: number,
      marginLeft: number,
      width: number
    ): void {
        (pdf as any).autoTable({
            head: [["Beschreibung", "Wert"]],
            body: [
                ["Datum", DateFormatter.formatNATODate(funkUebung.datum, false)],
                ["Rufgruppe", funkUebung.rufgruppe],
                ["Betriebsleitung", funkUebung.leitung]
            ],
            startY: startY,
            margin: { left: marginLeft },
            tableWidth: width,
            theme: "grid",
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] }
        });
    }

    /**
     * Erstellt die Kopfzeile auf Seite 2+.
     */
    drawHeader(
      pdf: jsPDF,
      teilnehmer: string,
      pageNumber: number,
      pdfWidth: number,
      pageMargin: number,
      funkUebung: Uebung
    ): void {
        if (pageNumber > 1) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10);

            // **Links: Funkrufname**
            pdf.text(`Eigener Funkrufname: ${teilnehmer}`, pageMargin, 20);

            // **Rechts: Name der Übung**
            let rightText = funkUebung.name + " - " + DateFormatter.formatNATODate(funkUebung.datum, false)
            let nameWidth = pdf.getTextWidth(rightText);
            pdf.text(rightText, pdfWidth - pageMargin - nameWidth, 20);

            // **Trennlinie unter der Kopfzeile**
            pdf.setDrawColor(0);
            pdf.line(pageMargin, 22, pdfWidth - pageMargin, 22);
        }
    }

    /**
     * Erstellt die Fußzeile auf allen Seiten.
     */
    drawFooter(
      pdf: jsPDF,
      generierungszeit: string,
      funkUebung: Uebung,
      pageNumber: number,
      totalPages: number,
      pdfWidth: number,
      pdfHeight: number,
      pageMargin: number
    ): void {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);

        // Hinweis über der Linie
        pdf.text("Wörter in GROSSBUCHSTABEN müssen buchstabiert werden.", pageMargin, pdfHeight - 20);

        // Trennlinie unter dem Hinweis
        pdf.setDrawColor(0);
        pdf.line(pageMargin, pdfHeight - 15, pdfWidth - pageMargin, pdfHeight - 15);

        // Seitenzahl
        pdf.setFontSize(10);
        let pageNumberText = `Seite ${pageNumber} von ${totalPages}`;
        let pageNumberWidth = pdf.getTextWidth(pageNumberText);
        pdf.text(pageNumberText, pdfWidth - pageMargin - pageNumberWidth, pdfHeight - 10);

        // Link und Copyright-Infos linksbündig
        pdf.setFontSize(6);
        let leftText = `© Johannes Rudolph | Version ${funkUebung.buildVersion} | Übung ID: ${funkUebung.id} | Generiert: ${generierungszeit} | Generator: https://sprechfunk-uebung.de/`;
        pdf.textWithLink(leftText, pageMargin, pdfHeight - 10, { url: "https://sprechfunk-uebung.de//" });
    }

    generateNachrichtenvordruckPDFs(funkUebung: FunkUebung) {
        this.generateNachrichtenvordruckPDFsBlob(funkUebung).then(blobMap => {
            blobMap.forEach((blob, teilnehmer) => {
                const fileName = `Nachrichtenvordruck_${teilnehmer}.pdf`;
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            });

            alert("Alle Nachrichtenvordruck PDFs wurden erfolgreich erstellt!");
        });
    }

    /**
     * Erstellt die Nachrichtenvordruck PDFs.
     */
    async generateNachrichtenvordruckPDFsBlob(funkUebung: FunkUebung) {
        const blobMap = new Map();
        funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
            let nachrichten = funkUebung.nachrichten[teilnehmer];

            let pdf = new jsPDF("p", "mm", "a5");
            // Deckblatt als erste Seite
            let deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();

            nachrichten.forEach((nachricht: Nachricht, index: number) => {
                new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht).draw();
                if (index < nachrichten.length - 1) pdf.addPage();
            });

            const totalPages = (pdf as any).getNumberOfPages();
            for (let j = 2; j <= totalPages; j++) {
                pdf.setPage(j);
            }

            const blob = pdf.output("blob");
            blobMap.set(teilnehmer, blob);
        });

        return blobMap;
    }

    generateMeldevordruckPDFs(funkUebung: FunkUebung) {
        this.generateMeldevordruckPDFsBlob(funkUebung).then(blobMap => {
            blobMap.forEach((blob, teilnehmer) => {
                const fileName = `Meldevordruck_${teilnehmer}.pdf`;
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            });

            alert("Alle Meldevorduck PDFs wurden erfolgreich erstellt!");
        });
    }

    /**
     * Erstellt die Meldevordruck PDFs für alle Teilnehmer.
     */
    async generateMeldevordruckPDFsBlob(funkUebung: FunkUebung) {
        const blobMap = new Map();
        funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
            let nachrichten = funkUebung.nachrichten[teilnehmer];

            let pdf = new jsPDF('p', 'mm', 'a5'); // A5 Hochformat
            // Deckblatt als erste Seite
            let deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();

            nachrichten.forEach((nachricht: Nachricht, index: number) => {
                new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht).draw();
                if (index < nachrichten.length - 1) pdf.addPage();
            });

            const totalPages = (pdf as any).getNumberOfPages();
            for (let j = 2; j <= totalPages; j++) {
                pdf.setPage(j);
            }

            const blob = pdf.output("blob");
            blobMap.set(teilnehmer, blob);
        });

        return blobMap;
    }

    generateInstructorPDF(funkUebung: Uebung) {
        const blob = this.generateInstructorPDFBlob(funkUebung);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Uebungsleitung.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    /**
     * Erstellt das PDF für die Übungsleitung.
     */
    generateInstructorPDFBlob(funkUebung: Uebung) {
        let pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const pageMargin = 10;
        const firstTableStartY = 30;
        const secondPageTableTopMargin = 30; // **Garantierter Abstand für Tabellen auf Seite 2+**
        const generierungszeit = DateFormatter.formatNATODate(funkUebung.createDate);
        const tableFontSize = 8;

        // **1. Kopfzeile für erste Seite**
        this.drawFirstPageHeader(pdf, funkUebung, "Übungsleitung", pdfWidth);

        // **2. Kopfdaten-Tabelle**
        this.drawKopfdatenTable(pdf, funkUebung, firstTableStartY, pageMargin, ((pdfWidth - 2 * pageMargin) / 2));

        // **3. Teilnehmer-Tabelle**
        let tableStartY = Math.max((pdf as any).lastAutoTable.finalY + 10, 75);

        let tableBody = funkUebung.teilnehmerListe.map((teilnehmer: string) => [
            teilnehmer,
            "", // Platz für Anmeldezeitpunkt
            funkUebung.loesungswoerter?.[teilnehmer] ? funkUebung.loesungswoerter?.[teilnehmer] : "", // Falls es ein Lösungswort gibt
            "" // Bemerkungen (handschriftlich eintragbar)
        ]);

        let columnWidths = [60, 35, 60, 120]; // Anpassung für saubere Darstellung

        (pdf as any).autoTable({
            head: [["Teilnehmer", "Anmeldung", "Lösungswort", "Bemerkungen"]],
            body: tableBody,
            startY: tableStartY,
            theme: "grid",
            margin: { left: pageMargin, top: secondPageTableTopMargin },
            tableWidth: pdfWidth - 2 * pageMargin,
            columnStyles: {
                0: { cellWidth: columnWidths[0] },
                1: { cellWidth: columnWidths[1] },
                2: { cellWidth: columnWidths[2] },
                3: { cellWidth: columnWidths[3] }
            },
            styles: { fontSize: tableFontSize, cellPadding: 3, lineWidth: 0.1, lineColor: [0, 0, 0] },
            headStyles: { fillColor: [200, 200, 200] }
        });

        //Funksprüche der Teilnehmer
        // Funksprüche aller Teilnehmer sammeln
        let alleNachrichten: { nr: number; empfaenger: string; sender: string; nachricht: string }[] = [];
        funkUebung.teilnehmerListe.forEach(sender => {
            let nachrichten = funkUebung.nachrichten[sender];
            if (!Array.isArray(nachrichten)) return;
            nachrichten.forEach((nachricht, index) => {
                alleNachrichten.push({
                    nr: index + 1,
                    empfaenger: nachricht.empfaenger.join("\n"),
                    sender,
                    nachricht: nachricht.nachricht
                });
            });
        });

        // Sortieren: zuerst nach Nr, dann Sender
        alleNachrichten.sort((a, b) => a.nr - b.nr || a.sender.localeCompare(b.sender));

        // Tabelle vorbereiten
        const tableData = alleNachrichten.map(n => [n.nr, n.empfaenger, n.sender, n.nachricht, ""]);

        let tableWidth = pdfWidth - 2 * pageMargin;
        let empfaengerWidth = tableWidth * 0.20;
        let lfdnrWidth = 12;
        let withCheckBox = 12;
        let senderWidth = empfaengerWidth; // gleiche Breite wie Empfänger
        let columnWidthsAll = [lfdnrWidth, empfaengerWidth, senderWidth, tableWidth - lfdnrWidth - (empfaengerWidth * 2) - withCheckBox, withCheckBox];

        // Neuen Y-Startpunkt nach der Teilnehmer-Tabelle
        pdf.addPage();
        let nextTableStartY = secondPageTableTopMargin;

        let lastNrValue: number | null = null;

        (pdf as any).autoTable({
            head: [["Nr", "Empfänger", "Sender", "Nachricht", "Zeit"]],
            body: tableData,
            startY: nextTableStartY,
            theme: "grid",
            margin: { left: pageMargin, top: secondPageTableTopMargin, bottom: 25 },
            tableWidth: tableWidth,
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
        let totalPages = (pdf as any).getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            pdf.setPage(j);
            this.drawHeader(pdf, "Übungsleitung", j, pdfWidth, pageMargin, funkUebung);
            this.drawFooter(pdf, generierungszeit, funkUebung, j, totalPages, pdfWidth, pdfHeight, pageMargin);
        }

        return pdf.output("blob");
    }

    /**
     * Zeichnet den Inhalt für Teilnehmer PDFs.
     */
    drawTeilnehmerInhalte(pdf: jsPDF, uebung: any) {
        pdf.setFontSize(12);
        pdf.text(`Teilnehmer: ${uebung.teilnehmer}`, 20, 30);
        pdf.text(`Rufgruppe: ${uebung.kopfdaten.rufgruppe}`, 20, 40);
    }

    /**
     * Zeichnet die Kopfdaten für die Übungsleitung.
     */
    drawKopfdaten(pdf: jsPDF, kopfdaten: any) {
        (pdf as any).autoTable({
            head: [["Beschreibung", "Wert"]],
            body: [
                ["Datum", kopfdaten.datum],
                ["Rufgruppe", kopfdaten.rufgruppe],
                ["Betriebsleitung", kopfdaten.leitung]
            ],
            startY: 30,
            theme: "grid",
            styles: { fontSize: 10 }
        });
    }

    /**
     * Zeichnet die Teilnehmerliste für die Übungsleitung.
     */
    drawTeilnehmerListe(pdf: jsPDF, jsonUebungsDaten: any[]) {
        let tableBody: any[][] = jsonUebungsDaten.map((t: any) => [t.teilnehmer, "", t.loesungswort || "", ""]);
        (pdf as any).autoTable({
            head: [["Teilnehmer", "Anmeldung", "Lösungswort", "Bemerkungen"]],
            body: tableBody,
            startY: 60,
            theme: "grid",
            styles: { fontSize: 10 }
        });
    }

    sanitizeFileName(name: string) {
        return name.replace(/[\/\\:*?"<>|]/g, "-");
    }

    /**
     * Erstellt ein A5-PDF mit allen Nachrichtenvordrucken (plain, ohne Hintergrund & Fußzeile),
     * jeweils mit Deckblatt als Trennblatt.
     */
    async generatePlainNachrichtenvordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5" });
        funkUebung.teilnehmerListe.forEach((teilnehmer, tIdx) => {
            if (tIdx > 0) pdf.addPage();
            // Deckblatt als Trennblatt
            let deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();
            const msgs = funkUebung.nachrichten[teilnehmer] || [];
            msgs.forEach((nachricht, nIdx) => {
                new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht, true, true).draw();
                if (nIdx < msgs.length - 1) pdf.addPage();
            });
        });
        return pdf.output("blob");
    }

    /**
     * Erstellt ein A5-PDF mit allen Meldevordrucken (plain, ohne Hintergrund & Fußzeile),
     * jeweils mit Deckblatt als Trennblatt.
     */
    async generatePlainMeldevordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5" });
        funkUebung.teilnehmerListe.forEach((teilnehmer: string, tIdx: number) => {
            if (tIdx > 0) pdf.addPage();
            let deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();
            const msgs = funkUebung.nachrichten[teilnehmer] || [];
            msgs.forEach((nachricht: Nachricht, nIdx: number) => {
                let meldevordruck = new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht, true, true);
                meldevordruck.draw();
                if (nIdx < msgs.length - 1) pdf.addPage();
            });
        });
        return pdf.output("blob");
    }

    async generateAllPDFsAsZip(funkUebung: FunkUebung) {
        const zip = new JSZip();

        // Teilnehmer-PDFs
        const teilnehmerBlobs = await this.generateTeilnehmerPDFsBlob(funkUebung);
        teilnehmerBlobs.forEach((blob, teilnehmer) => {
            zip.file(`Teilnehmer/${this.sanitizeFileName(teilnehmer)}.pdf`, blob);
        });

        // Instructor PDF
        const instructorBlob = this.generateInstructorPDFBlob(funkUebung);
        zip.file(`Uebungsleitung.pdf`, instructorBlob);

        // Nachrichtenvordrucke
        const nachrichtenvordruckBlobs = await this.generateNachrichtenvordruckPDFsBlob(funkUebung);
        nachrichtenvordruckBlobs.forEach((blob, teilnehmer) => {
            zip.file(`Nachrichtenvordruck/${this.sanitizeFileName(teilnehmer)}.pdf`, blob);
        });

        // Meldevordrucke
        const meldevordruckBlobs = await this.generateMeldevordruckPDFsBlob(funkUebung);
        meldevordruckBlobs.forEach((blob, teilnehmer) => {
            zip.file(`Meldevordruck/${this.sanitizeFileName(teilnehmer)}.pdf`, blob);
        });

        // Druck-PDF mit allen Nachrichtenvordrucken
        const allMsgPrint = await this.generateAllNachrichtenvordruckPrintBlob(funkUebung);
        zip.file(
            `Druck_Nachrichtenvordruck_A5.pdf`,
            allMsgPrint
        );

        // Druck-PDF mit allen Meldevordrucken
        const allMeldPrint = await this.generateAllMeldevordruckPrintBlob(funkUebung);
        zip.file(
            `Druck_Meldevordruck_A5.pdf`,
            allMeldPrint
        );

        // A4-Druckvorlagen hinzufügen
        const allMsgPrintA4 = await this.generateAllNachrichtenvordruckPrintA4Blob(funkUebung);
        zip.file(
            `Druck_Nachrichtenvordruck_A4.pdf`,
            allMsgPrintA4
        );

        const allMeldPrintA4 = await this.generateAllMeldevordruckPrintA4Blob(funkUebung);
        zip.file(
            `Druck_Meldevordruck_A4.pdf`,
            allMeldPrintA4
        );

        const deckblattBlob = await this.generateDeckblaetterA5Blob(funkUebung);
        zip.file(`Teilnehmer/DeckblaetterA5.pdf`, deckblattBlob);

        // Nadeldrucker: je ein A5-PDF mit allen Nachrichtenvordrucken
        const plainNachrichtBlob = await this.generatePlainNachrichtenvordruckPrintBlob(funkUebung);
        zip.file(
            `Nadeldrucker/Plain_Nachrichtenvordruck_A5.pdf`,
            plainNachrichtBlob
        );
        // Nadeldrucker: je ein A5-PDF mit allen Meldevordrucken
        const plainMeldeBlob = await this.generatePlainMeldevordruckPrintBlob(funkUebung);
        zip.file(
            `Nadeldrucker/Plain_Meldevordruck_A5.pdf`,
            plainMeldeBlob
        );

        const zipBlob = await zip.generateAsync({ type: "blob" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        const zipName = `${this.sanitizeFileName(funkUebung.name)}_${DateFormatter.formatNATODate(new Date())}.zip`;
        link.download = zipName
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    /**
     * Erstellt eine Druck-PDF mit allen Nachrichtenvordrucken inkl. Deckblatt pro Teilnehmer.
     */
    async generateAllNachrichtenvordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF('p', 'mm', 'a5');
        funkUebung.teilnehmerListe.forEach((teilnehmer: string, tIdx: number) => {
            if (tIdx > 0) pdf.addPage();
            // Deckblatt und dann Nachrichtenvordruck
            let deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
            nachrichten.forEach((nachricht: Nachricht, nIdx: number) => {
                new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht).draw();
                // add page if not last message of last participant
                if (!(tIdx === funkUebung.teilnehmerListe.length - 1 && nIdx === nachrichten.length - 1)) {
                    pdf.addPage();
                }
            });
        });
        return pdf.output('blob');
    }

    /**
     * Erstellt eine Druck-PDF mit allen Meldevordrucken inkl. Deckblatt pro Teilnehmer.
     */
    async generateAllMeldevordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF('p', 'mm', 'a5');
        funkUebung.teilnehmerListe.forEach((teilnehmer: string, tIdx: number) => {
            if (tIdx > 0) pdf.addPage();
            let deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
            nachrichten.forEach((nachricht: Nachricht, nIdx: number) => {
                let meldevordruck = new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht);
                meldevordruck.draw();
                if (!(tIdx === funkUebung.teilnehmerListe.length - 1 && nIdx === nachrichten.length - 1)) {
                    pdf.addPage();
                }
            });
        });
        return pdf.output('blob');
    }

}

// Instanz der Klasse exportieren
const pdfGenerator = new PDFGenerator();
export default pdfGenerator;
