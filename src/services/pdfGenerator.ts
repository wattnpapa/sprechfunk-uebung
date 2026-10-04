/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import type { Nachricht } from "../types/Nachricht";
import type { Uebung } from "../types/Uebung";

import { DeckblattTeilnehmer } from "../pdf/DeckblattTeilnehmer.js";
import { FunkUebung } from "../models/FunkUebung.js";
import { Meldevordruck } from "../pdf/Meldevordruck.js";
import { Nachrichtenvordruck } from "../pdf/Nachrichtenvordruck.js";
import { Teilnehmer } from "../pdf/Teilnehmer.js";
import { Uebungsleitung } from "../pdf/Uebungsleitung.js";
import { Drehbuch } from "../pdf/Drehbuch.js";
import { ladeFuehrungsstellenUebung } from "./FuehrungsstellenUebungService";
import type { FuehrungsstellenUebung } from "../types/FuehrungsstellenUebung";
import { uiFeedback } from "../core/UiFeedback";
import { UebungsleitungStorage } from "../types/Storage";
import { generateTeilnehmerDebriefPdfBlob } from "./pdfDebriefService";
import {
    generateAllMeldevordruckPrintA4Blob,
    generateAllNachrichtenvordruckPrintA4Blob,
    generateMeldevordruckA4PDFsBlob,
    generateNachrichtenvordruckA4PDFsBlob
} from "./pdfA4Service";
// pdfZipService wird bewusst nur bei Bedarf geladen: JSZip samt pako sind rund
// 200 kB, der ZIP-Export laeuft aber erst auf Klick. Rollup legt daraus einen
// eigenen Chunk an, der beim Start nicht mitgeladen wird.

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
            const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

            const teilnehmerPdf = new Teilnehmer(teilnehmer, funkUebung, pdf);
            teilnehmerPdf.draw();

            const blob = teilnehmerPdf.blob();
            blobMap.set(teilnehmer, blob);
        });

        return blobMap;
    }

    /**
     * Erstellt eine PDF mit den Übersichten aller Teilnehmer hintereinander,
     * in der Reihenfolge der Teilnehmerverwaltung.
     */
    async generateAllTeilnehmerUebersichtPrintBlob(funkUebung: FunkUebung): Promise<Blob> {
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

        funkUebung.teilnehmerListe.forEach((teilnehmer: string, index: number) => {
            if (index > 0) {
                pdf.addPage();
            }
            new Teilnehmer(teilnehmer, funkUebung, pdf).draw();
        });

        return pdf.output("blob");
    }

    async generateAllTeilnehmerUebersichtPrint(funkUebung: FunkUebung): Promise<void> {
        const blob = await this.generateAllTeilnehmerUebersichtPrintBlob(funkUebung);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Uebersicht_Alle_Teilnehmer_${this.sanitizeFileName(funkUebung.name)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
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

            const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
            // Deckblatt als erste Seite
            const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();

            // Seite erst vor jeder Nachricht: Stellen ohne Nachrichten (die
            // beübte Stelle einer Führungsstellen-Übung) bekommen keine Leerseite.
            nachrichten.forEach((nachricht: Nachricht) => {
                pdf.addPage();
                new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
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
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
        const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
        deckblatt.draw();

        nachrichten.forEach((nachricht: Nachricht) => {
            pdf.addPage();
            new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
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

        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
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

            const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true }); // A5 Hochformat
            // Deckblatt als erste Seite
            const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
            deckblatt.draw();

            nachrichten.forEach((nachricht: Nachricht) => {
                pdf.addPage();
                new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
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
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
        const deckblatt = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
        deckblatt.draw();

        nachrichten.forEach((nachricht: Nachricht) => {
            pdf.addPage();
            new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
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

        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
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
     * Erstellt das PDF für die Übungsleitung. Mit `stand` (Übungsleitungs-
     * Ansicht) trägt es Anmeldezeiten, Notizen und Abgesetzt-Zeiten; ohne
     * (Generator/ZIP) bleibt es ein leerer Papierplan zum Mitschreiben.
     *
     * Läuft bewusst über diesen Dienst: sein Konstruktor meldet das
     * autoTable-Plugin bei jsPDF an. Ein direkt importiertes jsPDF hat es
     * nicht (THW-Review 2026-10-04, B2).
     */
    generateInstructorPDFBlob(funkUebung: FunkUebung | Uebung, stand: UebungsleitungStorage | null = null) {
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });

        const uebungsLeitung = new Uebungsleitung(funkUebung, pdf, stand);
        uebungsLeitung.draw();

        return uebungsLeitung.blob();
    }

    /** Lädt das Übungsleitungs-PDF mit aktuellem Stand herunter. */
    downloadUebungsleitungPDF(uebung: Uebung, stand: UebungsleitungStorage | null): void {
        const blob = this.generateInstructorPDFBlob(uebung, stand);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Uebungsleitung_${uebung.name}_${uebung.id}.pdf`.replace(/\s+/g, "_");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    sanitizeFileName(name: string) {
        return name.replace(/[/\\:*?"<>|]/g, "-");
    }

    /**
     * Drehbuch einer Führungsstellen-Übung. Das Drehbuch-JSON wird bei Bedarf
     * nachgeladen; für Übungen ohne Rollenbesetzung gibt es kein Drehbuch.
     */
    async generateDrehbuchPDFBlob(funkUebung: FunkUebung, drehbuch?: FuehrungsstellenUebung): Promise<Blob | null> {
        const slug = funkUebung.fuehrungsstelle?.slug;
        if (!slug) {
            return null;
        }
        const geladen = drehbuch ?? await ladeFuehrungsstellenUebung(slug);
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
        const dokument = new Drehbuch(funkUebung, geladen, pdf);
        dokument.draw();
        return dokument.blob();
    }

    async generateDrehbuchPDF(funkUebung: FunkUebung, drehbuch?: FuehrungsstellenUebung): Promise<void> {
        const blob = await this.generateDrehbuchPDFBlob(funkUebung, drehbuch);
        if (!blob) {
            uiFeedback.error("Diese Übung hat kein Drehbuch.");
            return;
        }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Drehbuch_Fuehrungsstellen-Uebung.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    /**
     * Erstellt ein A5-PDF mit allen Nachrichtenvordrucken (plain, ohne Hintergrund & Fußzeile),
     * jeweils mit Deckblatt als Trennblatt.
     */
    async generatePlainNachrichtenvordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
        let seiteBelegt = false;
        funkUebung.teilnehmerListe.forEach(teilnehmer => {
            const msgs = funkUebung.nachrichten[teilnehmer] || [];
            if (msgs.length === 0) {
                return; // kein Trennblatt für Stellen ohne Nachrichten
            }
            if (seiteBelegt) {
                pdf.addPage();
            }
            seiteBelegt = true;
            // Deckblatt als Trennblatt
            new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf).draw();
            msgs.forEach(nachricht => {
                pdf.addPage();
                new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht, true, true).draw();
            });
        });
        return pdf.output("blob");
    }

    /**
     * Erstellt ein A5-PDF mit allen Meldevordrucken (plain, ohne Hintergrund & Fußzeile),
     * jeweils mit Deckblatt als Trennblatt.
     */
    async generatePlainMeldevordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
        let seiteBelegt = false;
        funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
            const msgs = funkUebung.nachrichten[teilnehmer] || [];
            if (msgs.length === 0) {
                return;
            }
            if (seiteBelegt) {
                pdf.addPage();
            }
            seiteBelegt = true;
            new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf).draw();
            msgs.forEach((nachricht: Nachricht) => {
                pdf.addPage();
                new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht, true, true).draw();
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
        const { createZipDownloadName, generateAllPDFsAsZipBlob } = await import("./pdfZipService");
        const zipBlob = await generateAllPDFsAsZipBlob(funkUebung, {
            sanitizeFileName: this.sanitizeFileName,
            generateDrehbuchPDFBlob: this.generateDrehbuchPDFBlob.bind(this),
            generateTeilnehmerPDFsBlob: this.generateTeilnehmerPDFsBlob.bind(this),
            generateAllTeilnehmerUebersichtPrintBlob: this.generateAllTeilnehmerUebersichtPrintBlob.bind(this),
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
        const { generateTeilnehmerPDFsAsZipBlob } = await import("./pdfZipService");
        return generateTeilnehmerPDFsAsZipBlob(funkUebung, teilnehmer, {
            sanitizeFileName: this.sanitizeFileName,
            generateTeilnehmerPDFsBlob: this.generateTeilnehmerPDFsBlob.bind(this),
            generateAllTeilnehmerUebersichtPrintBlob: this.generateAllTeilnehmerUebersichtPrintBlob.bind(this),
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
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
        let seiteBelegt = false;
        funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
            if (nachrichten.length === 0) {
                return;
            }
            if (seiteBelegt) {
                pdf.addPage();
            }
            seiteBelegt = true;
            // Deckblatt und dann Nachrichtenvordruck
            new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf).draw();
            nachrichten.forEach((nachricht: Nachricht) => {
                pdf.addPage();
                new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, nachricht).draw();
            });
        });
        return pdf.output("blob");
    }

    /**
     * Erstellt eine Druck-PDF mit allen Meldevordrucken inkl. Deckblatt pro Teilnehmer.
     */
    async generateAllMeldevordruckPrintBlob(funkUebung: FunkUebung) {
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
        let seiteBelegt = false;
        funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
            if (nachrichten.length === 0) {
                return;
            }
            if (seiteBelegt) {
                pdf.addPage();
            }
            seiteBelegt = true;
            new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf).draw();
            nachrichten.forEach((nachricht: Nachricht) => {
                pdf.addPage();
                new Meldevordruck(teilnehmer, funkUebung, pdf, nachricht).draw();
            });
        });
        return pdf.output("blob");
    }

}

// Instanz der Klasse exportieren
const pdfGenerator = new PDFGenerator();
export default pdfGenerator;
