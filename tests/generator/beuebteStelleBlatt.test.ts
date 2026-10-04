import { afterEach, describe, expect, it, vi } from "vitest";
import { baueBlattBeuebteStelle, druckeBlatt } from "../../src/generator/beuebteStelleBlatt";

const uebung = {
    name: "Hochwasser <Probe>",
    datum: new Date(2026, 9, 6),
    rufgruppe: "RG 1",
    leitung: "Heros 1",
    fuehrungsstelle: {
        slug: "hochwasser-fuehrungsstelle",
        beuebteStelle: "Heros Lohne 10",
        uebergeordnet: "Kater Vechta",
        unterstellt: ["Heros Lohne 21/10", "Heros Lohne 22/10"],
        beginn: "09:00",
        stellen: { "Heros Lohne 10": "Einsatzleitung" }
    }
};
const drehbuch = { titel: "Hochwasser", lage: "Der Pegel steigt.", auftrag: "Führen Sie die Einsatzstellen.", dauerMinuten: 180 };

describe("baueBlattBeuebteStelle", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("enthält Lage, Auftrag und Funkrufnamen, aber keine Erwartungen", () => {
        const html = baueBlattBeuebteStelle(uebung, drehbuch);
        expect(html).toContain("Der Pegel steigt.");
        expect(html).toContain("Führen Sie die Einsatzstellen.");
        expect(html).toContain("Heros Lohne 10 (Einsatzleitung)");
        expect(html).toContain("Einsatzabschnitt 2");
        expect(html).toContain("09:00 Uhr");
        expect(html).toContain("6.10.2026");
        expect(html).not.toMatch(/Erwartet/i);
        // Nutzerdaten werden maskiert.
        expect(html).toContain("Hochwasser &lt;Probe&gt;");
    });

    it("kommt ohne Rollen und Beginn aus", () => {
        const html = baueBlattBeuebteStelle({ ...uebung, fuehrungsstelle: undefined }, drehbuch);
        expect(html).toContain("laut Übungsleitung");
        expect(html).not.toContain("<h2>Funkrufnamen</h2>");
    });

    it("öffnet ein Druckfenster und meldet blockierte Pop-ups", () => {
        const doc = { open: vi.fn(), write: vi.fn(), close: vi.fn() };
        const fenster = { document: doc, focus: vi.fn(), print: vi.fn() };
        vi.stubGlobal("window", { open: vi.fn(() => fenster) });
        expect(druckeBlatt("<p>x</p>")).toBe(true);
        expect(doc.write).toHaveBeenCalledWith("<p>x</p>");
        expect(fenster.print).toHaveBeenCalled();

        vi.stubGlobal("window", { open: vi.fn(() => null) });
        expect(druckeBlatt("<p>x</p>")).toBe(false);
    });
});
