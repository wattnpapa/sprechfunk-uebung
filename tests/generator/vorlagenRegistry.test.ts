import { describe, expect, it } from "vitest";
import { FUNKSPRUCH_VORLAGEN, HERKUNFT_TEXT } from "../../src/data/funkspruchVorlagen";
import { vorlagenZusatz } from "../../src/generator/GeneratorVorlagenInfo";
import { VORLAGEN } from "../../scripts/lib/funkspruch-daten.mjs";
import { funkspruecheDerVorlage } from "../../scripts/lib/funkspruch-bestand.mjs";

interface BestandsVorlage {
    datei: string;
    slug: string;
    herkunft: "uebung" | "geschrieben";
}

/**
 * Die Vorlagenauswahl nennt Anzahl und Herkunft je Sammlung (THW-Review
 * 2026-10-05, new-user P2-1). Beides muss zum gezählten Bestand passen, sonst
 * stünde in der App eine erfundene Zahl oder eine falsche Herkunft.
 */
describe("Beschreibung der Funkspruch-Vorlagen", () => {
    const bestand = VORLAGEN as BestandsVorlage[];

    it.each(Object.entries(FUNKSPRUCH_VORLAGEN))("%s nennt Anzahl und Herkunft wie der Bestand", (key, vorlage) => {
        const datei = vorlage.filename.replace(/^assets\/funksprueche\//, "");
        const eintrag = bestand.find(v => v.datei === datei);
        expect(eintrag, `${key}: Datei ${datei} fehlt im Bestand`).toBeDefined();
        expect(vorlage.anzahl, `${key}: Anzahl nachziehen`).toBe((funkspruecheDerVorlage(eintrag?.slug) as unknown[]).length);
        expect(vorlage.herkunft).toBe(eintrag?.herkunft);
        expect(vorlage.beschreibung?.length ?? 0).toBeGreaterThan(20);
        // Keine Zahlen in der Beschreibung: Die Anzahl kommt aus dem Feld `anzahl`.
        expect(vorlage.beschreibung).not.toMatch(/\d{2,}/);
    });

    it("setzt die humorvolle Vorlage als Nebensache ab", () => {
        expect(FUNKSPRUCH_VORLAGEN["vorlageLustig"]?.nebenbei).toBe(true);
        expect(FUNKSPRUCH_VORLAGEN["vorlageLustig"]?.text).not.toContain("Chat GPT");
        expect(Object.entries(FUNKSPRUCH_VORLAGEN).filter(([, v]) => v.nebenbei).map(([k]) => k)).toEqual(["vorlageLustig"]);
    });

    it("formt den Zusatz aus Anzahl und Herkunft", () => {
        expect(vorlagenZusatz({ text: "x", filename: "x", anzahl: 1660, herkunft: "geschrieben" }))
            .toBe(`1.660 Sprüche · ${HERKUNFT_TEXT.geschrieben}`);
        expect(vorlagenZusatz({ text: "x", filename: "x" })).toBe("");
    });
});
