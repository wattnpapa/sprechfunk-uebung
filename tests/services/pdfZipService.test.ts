import { beforeEach, describe, expect, it, vi } from "vitest";
import { FunkUebung } from "../../src/models/FunkUebung";

const zipFiles: string[] = [];

vi.mock("jszip", () => ({
    default: class {
        file(path: string): void {
            zipFiles.push(path);
        }
        async generateAsync(): Promise<Blob> {
            return new Blob(["zip"]);
        }
    }
}));

const { generateAllPDFsAsZipBlob } = await import("../../src/services/pdfZipService");

function createUebung(): FunkUebung {
    const uebung = new FunkUebung("dev");
    uebung.name = "Testübung";
    uebung.teilnehmerListe = ["Heros Oldenburg 10", "Heros Oldenburg 20"];
    uebung.nachrichten = {
        "Heros Oldenburg 10": [],
        "Heros Oldenburg 20": []
    };
    return uebung;
}

function createDeps() {
    const blobMap = async (uebung: FunkUebung) =>
        new Map(uebung.teilnehmerListe.map(teilnehmer => [teilnehmer, new Blob([teilnehmer])]));
    const singleBlob = async () => new Blob(["pdf"]);

    return {
        sanitizeFileName: (name: string) => name.replace(/[/\\:*?"<>|]/g, "-"),
        generateTeilnehmerPDFsBlob: vi.fn(blobMap),
        generateAllTeilnehmerUebersichtPrintBlob: vi.fn(singleBlob),
        generateInstructorPDFBlob: vi.fn(() => new Blob(["leitung"])),
        generateNachrichtenvordruckPDFsBlob: vi.fn(blobMap),
        generateNachrichtenvordruckA4PDFsBlob: vi.fn(blobMap),
        generateMeldevordruckPDFsBlob: vi.fn(blobMap),
        generateMeldevordruckA4PDFsBlob: vi.fn(blobMap),
        generateAllNachrichtenvordruckPrintBlob: vi.fn(singleBlob),
        generateAllMeldevordruckPrintBlob: vi.fn(singleBlob),
        generateAllNachrichtenvordruckPrintA4Blob: vi.fn(singleBlob),
        generateAllMeldevordruckPrintA4Blob: vi.fn(singleBlob),
        generatePlainNachrichtenvordruckPrintBlob: vi.fn(singleBlob),
        generatePlainMeldevordruckPrintBlob: vi.fn(singleBlob),
        generateNachrichtenvordruckPDFForTeilnehmer: vi.fn(async () => ({ blob: new Blob(["pdf"]), totalPages: 1 })),
        generateMeldevordruckPDFForTeilnehmer: vi.fn(async () => ({ blob: new Blob(["pdf"]), totalPages: 1 }))
    };
}

describe("services/pdfZipService", () => {
    beforeEach(() => {
        zipFiles.length = 0;
    });

    it("adds the combined participant overview PDF to the archive", async () => {
        const uebung = createUebung();
        const deps = createDeps();

        await generateAllPDFsAsZipBlob(uebung, deps);

        expect(deps.generateAllTeilnehmerUebersichtPrintBlob).toHaveBeenCalledWith(uebung);
        expect(zipFiles).toContain("Gesamt/Übersicht_Alle_Teilnehmer.pdf");
        expect(zipFiles).toContain("Teilnehmer/Heros Oldenburg 10/Übersicht_Heros Oldenburg 10.pdf");
    });
});
