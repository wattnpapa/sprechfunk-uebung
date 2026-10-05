import { describe, expect, it } from "vitest";
import { hatEigeneUnterlagen, teilnehmerMitUnterlagen } from "../../src/pdf/druckTeilnehmer";

// THW-Review 2026-10-05, workflow W8: Die beübte Stelle bekam im ZIP einen
// Teilnehmerordner mit leerer Übersicht und Deckblättern ohne Vordrucke.
describe("teilnehmerMitUnterlagen", () => {
    const fs = { slug: "x", beuebteStelle: "EL 10", uebergeordnet: "Stab", unterstellt: ["EA 1"] };

    it("lässt nur die beübte Stelle weg", () => {
        expect(teilnehmerMitUnterlagen({ teilnehmerListe: ["EL 10", "EA 1", "Stab"], fuehrungsstelle: fs })).toEqual(["EA 1", "Stab"]);
        expect(hatEigeneUnterlagen({ fuehrungsstelle: fs }, "EL 10")).toBe(false);
        expect(hatEigeneUnterlagen({ fuehrungsstelle: fs }, "EA 1")).toBe(true);
    });

    it("klassische Übungen behalten alle Teilnehmer", () => {
        expect(teilnehmerMitUnterlagen({ teilnehmerListe: ["A", "B"] })).toEqual(["A", "B"]);
        expect(hatEigeneUnterlagen({}, "A")).toBe(true);
    });
});
