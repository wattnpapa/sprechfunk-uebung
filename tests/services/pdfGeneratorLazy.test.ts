import { afterEach, describe, expect, it, vi } from "vitest";
import {
    ladePdfGenerator,
    PDF_LADEFEHLER_MELDUNG,
    setzePdfGeneratorImporterFuerTests,
    vorladenPdfGenerator,
    type PdfGeneratorService
} from "../../src/services/pdfGeneratorLazy";
import { uiFeedback } from "../../src/core/UiFeedback";

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
        expect(fehler).toHaveBeenCalledWith(PDF_LADEFEHLER_MELDUNG);

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

    it("die Meldung sagt, was zu tun ist", () => {
        expect(PDF_LADEFEHLER_MELDUNG).toMatch(/Verbindung/);
        expect(PDF_LADEFEHLER_MELDUNG).toMatch(/erneut/);
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
