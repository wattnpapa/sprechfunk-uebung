import { afterEach, describe, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import { qrMatrix } from "../../scripts/lib/qrcode.mjs";
import {
    STANDARD_BASIS_URL,
    appBasisUrl,
    teilnehmerCodeVon,
    teilnehmerZugangsUrl,
    uebungCodeVon,
    uebungsleitungUrl,
    zeichneQrCode
} from "../../src/pdf/zugang";
import pdfGenerator from "../../src/services/pdfGenerator";
import { FunkUebung } from "../../src/models/FunkUebung";

// THW-Review 2026-10-04 (analog-first P2-1/P2-3, workflow F5): Ausdrucke
// tragen Zugangscodes, QR-Code und Felder zum Abhaken.
describe("pdf/zugang – Hilfsfunktionen", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("nimmt die Adresse der laufenden App, sonst die öffentliche", () => {
        expect(appBasisUrl()).toBe(STANDARD_BASIS_URL);
        vi.stubGlobal("window", { location: { protocol: "http:", origin: "http://127.0.0.1:3101", pathname: "/" } });
        expect(appBasisUrl()).toBe("http://127.0.0.1:3101/");
        vi.stubGlobal("window", { location: { protocol: "file:", origin: "null", pathname: "/x/index.html" } });
        expect(appBasisUrl()).toBe(STANDARD_BASIS_URL);
    });

    it("findet Codes und baut dieselben Links wie der Generator", () => {
        const uebung = { uebungCode: "k7m4q2", teilnehmerIds: { a1b2: "Heros 1", C3D4: "Heros 2" } };
        expect(uebungCodeVon(uebung)).toBe("K7M4Q2");
        expect(uebungCodeVon({})).toBeNull();
        expect(teilnehmerCodeVon(uebung, "Heros 1")).toBe("A1B2");
        expect(teilnehmerCodeVon(uebung, "Unbekannt")).toBeNull();
        expect(teilnehmerZugangsUrl(STANDARD_BASIS_URL, "K7M4Q2", "A1B2"))
            .toBe("https://sprechfunk-uebung.de/#/teilnehmer?uc=K7M4Q2&tc=A1B2");
        expect(uebungsleitungUrl(STANDARD_BASIS_URL, "id-1")).toBe("https://sprechfunk-uebung.de/#/uebungsleitung/id-1");
    });

    it("zeichnet genau die Module der QR-Matrix", () => {
        const text = "https://sprechfunk-uebung.de/#/teilnehmer?uc=K7M4Q2&tc=A1B2";
        const { matrix, groesse } = qrMatrix(text);
        const rechtecke: Array<[number, number, number, number]> = [];
        let fuellung = "";
        const pdf = {
            setFillColor: (r: number) => {
                fuellung = r === 0 ? "schwarz" : "weiss";
            },
            rect: (x: number, y: number, w: number, h: number) => {
                if (fuellung === "schwarz") rechtecke.push([x, y, w, h]);
            }
        };
        const kante = groesse + 8; // 1 mm je Modul
        zeichneQrCode(pdf as never, text, 0, 0, kante);

        const gezeichnet = Array.from({ length: groesse }, () => Array<boolean>(groesse).fill(false));
        for (const [x, y, w] of rechtecke) {
            for (let j = Math.round(x) - 4; j < Math.round(x + w) - 4; j++) {
                gezeichnet[Math.round(y) - 4]![j] = true;
            }
        }
        expect(gezeichnet).toEqual(matrix);
    });
});

describe("Ausdrucke mit Zugangsdaten (echtes jsPDF)", () => {
    /** Text aller Inhaltsströme; die PDFs sind seit P3 Flate-komprimiert. */
    const pdfText = async (blob: Blob) => {
        const roh = Buffer.from(await blob.arrayBuffer());
        const text = roh.toString("latin1");
        const teile: string[] = [];
        const muster = /stream\r?\n/g;
        let treffer: RegExpExecArray | null;
        while ((treffer = muster.exec(text)) !== null) {
            const start = treffer.index + treffer[0].length;
            const ende = text.indexOf("endstream", start);
            try {
                teile.push(inflateSync(roh.subarray(start, ende)).toString("latin1"));
            } catch {
                // Bilddaten o. Ä. – nicht relevant
            }
        }
        return teile.join("\n");
    };

    const uebung = () => {
        const u = new FunkUebung("test");
        u.name = "Dienstabend";
        u.uebungCode = "K7M4Q2";
        u.teilnehmerListe = ["Heros 1", "Heros 2"];
        u.teilnehmerIds = { A1B2: "Heros 1", C3D4: "Heros 2" };
        u.nachrichten = {
            "Heros 1": [{ id: 1, empfaenger: ["Heros 2"], nachricht: "Kommen" }],
            "Heros 2": [{ id: 1, empfaenger: ["Heros 1"], nachricht: "Verstanden" }]
        };
        return u;
    };

    it("Teilnehmer-Übersicht: Übungscode, Teilnehmercode und Abhak-Spalte", async () => {
        const blobs = await pdfGenerator.generateTeilnehmerPDFsBlob(uebung());
        const text = await pdfText(blobs.get("Heros 1")!);
        expect(text).toContain("(K7M4Q2)");
        expect(text).toContain("(A1B2)");
        expect(text).toContain("(Teilnehmercode)");
        // Der Spaltenkopf bricht in der schmalen Spalte um.
        expect(text).toContain("(Abgesetzt");
        expect(text).toContain("Uhrzeit");
        expect(text).toContain("Teilnehmeransicht");
    });

    it("Übungsleitung: Codes je Teilnehmer, Ist-Felder und Hinweis für den Papierbetrieb", async () => {
        const text = await pdfText(pdfGenerator.generateInstructorPDFBlob(uebung()));
        expect(text).toContain("Code: A1B2");
        expect(text).toContain("Code: C3D4");
        // jsPDF schreibt WinAnsi; als latin1 gelesen steht das Ü wieder da.
        expect(text).toContain("Übungscode: K7M4Q2");
        expect(text).toContain("https://sprechfunk-uebung.de/#/teilnehmer, dort");
        expect(text).toContain("Ist)");
        expect(text).toContain("(Abgesetzt");
        expect(text).toContain("Ohne Netz");
    });

    it("Altbestand ohne Codes: kein Code-Feld, kein Fehler", async () => {
        const u = uebung();
        u.uebungCode = "";
        u.teilnehmerIds = {};
        const blobs = await pdfGenerator.generateTeilnehmerPDFsBlob(u);
        const text = await pdfText(blobs.get("Heros 1")!);
        expect(text).not.toContain("(Teilnehmercode)");
    });

    it("Vordrucke sind komprimiert (P3: vorher rund 1,9 MB je Datei)", async () => {
        const blobs = await pdfGenerator.generateMeldevordruckPDFsBlob(uebung());
        expect(blobs.get("Heros 1")!.size).toBeLessThan(200_000);
    });
});
