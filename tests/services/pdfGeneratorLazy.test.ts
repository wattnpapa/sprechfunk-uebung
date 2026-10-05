import { afterEach, describe, expect, it, vi } from "vitest";
import {
    chunkUrlAusFehler,
    ladePdfGenerator,
    neuerVersuchUrl,
    PDF_LADEFEHLER_MELDUNG,
    setzePdfGeneratorImporterFuerTests,
    vorladenPdfGenerator,
    type PdfGeneratorService
} from "../../src/services/pdfGeneratorLazy";
import { uiFeedback } from "../../src/core/UiFeedback";
import { findeNamensraum, hatFunktion } from "../../src/services/chunkLaden";
import { readFileSync } from "node:fs";
import path from "node:path";

// B3 (THW-Review 2026-10-04): Ein fehlgeschlagener Lazy-Import blieb gecacht,
// Vordruck und ZIP gingen danach bis zum Neuladen nicht mehr – ohne Meldung.
describe("ladePdfGenerator", () => {
    afterEach(() => {
        setzePdfGeneratorImporterFuerTests(null);
        vi.restoreAllMocks();
    });

    const dienst = { sanitizeFileName: (n: string) => n } as unknown as PdfGeneratorService;

    it("versucht es nach einem Fehlschlag beim nächsten Aufruf erneut", async () => {
        const fehler = vi.spyOn(uiFeedback, "error").mockImplementation(() => undefined);
        const importer = vi.fn()
            .mockRejectedValueOnce(new TypeError("Failed to fetch dynamically imported module"))
            .mockResolvedValueOnce(dienst);
        setzePdfGeneratorImporterFuerTests(importer);

        await expect(ladePdfGenerator()).rejects.toThrow("Failed to fetch");
        expect(fehler).toHaveBeenCalledWith(PDF_LADEFEHLER_MELDUNG, expect.objectContaining({ folgefehlerUnterdrueckenMs: expect.any(Number) }));

        await expect(ladePdfGenerator()).resolves.toBe(dienst);
        expect(importer).toHaveBeenCalledTimes(2);
    });

    it("lädt nach Erfolg nur einmal", async () => {
        const importer = vi.fn().mockResolvedValue(dienst);
        setzePdfGeneratorImporterFuerTests(importer);

        await ladePdfGenerator();
        await ladePdfGenerator();
        expect(importer).toHaveBeenCalledTimes(1);
    });

    it("die Meldung sagt, was zu tun ist – auch, wenn ein neuer Versuch nicht reicht", () => {
        expect(PDF_LADEFEHLER_MELDUNG).toMatch(/Verbindung/);
        expect(PDF_LADEFEHLER_MELDUNG).toMatch(/erneut/);
        expect(PDF_LADEFEHLER_MELDUNG).toMatch(/Seite mit Netz neu/);
    });

    // Offline P1-1 (THW-Review 2026-10-05): Chromium merkt sich ein
    // gescheitertes import() derselben URL bis zum Neuladen. Der zweite
    // Versuch muss deshalb eine andere Adresse abrufen.
    it("ruft nach einem Fehlschlag dieselbe Datei unter neuer Adresse ab", async () => {
        vi.spyOn(uiFeedback, "error").mockImplementation(() => undefined);
        const url = "https://sprechfunk-uebung.de/pdfGenerator-b1jgK7B2.js";
        const importer = vi.fn()
            .mockRejectedValueOnce(new TypeError(`Failed to fetch dynamically imported module: ${url}`))
            .mockRejectedValueOnce(new TypeError("Failed to fetch"))
            .mockResolvedValueOnce(dienst);
        setzePdfGeneratorImporterFuerTests(importer);

        await expect(ladePdfGenerator()).rejects.toThrow();
        await expect(ladePdfGenerator()).rejects.toThrow();
        await expect(ladePdfGenerator()).resolves.toBe(dienst);
        expect(importer.mock.calls).toEqual([[undefined], [`${url}?neuladen=1`], [`${url}?neuladen=2`]]);
    });

    it("liest die Chunk-Adresse aus den Meldungen von Chromium und Firefox", () => {
        const url = "https://example.org/app/pdfGenerator-x1.js";
        expect(chunkUrlAusFehler(new TypeError(`Failed to fetch dynamically imported module: ${url}`))).toBe(url);
        expect(chunkUrlAusFehler(new TypeError(`error loading dynamically imported module: ${url}?neuladen=3`))).toBe(url);
        expect(chunkUrlAusFehler(new TypeError("Importing a module script failed."))).toBeUndefined();
        expect(chunkUrlAusFehler("kein Fehler")).toBeUndefined();
        expect(neuerVersuchUrl(url, 2)).toBe(`${url}?neuladen=2`);
        expect(neuerVersuchUrl(`${url}?v=1`, 2)).toBe(`${url}?v=1&neuladen=2`);
    });

    it("findet im gebündelten Chunk das Namensraum-Objekt trotz verkürzter Exportnamen", () => {
        const dienst = { default: { generateAllPDFsAsZip: () => undefined } };
        const gebuendelt = { a: { default: 1 }, p: dienst };
        expect(findeNamensraum(gebuendelt, hatFunktion("default", "generateAllPDFsAsZip"))).toBe(dienst);
        expect(findeNamensraum(dienst, hatFunktion("default", "generateAllPDFsAsZip"))).toBe(dienst);
        const zip = { generateAllPDFsAsZipBlob: () => undefined };
        expect(findeNamensraum({ z: zip }, hatFunktion("generateAllPDFsAsZipBlob"))).toBe(zip);
        expect(() => findeNamensraum({ x: 1 }, hatFunktion("default", "x"))).toThrow();
    });

    // Ein Chunk, der aus dem Druckteil-Chunk importiert, scheitert dauerhaft,
    // wenn dessen erster Abruf scheiterte – der ZIP-Teil darf das nicht.
    it("der ZIP-Dienst importiert nichts aus src/pdf", () => {
        const quelle = readFileSync(path.resolve(__dirname, "..", "..", "src", "services", "pdfZipService.ts"), "utf8");
        expect(quelle).not.toMatch(/from "\.\.\/pdf\//);
    });

    // analog-first P3-2: Der Notfall-ZIP ging auf einem reinen
    // Teilnehmer-Gerät offline nicht, weil JSZip ein eigener Chunk ist.
    it("vorladen lädt mit dem Druckteil auch den ZIP-Teil", async () => {
        const vorladenZip = vi.fn(async () => undefined);
        setzePdfGeneratorImporterFuerTests(vi.fn().mockResolvedValue({ ...dienst, vorladenZip }));
        vorladenPdfGenerator();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(vorladenZip).toHaveBeenCalledTimes(1);
    });

    it("ohne Adresse in der Meldung bleibt es beim Original-Import", async () => {
        vi.spyOn(uiFeedback, "error").mockImplementation(() => undefined);
        const importer = vi.fn()
            .mockRejectedValueOnce(new TypeError("Importing a module script failed."))
            .mockResolvedValueOnce(dienst);
        setzePdfGeneratorImporterFuerTests(importer);
        await expect(ladePdfGenerator()).rejects.toThrow();
        await ladePdfGenerator();
        expect(importer.mock.calls).toEqual([[undefined], [undefined]]);
    });

    it("vorladen meldet Fehler nicht, lässt aber einen späteren Klick neu laden", async () => {
        const fehler = vi.spyOn(uiFeedback, "error").mockImplementation(() => undefined);
        const importer = vi.fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce(dienst);
        setzePdfGeneratorImporterFuerTests(importer);

        vorladenPdfGenerator();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(fehler).not.toHaveBeenCalled();

        await expect(ladePdfGenerator()).resolves.toBe(dienst);
    });
});
