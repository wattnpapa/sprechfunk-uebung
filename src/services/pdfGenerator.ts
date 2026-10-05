/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import type { Uebung } from "../types/Uebung";

import { FunkUebung } from "../models/FunkUebung.js";
import { Meldevordruck } from "../pdf/Meldevordruck.js";
import { Nachrichtenvordruck } from "../pdf/Nachrichtenvordruck.js";
import { Teilnehmer } from "../pdf/Teilnehmer.js";
import { Uebungsleitung } from "../pdf/Uebungsleitung.js";
import { Drehbuch } from "../pdf/Drehbuch.js";
import { Ausgangslage } from "../pdf/Ausgangslage.js";
import { ladeFuehrungsstellenUebung } from "./FuehrungsstellenUebungService";
import type { FuehrungsstellenUebung } from "../types/FuehrungsstellenUebung";
import { uiFeedback } from "../core/UiFeedback";
import { asciiDateiname } from "../utils/dateiname";
import { teilnehmerMitUnterlagen } from "../pdf/druckTeilnehmer";
import { erzeugeChunkLader, hatFunktion, importiereUrl } from "./chunkLaden";
import { UebungsleitungStorage } from "../types/Storage";
import { generateTeilnehmerDebriefPdfBlob } from "./pdfDebriefService";
import {
    generateAllMeldevordruckPrintA4Blob,
    generateAllNachrichtenvordruckPrintA4Blob,
    generateMeldevordruckA4PDFsBlob,
    generateNachrichtenvordruckA4PDFsBlob
} from "./pdfA4Service";
import {
    sammelVordruckBlob,
    teilnehmerVordruckPdf,
    vordruckPdfsJeTeilnehmer,
    vordruckSeiteBlob,
    type VordruckSeitenOptionen
} from "./pdfA5Vordrucke";
// pdfZipService wird bewusst nur bei Bedarf geladen: JSZip samt pako sind rund
// 200 kB, der ZIP-Export laeuft aber erst auf Klick. Rollup legt daraus einen
// eigenen Chunk an, der beim Start nicht mitgeladen wird. Der Lader übersteht
// einen Netzaussetzer (chunkLaden.ts) und lässt sich vorladen (vorladenZip).
type ZipDienst = typeof import("./pdfZipService");
const zipLader = erzeugeChunkLader<ZipDienst>(url => (url ? importiereUrl<ZipDienst>(url, hatFunktion("generateAllPDFsAsZipBlob")) : import("./pdfZipService")));

/**
 * Startet den Download eines Blobs. Die Objekt-URL wird erst nach einer
 * Weile freigegeben: Browser lösen den Download asynchron auf, und eine
 * sofort widerrufene URL kann ihn (bekannt aus Firefox) abbrechen. Der
 * Ausdruck ist die Rückfallebene – er muss zuverlässig ankommen.
 */
