import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FUEHRUNGSSTELLEN_UEBUNGEN } from "../../src/data/fuehrungsstellenUebungen";
import { parseFuehrungsstellenUebung } from "../../src/services/FuehrungsstellenUebungService";
import {
    fuehrungsstellenZeitachse,
    MELDEARTEN,
    type FuehrungsstellenUebung
} from "../../src/types/FuehrungsstellenUebung";
import { enthaeltBuchstabierAufgabe } from "../../src/utils/buchstabieren";

/**
 * Hält die mitgelieferten Drehbücher (assets/fuehrungsstellen/*.json), die
 * Registry (src/data/fuehrungsstellenUebungen.ts) und den Datenvertrag
 * (parseFuehrungsstellenUebung) synchron — analog zu
 * tests/szenarien/SzenarioBestand.test.ts. Zusätzlich prüft er, was ein
 * Drehbuch für eine dreistündige Führungsstellen-Übung mindestens braucht:
 * Dichte über die ganze Dauer, Mischung der Wege und Meldearten,
 * Stärkemeldungen, Buchstabieraufgaben, Aufträge, die die Führungsstelle an
 * einen bestimmten Abschnitt weitergeben muss.
 */

const DIR = path.join(process.cwd(), "assets", "fuehrungsstellen");

function ladeUebung(slug: string): FuehrungsstellenUebung {
    const roh = readFileSync(path.join(DIR, `${slug}.json`), "utf-8");
    return parseFuehrungsstellenUebung(slug, JSON.parse(roh));
}

const slugs = Object.keys(FUEHRUNGSSTELLEN_UEBUNGEN);
const STAERKE_THW = /\b\d{1,3}\/\d{1,3}\/\d{1,3}\/\/\d{1,3}\b/;

