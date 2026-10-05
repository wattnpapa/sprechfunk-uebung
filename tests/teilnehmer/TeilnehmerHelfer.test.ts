import { describe, expect, it, vi } from "vitest";
import { codesAusHash, pruefeCodeFormat, resetRueckfrage } from "../../src/teilnehmer";
import { xZeitHerkunftText } from "../../src/teilnehmer/xZeitSteuerung";
import { preloadReihenfolge } from "../../src/teilnehmer/vordruckSteuerung";
import { formatDatumKurz, formatUhrzeit, nachrichtHtml, renderArtBadge, sanitizeCode } from "../../src/teilnehmer/teilnehmerFormat";
import { xZeitBadgeClass, xZeitBadgeLabel } from "../../src/teilnehmer/nachrichtenMarkup";
import type { TeilnehmerStorage } from "../../src/types/Storage";

// Der echte Store liest beim Laden localStorage, das es in Node nicht gibt.
vi.mock("../../src/state/store", () => ({ store: { setState: vi.fn() } }));

const storage = (teil: Partial<TeilnehmerStorage> = {}): TeilnehmerStorage => ({
    version: 1, uebungId: "u1", teilnehmer: "A", lastUpdated: "", nachrichten: {}, hideTransmitted: false, ...teil
});

describe("Teilnehmer – Hilfsfunktionen", () => {
    it("liest Codes aus dem Hash und bereinigt sie", () => {
        expect(codesAusHash("#/teilnehmer?uc=k7-m4q2&tc=a1 b2")).toEqual({ uebungCode: "K7M4Q2", teilnehmerCode: "A1B2" });
        expect(codesAusHash("#/teilnehmer")).toEqual({ uebungCode: "", teilnehmerCode: "" });
        expect(sanitizeCode("ab_12")).toBe("AB12");
    });

    it("prüft das Codeformat", () => {
        expect(pruefeCodeFormat("", "A1B2")).toContain("beide Codes");
        expect(pruefeCodeFormat("ABC", "A1B2")).toContain("Codeformat");
        expect(pruefeCodeFormat("ABC123", "A1B2")).toBeNull();
    });

    it("nennt im Rücksetz-Text Anzahl und Reichweite", () => {
        expect(resetRueckfrage(3, true)).toContain("alle 3");
        expect(resetRueckfrage(3, true)).toContain("Übungsleitung");
        expect(resetRueckfrage(0, false)).toContain("nur dieses Gerät");
    });

    it("beschreibt die Herkunft der X-Zeit-Basis", () => {
        expect(xZeitHerkunftText(storage(), null)).toContain("Warte auf die X-Zeit");
        expect(xZeitHerkunftText(storage({ xZeitBasis: "10:00", xZeitBasisQuelle: "leitung" }), "10:00")).toContain("von der Übungsleitung gesetzt");
        expect(xZeitHerkunftText(storage({ xZeitBasis: "10:05", xZeitBasisQuelle: "eigen" }), "10:00")).toContain("Eigene Basis 10:05");
        expect(xZeitHerkunftText(storage({ xZeitBasis: "10:00", xZeitBasisQuelle: "eigen" }), "10:00")).toBe("");
        expect(xZeitHerkunftText(storage({ xZeitBasis: "10:00" }), null)).toBe("");
    });

    it("lädt zuerst die aktuelle Seite und ihre Nachbarn vor", () => {
        expect(preloadReihenfolge(2, 4)).toEqual([2, 3, 1, 4]);
        expect(preloadReihenfolge(1, 1)).toEqual([1]);
        expect(preloadReihenfolge(5, 3)).toEqual([4, 1, 2, 3]);
    });

    it("formatiert Datum, Uhrzeit, Text und Art", () => {
        expect(formatDatumKurz(undefined)).toBe("–");
        expect(formatDatumKurz("kein Datum")).toBe("–");
        expect(formatDatumKurz("2026-10-04T09:00:00.000Z")).toMatch(/04\.10\.2026/);
        expect(formatUhrzeit(undefined)).toBe("");
        expect(formatUhrzeit("quatsch")).toBe("");
        expect(formatUhrzeit("2026-10-04T09:05:00")).toBe("09:05");
        expect(nachrichtHtml("a\\nb\n<c>")).toBe("a<br>b<br>&lt;c&gt;");
        expect(renderArtBadge({ id: 1, empfaenger: [], nachricht: "" })).toBe("");
    });

    it("kennzeichnet X-Zeit-Slots ohne gültige Basis neutral", () => {
        expect(xZeitBadgeClass(5, undefined, false)).toBe("badge bg-secondary");
        expect(xZeitBadgeClass(5, "kaputt", false)).toBe("badge bg-secondary");
        expect(xZeitBadgeLabel(5, "10:00", true)).toBe("X+5");
        expect(xZeitBadgeLabel(5, "kaputt", false)).toBe("X+5");
    });
});
