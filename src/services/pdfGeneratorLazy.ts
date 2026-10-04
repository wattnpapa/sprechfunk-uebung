import type pdfGenerator from "./pdfGenerator";
import { uiFeedback } from "../core/UiFeedback";

// jsPDF und JSZip machen einen erheblichen Teil des Start-Bundles aus, werden
// aber erst beim ersten Export-Klick gebraucht. Der dynamische Import lagert
// sie in einen eigenen Chunk aus, den Rollup separat schreibt und der Browser
// erst bei Bedarf lädt.
export type PdfGeneratorService = typeof pdfGenerator;

/** Meldung, wenn der Druckteil nicht geladen werden konnte (meist: kein Netz). */
export const PDF_LADEFEHLER_MELDUNG =
    "Die Druckfunktion konnte nicht geladen werden. Prüf die Verbindung und tipp dann erneut. "
    + "Ohne Netz helfen die vorher gedruckten Unterlagen.";

type Importer = () => Promise<PdfGeneratorService>;

const standardImporter: Importer = () => import("./pdfGenerator").then(m => m.default);

let importer: Importer = standardImporter;
let modulePromise: Promise<PdfGeneratorService> | undefined;

function lade(): Promise<PdfGeneratorService> {
    modulePromise ??= importer().catch((err: unknown) => {
        // Ein fehlgeschlagener Import darf nicht gecacht bleiben, sonst bleiben
        // Vordruck und ZIP nach einem kurzen Netzaussetzer bis zum Neuladen
        // kaputt (THW-Review 2026-10-04, B3). Der nächste Klick versucht es neu.
        modulePromise = undefined;
        throw err;
    });
    return modulePromise;
}

/**
 * Lädt den PDF-Teil. Schlägt das fehl, sieht der Nutzer eine Meldung mit
 * Handlungsanweisung; der Fehler wird trotzdem weitergereicht, damit der
 * Aufrufer seinen eigenen Ablauf abbrechen kann.
 */
export async function ladePdfGenerator(): Promise<PdfGeneratorService> {
    try {
        return await lade();
    } catch (err) {
        uiFeedback.error(PDF_LADEFEHLER_MELDUNG);
        throw err;
    }
}

/**
 * Lädt den PDF-Teil still im Hintergrund vor, solange Netz da ist – damit
 * Vordruck und ZIP im Funkloch schon im Speicher (und im Offline-Cache des
 * Service Workers) liegen. Fehler bleiben hier stumm; der echte Klick meldet sie.
 */
export function vorladenPdfGenerator(): void {
    lade().catch(() => undefined);
}

/** Nur für Tests: Import ersetzen bzw. Zustand zurücksetzen. */
export function setzePdfGeneratorImporterFuerTests(neu: Importer | null): void {
    importer = neu ?? standardImporter;
    modulePromise = undefined;
}
