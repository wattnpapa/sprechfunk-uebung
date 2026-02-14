import { describe, expect, it } from "vitest";
import { UebungHTMLGenerator } from "../../src/services/UebungHTMLGenerator";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("UebungHTMLGenerator", () => {
    it("renders html for participant with messages", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B"];
        uebung.nachrichten = {
            A: [{ id: 1, empfaenger: ["B"], nachricht: "Hallo" }],
            B: []
        };

        const html = UebungHTMLGenerator.generateHTMLPage("A", uebung);
        expect(html).toContain("Sprechfunkübung");
        expect(html).toContain("Hallo");
        expect(html).toContain("A");
    });

    it("renders html without loesungswort when missing", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        uebung.nachrichten = { A: [] };

        const html = UebungHTMLGenerator.generateHTMLPage("A", uebung);
        expect(html).not.toContain("Lösungswort");
    });

    it("includes loesungswort when present", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        uebung.nachrichten = { A: [] };
        uebung.loesungswoerter = { A: "CODE" };

        const html = UebungHTMLGenerator.generateHTMLPage("A", uebung);
        expect(html).toContain("Lösungswort");
        expect(html).toContain("CODE");
    });

    it("handles missing nachrichten list", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        uebung.nachrichten = {};

        const html = UebungHTMLGenerator.generateHTMLPage("A", uebung);
        expect(html).toContain("Folgende Nachrichten");
    });
});
