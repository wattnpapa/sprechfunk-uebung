import { describe, expect, it } from "vitest";
import pdfGenerator from "../../src/services/pdfGenerator";
import { FunkUebung } from "../../src/models/FunkUebung";
import type { UebungsleitungStorage } from "../../src/types/Storage";

// B2 (THW-Review 2026-10-04): „Übungsleitung als PDF“ scheiterte als erste
// Aktion mit „this.pdf.autoTable is not a function“, weil die Ansicht jsPDF
// direkt importierte. Der PDF-Dienst muss das Plugin selbst mitbringen – hier
// mit echtem jsPDF, ohne vorherigen anderen Export.
describe("pdfGenerator – Übungsleitungs-PDF", () => {
    const uebung = () => {
        const u = new FunkUebung("test");
        u.id = "11111111-2222-3333-4444-555555555555";
        u.name = "Dienstabend";
        u.uebungCode = "K7M4Q2";
        u.leitung = "Heros Wind 10";
        u.rufgruppe = "T_OL_GOLD-1";
        u.teilnehmerListe = ["Heros Oldenburg 21/11", "Heros Oldenburg 22/12"];
        u.teilnehmerIds = { A1B2: "Heros Oldenburg 21/11", C3D4: "Heros Oldenburg 22/12" };
        u.nachrichten = {
            "Heros Oldenburg 21/11": [{ id: 1, empfaenger: ["Heros Oldenburg 22/12"], nachricht: "Kommen" }],
            "Heros Oldenburg 22/12": [{ id: 1, empfaenger: ["Heros Oldenburg 21/11"], nachricht: "Verstanden" }]
        };
        return u;
    };

    it("erzeugt das PDF mit Stand, ohne dass vorher ein anderer Export lief", async () => {
        const stand: UebungsleitungStorage = {
            version: 1,
            uebungId: "x",
            lastUpdated: new Date().toISOString(),
            teilnehmer: { "Heros Oldenburg 21/11": { angemeldetUm: new Date().toISOString(), loesungswortGesendet: "FUNK" } },
            nachrichten: { "Heros Oldenburg 21/11__1": { abgesetztUm: new Date().toISOString() } }
        };
        const blob = pdfGenerator.generateInstructorPDFBlob(uebung(), stand);
        expect(blob).toBeInstanceOf(Blob);
        const text = Buffer.from(await blob.arrayBuffer()).toString("latin1");
        expect(text.startsWith("%PDF")).toBe(true);
    });

    it("erzeugt das leere Papier-PDF für das ZIP", () => {
        const blob = pdfGenerator.generateInstructorPDFBlob(uebung());
        expect(blob.size).toBeGreaterThan(1000);
    });
});
