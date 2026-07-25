import { describe, expect, it } from "vitest";
import {
    enthaeltBuchstabierAufgabe,
    entferneBuchstabierAufgaben,
    erzeugeBuchstabierAufgabe,
    istBuchstabierWort,
    zaehleBuchstabierAufgaben
} from "../../src/utils/buchstabieren";

describe("istBuchstabierWort", () => {
    it("erkennt großgeschriebene Wörter ab 5 Zeichen", () => {
        expect(istBuchstabierWort("MJÖLNIR")).toBe(true);
        expect(istBuchstabierWort("METEOR-FELD")).toBe(true);
        expect(istBuchstabierWort("WALL-E")).toBe(true);
    });

    it("ignoriert kurze Wörter und Normalschreibweise", () => {
        expect(istBuchstabierWort("THW")).toBe(false);
        expect(istBuchstabierWort("MANV")).toBe(false);
        expect(istBuchstabierWort("Mjölnir")).toBe(false);
    });

    it("ignoriert Zahlen und Kennungen ohne zwei Buchstaben", () => {
        expect(istBuchstabierWort("12345")).toBe(false);
        expect(istBuchstabierWort("B-1234")).toBe(false);
        expect(istBuchstabierWort("1/2/3/4")).toBe(false);
    });
});

describe("enthaeltBuchstabierAufgabe", () => {
    it("findet Buchstabierwörter auch mit Satzzeichen", () => {
        expect(enthaeltBuchstabierAufgabe("Fahre nach NIENBURG.")).toBe(true);
        expect(enthaeltBuchstabierAufgabe("Fahre nach Nienburg.")).toBe(false);
    });

    it("zählt über eine Liste", () => {
        expect(zaehleBuchstabierAufgaben(["Meldung EINSATZ", "Meldung normal", "12345"])).toBe(1);
    });
});

describe("entferneBuchstabierAufgaben", () => {
    it("überführt Großschreibung in Normalschreibweise", () => {
        expect(entferneBuchstabierAufgaben("Fahre nach NIENBURG.")).toBe("Fahre nach Nienburg.");
        expect(entferneBuchstabierAufgaben("Ziel ist das METEOR-FELD")).toBe("Ziel ist das Meteor-Feld");
    });

    it("lässt Zahlen, Stärkeangaben und kurze Kürzel unangetastet", () => {
        const text = "THW MANV Aktuelle Stärke: 1/2/3/4 Kennung B-1234";
        expect(entferneBuchstabierAufgaben(text)).toBe(text);
    });

    it("ist idempotent und entfernt jede Aufgabe", () => {
        const einmal = entferneBuchstabierAufgaben("MJÖLNIR trifft HOGWARTS-EXPRESS");
        expect(enthaeltBuchstabierAufgabe(einmal)).toBe(false);
        expect(entferneBuchstabierAufgaben(einmal)).toBe(einmal);
    });
});

describe("erzeugeBuchstabierAufgabe", () => {
    it("schreibt das längste geeignete Wort groß", () => {
        const ergebnis = erzeugeBuchstabierAufgabe("Wir fahren zum Bahnhof");
        expect(ergebnis).toBe("Wir fahren zum BAHNHOF");
        expect(enthaeltBuchstabierAufgabe(ergebnis as string)).toBe(true);
    });

    it("gibt null zurück, wenn kein Wort geeignet ist", () => {
        expect(erzeugeBuchstabierAufgabe("Wir 1/2/3/4 ok")).toBeNull();
    });
});
