import type pdfGenerator from "./pdfGenerator";
import { uiFeedback } from "../core/UiFeedback";
import { erzeugeChunkLader, hatFunktion, importiereUrl, type ChunkImporter } from "./chunkLaden";

export { chunkUrlAusFehler, neuerVersuchUrl } from "./chunkLaden";

// jsPDF und JSZip machen einen erheblichen Teil des Start-Bundles aus, werden
// aber erst beim ersten Export-Klick gebraucht. Der dynamische Import lagert
// sie in einen eigenen Chunk aus, den Rollup separat schreibt und der Browser
// erst bei Bedarf lädt.
export type PdfGeneratorService = typeof pdfGenerator;

/**
 * Meldung, wenn der Druckteil nicht geladen werden konnte (meist: kein Netz).
 * Sie nennt beide Auswege, weil nicht jeder Browser einen neuen Versuch ohne
 * Neuladen zulässt (siehe `neuerVersuchUrl`).
 */
export const PDF_LADEFEHLER_MELDUNG =
    "Die Druckfunktion konnte nicht geladen werden – vermutlich keine Verbindung. "
    + "Tipp erneut, sobald wieder Netz da ist; hilft das nicht, lade die Seite mit Netz neu. "
    + "Ohne Netz helfen die vorher gedruckten Unterlagen.";

/** Wie lange nach der Ladefehler-Meldung Folgemeldungen derselben Ursache unterdrückt werden. */
const FOLGEFEHLER_MS = 2000;

// Ein gescheitertes import() merkt sich der Browser bis zum Neuladen; der
// Lader ruft den Chunk beim nächsten Versuch unter neuer Adresse ab
// (THW-Review 2026-10-05, offline P1-1, siehe chunkLaden.ts).
const lader = erzeugeChunkLader<PdfGeneratorService>(url => (url
    ? importiereUrl<{ default: PdfGeneratorService }>(url, hatFunktion("default", "generateAllPDFsAsZip"))
    : import("./pdfGenerator")
).then(m => m.default));

function lade(): Promise<PdfGeneratorService> {
    return lader.lade();
}

/**
 * Lädt den PDF-Teil. Schlägt das fehl, sieht der Nutzer genau eine Meldung
 * mit Handlungsanweisung (Folgemeldungen des Aufrufers werden kurz
 * unterdrückt); der Fehler wird trotzdem weitergereicht, damit der Aufrufer
 * seinen eigenen Ablauf abbrechen kann.
 */
export async function ladePdfGenerator(): Promise<PdfGeneratorService> {
    try {
        return await lade();
    } catch (err) {
        uiFeedback.error(PDF_LADEFEHLER_MELDUNG, { folgefehlerUnterdrueckenMs: FOLGEFEHLER_MS });
        throw err;
    }
}

/**
 * Lädt den PDF-Teil still im Hintergrund vor, solange Netz da ist – damit
 * Vordruck und ZIP im Funkloch schon im Speicher (und im Offline-Cache des
 * Service Workers) liegen. Fehler bleiben hier stumm; der echte Klick meldet sie.
 */
export function vorladenPdfGenerator(): void {
    // Mit dem Druckteil auch das ZIP (JSZip, eigener Chunk): sonst ging der
    // Notfall-ZIP auf einem reinen Teilnehmer-Gerät offline nicht
    // (THW-Review 2026-10-05, analog-first P3-2).
    lade().then(dienst => dienst.vorladenZip()).catch(() => undefined);
}

/** Nur für Tests: Import ersetzen bzw. Zustand zurücksetzen. */
export function setzePdfGeneratorImporterFuerTests(neu: ChunkImporter<PdfGeneratorService> | null): void {
    lader.setzeZurueck(neu ?? undefined);
}