function herunterladen(blob: Blob, dateiname: string): void {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    // Nur ASCII: mit Umlaut kam die Datei in Chromium als „download“ an.
    link.download = asciiDateiname(dateiname);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

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
                herunterladen(blob, fileName);
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

        // Die beübte Stelle einer Führungsstellen-Übung hat keine Übersicht (workflow W8).
        teilnehmerMitUnterlagen(funkUebung).forEach((teilnehmer: string, index: number) => {
            if (index > 0) {
                pdf.addPage();
            }
            new Teilnehmer(teilnehmer, funkUebung, pdf).draw();
        });

        return pdf.output("blob");
    }

    async generateAllTeilnehmerUebersichtPrint(funkUebung: FunkUebung): Promise<void> {
        const blob = await this.generateAllTeilnehmerUebersichtPrintBlob(funkUebung);
        herunterladen(blob, `Uebersicht_Alle_Teilnehmer_${this.sanitizeFileName(funkUebung.name)}.pdf`);
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
                herunterladen(blob, fileName);
            });

            uiFeedback.success("Alle Nachrichtenvordruck PDFs wurden erfolgreich erstellt.");
        });
    }

    /**
     * Erstellt die Nachrichtenvordruck PDFs.
     */
    async generateNachrichtenvordruckPDFsBlob(funkUebung: FunkUebung, hideBackground = false, hideFooter = false): Promise<Map<string, Blob>> {
        return vordruckPdfsJeTeilnehmer(Nachrichtenvordruck, funkUebung, { hideBackground, hideFooter });
    }

    async generateNachrichtenvordruckPDFForTeilnehmer(
        funkUebung: FunkUebung,
        teilnehmer: string,
        hideBackground = false,
        hideFooter = false
    ): Promise<{ blob: Blob; totalPages: number }> {
        return teilnehmerVordruckPdf(Nachrichtenvordruck, funkUebung, teilnehmer, { hideBackground, hideFooter });
    }

    async generateNachrichtenvordruckPageBlob(options: VordruckSeitenOptionen): Promise<Blob> {
        return vordruckSeiteBlob(Nachrichtenvordruck, options);
    }

    generateMeldevordruckPDFs(funkUebung: FunkUebung) {
        this.generateMeldevordruckPDFsBlob(funkUebung).then(blobMap => {
            blobMap.forEach((blob, teilnehmer) => {
                const fileName = `Meldevordruck_${teilnehmer}.pdf`;
                herunterladen(blob, fileName);
            });

            uiFeedback.success("Alle Meldevordruck PDFs wurden erfolgreich erstellt.");
        });
    }

    /**
     * Erstellt die Meldevordruck PDFs für alle Teilnehmer.
     */
    async generateMeldevordruckPDFsBlob(funkUebung: FunkUebung, hideBackground = false, hideFooter = false): Promise<Map<string, Blob>> {
        return vordruckPdfsJeTeilnehmer(Meldevordruck, funkUebung, { hideBackground, hideFooter });
    }

    async generateMeldevordruckPDFForTeilnehmer(
        funkUebung: FunkUebung,
        teilnehmer: string,
        hideBackground = false,
        hideFooter = false
    ): Promise<{ blob: Blob; totalPages: number }> {
        return teilnehmerVordruckPdf(Meldevordruck, funkUebung, teilnehmer, { hideBackground, hideFooter });
    }

    async generateMeldevordruckPageBlob(options: VordruckSeitenOptionen): Promise<Blob> {
        return vordruckSeiteBlob(Meldevordruck, options);
    }

    generateInstructorPDF(funkUebung: FunkUebung) {
        const blob = this.generateInstructorPDFBlob(funkUebung);
        herunterladen(blob, "Uebungsleitung.pdf");
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
        herunterladen(blob, `Uebungsleitung_${this.sanitizeFileName(uebung.name)}_${uebung.id}.pdf`.replace(/\s+/g, "_"));
    }

    /** Lädt den ZIP-Teil still vor, solange Netz da ist (Notfall-ZIP offline, analog-first P3-2). */
    vorladenZip(): Promise<void> {
        return zipLader.lade().then(() => undefined, () => undefined);
    }

    /** Teil eines Dateinamens: nur ASCII, Umlaute umschrieben (siehe asciiDateiname). */
    sanitizeFileName(name: string) {
        return asciiDateiname(name);
    }

    /**
     * Download mit ASCII-Dateinamen und verzögert freigegebener Objekt-URL –
     * für Aufrufer außerhalb dieses Dienstes, die bisher selbst einen Link
     * bauten und die URL sofort widerriefen.
     */
    herunterladen(blob: Blob, dateiname: string): void {
        herunterladen(blob, dateiname);
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

    /**
     * Blatt „Ausgangslage und Auftrag“ für die beübte Stelle einer
     * Führungsstellen-Übung – ohne Rollen und erwartete Reaktionen.
     */
    async generateAusgangslagePDFBlob(funkUebung: FunkUebung, drehbuch?: FuehrungsstellenUebung): Promise<Blob | null> {
        const slug = funkUebung.fuehrungsstelle?.slug;
        if (!slug) {
            return null;
        }
        const geladen = drehbuch ?? await ladeFuehrungsstellenUebung(slug);
        const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
        const dokument = new Ausgangslage(funkUebung, geladen, pdf);
        dokument.draw();
        return dokument.blob();
    }

    async generateDrehbuchPDF(funkUebung: FunkUebung, drehbuch?: FuehrungsstellenUebung): Promise<void> {
        const blob = await this.generateDrehbuchPDFBlob(funkUebung, drehbuch);
        if (!blob) {
            uiFeedback.error("Diese Übung hat kein Drehbuch.");
            return;
        }
        herunterladen(blob, "Drehbuch_Fuehrungsstellen-Uebung.pdf");
    }

    /**
     * Erstellt ein A5-PDF mit allen Nachrichtenvordrucken (plain, ohne Hintergrund & Fußzeile),
     * jeweils mit Deckblatt als Trennblatt.
     */
    async generatePlainNachrichtenvordruckPrintBlob(funkUebung: FunkUebung) {
        return sammelVordruckBlob(Nachrichtenvordruck, funkUebung, { hideBackground: true, hideFooter: true });
    }

    /**
     * Erstellt ein A5-PDF mit allen Meldevordrucken (plain, ohne Hintergrund & Fußzeile),
     * jeweils mit Deckblatt als Trennblatt.
     */
    async generatePlainMeldevordruckPrintBlob(funkUebung: FunkUebung) {
        return sammelVordruckBlob(Meldevordruck, funkUebung, { hideBackground: true, hideFooter: true });
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
        const { createZipDownloadName, generateAllPDFsAsZipBlob } = await zipLader.lade();
        const zipBlob = await generateAllPDFsAsZipBlob(funkUebung, {
            sanitizeFileName: this.sanitizeFileName,
            generateDrehbuchPDFBlob: this.generateDrehbuchPDFBlob.bind(this),
            generateAusgangslagePDFBlob: this.generateAusgangslagePDFBlob.bind(this),
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

        herunterladen(zipBlob, createZipDownloadName(funkUebung, this.sanitizeFileName));
    }

    async generateTeilnehmerPDFsAsZip(funkUebung: FunkUebung, teilnehmer: string): Promise<Blob> {
        const { generateTeilnehmerPDFsAsZipBlob } = await zipLader.lade();
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
        return sammelVordruckBlob(Nachrichtenvordruck, funkUebung);
    }

    /**
     * Erstellt eine Druck-PDF mit allen Meldevordrucken inkl. Deckblatt pro Teilnehmer.
     */
    async generateAllMeldevordruckPrintBlob(funkUebung: FunkUebung) {
        return sammelVordruckBlob(Meldevordruck, funkUebung);
    }

}

// Instanz der Klasse exportieren
const pdfGenerator = new PDFGenerator();
export default pdfGenerator;
