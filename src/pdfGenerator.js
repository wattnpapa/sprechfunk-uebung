import dateFormatter, { DateFormatter } from "./DateFormatter.js";

// pdfGenerator.js
class PDFGenerator {
    constructor() {
        this.jsPDF = window.jspdf.jsPDF; // Zugriff auf jsPDF
    }

    generateTeilnehmerPDFs(funkUebung) {
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
    async generateTeilnehmerPDFsBlob(funkUebung) {
        console.log(funkUebung)
        const generierungszeit = DateFormatter.formatNATODate(funkUebung.createDate, true); // NATO-Datum für Fußzeile
        const blobMap = new Map();

        funkUebung.teilnehmerListe.forEach(teilnehmer => {

            let nachrichten = funkUebung.nachrichten[teilnehmer]

            let pdf = new this.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

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
            let tableStartY = Math.max(pdf.lastAutoTable.finalY + 10, 75);

            this.drawNachrichtenTable(pdf, nachrichten, tableStartY, pageMargin, pdfWidth, secondPageTableTopMargin);

            // **5. Setze Kopfzeilen & Seitenzahlen auf allen Seiten**
            let totalPages = pdf.internal.getNumberOfPages();
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
    async generateDeckblaetterA5Blob(funkUebung) {
        const pdf = new this.jsPDF({ orientation: "p", unit: "mm", format: "a5" });
        // Pro Teilnehmer eine Seite
        funkUebung.teilnehmerListe.forEach((teilnehmer, idx) => {
            if (idx > 0) pdf.addPage();
            this.drawDeckblattPage(pdf, funkUebung, teilnehmer);
        });
        return pdf.output("blob");
    }

    /**
     * Zeichnet einen Nachrichtenvordruck (A5 oder A4-Hälfte).
     * offsetX: 0 für volle A5-Seite oder linke A4-Hälfte, 148 für rechte A4-Hälfte.
     */
    drawNachrichtenvordruck(pdf, funkUebung, teilnehmer, nachricht, offsetX = 0) {
        const templateImageUrl = 'assets/nachrichtenvordruck4fach.png';
        const width = 148, height = 210;
        // Hintergrundbild positionieren
        pdf.addImage(templateImageUrl, 'PNG', offsetX, 0, width, height);

        // FM Zentrale
        pdf.setFontSize(16);
        pdf.text('x', offsetX + 15.4, 9);
        pdf.setFontSize(10);
        pdf.text(`${nachricht.id}`, offsetX + 125.5, 17);
        pdf.setFontSize(16);
        pdf.text('x', offsetX + 122.2, 27.5);
        // Ausgang
        pdf.text('x', offsetX + 18.6, 42.5);

        // Absender
        pdf.setFontSize(12);
        pdf.text(`${teilnehmer}`, offsetX + 44, 155);

        // Empfänger und Anschrift
        let empText = nachricht.empfaenger.includes('Alle') ? 'Alle' : nachricht.empfaenger.join(', ');
        this.adjustTextForWidth(pdf, empText, 70, offsetX + 58, 35);
        this.adjustTextForWidth(pdf, empText, 70, offsetX + 42, 55);

        // Nachricht umbrochen
        pdf.setFontSize(12);
        const lineHeight = 6.5;
        const msgLines = pdf.splitTextToSize(nachricht.nachricht, 120);
        let startY = 77;
        msgLines.forEach((line, i) => {
            pdf.text(line, offsetX + 17, startY + i * lineHeight);
        });

        // Footer (compact)
        const generierungszeit = DateFormatter.formatNATODate(funkUebung.createDate, true);
        this.drawCompactFooter(
            pdf,
            funkUebung,
            generierungszeit,
            148,
            210,
            offsetX
        );
    }

    /**
     * Erstellt eine A4-Quer-PDF mit 2 Nachrichtenvordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateAllNachrichtenvordruckPrintA4Blob(funkUebung) {
        const pdf = new this.jsPDF('l', 'mm', 'a4');
        const parts = funkUebung.teilnehmerListe;
        for (let i = 0; i < parts.length; i += 2) {
            const left = parts[i];
            const right = parts[i + 1];
            // Deckblatt-Paarseite
            if (i > 0) pdf.addPage();
            this.drawDeckblattOnA4(pdf, funkUebung, left, 'left');
            if (right) this.drawDeckblattOnA4(pdf, funkUebung, right, 'right');
            // Nachrichtenvordrucke
            const leftMsgs = funkUebung.nachrichten[left] || [];
            const rightMsgs = right ? funkUebung.nachrichten[right] || [] : [];
            const max = Math.max(leftMsgs.length, rightMsgs.length);
            for (let j = 0; j < max; j++) {
                pdf.addPage();
                if (j < leftMsgs.length) this.drawNachrichtenvordruck(pdf, funkUebung, left, leftMsgs[j], 0);
                if (right && j < rightMsgs.length) this.drawNachrichtenvordruck(pdf, funkUebung, right, rightMsgs[j], 148);
            }
        }
        return pdf.output('blob');
    }

    /**
     * Zeichnet einen Meldevordruck (A5 oder A4-Hälfte).
     * offsetX: 0 für volle A5-Seite bzw. linke A4-Hälfte, 148 für rechte A4-Hälfte.
     */
    drawMeldevordruck(pdf, funkUebung, teilnehmer, nachricht, offsetX = 0) {
        const template = 'assets/meldevordruck.png';
        const w = 148, h = 210;
        // Hintergrundbild
        pdf.addImage(template, 'PNG', offsetX, 0, w, h);

        // FM Zentrale
        pdf.setFontSize(16);
        pdf.text('x', offsetX + 109.5, 10);
        // Nummer
        pdf.setFontSize(12);
        pdf.text(`${nachricht.id}`, offsetX + 80, 12);

        // Absender
        pdf.setFontSize(16);
        this.adjustTextForWidth(pdf, teilnehmer, 70, offsetX + 22, 25);

        // Empfänger
        let emp = nachricht.empfaenger.includes('Alle') ? 'Alle' : nachricht.empfaenger.join(', ');
        this.adjustTextForWidth(pdf, emp, 70, offsetX + 22, 40);

        // Verfasser
        pdf.setFontSize(12);
        this.adjustTextForWidth(pdf, teilnehmer, 40, offsetX + 37, 192);

        // Nachricht umbrochen
        pdf.setFontSize(11.5);
        const lh = 5;
        const lines = pdf.splitTextToSize(nachricht.nachricht, 120);
        let y = 55;
        lines.forEach((l, i) => pdf.text(l, offsetX + 20, y + i * lh));

        // Footer
        const genTime = DateFormatter.formatNATODate(funkUebung.createDate, true);
        this.drawCompactFooter(
            pdf, funkUebung, genTime,
            148,
            210,
            offsetX
        );
    }

    /**
     * Erstellt eine A4-Quer-PDF mit 2 Meldevordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateAllMeldevordruckPrintA4Blob(funkUebung) {
        const pdf = new this.jsPDF('l', 'mm', 'a4');
        const parts = funkUebung.teilnehmerListe;
        for (let i = 0; i < parts.length; i += 2) {
            const left = parts[i];
            const right = parts[i + 1];
            if (i > 0) pdf.addPage();
            this.drawDeckblattOnA4(pdf, funkUebung, left, 'left');
            if (right) this.drawDeckblattOnA4(pdf, funkUebung, right, 'right');
            const leftMsgs = funkUebung.nachrichten[left] || [];
            const rightMsgs = right ? funkUebung.nachrichten[right] || [] : [];
            const max = Math.max(leftMsgs.length, rightMsgs.length);
            for (let j = 0; j < max; j++) {
                pdf.addPage();
                if (j < leftMsgs.length) this.drawMeldevordruck(pdf, funkUebung, left, leftMsgs[j], 0);
                if (right && j < rightMsgs.length) this.drawMeldevordruck(pdf, funkUebung, right, rightMsgs[j], 148);
            }
        }
        return pdf.output('blob');
    }

    /**
     * Zeichnet ein einzelnes A5-Deckblatt für einen Teilnehmer.
     */
    drawDeckblattPage(pdf, funkUebung, teilnehmer) {
        // Datum kurz z.B. "19jul25"
        const dateLine = DateFormatter
            .formatNATODate(funkUebung.datum, false)
            .replace(/\s+/g, '')
            .toLowerCase();

        // Zeilenhöhen in mm
        const lh = {
            date: 10,
            title: 12,
            owner: 10,
            rufgruppe: 10,
            blank: 8,
            hdrSection: 8,
            Leitung: 10,
            partEmpty: 10,
            hdrTeil: 4,
            teilnehmer: 4
        };

        // Gesamt-Höhe berechnen
        const n = funkUebung.teilnehmerListe.length;
        const totalH = lh.date + lh.title + lh.owner + lh.rufgruppe + lh.blank
            + lh.hdrSection + lh.Leitung + lh.partEmpty + lh.hdrTeil
            + n * lh.teilnehmer;

        // Vertikal zentrieren
        const h = pdf.internal.pageSize.getHeight();
        const w = pdf.internal.pageSize.getWidth();
        let y = (h - totalH) / 2 + lh.date / 2;
        const centerX = txt => (w - pdf.getTextWidth(txt)) / 2;

        // 1) Datum
        pdf.setFont("helvetica", "normal").setFontSize(14);
        pdf.text(dateLine, centerX(dateLine), y);
        y += lh.date;

        // 2) Titel
        pdf.setFont("helvetica", "bold").setFontSize(16);
        pdf.text(funkUebung.name, centerX(funkUebung.name), y);
        y += lh.title;

        // 3) Eigener Rufname
        pdf.setFont("helvetica", "normal").setFontSize(14);
        pdf.text(teilnehmer, centerX(teilnehmer), y);
        y += lh.owner;

        // 4) Rufgruppe
        pdf.text(funkUebung.rufgruppe, centerX(funkUebung.rufgruppe), y);
        y += lh.rufgruppe;

        // 5) Leerzeile
        y += lh.blank;

        // 6) Übungsleitung
        pdf.setFont("helvetica", "bold").setFontSize(12);
        pdf.text("Übungsleitung:", centerX("Übungsleitung:"), y);
        y += lh.hdrSection;
        pdf.setFont("helvetica", "normal").setFontSize(12);
        pdf.text(funkUebung.leitung, centerX(funkUebung.leitung), y);
        y += lh.Leitung;

        // 7) Leer vor Teilnehmer
        y += lh.partEmpty;

        // 8) Teilnehmer-Header
        pdf.setFont("helvetica", "bold").setFontSize(12);
        pdf.text("Teilnehmer:", centerX("Teilnehmer:"), y);
        y += lh.hdrTeil;

        // 9) Teilnehmerliste
        pdf.setFont("helvetica", "normal").setFontSize(8);
        funkUebung.teilnehmerListe.forEach(name => {
            pdf.text(name, centerX(name), y);
            y += lh.teilnehmer;
        });

        // 10) Zweizeiliger Footer
        const generierungszeit = DateFormatter.formatNATODate(funkUebung.createDate, true);
        pdf.setFont("helvetica", "normal").setFontSize(6);
        const line1 = `© Johannes Rudolph | Version ${funkUebung.buildVersion} | Übung ID: ${funkUebung.id}`;
        const line2 = `Generiert: ${generierungszeit} | Generator: sprechfunk-uebung.de`;
        const y2 = h - 10;
        const y1 = y2 - 4;
        pdf.textWithLink(line1, 10, y1, { url: "https://sprechfunk-uebung.de/" });
        pdf.textWithLink(line2, 10, y2, { url: "https://sprechfunk-uebung.de/" });
    }


    /**
     * Erstellt die Teilnehmerliste-Tabelle.
     */
    drawTeilnehmerTable(pdf, funkUebung, startY, marginLeft, width) {
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

        pdf.autoTable({
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
    drawNachrichtenTable(pdf, nachrichten, startY, marginLeft, pdfWidth, secondPageTableTopMargin) {
        let tableWidth = pdfWidth - 2 * marginLeft;
        let empfaengerWidth = tableWidth * 0.20;
        let lfdnrWidth = 12;
        let columnWidths = [lfdnrWidth, empfaengerWidth, tableWidth - lfdnrWidth - empfaengerWidth];

        pdf.autoTable({
            head: [["Nr.", "Empfänger", "Nachrichtentext"]],
            body: nachrichten.map(n => [n.id, n.empfaenger.join("\n"), n.nachricht]),
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

    fixEncoding(text) {
        return text.normalize("NFC") // Korrigiert Zeichensatz-Probleme
            .replace(/ /g, "\u00A0"); // Non-Breaking Space für Leerzeichen
    }

    /**
     * Erstellt die Kopfzeile der ersten Seite (größer & fett).
     */
    drawFirstPageHeader(pdf, funkUebung, teilnehmer, pdfWidth) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(`${funkUebung.name}`, pdfWidth / 2, 15, { align: "center" });

        pdf.setFontSize(14);
        pdf.text(`${teilnehmer}`, pdfWidth / 2, 20, { align: "center" });
    }

    /**
     * Erstellt die Kopfdaten-Tabelle.
     */
    drawKopfdatenTable(pdf, funkUebung, startY, marginLeft, width) {
        pdf.autoTable({
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
    drawHeader(pdf, teilnehmer, pageNumber, pdfWidth, pageMargin, funkUebung) {
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
    drawFooter(pdf, generierungszeit, funkUebung, pageNumber, totalPages, pdfWidth, pdfHeight, pageMargin) {
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

    generateNachrichtenvordruckPDFs(funkUebung) {
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
    async generateNachrichtenvordruckPDFsBlob(funkUebung) {
        const blobMap = new Map();
        funkUebung.teilnehmerListe.forEach(teilnehmer => {
            let nachrichten = funkUebung.nachrichten[teilnehmer];

            let pdf = new this.jsPDF("p", "mm", "a5");
            // Deckblatt als erste Seite
            this.drawDeckblattPage(pdf, funkUebung, teilnehmer);
            pdf.addPage();

            nachrichten.forEach((nachricht, index) => {
                this.drawNachrichtenvordruck(pdf, funkUebung, teilnehmer, nachricht);
                if (index < nachrichten.length - 1) pdf.addPage();
            });

            const totalPages = pdf.internal.getNumberOfPages();
            for (let j = 2; j <= totalPages; j++) {
                pdf.setPage(j);
            }

            const blob = pdf.output("blob");
            blobMap.set(teilnehmer, blob);
        });

        return blobMap;
    }

    generateMeldevordruckPDFs(funkUebung) {
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
    async generateMeldevordruckPDFsBlob(funkUebung) {
        const blobMap = new Map();
        funkUebung.teilnehmerListe.forEach(teilnehmer => {
            let nachrichten = funkUebung.nachrichten[teilnehmer];

            let pdf = new this.jsPDF('p', 'mm', 'a5'); // A5 Hochformat
            // Deckblatt als erste Seite
            this.drawDeckblattPage(pdf, funkUebung, teilnehmer);
            pdf.addPage();

            nachrichten.forEach((nachricht, index) => {
                this.drawMeldevordruck(pdf, funkUebung, teilnehmer, nachricht);
                if (index < nachrichten.length - 1) pdf.addPage();
            });

            const totalPages = pdf.internal.getNumberOfPages();
            for (let j = 2; j <= totalPages; j++) {
                pdf.setPage(j);
            }

            const blob = pdf.output("blob");
            blobMap.set(teilnehmer, blob);
        });

        return blobMap;
    }

    /**
     * Passt die Schriftgröße an, falls der Text nicht in die vorgegebene Breite passt.
     * Falls der Text zu lang ist, wird die Schriftgröße schrittweise verkleinert.
     */
    adjustTextForWidth(pdf, text, maxWidth, x, y) {
        let fontSize = 12;
        pdf.setFontSize(fontSize);

        while (pdf.getTextWidth(text) > maxWidth && fontSize > 7) {
            fontSize -= 0.5; // Schrittweise verkleinern
            pdf.setFontSize(fontSize);
        }

        pdf.text(text, x, y);
    }


    generateInstructorPDF(funkUebung) {
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
    generateInstructorPDFBlob(funkUebung) {
        let pdf = new this.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

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
        let tableStartY = Math.max(pdf.lastAutoTable.finalY + 10, 75);

        let tableBody = funkUebung.teilnehmerListe.map(teilnehmer => [
            teilnehmer,
            "", // Platz für Anmeldezeitpunkt
            funkUebung.loesungswoerter[teilnehmer] ? funkUebung.loesungswoerter[teilnehmer] : "", // Falls es ein Lösungswort gibt
            "" // Bemerkungen (handschriftlich eintragbar)
        ]);

        let columnWidths = [60, 35, 60, 120]; // Anpassung für saubere Darstellung

        pdf.autoTable({
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
        let alleNachrichten = [];
        funkUebung.teilnehmerListe.forEach(sender => {
            let nachrichten = funkUebung.nachrichten[sender];
            if (!Array.isArray(nachrichten)) return;
            nachrichten.forEach((nachricht, index) => {
                alleNachrichten.push({
                    nr: index + 1,
                    sender,
                    empfaenger: nachricht.empfaenger.join("\n"),
                    nachricht: nachricht.nachricht
                });
            });
        });

        // Sortieren: zuerst nach Nr, dann Sender
        alleNachrichten.sort((a, b) => a.nr - b.nr || a.sender.localeCompare(b.sender));

        // Tabelle vorbereiten
        const tableData = alleNachrichten.map(n => [n.nr, n.sender, n.empfaenger, n.nachricht, ""]);

        let tableWidth = pdfWidth - 2 * pageMargin;
        let empfaengerWidth = tableWidth * 0.20;
        let lfdnrWidth = 12;
        let withCheckBox = 12;
        let columnWidthsAll = [lfdnrWidth, empfaengerWidth, empfaengerWidth, tableWidth - lfdnrWidth - (empfaengerWidth * 2) - withCheckBox];

        // Neuen Y-Startpunkt nach der Teilnehmer-Tabelle
        pdf.addPage();
        let nextTableStartY = secondPageTableTopMargin;

        let lastNrValue = null;

        pdf.autoTable({
            head: [["Nr", "Sender", "Empfänger", "Nachricht", "Zeit"]],
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
            didDrawCell: function (data) {
                if (data.section === 'body' && data.column.index === 0) {
                    const currentNr = data.cell.raw;

                    if (currentNr !== lastNrValue) {
                        lastNrValue = currentNr;

                        const startX = data.cell.x;
                        const endX = startX + data.cell.width + data.table.columns.slice(1).reduce((sum, col) => sum + col.width, 0);
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
        let totalPages = pdf.internal.getNumberOfPages();
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
    drawTeilnehmerInhalte(pdf, uebung) {
        pdf.setFontSize(12);
        pdf.text(`Teilnehmer: ${uebung.teilnehmer}`, 20, 30);
        pdf.text(`Rufgruppe: ${uebung.kopfdaten.rufgruppe}`, 20, 40);
    }

    /**
     * Zeichnet die Kopfdaten für die Übungsleitung.
     */
    drawKopfdaten(pdf, kopfdaten) {
        pdf.autoTable({
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
    drawTeilnehmerListe(pdf, jsonUebungsDaten) {
        let tableBody = jsonUebungsDaten.map(t => [t.teilnehmer, "", t.loesungswort || "", ""]);
        pdf.autoTable({
            head: [["Teilnehmer", "Anmeldung", "Lösungswort", "Bemerkungen"]],
            body: tableBody,
            startY: 60,
            theme: "grid",
            styles: { fontSize: 10 }
        });
    }

    drawCompactFooter(pdf, funkUebung, generierungszeit, pdfWidth, pdfHeight, offsetX = 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);

        pdf.text(funkUebung.name, offsetX + (pdfWidth / 2), 4, { align: "center" });

        // Hinweis ganz unten (5 mm Abstand vom unteren Rand)
        pdf.text("Wörter in GROSSBUCHSTABEN müssen buchstabiert werden.", offsetX + (pdfWidth / 2), pdfHeight - 1.5, { align: "center" });

        // Trennlinie direkt darüber (bei 7 mm Abstand vom unteren Rand)
        pdf.setDrawColor(0);

        // Vertikaler Text (90° gedreht) an der rechten Seite (5 mm vom rechten Rand)
        pdf.setFontSize(6);
        let rightText = `© Johannes Rudolph | Version ${funkUebung.buildVersion} | Übung ID: ${funkUebung.id} | Generiert: ${generierungszeit} | Generator: https://sprechfunk-uebung.de/`;
        pdf.text(rightText, pdfWidth - 3 + offsetX, pdfHeight - 5, { angle: 90, align: "left" });
    }

    sanitizeFileName(name) {
        return name.replace(/[\/\\:*?"<>|]/g, "-");
    }

    async generateAllPDFsAsZip(funkUebung) {
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
            zip.file(`Teilnehmer/Nachrichtenvordruck/${this.sanitizeFileName(teilnehmer)}.pdf`, blob);
        });

        // Meldevordrucke
        const meldevordruckBlobs = await this.generateMeldevordruckPDFsBlob(funkUebung);
        meldevordruckBlobs.forEach((blob, teilnehmer) => {
            zip.file(`Teilnehmer/Meldevordruck/${this.sanitizeFileName(teilnehmer)}.pdf`, blob);
        });

        // Druck-PDF mit allen Nachrichtenvordrucken
        const allMsgPrint = await this.generateAllNachrichtenvordruckPrintBlob(funkUebung);
        zip.file(
            `Teilnehmer/Nachrichtenvordruck/Druck_Nachrichtenvordruck_A5.pdf`,
            allMsgPrint
        );

        // Druck-PDF mit allen Meldevordrucken
        const allMeldPrint = await this.generateAllMeldevordruckPrintBlob(funkUebung);
        zip.file(
            `Teilnehmer/Meldevordruck/Druck_Meldevordruck_A5.pdf`,
            allMeldPrint
        );

        // A4-Druckvorlagen hinzufügen
        const allMsgPrintA4 = await this.generateAllNachrichtenvordruckPrintA4Blob(funkUebung);
        zip.file(
            `Teilnehmer/Nachrichtenvordruck/Druck_Nachrichtenvordruck_A4.pdf`,
            allMsgPrintA4
        );

        const allMeldPrintA4 = await this.generateAllMeldevordruckPrintA4Blob(funkUebung);
        zip.file(
            `Teilnehmer/Meldevordruck/Druck_Meldevordruck_A4.pdf`,
            allMeldPrintA4
        );

        const deckblattBlob = await this.generateDeckblaetterA5Blob(funkUebung);
        zip.file(`Teilnehmer/DeckblaetterA5.pdf`, deckblattBlob);

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
    async generateAllNachrichtenvordruckPrintBlob(funkUebung) {
        const pdf = new this.jsPDF('p', 'mm', 'a5');
        funkUebung.teilnehmerListe.forEach((teilnehmer, tIdx) => {
            if (tIdx > 0) pdf.addPage();
            // Deckblatt und dann Nachrichtenvordruck
            this.drawDeckblattPage(pdf, funkUebung, teilnehmer);
            pdf.addPage();
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
            nachrichten.forEach((nachricht, nIdx) => {
                this.drawNachrichtenvordruck(pdf, funkUebung, teilnehmer, nachricht);
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
    async generateAllMeldevordruckPrintBlob(funkUebung) {
        const pdf = new this.jsPDF('p', 'mm', 'a5');
        funkUebung.teilnehmerListe.forEach((teilnehmer, tIdx) => {
            if (tIdx > 0) pdf.addPage();
            this.drawDeckblattPage(pdf, funkUebung, teilnehmer);
            pdf.addPage();
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
            nachrichten.forEach((nachricht, nIdx) => {
                this.drawMeldevordruck(pdf, funkUebung, teilnehmer, nachricht);
                if (!(tIdx === funkUebung.teilnehmerListe.length - 1 && nIdx === nachrichten.length - 1)) {
                    pdf.addPage();
                }
            });
        });
        return pdf.output('blob');
    }



    /**
        * Zeichnet ein A5-Deckblatt auf A4 Quer (2x A5) links oder rechts.
        */
    drawDeckblattOnA4(pdf, funkUebung, teilnehmer, side) {
        const offsetX = side === 'right' ? 148 : 0;
        const halfWidth = 148;
        const halfHeight = 210;
        // Zeilenhöhen analog A5
        const lh = {
            date: 10,
            title: 12,
            owner: 10,
            rufgruppe: 10,
            blank: 8,
            hdrSection: 8,
            Leitung: 10,
            partEmpty: 10,
            hdrTeil: 4,
            teilnehmer: 4
        };
        // Gesamt-Höhe analog A5
        const n = funkUebung.teilnehmerListe.length;
        const totalH = lh.date + lh.title + lh.owner + lh.rufgruppe + lh.blank
            + lh.hdrSection + lh.Leitung + lh.partEmpty + lh.hdrTeil
            + n * lh.teilnehmer;
        let y = (halfHeight - totalH) / 2 + lh.date / 2;
        const centerX = txt => offsetX + (halfWidth - pdf.getTextWidth(txt)) / 2;
        // Datum
        const dateLine = DateFormatter.formatNATODate(funkUebung.datum, false)
            .replace(/\s+/g, '').toLowerCase();
        pdf.setFont("helvetica", "normal").setFontSize(14);
        pdf.text(dateLine, centerX(dateLine), y);
        y += lh.date;
        // Titel
        pdf.setFont("helvetica", "bold").setFontSize(16);
        pdf.text(funkUebung.name, centerX(funkUebung.name), y);
        y += lh.title;
        // Rufname
        pdf.setFont("helvetica", "normal").setFontSize(14);
        pdf.text(teilnehmer, centerX(teilnehmer), y);
        y += lh.owner;
        // Rufgruppe
        pdf.text(funkUebung.rufgruppe, centerX(funkUebung.rufgruppe), y);
        y += lh.rufgruppe;
        // Leer
        y += lh.blank;
        // Übungsleitung
        pdf.setFont("helvetica", "bold").setFontSize(12);
        pdf.text("Übungsleitung:", centerX("Übungsleitung:"), y);
        y += lh.hdrSection;
        pdf.setFont("helvetica", "normal").setFontSize(12);
        pdf.text(funkUebung.leitung, centerX(funkUebung.leitung), y);
        y += lh.Leitung;
        // Leer vor Teilnehmer
        y += lh.partEmpty;
        // Teilnehmer-Header
        pdf.setFont("helvetica", "bold").setFontSize(12);
        pdf.text("Teilnehmer:", centerX("Teilnehmer:"), y);
        y += lh.hdrTeil;
        // Teilnehmerliste
        pdf.setFont("helvetica", "normal").setFontSize(8);
        funkUebung.teilnehmerListe.forEach(name => {
            pdf.text(name, centerX(name), y);
            y += lh.teilnehmer;
        });
    }
}

// Instanz der Klasse exportieren
const pdfGenerator = new PDFGenerator();
export default pdfGenerator;
