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
        // 1) Ein einziges jsPDF für alle Seiten
        const pdf = new this.jsPDF({ orientation: "p", unit: "mm", format: "a5" });
        const w = pdf.internal.pageSize.getWidth();
        const h = pdf.internal.pageSize.getHeight();

        // Generierungszeit für Footer
        const generierungszeit = DateFormatter.formatNATODate(funkUebung.createDate, true);

        // Hilfsfunktion: Zeichne ein einzelnes Deckblatt auf aktuelle Seite
        const drawDeckblatt = (teilnehmer) => {
            // Datum kurz z.B. "19jul25"
            const dateLine = DateFormatter
                .formatNATODate(funkUebung.datum, false)
                .replace(/\s+/g, '')
                .toLowerCase();

            // Zeilenhöhen (angepasst)
            const lh = {
                title:       12,
                date:        10,
                owner:       10,
                blank:       8,
                hdrSection:  8,
                Leitung:     10,
                partEmpty:   10,
                hdrTeil:     4,
                teilnehmer:  4
            };

            // Berechne Blockhöhe
            const n = funkUebung.teilnehmerListe.length;
            const totalH = lh.title + lh.date + lh.owner + lh.blank
                        + lh.hdrSection + lh.Leitung + lh.partEmpty
                        + lh.hdrTeil + n*lh.teilnehmer;

            // Starte vertikal zentriert
            let y = (h - totalH)/2 + lh.title/2;
            const centerX = txt => (w - pdf.getTextWidth(txt)) / 2;

            // –– Zeichnungsschritte ––
            // 1) Titel
            pdf.setFont("helvetica", "bold").setFontSize(16);
            pdf.text(funkUebung.name, centerX(funkUebung.name), y);
            y += lh.title;

            // 2) Datum
            pdf.setFont("helvetica", "normal").setFontSize(14);
            pdf.text(dateLine, centerX(dateLine), y);
            y += lh.date;

            // 3) Eigener Rufname
            pdf.text(teilnehmer, centerX(teilnehmer), y);
            y += lh.owner;

            // 4) Leer
            y += lh.blank;

            // 5) Übungsleitung
            pdf.setFont("helvetica", "bold").setFontSize(12);
            pdf.text("Übungsleitung:", centerX("Übungsleitung:"), y);
            y += lh.hdrSection;
            pdf.setFont("helvetica", "normal").setFontSize(12);
            pdf.text(funkUebung.leitung, centerX(funkUebung.leitung), y);
            y += lh.Leitung;

            // 6) Leer vor Teilnehmer
            y += lh.partEmpty;

            // 7) Teilnehmer-Header
            pdf.setFont("helvetica", "bold").setFontSize(12);
            pdf.text("Teilnehmer:", centerX("Teilnehmer:"), y);
            y += lh.hdrTeil;

            // 8) Teilnehmerliste (klein, eng)
            pdf.setFont("helvetica", "normal").setFontSize(8);
            funkUebung.teilnehmerListe.forEach(name => {
                pdf.text(name, centerX(name), y);
                y += lh.teilnehmer;
            });

            // 9) Zweizeiliger Footer
            pdf.setFont("helvetica", "normal").setFontSize(6);
            const line1 = `© Johannes Rudolph | Version ${funkUebung.buildVersion} | Übung ID: ${funkUebung.id}`;
            const line2 = `Generiert: ${generierungszeit} | Generator: sprechfunk-uebung.de`;
            const y2 = h - 10;
            const y1 = y2 - 4;
            pdf.textWithLink(line1, 10, y1, { url: "https://sprechfunk-uebung.de/" });
            pdf.textWithLink(line2, 10, y2, { url: "https://sprechfunk-uebung.de/" });
        };

        // 2) Pro Teilnehmer eine Seite erzeugen
        funkUebung.teilnehmerListe.forEach((teilnehmer, idx) => {
            if (idx > 0) pdf.addPage();
            drawDeckblatt(teilnehmer);
        });

        // 3) Einen einzigen Blob zurückgeben
        return pdf.output("blob");
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
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.1 , lineColor: [0, 0, 0] },
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
            styles: { fontSize: 10, cellPadding: 1.5, lineWidth: 0.1 , lineColor: [0, 0, 0] },
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
            styles: { fontSize: 10, cellPadding: 3, lineWidth: 0.1 , lineColor: [0, 0, 0] },
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
        const templateImageUrl = 'assets/nachrichtenvordruck4fach.png';
        const maxWidth = 120; // Maximale Breite für die Nachricht
        const maxWidthAnschrift = 70; // Maximale Breite für Anschrift
        const maxWidthRufname = 70; // Maximale Breite für Rufname der Gegenstelle
        const blobMap = new Map();
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
            
            const totalPages = pdf.internal.getNumberOfPages();
            for (let j = 1; j <= totalPages; j++) {
                pdf.setPage(j);
                this.drawCompactFooter(pdf, funkUebung, DateFormatter.formatNATODate(funkUebung.createDate), pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 10);
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
        const templateImageUrl = 'assets/meldevordruck.png';
        const maxWidth = 120; // Maximale Breite für die Nachricht
        const maxWidthAnschrift = 70; // Maximale Breite für Anschrift
        const maxWidthRufname = 70; // Maximale Breite für Rufname der Gegenstelle
        const maxWidthVerfasser = 40; // Maximale Breite für Rufname der Gegenstelle
        const blobMap = new Map();
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
                this.adjustTextForWidth(pdf, teilnehmer, maxWidthVerfasser, 37, 192);
            
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

            const totalPages = pdf.internal.getNumberOfPages();
            for (let j = 1; j <= totalPages; j++) {
                pdf.setPage(j);
                this.drawCompactFooter(pdf, funkUebung, DateFormatter.formatNATODate(funkUebung.createDate), pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 10);
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
            styles: { fontSize: tableFontSize, cellPadding: 3, lineWidth: 0.1 , lineColor: [0, 0, 0] },
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
        let columnWidthsAll = [lfdnrWidth, empfaengerWidth, empfaengerWidth, tableWidth - lfdnrWidth - (empfaengerWidth * 2)- withCheckBox];
        
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

    drawCompactFooter(pdf, funkUebung, generierungszeit, pdfWidth, pdfHeight, pageMargin) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);


        pdf.text(funkUebung.name, pdf.internal.pageSize.getWidth() / 2, 4, { align: "center" });
    
        // Hinweis ganz unten (5 mm Abstand vom unteren Rand)
        pdf.text("Wörter in GROSSBUCHSTABEN müssen buchstabiert werden.", pdfWidth / 2, pdfHeight - 1.5, { align: "center" });
        
        // Trennlinie direkt darüber (bei 7 mm Abstand vom unteren Rand)
        pdf.setDrawColor(0);
        
        // Vertikaler Text (90° gedreht) an der rechten Seite (5 mm vom rechten Rand)
        pdf.setFontSize(6);
        let rightText = `© Johannes Rudolph | Version ${funkUebung.buildVersion} | Übung ID: ${funkUebung.id} | Generiert: ${generierungszeit} | Generator: https://sprechfunk-uebung.de/`;
        pdf.text(rightText, pdfWidth - 3, pdfHeight-5, { angle: 90, align: "left" });
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

}

// Instanz der Klasse exportieren
const pdfGenerator = new PDFGenerator();
export default pdfGenerator;