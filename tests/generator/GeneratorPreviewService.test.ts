import { describe, expect, it } from "vitest";
import { GeneratorPreviewService } from "../../src/generator/GeneratorPreviewService";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("GeneratorPreviewService", () => {
    it("generates pages and navigates", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B"];
        uebung.nachrichten = { A: [], B: [] };

        const svc = new GeneratorPreviewService();
        svc.generate(uebung);

        const first = svc.getCurrent();
        expect(first?.index).toBe(0);
        expect(first?.total).toBe(2);
        expect(first?.html).toContain("Sprechfunkübung");

        const next = svc.change(1);
        expect(next?.index).toBe(1);
    });

    it("returns null when out of range", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        uebung.nachrichten = { A: [] };
        const svc = new GeneratorPreviewService();
        svc.generate(uebung);

        expect(svc.getAt(-1)).toBeNull();
        expect(svc.getAt(10)).toBeNull();
    });

    it("returns null when page html is empty", () => {
        const svc = new GeneratorPreviewService();
        (svc as unknown as { pages: string[] }).pages = [""];
        expect(svc.getAt(0)).toBeNull();
    });
});
