import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EINSPIELUNGEN } from "../../src/data/einspielungen";
import { parseEinspielung } from "../../src/services/EinspielungService";
import { einspielungAnzahlJeWeg, type Einspielung, type EinspielungArt } from "../../src/types/Einspielung";
import { enthaeltBuchstabierAufgabe } from "../../src/utils/buchstabieren";

/**
 * Hält die mitgelieferten Einspielungen (assets/einspielungen/*.json), die
 * Registry (src/data/einspielungen.ts) und den Datenvertrag
 * (EinspielungService.parseEinspielung) synchron — analog zu
 * tests/szenarien/SzenarioBestand.test.ts. Zusätzlich prüft er, was ein
 * Drehbuch für eine dreistündige Führungsstellen-Übung mindestens braucht:
 * Dichte, Mischung der Wege und Meldearten, Stärkemeldungen, Buchstabieraufgaben.
 */

const EINSPIELUNGEN_DIR = path.join(process.cwd(), "assets", "einspielungen");

function ladeEinspielung(slug: string): Einspielung {
    const roh = readFileSync(path.join(EINSPIELUNGEN_DIR, `${slug}.json`), "utf-8");
    return parseEinspielung(slug, JSON.parse(roh));
}

const slugs = Object.keys(EINSPIELUNGEN);
const STAERKE_THW = /\b\d{1,3}\/\d{1,3}\/\d{1,3}\/\/\d{1,3}\b/;
const PFLICHT_ARTEN: EinspielungArt[] = [
    "betrieb", "lagemeldung", "anforderung", "rueckfrage", "auftrag", "information", "vollzug"
];

describe("Einspielungs-Bestand", () => {
    it("führt jede Datei unter assets/einspielungen in der Registry — und umgekehrt", () => {
        const dateien = readdirSync(EINSPIELUNGEN_DIR)
            .filter(name => name.endsWith(".json"))
            .sort();
        const erwartet = Object.values(EINSPIELUNGEN)
            .map(eintrag => path.basename(eintrag.filename))
            .sort();
        expect(dateien).toEqual(erwartet);
    });

    it("verweist in der Registry auf den Pfad, den der Generator lädt", () => {
        Object.entries(EINSPIELUNGEN).forEach(([slug, eintrag]) => {
            expect(eintrag.filename).toBe(`assets/einspielungen/${slug}.json`);
        });
    });

    describe.each(slugs)("Einspielung %s", slug => {
        const einspielung = ladeEinspielung(slug);
        const texte = einspielung.einlagen.map(e => e.text);
        const anzahlAbschnitte = einspielung.einsatzabschnitte.length;

        it("besteht den Datenvertrag und trägt den Registry-Titel", () => {
            expect(einspielung.titel).toBe(EINSPIELUNGEN[slug]?.titel);
            expect(einspielung.beschreibung.length).toBeGreaterThan(40);
            expect(einspielung.lage.length).toBeGreaterThan(200);
            expect(einspielung.auftrag.length).toBeGreaterThan(50);
            expect(einspielung.uebergeordnet.hintergrund.length).toBeGreaterThan(80);
            einspielung.einsatzabschnitte.forEach(abschnitt => {
                expect(abschnitt.hintergrund.length).toBeGreaterThan(80);
            });
        });

        it("ist auf eine Führungsstellen-Übung von zwei bis vier Stunden ausgelegt", () => {
            expect(einspielung.dauerMinuten).toBeGreaterThanOrEqual(120);
            expect(einspielung.dauerMinuten).toBeLessThanOrEqual(240);
            expect(anzahlAbschnitte).toBeGreaterThanOrEqual(2);
            expect(anzahlAbschnitte).toBeLessThanOrEqual(4);
        });

        it("beschäftigt die Führungsstelle über die ganze Dauer ohne lange Pausen", () => {
            const zeiten = einspielung.einlagen.map(e => e.zeit);
            expect(einspielung.einlagen.length).toBeGreaterThanOrEqual(40);
            expect(zeiten[0]).toBeLessThanOrEqual(5);
            expect(zeiten[zeiten.length - 1]).toBeGreaterThanOrEqual(einspielung.dauerMinuten - 30);
            for (let i = 1; i < zeiten.length; i++) {
                expect((zeiten[i] as number) - (zeiten[i - 1] as number)).toBeLessThanOrEqual(15);
            }
            // Höchstens zwei Einlagen je Minute — sonst überfährt die Einspielung die Stelle.
            const jeMinute = new Map<number, number>();
            zeiten.forEach(zeit => jeMinute.set(zeit, (jeMinute.get(zeit) ?? 0) + 1));
            jeMinute.forEach(anzahl => expect(anzahl).toBeLessThanOrEqual(2));
        });

        it("lässt jeden Einsatzabschnitt und den Stab regelmäßig zu Wort kommen", () => {
            for (let i = 1; i <= anzahlAbschnitte; i++) {
                const vomAbschnitt = einspielung.einlagen.filter(e => e.von === `ea${i}`);
                expect(vomAbschnitt.length).toBeGreaterThanOrEqual(8);
                // Einsatzabschnitte melden über Funk; Ausdruck und E-Mail kommen vom Stab.
                vomAbschnitt.forEach(e => expect(e.weg).toBe("funk"));
            }
            const vomStab = einspielung.einlagen.filter(e => e.von === "stab");
            expect(vomStab.length).toBeGreaterThanOrEqual(10);
        });

        it("mischt Funk, Ausdruck und E-Mail — mit Funk als Hauptweg", () => {
            const jeWeg = einspielungAnzahlJeWeg(einspielung);
            expect(jeWeg.drucker).toBeGreaterThanOrEqual(4);
            expect(jeWeg.email).toBeGreaterThanOrEqual(2);
            expect(jeWeg.funk).toBeGreaterThanOrEqual(einspielung.einlagen.length * 0.6);
        });

        it("enthält jede Meldeart und mindestens einen Auftrag mit Vollzugsmeldung", () => {
            PFLICHT_ARTEN.forEach(art => {
                expect(einspielung.einlagen.some(e => e.art === art), `Meldeart ${art} fehlt`).toBe(true);
            });
            expect(einspielung.einlagen.filter(e => e.art === "auftrag").length).toBeGreaterThanOrEqual(4);
            expect(einspielung.einlagen.filter(e => e.art === "rueckfrage").length).toBeGreaterThanOrEqual(4);
        });

        it("verwendet jeden Einlagentext nur einmal und nennt eine erwartete Reaktion", () => {
            const normalisiert = texte.map(text => text.toLowerCase());
            expect(new Set(normalisiert).size).toBe(normalisiert.length);
            einspielung.einlagen.forEach(e => {
                expect(e.erwartung.length).toBeGreaterThanOrEqual(20);
            });
        });

        it("enthält Buchstabier-Aufgaben und Stärkemeldungen im THW-Schema", () => {
            const mitBuchstabieren = texte.filter(text => enthaeltBuchstabierAufgabe(text));
            expect(mitBuchstabieren.length).toBeGreaterThanOrEqual(5);
            const mitStaerke = texte.filter(text => STAERKE_THW.test(text));
            expect(mitStaerke.length).toBeGreaterThanOrEqual(3);
        });

        it("bleibt beim Nachrichteninhalt: kein Betriebsgespräch, keine Übungsleitung im Text", () => {
            texte.forEach(text => {
                expect(text.toLowerCase()).not.toContain("übungsleitung");
                expect(text).not.toMatch(/(^|\s)(kommen|ende|roger|over)[.!]?$/i);
                expect(text).not.toMatch(/\bhier\s+\{\{/i);
            });
        });
    });
});
