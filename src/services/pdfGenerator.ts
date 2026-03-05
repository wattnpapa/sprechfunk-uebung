/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import type { Nachricht } from "../types/Nachricht";

import { DeckblattTeilnehmer } from "../pdf/DeckblattTeilnehmer.js";
import { FunkUebung } from "../models/FunkUebung.js";
import { Meldevordruck } from "../pdf/Meldevordruck.js";
import { Nachrichtenvordruck } from "../pdf/Nachrichtenvordruck.js";
import { Teilnehmer } from "../pdf/Teilnehmer.js";
import { Uebungsleitung } from "../pdf/Uebungsleitung.js";
import { uiFeedback } from "../core/UiFeedback";
import { UebungsleitungStorage } from "../types/Storage";
import { generateTeilnehmerDebriefPdfBlob } from "./pdfDebriefService";
import {
    generateAllMeldevordruckPrintA4Blob,
    generateAllNachrichtenvordruckPrintA4Blob,
    generateMeldevordruckA4PDFsBlob,
    generateNachrichtenvordruckA4PDFsBlob
} from "./pdfA4Service";
import {
    createZipDownloadName,
    generateAllPDFsAsZipBlob,
    generateTeilnehmerPDFsAsZipBlob
} from "./pdfZipService";

class PDFGenerator {
    constructor() {
        if (typeof (jsPDF as any).API.autoTable !== "function") {
            applyPlugin(jsPDF);
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

            uiFeedback.success("Alle Teilnehmer PDFs wurden erfolgreich erstellt.");
        });
    }

    /**
     * Erstellt die Teilnehmer PDFs.
     */
    async generateTeilnehmerPDFsBlob(funkUebung: FunkUebung): Promise<Map<string, Blob>> {
        const blobMap = new Map();

        funkUebung.teilnehmerListe.forEach(teilnehmer => {
            const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

            const teilnehmerPdf = new Teilnehmer(teilnehmer, funkUebung, pdf);
            teilnehmerPdf.draw();

            const blob = teilnehmerPdf.blob();
            blobMap.set(teilnehmer, blob);
        });

        return blobMap;
    }

    async generateTeilnehmerDebriefPdfBlob(
        funkUebung: FunkUebung,
        storage: UebungsleitungStorage,
        teilnehmer: string
    ): Promise<Blob> {
        return generateTeilnehmerDebriefPdfBlob(funkUebung, storage, teilnehmer);
    }

    /**
     * Erstellt eine A4-Quer-PDF mit 2 Nachrichtenvordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateAllNachrichtenvordruckPrintA4Blob(funkUebung: FunkUebung): Promise<Blob> {
        return generateAllNachrichtenvordruckPrintA4Blob(funkUebung);
    }

    /**
     * Erstellt eine A4-Quer-PDF mit 2 Meldevordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateAllMeldevordruckPrintA4Blob(funkUebung: FunkUebung): Promise<Blob> {
        return generateAllMeldevordruckPrintA4Blob(funkUebung);
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

            uiFeedback.success("Alle Nachrichtenvordruck PDFs wurden erfolgreich erstellt.");
        });
    }

    /**
     * Erstellt die Nachrichtenvordruck PDFs.
     */
    async generateNachrichtenvordruckPDFsBlob(funkUebung: FunkUebung, hideBackground = false, hideFooter = false): Promise<Map<string, Blob>> {
        const blobMap = new Map();
        funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];

            const pdf = new jsPDF("p", "mm", "a5");
            // Deckblatt als erste Seite
            const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();

            nachrichten.forEach((nachricht: Nachricht, index: number) => {
                new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
                if (index < nachrichten.length - 1) {
                    pdf.addPage();
                }
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

    async generateNachrichtenvordruckPDFForTeilnehmer(
        funkUebung: FunkUebung,
        teilnehmer: string,
        hideBackground = false,
        hideFooter = false
    ): Promise<{ blob: Blob; totalPages: number }> {
        const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
        const pdf = new jsPDF("p", "mm", "a5");
        const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
        deckblatt.draw();
        pdf.addPage();

        nachrichten.forEach((nachricht: Nachricht, index: number) => {
            new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
            if (index < nachrichten.length - 1) {
                pdf.addPage();
            }
        });

        const totalPages = (pdf as any).getNumberOfPages();
        for (let j = 2; j <= totalPages; j++) {
            pdf.setPage(j);
        }

        return { blob: pdf.output("blob"), totalPages };
    }

    async generateNachrichtenvordruckPageBlob(options: {
        funkUebung: FunkUebung;
        teilnehmer: string;
        page: number;
        hideBackground?: boolean;
        hideFooter?: boolean;
    }): Promise<Blob> {
        const {
            funkUebung,
            teilnehmer,
            page,
            hideBackground = false,
            hideFooter = false
        } = options;
        const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
        const totalPages = nachrichten.length;
        if (page < 1 || page > totalPages) {
            throw new Error("Ungültige Seite");
        }

        const pdf = new jsPDF("p", "mm", "a5");
        const msg = nachrichten[page - 1];
        if (!msg) {
            throw new Error("Nachricht nicht gefunden");
        }
        new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, msg, hideBackground, hideFooter).draw();

        return pdf.output("blob");
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

            uiFeedback.success("Alle Meldevordruck PDFs wurden erfolgreich erstellt.");
        });
    }

    /**
     * Erstellt die Meldevordruck PDFs für alle Teilnehmer.
     */
    async generateMeldevordruckPDFsBlob(funkUebung: FunkUebung, hideBackground = false, hideFooter = false): Promise<Map<string, Blob>> {
        const blobMap = new Map();
        funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];

            const pdf = new jsPDF("p", "mm", "a5"); // A5 Hochformat
            // Deckblatt als erste Seite
            const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();

            nachrichten.forEach((nachricht: Nachricht, index: number) => {
                new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
                if (index < nachrichten.length - 1) {
                    pdf.addPage();
                }
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

    async generateMeldevordruckPDFForTeilnehmer(
        funkUebung: FunkUebung,
        teilnehmer: string,
        hideBackground = false,
        hideFooter = false
    ): Promise<{ blob: Blob; totalPages: number }> {
        const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
        const pdf = new jsPDF("p", "mm", "a5");
        const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
        deckblatt.draw();
        pdf.addPage();

        nachrichten.forEach((nachricht: Nachricht, index: number) => {
            new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
            if (index < nachrichten.length - 1) {
                pdf.addPage();
            }
        });

        const totalPages = (pdf as any).getNumberOfPages();
        for (let j = 2; j <= totalPages; j++) {
            pdf.setPage(j);
        }

        return { blob: pdf.output("blob"), totalPages };
    }

    async generateMeldevordruckPageBlob(options: {
        funkUebung: FunkUebung;
        teilnehmer: string;
        page: number;
        hideBackground?: boolean;
        hideFooter?: boolean;
    }): Promise<Blob> {
        const {
            funkUebung,
            teilnehmer,
            page,
            hideBackground = false,
            hideFooter = false
        } = options;
        const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
        const totalPages = nachrichten.length;
        if (page < 1 || page > totalPages) {
            throw new Error("Ungültige Seite");
        }

        const pdf = new jsPDF("p", "mm", "a5");
        const msg = nachrichten[page - 1];
        if (!msg) {
            throw new Error("Nachricht nicht gefunden");
        }
        new Meldevordruck(teilnehmer, funkUebung, pdf, msg, hideBackground, hideFooter).draw();

        return pdf.output("blob");
    }

    generateInstructorPDF(funkUebung: FunkUebung) {
        const blob = this.generateInstructorPDFBlob(funkUebung);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Uebungsleitung.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    /**
     * Erstellt das PDF für die Übungsleitung.
     */
    generateInstructorPDFBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

        const uebungsLeitung = new Uebungsleitung(funkUebung, pdf);
        uebungsLeitung.draw();

        return uebungsLeitung.blob();
    }

    sanitizeFileName(name: string) {
        return name.replace(/[/\\:*?"<>|]/g, "-");
    }

    /**
     * Erstellt ein A5-PDF mit allen Nachrichtenvordrucken (plain, ohne Hintergrund & Fußzeile),
     * jeweils mit Deckblatt als Trennblatt.
     */
    async generatePlainNachrichtenvordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5" });
        funkUebung.teilnehmerListe.forEach((teilnehmer, tIdx) => {
            if (tIdx > 0) {
                pdf.addPage();
            }
            // Deckblatt als Trennblatt
            const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();
            const msgs = funkUebung.nachrichten[teilnehmer] || [];
            msgs.forEach((nachricht, nIdx) => {
                new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht, true, true).draw();
                if (nIdx < msgs.length - 1) {
                    pdf.addPage();
                }
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
            if (tIdx > 0) {
                pdf.addPage();
            }
            const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();
            const msgs = funkUebung.nachrichten[teilnehmer] || [];
            msgs.forEach((nachricht: Nachricht, nIdx: number) => {
                const meldevordruck = new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht, true, true);
                meldevordruck.draw();
                if (nIdx < msgs.length - 1) {
                    pdf.addPage();
                }
            });
        });
        return pdf.output("blob");
    }


    async generateNachrichtenvordruckA4PDFsBlob(funkUebung: FunkUebung) {
        return generateNachrichtenvordruckA4PDFsBlob(funkUebung);
    }

    /**
     * Erstellt die Meldevordruck-PDFs im A4-Querformat mit 2 Meldevordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateMeldevordruckA4PDFsBlob(funkUebung: FunkUebung) {
        return generateMeldevordruckA4PDFsBlob(funkUebung);
    }

    async generateAllPDFsAsZip(funkUebung: FunkUebung) {
        const zipBlob = await generateAllPDFsAsZipBlob(funkUebung, {
            sanitizeFileName: this.sanitizeFileName,
            generateTeilnehmerPDFsBlob: this.generateTeilnehmerPDFsBlob.bind(this),
            generateInstructorPDFBlob: this.generateInstructorPDFBlob.bind(this),
            generateNachrichtenvordruckPDFsBlob: this.generateNachrichtenvordruckPDFsBlob.bind(this),
            generateNachrichtenvordruckA4PDFsBlob: this.generateNachrichtenvordruckA4PDFsBlob.bind(this),
            generateMeldevordruckPDFsBlob: this.generateMeldevordruckPDFsBlob.bind(this),
            generateMeldevordruckA4PDFsBlob: this.generateMeldevordruckA4PDFsBlob.bind(this),
            generateAllNachrichtenvordruckPrintBlob: this.generateAllNachrichtenvordruckPrintBlob.bind(this),
            generateAllMeldevordruckPrintBlob: this.generateAllMeldevordruckPrintBlob.bind(this),
            generateAllNachrichtenvordruckPrintA4Blob: this.generateAllNachrichtenvordruckPrintA4Blob.bind(this),
            generateAllMeldevordruckPrintA4Blob: this.generateAllMeldevordruckPrintA4Blob.bind(this),
            generatePlainNachrichtenvordruckPrintBlob: this.generatePlainNachrichtenvordruckPrintBlob.bind(this),
            generatePlainMeldevordruckPrintBlob: this.generatePlainMeldevordruckPrintBlob.bind(this),
            generateNachrichtenvordruckPDFForTeilnehmer: this.generateNachrichtenvordruckPDFForTeilnehmer.bind(this),
            generateMeldevordruckPDFForTeilnehmer: this.generateMeldevordruckPDFForTeilnehmer.bind(this)
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = createZipDownloadName(funkUebung, this.sanitizeFileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    async generateTeilnehmerPDFsAsZip(funkUebung: FunkUebung, teilnehmer: string): Promise<Blob> {
        return generateTeilnehmerPDFsAsZipBlob(funkUebung, teilnehmer, {
            sanitizeFileName: this.sanitizeFileName,
            generateTeilnehmerPDFsBlob: this.generateTeilnehmerPDFsBlob.bind(this),
            generateInstructorPDFBlob: this.generateInstructorPDFBlob.bind(this),
            generateNachrichtenvordruckPDFsBlob: this.generateNachrichtenvordruckPDFsBlob.bind(this),
            generateNachrichtenvordruckA4PDFsBlob: this.generateNachrichtenvordruckA4PDFsBlob.bind(this),
            generateMeldevordruckPDFsBlob: this.generateMeldevordruckPDFsBlob.bind(this),
            generateMeldevordruckA4PDFsBlob: this.generateMeldevordruckA4PDFsBlob.bind(this),
            generateAllNachrichtenvordruckPrintBlob: this.generateAllNachrichtenvordruckPrintBlob.bind(this),
            generateAllMeldevordruckPrintBlob: this.generateAllMeldevordruckPrintBlob.bind(this),
            generateAllNachrichtenvordruckPrintA4Blob: this.generateAllNachrichtenvordruckPrintA4Blob.bind(this),
            generateAllMeldevordruckPrintA4Blob: this.generateAllMeldevordruckPrintA4Blob.bind(this),
            generatePlainNachrichtenvordruckPrintBlob: this.generatePlainNachrichtenvordruckPrintBlob.bind(this),
            generatePlainMeldevordruckPrintBlob: this.generatePlainMeldevordruckPrintBlob.bind(this),
            generateNachrichtenvordruckPDFForTeilnehmer: this.generateNachrichtenvordruckPDFForTeilnehmer.bind(this),
            generateMeldevordruckPDFForTeilnehmer: this.generateMeldevordruckPDFForTeilnehmer.bind(this)
        });
    }

    /**
     * Erstellt eine Druck-PDF mit allen Nachrichtenvordrucken inkl. Deckblatt pro Teilnehmer.
     */
    async generateAllNachrichtenvordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF("p", "mm", "a5");
        funkUebung.teilnehmerListe.forEach((teilnehmer: string, tIdx: number) => {
            if (tIdx > 0) {
                pdf.addPage();
            }
            // Deckblatt und dann Nachrichtenvordruck
            const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
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
        return pdf.output("blob");
    }

    /**
     * Erstellt eine Druck-PDF mit allen Meldevordrucken inkl. Deckblatt pro Teilnehmer.
     */
    async generateAllMeldevordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF("p", "mm", "a5");
        funkUebung.teilnehmerListe.forEach((teilnehmer: string, tIdx: number) => {
            if (tIdx > 0) {
                pdf.addPage();
            }
            const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();
            pdf.addPage();
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
            nachrichten.forEach((nachricht: Nachricht, nIdx: number) => {
                const meldevordruck = new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht);
                meldevordruck.draw();
                if (!(tIdx === funkUebung.teilnehmerListe.length - 1 && nIdx === nachrichten.length - 1)) {
                    pdf.addPage();
                }
            });
        });
        return pdf.output("blob");
    }

}

// Instanz der Klasse exportieren
const pdfGenerator = new PDFGenerator();
export default pdfGenerator;
