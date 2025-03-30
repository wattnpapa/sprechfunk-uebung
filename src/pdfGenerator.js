import dateFormatter, { DateFormatter } from "./DateFormatter.js";

// pdfGenerator.js
class PDFGenerator {
    constructor() {
        this.jsPDF = window.jspdf.jsPDF; // Zugriff auf jsPDF
    }

    /**
     * Erstellt die Teilnehmer PDFs.
     */
    generateTeilnehmerPDFs(funkUebung) {
        const generierungszeit = DateFormatter.formatNATODate(new Date()); // NATO-Datum für Fußzeile

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
                this.drawFooter(pdf, generierungszeit, funkUebung.buildVersion, j, totalPages, pdfWidth, pdfHeight, pageMargin);
            }

            // **6. PDF speichern**
            pdf.save(`${teilnehmer}.pdf`);
        });

        alert("Alle Teilnehmer PDFs wurden erfolgreich erstellt!");
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
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5 },
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
            margin: { left: marginLeft, top: secondPageTableTopMargin, bottom: 20},
            tableWidth: tableWidth,
            columnStyles: {
                0: { cellWidth: columnWidths[0] },
                1: { cellWidth: columnWidths[1] },
                2: { cellWidth: columnWidths[2] }
            },
            styles: { fontSize: 10, cellPadding: 1.5, lineWidth: 0.5 },
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
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5 },
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
            let rightText = funkUebung.name + " - " + DateFormatter.formatNATODate(funkUebung.datum,false)
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
    drawFooter(pdf, generierungszeit, softwareVersion, pageNumber, totalPages, pdfWidth, pdfHeight, pageMargin) {
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
        let leftText = `© Johannes Rudolph | Version ${softwareVersion} | Generiert: ${generierungszeit} | Generator: https://wattnpapa.github.io/sprechfunk-uebung`;
        pdf.textWithLink(leftText, pageMargin, pdfHeight - 10, { url: "https://wattnpapa.github.io/sprechfunk-uebung/" });
    }

    /**
     * Erstellt die Nachrichtenvordruck PDFs.
     */
    generateNachrichtenvordruckPDFs(funkUebung) {
        const templateImageUrl = 'assets/nachrichtenvordruck4fach.png';
        const maxWidth = 120; // Maximale Breite für die Nachricht
        const maxWidthAnschrift = 70; // Maximale Breite für Anschrift
        const maxWidthRufname = 70; // Maximale Breite für Rufname der Gegenstelle
        funkUebung.teilnehmerListe.forEach(teilnehmer => {
            let nachrichten = funkUebung.nachrichten[teilnehmer];

            let pdf = new this.jsPDF("p", "mm", "a5");

            nachrichten.forEach((nachricht, index) => {
                pdf.addImage(templateImageUrl, "PNG", 0, 0, 148, 210);

                //FM Zentrale ausfüllen
                pdf.setFontSize(16);
                pdf.text("x", 15.4, 9) // "x" Funk

                pdf.setFontSize(10);
                pdf.text(`${nachricht.id}`, 125.5, 17); //TBB Nummer
                pdf.setFontSize(16);
                pdf.text("x", 122.2, 27.5) // "x" Funk

                //Ausgang
                pdf.setFontSize(16);
                pdf.text("x", 18.6, 42.5) // "x" Funk

                pdf.setFontSize(12);
                //Absender               
                pdf.text(`${teilnehmer}`, 44, 155);


                let empfaengerText = nachricht.empfaenger.includes("Alle") ? "Alle" : nachricht.empfaenger.join(", ");
                //Rufname
                this.adjustTextForWidth(pdf, empfaengerText, maxWidthRufname, 58, 35);
                //Anschrift
                this.adjustTextForWidth(pdf, empfaengerText, maxWidthAnschrift, 42, 55);


                // Nachricht (Umbrechen)
                pdf.setFontSize(12);
                const lineHeight = 6.5; // z. B. 6pt Abstand
                const messageLines = pdf.splitTextToSize(nachricht.nachricht, maxWidth);

                let startY = 77;
                messageLines.forEach((line, i) => {
                    pdf.text(line, 17, startY + i * lineHeight);
                });


                if (index < nachrichten.length - 1) pdf.addPage();
            });

            pdf.save(`Nachrichtenvordruck_${teilnehmer}.pdf`);
        });

        alert("Alle Nachrichtenvordruck PDFs wurden erfolgreich erstellt!");
    }

    /**
     * Erstellt die Meldevordruck PDFs für alle Teilnehmer.
     */
    generateMeldevordruckPDFs(funkUebung) {
        const templateImageUrl = 'assets/meldevordruck.png';
        const maxWidth = 120; // Maximale Breite für die Nachricht
        const maxWidthAnschrift = 70; // Maximale Breite für Anschrift
        const maxWidthRufname = 70; // Maximale Breite für Rufname der Gegenstelle

        funkUebung.teilnehmerListe.forEach(teilnehmer => {
            let nachrichten = funkUebung.nachrichten[teilnehmer];

            let pdf = new this.jsPDF('p', 'mm', 'a5'); // A5 Hochformat

            nachrichten.forEach((nachricht, index) => {
                // Füge das Hintergrundbild (Vorlage) auf jeder Seite hinzu
                pdf.addImage(templateImageUrl, 'PNG', 0, 0, 148, 210);

                //FM Zentrale ausfüllen
                pdf.setFontSize(16);
                pdf.text("x", 109.5, 10) // "x" Funk

                pdf.setFontSize(12);
                pdf.text(`${nachricht.id}`, 80, 12); //Nr

                //Absender  
                pdf.setFontSize(16);                             
                this.adjustTextForWidth(pdf, teilnehmer, maxWidthAnschrift, 22, 25);

                // Empfänger
                pdf.setFontSize(16);
                let empfaengerText = nachricht.empfaenger.includes("Alle") ? "Alle" : nachricht.empfaenger.join(", ");
                this.adjustTextForWidth(pdf, empfaengerText, maxWidthAnschrift, 22, 40);

                //Verfasser        
                pdf.setFontSize(12);                       
                this.adjustTextForWidth(pdf, teilnehmer, maxWidthAnschrift, 37, 192);
            
                // Nachricht (Umbrechen)
                pdf.setFontSize(11.5);
                const lineHeight = 5; // z. B. 6pt Abstand
                const messageLines = pdf.splitTextToSize(nachricht.nachricht, maxWidth);

                let startY = 55;
                messageLines.forEach((line, i) => {
                    pdf.text(line, 20, startY + i * lineHeight);
                });

                // Falls nicht die letzte Nachricht, füge eine neue Seite hinzu
                if (index < nachrichten.length - 1) {
                    pdf.addPage();
                    pdf.addImage(templateImageUrl, 'PNG', 0, 0, 148, 210);
                }
            });

            pdf.save(`Meldevordruck_${teilnehmer}.pdf`);
        });

        alert("Meldevordruck PDFs wurden erfolgreich erstellt!");
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

    /**
     * Erstellt das PDF für die Übungsleitung.
     */
    generateInstructorPDF(funkUebung) {
        let pdf = new this.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const pageMargin = 10;
        const firstTableStartY = 30;
        const secondPageTableTopMargin = 30; // **Garantierter Abstand für Tabellen auf Seite 2+**
        const generierungszeit = DateFormatter.formatNATODate(new Date());

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
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.5 },
            headStyles: { fillColor: [200, 200, 200] }
        });

        // **4. Kopf- und Fußzeilen für alle Seiten**
        let totalPages = pdf.internal.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            pdf.setPage(j);
            this.drawHeader(pdf, "Übungsleitung", j, pdfWidth, pageMargin, funkUebung);
            this.drawFooter(pdf, generierungszeit, funkUebung.buildVersion, j, totalPages, pdfWidth, pdfHeight, pageMargin);
        }

        pdf.save("Uebungsleitung.pdf");
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

}

// Instanz der Klasse exportieren
const pdfGenerator = new PDFGenerator();
export default pdfGenerator;