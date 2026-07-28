import type pdfGenerator from "./pdfGenerator";

// jsPDF und JSZip machen einen erheblichen Teil des Start-Bundles aus, werden
// aber erst beim ersten Export-Klick gebraucht. Der dynamische Import lagert
// sie in einen eigenen Chunk aus, den Rollup separat schreibt und der Browser
// erst bei Bedarf lädt.
export type PdfGeneratorService = typeof pdfGenerator;

let modulePromise: Promise<PdfGeneratorService> | undefined;

export function ladePdfGenerator(): Promise<PdfGeneratorService> {
    modulePromise ??= import("./pdfGenerator").then(m => m.default);
    return modulePromise;
}
