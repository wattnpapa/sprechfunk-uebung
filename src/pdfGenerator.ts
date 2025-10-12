import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Nachricht } from './types/Nachricht';

import JSZip from "jszip";
import { DeckblattTeilnehmer } from "./pdf/DeckblattTeilnehmer.js";
import { FunkUebung } from "./FunkUebung.js";
import { Meldevordruck } from "./pdf/Meldevordruck.js";
import { Nachrichtenvordruck } from "./pdf/Nachrichtenvordruck.js";
import { Teilnehmer } from "./pdf/Teilnehmer.js";
import { Uebungsleitung } from "./pdf/Uebungsleitung.js";
import { DateFormatter } from './DateFormatter';

class PDFGenerator {
    constructor() {
        if (typeof (jsPDF as any).API.autoTable !== "function") {
            // @ts-expect-error Plugin-Binding für jsPDF
            autoTable(jsPDF);
        }
    }

    generateTeilnehmerPDFs(funkUebung: FunkUebung): void {
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
    async generateTeilnehmerPDFsBlob(funkUebung: FunkUebung): Promise<Map<string, Blob>> {
        const blobMap = new Map();

        funkUebung.teilnehmerListe.forEach(teilnehmer => {

            let nachrichten = funkUebung.nachrichten[teilnehmer]

            let pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

            let teilnehmerPdf = new Teilnehmer(teilnehmer, funkUebung, pdf);
            teilnehmerPdf.draw();
            
            const blob = teilnehmerPdf.blob()
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

    generateInstructorPDF(funkUebung: FunkUebung) {
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
    generateInstructorPDFBlob(funkUebung: FunkUebung) {
        let pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        let uebungsLeitung = new Uebungsleitung(funkUebung, pdf); 
        uebungsLeitung.draw();   

        return uebungsLeitung.blob();
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
