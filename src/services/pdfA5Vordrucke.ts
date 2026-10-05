import { jsPDF } from "jspdf";
import type { Nachricht } from "../types/Nachricht";
import { DeckblattTeilnehmer } from "../pdf/DeckblattTeilnehmer.js";
import type { FunkUebung } from "../models/FunkUebung.js";

/** Gemeinsame Signatur von Nachrichten- und Meldevordruck. */
export type VordruckKlasse = new (
    teilnehmer: string,
    uebung: FunkUebung,
    pdfInstance: jsPDF,
    nachricht: Nachricht,
    hideBackground?: boolean,
    hideFooter?: boolean
) => { draw(): void };

export interface VordruckDarstellung {
    hideBackground?: boolean;
    hideFooter?: boolean;
}

export interface VordruckSeitenOptionen extends VordruckDarstellung {
    funkUebung: FunkUebung;
    teilnehmer: string;
    page: number;
}

function neuesA5Pdf(): jsPDF {
    return new jsPDF({ orientation: "p", unit: "mm", format: "a5", compress: true });
}

/** Deckblatt plus ein Vordruck je Nachricht eines Teilnehmers als A5-PDF. */
export function teilnehmerVordruckPdf(
    Klasse: VordruckKlasse,
    funkUebung: FunkUebung,
    teilnehmer: string,
    darstellung: VordruckDarstellung = {}
): { blob: Blob; totalPages: number } {
    const { hideBackground = false, hideFooter = false } = darstellung;
    const nachrichten = funkUebung.nachrichten[teilnehmer] || [];
    const pdf = neuesA5Pdf();
    // Deckblatt als erste Seite
    new DeckblattTeilnehmer(teilnehmer, funkUebung, pdf).draw();

    // Seite erst vor jeder Nachricht: Stellen ohne Nachrichten (die
    // beübte Stelle einer Führungsstellen-Übung) bekommen keine Leerseite.
    nachrichten.forEach((nachricht: Nachricht) => {
        pdf.addPage();
        new Klasse(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
    });

    const totalPages = (pdf as unknown as { getNumberOfPages(): number }).getNumberOfPages();
    for (let j = 2; j <= totalPages; j++) {
        pdf.setPage(j);
    }

    return { blob: pdf.output("blob"), totalPages };
}

/** Je Teilnehmer ein A5-PDF mit Deckblatt und Vordrucken. */
export function vordruckPdfsJeTeilnehmer(
    Klasse: VordruckKlasse,
    funkUebung: FunkUebung,
    darstellung: VordruckDarstellung
): Map<string, Blob> {
    const blobMap = new Map();
    funkUebung.teilnehmerListe.forEach((teilnehmer: string) => {
        blobMap.set(teilnehmer, teilnehmerVordruckPdf(Klasse, funkUebung, teilnehmer, darstellung).blob);
    });
    return blobMap;
}

/** Eine einzelne Vordruckseite (1-basiert) eines Teilnehmers. */
export function vordruckSeiteBlob(Klasse: VordruckKlasse, options: VordruckSeitenOptionen): Blob {
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

    const pdf = neuesA5Pdf();
    const msg = nachrichten[page - 1];
    if (!msg) {
        throw new Error("Nachricht nicht gefunden");
    }
    new Klasse(teilnehmer, funkUebung, pdf, msg, hideBackground, hideFooter).draw();

    return pdf.output("blob");
}

/**
 * Ein A5-Druck-PDF mit allen Vordrucken, je Teilnehmer mit Deckblatt als
 * Trennblatt. Stellen ohne Nachrichten bekommen kein Trennblatt.
 */
export function sammelVordruckBlob(
    Klasse: VordruckKlasse,
    funkUebung: FunkUebung,
    darstellung: VordruckDarstellung = {}
): Blob {
    const { hideBackground = false, hideFooter = false } = darstellung;
    const pdf = neuesA5Pdf();
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
            new Klasse(teilnehmer, funkUebung, pdf, nachricht, hideBackground, hideFooter).draw();
        });
    });
    return pdf.output("blob");
}
