import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SZENARIEN } from "../../src/data/szenarien";
import { parseSzenario } from "../../src/services/SzenarioService";
import { szenarioMaxTeilnehmer, type Szenario } from "../../src/types/Szenario";
import { enthaeltBuchstabierAufgabe } from "../../src/utils/buchstabieren";

/**
 * Hält die mitgelieferten Szenarien (assets/szenarien/*.json), die Registry
 * (src/data/szenarien.ts) und den Datenvertrag (SzenarioService.parseSzenario)
 * synchron — analog zu tests/seo/FunkspruchArchiv.test.ts für die Vorlagen.
 */

const SZENARIEN_DIR = path.join(process.cwd(), "assets", "szenarien");

function ladeSzenario(slug: string): Szenario {
    const roh = readFileSync(path.join(SZENARIEN_DIR, `${slug}.json`), "utf-8");
    return parseSzenario(slug, JSON.parse(roh));
}

const slugs = Object.keys(SZENARIEN);

describe("Szenario-Bestand", () => {
    it("führt jede Datei unter assets/szenarien in der Registry — und umgekehrt", () => {
        const dateien = readdirSync(SZENARIEN_DIR)
            .filter(name => name.endsWith(".json"))
            .sort();
        const erwartet = Object.values(SZENARIEN)
            .map(eintrag => path.basename(eintrag.filename))
            .sort();
        expect(dateien).toEqual(erwartet);
    });

    it("verweist in der Registry auf den Pfad, den der Generator lädt", () => {
        Object.entries(SZENARIEN).forEach(([slug, eintrag]) => {
            expect(eintrag.filename).toBe(`assets/szenarien/${slug}.json`);
        });
    });

    describe.each(slugs)("Szenario %s", slug => {
        const szenario = ladeSzenario(slug);
        const alleSprueche = [
            ...szenario.einleitung.map(s => s.text),
            ...szenario.straenge.flatMap(strang => strang.sprueche.map(s => s.text)),
            ...szenario.abschluss.map(s => s.text)
        ];

        it("besteht den Datenvertrag und trägt den Registry-Titel", () => {
            expect(szenario.titel).toBe(SZENARIEN[slug]?.titel);
            expect(szenario.beschreibung.length).toBeGreaterThan(20);
            expect(szenario.lage.length).toBeGreaterThan(50);
        });

        it("skaliert über eine sinnvolle Teilnehmerspanne", () => {
            expect(szenario.minTeilnehmer).toBeGreaterThanOrEqual(2);
            expect(szenario.minTeilnehmer).toBeLessThanOrEqual(4);
            // Genug Stränge, damit auch größere Übungen jedem Teilnehmer
            // einen eigenen Strang geben können.
            expect(szenarioMaxTeilnehmer(szenario)).toBeGreaterThanOrEqual(10);
        });

        it("hält die Strang-Struktur ein", () => {
            szenario.straenge.forEach(strang => {
                expect(strang.sprueche.length).toBeGreaterThanOrEqual(3);
                expect(strang.sprueche.length).toBeLessThanOrEqual(8);
                // Rundsprüche bleiben selten: höchstens einer je Strang.
                const anAlle = strang.sprueche.filter(s => s.empfaenger === "alle").length;
                expect(anAlle).toBeLessThanOrEqual(1);
            });
        });

        it("verwendet jeden Spruchtext nur einmal", () => {
            const normalisiert = alleSprueche.map(text => text.toLowerCase());
            expect(new Set(normalisiert).size).toBe(normalisiert.length);
        });

        it("enthält Buchstabier-Aufgaben und mindestens eine Stärkemeldung", () => {
            const mitBuchstabieren = alleSprueche.filter(text => enthaeltBuchstabierAufgabe(text));
            expect(mitBuchstabieren.length).toBeGreaterThanOrEqual(5);

            const staerkeRegex = /(\d{1,3})\s*\/+\s*(\d{1,3})\s*\/+\s*(\d{1,3})\s*\/+\s*(\d{1,3})/;
            const mitStaerke = alleSprueche.filter(text => staerkeRegex.test(text));
            expect(mitStaerke.length).toBeGreaterThanOrEqual(1);
        });

        it("nutzt nur die bekannten Platzhalter", () => {
            alleSprueche.forEach(text => {
                // Jede öffnende Klammer muss zu einem bekannten Platzhalter gehören.
                const reste = text
                    .replaceAll("{{ich}}", "")
                    .replaceAll("{{partner}}", "")
                    .replaceAll("{{leitung}}", "");
                expect(reste).not.toContain("{{");
                expect(reste).not.toContain("}}");
            });
        });
    });
});