describe("Führungsstellen-Bestand", () => {
    it("führt jede Datei unter assets/fuehrungsstellen in der Registry — und umgekehrt", () => {
        const dateien = readdirSync(DIR)
            .filter(name => name.endsWith(".json"))
            .sort();
        const erwartet = Object.values(FUEHRUNGSSTELLEN_UEBUNGEN)
            .map(eintrag => path.basename(eintrag.filename))
            .sort();
        expect(dateien).toEqual(erwartet);
    });

    it("verweist in der Registry auf den Pfad, den der Generator lädt", () => {
        Object.entries(FUEHRUNGSSTELLEN_UEBUNGEN).forEach(([slug, eintrag]) => {
            expect(eintrag.filename).toBe(`assets/fuehrungsstellen/${slug}.json`);
        });
    });

    describe.each(slugs)("Führungsstellen-Übung %s", slug => {
        // Lade- oder Vertragsfehler eines Drehbuchs sollen nur dessen Block
        // rot machen, nicht die ganze Datei — so bleibt der Bestand prüfbar,
        // während ein neues Drehbuch entsteht.
        let geladen: FuehrungsstellenUebung | null = null;
        let ladeFehler: unknown = null;
        try {
            geladen = ladeUebung(slug);
        } catch (fehler) {
            ladeFehler = fehler;
        }

        it("lässt sich laden und besteht den Datenvertrag", () => {
            expect(ladeFehler, ladeFehler instanceof Error ? ladeFehler.message : "").toBeNull();
        });

        if (!geladen) {
            return;
        }
        const uebung = geladen;
        const zeitachse = fuehrungsstellenZeitachse(uebung);
        const alle = zeitachse.map(eintrag => eintrag.nachricht);
        const texte = alle.map(n => n.text);
        const vomStab = uebung.uebergeordnet.nachrichten;

        it("besteht den Datenvertrag und trägt den Registry-Titel", () => {
            expect(uebung.titel).toBe(FUEHRUNGSSTELLEN_UEBUNGEN[slug]?.titel);
            expect(uebung.beschreibung.length).toBeGreaterThan(40);
            expect(uebung.lage.length).toBeGreaterThan(200);
            expect(uebung.auftrag.length).toBeGreaterThan(50);
            expect(uebung.uebergeordnet.hintergrund.length).toBeGreaterThan(80);
            uebung.straenge.forEach(strang => {
                expect(strang.hintergrund.length).toBeGreaterThan(80);
            });
        });

        it("ist auf zwei bis vier Stunden und zwei bis acht Einsatzabschnitte ausgelegt", () => {
            expect(uebung.dauerMinuten).toBeGreaterThanOrEqual(120);
            expect(uebung.dauerMinuten).toBeLessThanOrEqual(240);
            expect(uebung.minAbschnitte).toBeGreaterThanOrEqual(2);
            expect(uebung.minAbschnitte).toBeLessThanOrEqual(3);
            // Sechs Stränge verteilen sich auf 2, 3 und 6 Abschnitte gleichmäßig.
            expect(uebung.straenge.length).toBeGreaterThanOrEqual(4);
            expect(uebung.straenge.length).toBeLessThanOrEqual(8);
        });

        it("beschäftigt die Führungsstelle über die ganze Dauer ohne lange Pausen", () => {
            const zeiten = alle.map(n => n.zeit);
            expect(alle.length).toBeGreaterThanOrEqual(50);
            expect(zeiten[0]).toBeLessThanOrEqual(5);
            expect(zeiten[zeiten.length - 1]).toBeGreaterThanOrEqual(uebung.dauerMinuten - 30);
            for (let i = 1; i < zeiten.length; i++) {
                expect((zeiten[i] as number) - (zeiten[i - 1] as number)).toBeLessThanOrEqual(12);
            }
            // Höchstens zwei Nachrichten je Minute — sonst überfährt die Einspielung die Stelle.
            const jeMinute = new Map<number, number>();
            zeiten.forEach(zeit => jeMinute.set(zeit, (jeMinute.get(zeit) ?? 0) + 1));
            jeMinute.forEach(anzahl => expect(anzahl).toBeLessThanOrEqual(2));
        });

        it("lässt jede Einsatzstelle und den Stab regelmäßig zu Wort kommen", () => {
            uebung.straenge.forEach(strang => {
                expect(strang.nachrichten.length).toBeGreaterThanOrEqual(6);
                expect(strang.nachrichten.length).toBeLessThanOrEqual(12);
                // Jede Einsatzstelle meldet sich früh an und bleibt bis zum Ende dabei.
                expect(strang.nachrichten[0]?.zeit).toBeLessThanOrEqual(20);
                expect(strang.nachrichten[strang.nachrichten.length - 1]?.zeit)
                    .toBeGreaterThanOrEqual(uebung.dauerMinuten - 45);
            });
            expect(vomStab.length).toBeGreaterThanOrEqual(12);
        });

        it("mischt Funk, Ausdruck und E-Mail — mit Funk als Hauptweg", () => {
            expect(vomStab.filter(n => n.weg === "drucker").length).toBeGreaterThanOrEqual(5);
            expect(vomStab.filter(n => n.weg === "email").length).toBeGreaterThanOrEqual(3);
            expect(alle.filter(n => n.weg === "funk").length).toBeGreaterThanOrEqual(alle.length * 0.6);
        });

        it("enthält jede Meldeart, Aufträge mit Vollzug und Rückfragen", () => {
            MELDEARTEN.forEach(art => {
                expect(alle.some(n => n.art === art), `Meldeart ${art} fehlt`).toBe(true);
            });
            expect(vomStab.filter(n => n.art === "auftrag").length).toBeGreaterThanOrEqual(5);
            expect(alle.filter(n => n.art === "rueckfrage").length).toBeGreaterThanOrEqual(5);
            expect(alle.filter(n => n.art === "vollzug").length).toBeGreaterThanOrEqual(3);
            expect(alle.filter(n => n.art === "anforderung").length).toBeGreaterThanOrEqual(3);
        });

        it("verlangt von der Führungsstelle, Aufträge an bestimmte Abschnitte weiterzugeben", () => {
            // Die erwartete Reaktion nennt den Abschnitt über {{ea:<strang>}}; erst
            // dadurch kann die Übungsleitung prüfen, ob die Stelle richtig verteilt hat.
            const mitZiel = vomStab.filter(n => /\{\{ea:[a-z0-9-]+\}\}/.test(`${n.text} ${n.erwartung}`));
            expect(mitZiel.length).toBeGreaterThanOrEqual(4);
        });

        it("verwendet jeden Text nur einmal und nennt überall eine erwartete Reaktion", () => {
            const normalisiert = texte.map(text => text.toLowerCase());
            expect(new Set(normalisiert).size).toBe(normalisiert.length);
            alle.forEach(n => {
                expect(n.erwartung.length).toBeGreaterThanOrEqual(20);
            });
        });

        it("enthält Buchstabier-Aufgaben und Stärkemeldungen im THW-Schema", () => {
            const funkTexte = alle.filter(n => n.weg === "funk").map(n => n.text);
            expect(funkTexte.filter(text => enthaeltBuchstabierAufgabe(text)).length).toBeGreaterThanOrEqual(6);
            expect(texte.filter(text => STAERKE_THW.test(text)).length).toBeGreaterThanOrEqual(4);
        });

        it("bleibt beim Nachrichteninhalt: kein Betriebsgespräch, keine Übungsleitung im Text", () => {
            texte.forEach(text => {
                expect(text.toLowerCase()).not.toContain("übungsleitung");
                expect(text).not.toMatch(/(^|\s)(kommen|ende|roger|over)[.!]?$/i);
            });
        });
    });
});
