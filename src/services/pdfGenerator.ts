/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import type { Nachricht } from "../types/Nachricht";

import JSZip from "jszip";
import { DeckblattTeilnehmer } from "../pdf/DeckblattTeilnehmer.js";
import { FunkUebung } from "../models/FunkUebung.js";
import { Meldevordruck } from "../pdf/Meldevordruck.js";
import { Nachrichtenvordruck } from "../pdf/Nachrichtenvordruck.js";
import { Teilnehmer } from "../pdf/Teilnehmer.js";
import { Uebungsleitung } from "../pdf/Uebungsleitung.js";
import { formatNatoDate } from "../utils/date";
import { uiFeedback } from "../core/UiFeedback";

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

    /**
     * Erstellt eine A4-Quer-PDF mit 2 Nachrichtenvordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateAllNachrichtenvordruckPrintA4Blob(funkUebung: FunkUebung): Promise<Blob> {
        const pdf = new jsPDF("l", "mm", "a4");
        const parts = funkUebung.teilnehmerListe;
        for (let i = 0; i < parts.length; i += 2) {
            if (i > 0) {
                pdf.addPage();
            }

            // Trennlinie (Schneidekante)
            pdf.setDrawColor(150);
            pdf.setLineWidth(0.2);
            (pdf as any).setLineDash([1, 1], 0); // gestrichelt
            pdf.line(148, 0, 148, 210);
            (pdf as any).setLineDash([], 0); // zurücksetzen

            const left = parts[i];
            const right = parts[i + 1];
            if (!left) {
                continue;
            }

            const deckblattLeft = new DeckblattTeilnehmer(left, funkUebung, pdf);
            deckblattLeft.draw(0); // left -> offset 0  

            if (right) {
                const deckblattRight = new DeckblattTeilnehmer(right, funkUebung, pdf);
                deckblattRight.draw(148); // right -> offset 148
            }

            // Nachrichtenvordrucke
            const leftMsgs = funkUebung.nachrichten[left] || [];
            const rightMsgs = right ? funkUebung.nachrichten[right] || [] : [];
            const max = Math.max(leftMsgs.length, rightMsgs.length);
            for (let j = 0; j < max; j++) {
                pdf.addPage();
                if (j < leftMsgs.length) {
                    const leftMsg = leftMsgs[j];
                    if (leftMsg) {
                        new Nachrichtenvordruck(left, funkUebung, pdf, leftMsg).draw();
                    }
                }
                if (right && j < rightMsgs.length) {
                    const rightMsg = rightMsgs[j];
                    if (rightMsg) {
                        new Nachrichtenvordruck(right, funkUebung, pdf, rightMsg).draw(148);
                    }
                }
                // Trennlinie (Schneidekante)
                pdf.setDrawColor(150);
                pdf.setLineWidth(0.2);
                (pdf as any).setLineDash([1, 1], 0); // gestrichelt
                pdf.line(148, 0, 148, 210);
                (pdf as any).setLineDash([], 0); // zurücksetzen
            }
        }
        return pdf.output("blob");
    }

    /**
     * Erstellt eine A4-Quer-PDF mit 2 Meldevordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateAllMeldevordruckPrintA4Blob(funkUebung: FunkUebung): Promise<Blob> {
        const pdf = new jsPDF("l", "mm", "a4");
        const parts = funkUebung.teilnehmerListe;
        for (let i = 0; i < parts.length; i += 2) {
            if (i > 0) {
                pdf.addPage();
            }

            // Trennlinie (Schneidekante)
            pdf.setDrawColor(150);
            pdf.setLineWidth(0.2);
            (pdf as any).setLineDash([1, 1], 0); // gestrichelt
            pdf.line(148, 0, 148, 210);
            (pdf as any).setLineDash([], 0); // zurücksetzen

            const left = parts[i];
            const right = parts[i + 1];
            if (!left) {
                continue;
            }

            const deckblattLeft = new DeckblattTeilnehmer(left, funkUebung, pdf);
            deckblattLeft.draw(0); // left -> offset 0

            if (right) {
                const deckblattRight = new DeckblattTeilnehmer(right, funkUebung, pdf);
                deckblattRight.draw(148); // right -> offset 148
            }
            const leftMsgs = funkUebung.nachrichten[left] || [];
            const rightMsgs = right ? funkUebung.nachrichten[right] || [] : [];
            const max = Math.max(leftMsgs.length, rightMsgs.length);
            for (let j = 0; j < max; j++) {
                pdf.addPage();
                if (j < leftMsgs.length) {
                    const leftMsg = leftMsgs[j];
                    if (leftMsg) {
                        new Meldevordruck(left, funkUebung, pdf, leftMsg).draw();
                    }
                }
                if (right && j < rightMsgs.length) {
                    const rightMsg = rightMsgs[j];
                    if (rightMsg) {
                        new Meldevordruck(right, funkUebung, pdf, rightMsg).draw(148);
                    }
                }
                // Trennlinie (Schneidekante)
                pdf.setDrawColor(150);
                pdf.setLineWidth(0.2);
                (pdf as any).setLineDash([1, 1], 0); // gestrichelt
                pdf.line(148, 0, 148, 210);
                (pdf as any).setLineDash([], 0); // zurücksetzen
            }
        }
        return pdf.output("blob");
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

    async generateNachrichtenvordruckPageBlob(
        funkUebung: FunkUebung,
        teilnehmer: string,
        page: number,
        hideBackground = false,
        hideFooter = false
    ): Promise<Blob> {
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

    async generateMeldevordruckPageBlob(
        funkUebung: FunkUebung,
        teilnehmer: string,
        page: number,
        hideBackground = false,
        hideFooter = false
    ): Promise<Blob> {
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
        const blobs = new Map<string, Blob>();
        const { jsPDF } = await import("jspdf");

        for (const teilnehmer of funkUebung.teilnehmerListe) {
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
            const totalA5Pages = 1 + nachrichten.length; // 0 = Deckblatt, danach jede Nachricht eine Seite
            const half = Math.ceil(totalA5Pages / 2);

            const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            const offsetRight = 148; // A5-Breite in mm

            // Hilfsrenderer für eine Seite auf linker/rechter Hälfte
            const renderIndex = (pageIndex: number, offsetX: number) => {
                if (pageIndex < 0 || pageIndex >= totalA5Pages) {
                    return;
                }
                if (pageIndex === 0) {
                    // Deckblatt
                    const deck = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
                    deck.draw(offsetX || 0);
                } else {
                    // Nachrichtenseite (pageIndex - 1, da 0 das Deckblatt ist)
                    const msg = nachrichten[pageIndex - 1];
                    if (msg) {
                        new Nachrichtenvordruck(teilnehmer, funkUebung, pdf, msg).draw(offsetX || 0);
                    }
                }
            };

            // Bogenweise ausgeben: links s, rechts s + half
            for (let s = 0; s < half; s++) {
                if (s > 0) {
                    pdf.addPage();
                }
                const leftIndex = s;                // 0 .. half-1
                const rightIndex = s + half;        // half .. totalA5Pages-1

                // Links (Deckblatt oder Nachricht)
                renderIndex(leftIndex, 0);

                // Rechts (nur wenn vorhanden)
                if (rightIndex < totalA5Pages) {
                    renderIndex(rightIndex, offsetRight);
                }

                // Trennlinie (Schneidekante)
                pdf.setDrawColor(150);
                pdf.setLineWidth(0.2);
                (pdf as any).setLineDash([1, 1], 0); // gestrichelt
                pdf.line(148, 0, 148, 210);
                (pdf as any).setLineDash([], 0); // zurücksetzen
            }

            const blob = pdf.output("blob");
            blobs.set(teilnehmer, blob);
        }

        return blobs;
    }

    /**
     * Erstellt die Meldevordruck-PDFs im A4-Querformat mit 2 Meldevordrucken pro Seite (paarweise Layout mit Deckblatt).
     */
    async generateMeldevordruckA4PDFsBlob(funkUebung: FunkUebung) {
        const blobs = new Map<string, Blob>();
        const { jsPDF } = await import("jspdf");

        for (const teilnehmer of funkUebung.teilnehmerListe) {
            const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
            const totalA5Pages = 1 + nachrichten.length; // 0 = Deckblatt, danach jede Nachricht eine Seite
            const half = Math.ceil(totalA5Pages / 2);

            const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            const offsetRight = 148; // A5-Breite in mm

            // Hilfsrenderer für eine Seite auf linker/rechter Hälfte
            const renderIndex = (pageIndex: number, offsetX: number) => {
                if (pageIndex < 0 || pageIndex >= totalA5Pages) {
                    return;
                }
                if (pageIndex === 0) {
                    // Deckblatt
                    const deck = new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf);
                    deck.draw(offsetX || 0);
                } else {
                    // Meldevordruck-Seite
                    const msg = nachrichten[pageIndex - 1];
                    if (msg) {
                        new Meldevordruck(teilnehmer, funkUebung, pdf, msg).draw(offsetX || 0);
                    }
                }
            };

            // Bogenweise ausgeben: links s, rechts s + half
            for (let s = 0; s < half; s++) {
                if (s > 0) {
                    pdf.addPage();
                }
                const leftIndex = s;
                const rightIndex = s + half;

                renderIndex(leftIndex, 0);
                if (rightIndex < totalA5Pages) {
                    renderIndex(rightIndex, offsetRight);
                }

                // Trennlinie (Schneidekante)
                pdf.setDrawColor(150);
                pdf.setLineWidth(0.2);
                (pdf as any).setLineDash([1, 1], 0); // gestrichelt
                pdf.line(148, 0, 148, 210);
                (pdf as any).setLineDash([], 0); // zurücksetzen
            }

            const blob = pdf.output("blob");
            blobs.set(teilnehmer, blob);
        }

        return blobs;
    }

    async generateAllPDFsAsZip(funkUebung: FunkUebung) {
        const zip = new JSZip();

        // Teilnehmer-PDFs
        const teilnehmerBlobs = await this.generateTeilnehmerPDFsBlob(funkUebung);
        teilnehmerBlobs.forEach((blob, teilnehmer) => {
            zip.file(`Teilnehmer/${this.sanitizeFileName(teilnehmer)}/Übersicht_${this.sanitizeFileName(teilnehmer)}.pdf`, blob);
        });

        // Instructor PDF
        const instructorBlob = this.generateInstructorPDFBlob(funkUebung);
        zip.file("Uebungsleitung.pdf", instructorBlob);

        // Nachrichtenvordrucke
        const nachrichtenvordruckBlobs = await this.generateNachrichtenvordruckPDFsBlob(funkUebung);
        nachrichtenvordruckBlobs.forEach((blob, teilnehmer) => {
            zip.file(`Teilnehmer/${this.sanitizeFileName(teilnehmer)}/Nachrichtenvordruck_${this.sanitizeFileName(teilnehmer)}_A5.pdf`, blob);
        });

        const nachrichtenvordruckBlobsNadel = await this.generateNachrichtenvordruckPDFsBlob(funkUebung, true, true);
        nachrichtenvordruckBlobsNadel.forEach((blob, teilnehmer) => {
            zip.file(`Teilnehmer/${this.sanitizeFileName(teilnehmer)}/Nachrichtenvordruck_${this.sanitizeFileName(teilnehmer)}_Nadeldrucker_A5.pdf`, blob);
        });

        const nachrichtenvordruckA4Blobs = await this.generateNachrichtenvordruckA4PDFsBlob(funkUebung);
        nachrichtenvordruckA4Blobs.forEach((blob, teilnehmer) => {
            zip.file(`Teilnehmer/${this.sanitizeFileName(teilnehmer)}/Nachrichtenvordruck_${this.sanitizeFileName(teilnehmer)}_A4.pdf`, blob);
        });

        // Meldevordrucke
        const meldevordruckBlobs = await this.generateMeldevordruckPDFsBlob(funkUebung);
        meldevordruckBlobs.forEach((blob, teilnehmer) => {
            zip.file(`Teilnehmer/${this.sanitizeFileName(teilnehmer)}/Meldevordruck_${this.sanitizeFileName(teilnehmer)}_A5.pdf`, blob);
        });

        const meldevordruckBlobsNadel = await this.generateMeldevordruckPDFsBlob(funkUebung, true, true);
        meldevordruckBlobsNadel.forEach((blob, teilnehmer) => {
            zip.file(`Teilnehmer/${this.sanitizeFileName(teilnehmer)}/Meldevordruck_${this.sanitizeFileName(teilnehmer)}_Nadeldrucker_A5.pdf`, blob);
        });

        const meldevordruckA4Blobs = await this.generateMeldevordruckA4PDFsBlob(funkUebung);
        meldevordruckA4Blobs.forEach((blob, teilnehmer) => {
            zip.file(`Teilnehmer/${this.sanitizeFileName(teilnehmer)}/Meldevordruck_${this.sanitizeFileName(teilnehmer)}_A4.pdf`, blob);
        });

        // Druck-PDF mit allen Nachrichtenvordrucken
        const allMsgPrint = await this.generateAllNachrichtenvordruckPrintBlob(funkUebung);
        zip.file(
            "Gesamt/Druck_Nachrichtenvordruck_A5.pdf",
            allMsgPrint
        );

        // Druck-PDF mit allen Meldevordrucken
        const allMeldPrint = await this.generateAllMeldevordruckPrintBlob(funkUebung);
        zip.file(
            "Gesamt/Druck_Meldevordruck_A5.pdf",
            allMeldPrint
        );

        // A4-Druckvorlagen hinzufügen
        const allMsgPrintA4 = await this.generateAllNachrichtenvordruckPrintA4Blob(funkUebung);
        zip.file(
            "Gesamt/Druck_Nachrichtenvordruck_A4.pdf",
            allMsgPrintA4
        );

        const allMeldPrintA4 = await this.generateAllMeldevordruckPrintA4Blob(funkUebung);
        zip.file(
            "Gesamt/Druck_Meldevordruck_A4.pdf",
            allMeldPrintA4
        );

        // Nadeldrucker: je ein A5-PDF mit allen Nachrichtenvordrucken
        const plainNachrichtBlob = await this.generatePlainNachrichtenvordruckPrintBlob(funkUebung);
        zip.file(
            "Gesamt/Nadeldrucker_Nachrichtenvordruck_A5.pdf",
            plainNachrichtBlob
        );
        // Nadeldrucker: je ein A5-PDF mit allen Meldevordrucken
        const plainMeldeBlob = await this.generatePlainMeldevordruckPrintBlob(funkUebung);
        zip.file(
            "Gesamt/Nadeldrucker_Meldevordruck_A5.pdf",
            plainMeldeBlob
        );

        const zipBlob = await zip.generateAsync({ type: "blob" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        const zipName = `${this.sanitizeFileName(funkUebung.name)}_${formatNatoDate(new Date())}.zip`;
        link.download = zipName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    async generateTeilnehmerPDFsAsZip(funkUebung: FunkUebung, teilnehmer: string): Promise<Blob> {
        const zip = new JSZip();
        const safeTeilnehmer = this.sanitizeFileName(teilnehmer);
        const basePath = `Teilnehmer/${safeTeilnehmer}`;

        const teilnehmerBlobs = await this.generateTeilnehmerPDFsBlob(funkUebung);
        const uebersichtBlob = teilnehmerBlobs.get(teilnehmer);
        if (uebersichtBlob) {
            zip.file(`${basePath}/Übersicht_${safeTeilnehmer}.pdf`, uebersichtBlob);
        }

        const nachrichtA5 = await this.generateNachrichtenvordruckPDFForTeilnehmer(funkUebung, teilnehmer);
        zip.file(`${basePath}/Nachrichtenvordruck_${safeTeilnehmer}_A5.pdf`, nachrichtA5.blob);

        const nachrichtNadelA5 = await this.generateNachrichtenvordruckPDFForTeilnehmer(funkUebung, teilnehmer, true, true);
        zip.file(`${basePath}/Nachrichtenvordruck_${safeTeilnehmer}_Nadeldrucker_A5.pdf`, nachrichtNadelA5.blob);

        const nachrichtA4Blobs = await this.generateNachrichtenvordruckA4PDFsBlob(funkUebung);
        const nachrichtA4 = nachrichtA4Blobs.get(teilnehmer);
        if (nachrichtA4) {
            zip.file(`${basePath}/Nachrichtenvordruck_${safeTeilnehmer}_A4.pdf`, nachrichtA4);
        }

        const meldeA5 = await this.generateMeldevordruckPDFForTeilnehmer(funkUebung, teilnehmer);
        zip.file(`${basePath}/Meldevordruck_${safeTeilnehmer}_A5.pdf`, meldeA5.blob);

        const meldeNadelA5 = await this.generateMeldevordruckPDFForTeilnehmer(funkUebung, teilnehmer, true, true);
        zip.file(`${basePath}/Meldevordruck_${safeTeilnehmer}_Nadeldrucker_A5.pdf`, meldeNadelA5.blob);

        const meldeA4Blobs = await this.generateMeldevordruckA4PDFsBlob(funkUebung);
        const meldeA4 = meldeA4Blobs.get(teilnehmer);
        if (meldeA4) {
            zip.file(`${basePath}/Meldevordruck_${safeTeilnehmer}_A4.pdf`, meldeA4);
        }

        return zip.generateAsync({ type: "blob" });
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
