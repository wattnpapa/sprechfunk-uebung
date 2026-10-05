import type pdfGenerator from "./pdfGenerator";
import { uiFeedback } from "../core/UiFeedback";

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

type Importer = (url?: string) => Promise<PdfGeneratorService>;

const standardImporter: Importer = url => (url
    // Ein gescheiterter Modulabruf bleibt im Browser für die Lebensdauer der
    // Seite gemerkt: import() derselben URL scheitert sofort wieder, ohne das
    // Netz zu fragen (THW-Review 2026-10-05, offline P1-1). Ein angehängter
    // Parameter macht daraus eine neue URL, die der Browser wirklich abruft.
    ? (import(/* @vite-ignore */ url) as Promise<{ default: PdfGeneratorService }>)
    : import("./pdfGenerator")
).then(m => m.default);

let importer: Importer = standardImporter;
let modulePromise: Promise<PdfGeneratorService> | undefined;
let fehlgeschlageneUrl: string | undefined;
let versuch = 0;

/**
 * Liest die Adresse des Chunks aus der Fehlermeldung (Chromium: „Failed to
 * fetch dynamically imported module: <url>“, Firefox: „error loading
 * dynamically imported module: <url>“). Safari nennt keine Adresse; dort
 * bleibt nur das Neuladen, das die Meldung ebenfalls nennt.
 */
export function chunkUrlAusFehler(err: unknown): string | undefined {
    const text = err instanceof Error ? err.message : String(err ?? "");
    const treffer = /(https?:\/\/\S+?\.m?js)(?:\?\S*)?(?=\s|$|["'),])/.exec(text);
    return treffer?.[1];
}

/** Neue Adresse für den nächsten Versuch: gleiche Datei, anderer Cache-Schlüssel. */
export function neuerVersuchUrl(url: string, nummer: number): string {
    return `${url}${url.includes("?") ? "&" : "?"}neuladen=${nummer}`;
}

function lade(): Promise<PdfGeneratorService> {
    if (modulePromise) {
        return modulePromise;
    }
    const url = fehlgeschlageneUrl ? neuerVersuchUrl(fehlgeschlageneUrl, ++versuch) : undefined;
    modulePromise = importer(url).catch((err: unknown) => {
        // Ein fehlgeschlagener Import darf nicht gecacht bleiben, sonst bleiben
        // Vordruck und ZIP nach einem kurzen Netzaussetzer bis zum Neuladen
        // kaputt (THW-Review 2026-10-04, B3). Der nächste Klick versucht es
        // neu – mit neuer Adresse, falls der Browser sie verraten hat.
        modulePromise = undefined;
        fehlgeschlageneUrl ??= chunkUrlAusFehler(err);
        throw err;
    });
    return modulePromise;
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
    lade().catch(() => undefined);
}

/** Nur für Tests: Import ersetzen bzw. Zustand zurücksetzen. */
export function setzePdfGeneratorImporterFuerTests(neu: Importer | null): void {
    importer = neu ?? standardImporter;
    modulePromise = undefined;
    fehlgeschlageneUrl = undefined;
    versuch = 0;
}
