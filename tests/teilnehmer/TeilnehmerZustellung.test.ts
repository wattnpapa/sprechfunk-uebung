import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { ZustellVerfolgung, zustellSchluessel } from "../../src/teilnehmer/zustellung";
import { syncAnzeige } from "../../src/teilnehmer/ansichtHelfer";
import { bindeCodeSprung, rueckstandText, syncLeistenText } from "../../src/teilnehmer/ansichtTexte";
import { leistenPosition } from "../../src/teilnehmer/rueckgaengigHinweis";
import { massstabFuer, MIN_LESBARE_HOEHE } from "../../src/teilnehmer/vordruckVorschau";
import { zustellText } from "../../src/teilnehmer/nachrichtenMarkup";
import { resetErlaubt, veroeffentlicheReset, RESET_BESTAETIGUNG_MS } from "../../src/teilnehmer/zuruecksetzen";
import type { TeilnehmerStorage } from "../../src/types/Storage";

const mocks = vi.hoisted(() => ({ uiError: vi.fn() }));
vi.mock("../../src/core/UiFeedback", () => ({ uiFeedback: { error: mocks.uiError } }));

function speicher(): Map<string, string> {
    const daten = new Map<string, string>();
    vi.stubGlobal("localStorage", {
        getItem: (k: string) => daten.get(k) ?? null,
        setItem: (k: string, v: string) => { daten.set(k, v); },
        removeItem: (k: string) => { daten.delete(k); }
    });
    return daten;
}

describe("ZustellVerfolgung – was nur auf diesem Gerät liegt", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("merkt geänderte Sprüche, bis der Server alles bestätigt hat", () => {
        const daten = speicher();
        const schluessel = zustellSchluessel("u1", "Alpha");
        const z = new ZustellVerfolgung(schluessel);
        z.merke(3);
        z.merke(4);
        expect(z.info().offen).toBe(2);
        expect(Array.from(z.nurLokal)).toEqual([3, 4]);

        // Offline oder noch unbestätigt: nichts ändert sich.
        expect(z.pruefe("offline", 0)).toBe(false);
        expect(z.pruefe("live", 1)).toBe(false);
        expect(z.info().offen).toBe(2);

        // Überlebt ein Neuladen.
        const neu = new ZustellVerfolgung(schluessel);
        expect(Array.from(neu.nurLokal)).toEqual([3, 4]);

        // Live und nichts mehr offen: bestätigt, mit Uhrzeit.
        expect(neu.pruefe("live", 0, new Date(2026, 9, 5, 21, 7))).toBe(true);
        expect(neu.info()).toEqual({ offen: 0, bestaetigtUm: "21:07" });
        expect(neu.pruefe("live", 0, new Date(2026, 9, 5, 21, 8))).toBe(false);
        expect(neu.info().bestaetigtUm).toBe("21:07");

        neu.leeren();
        expect(daten.has(schluessel)).toBe(false);
    });

    it("setzt beim ersten Kontakt eine Bestätigungszeit, ohne die Karten neu zu zeichnen", () => {
        speicher();
        const z = new ZustellVerfolgung("k");
        expect(z.pruefe("live", 0, new Date(2026, 9, 5, 20, 1))).toBe(false);
        expect(z.info().bestaetigtUm).toBe("20:01");
    });

    it("übersteht kaputten oder gesperrten Speicher", () => {
        const daten = speicher();
        daten.set("k", "{kaputt");
        expect(new ZustellVerfolgung("k").info().offen).toBe(0);
        daten.set("k", JSON.stringify({ offen: [1, "x"], bestaetigtUm: 5 }));
        expect(Array.from(new ZustellVerfolgung("k").nurLokal)).toEqual([1]);

        vi.stubGlobal("localStorage", {
            getItem: () => { throw new Error("gesperrt"); },
            setItem: () => { throw new Error("gesperrt"); },
            removeItem: () => { throw new Error("gesperrt"); }
        });
        const z = new ZustellVerfolgung("k");
        expect(() => z.merke(1)).not.toThrow();
        expect(() => z.leeren()).not.toThrow();
    });
});

describe("Verbindungsanzeige mit Zahl und Uhrzeit", () => {
    it("nennt offene Sprüche und die letzte Bestätigung", () => {
        expect(syncAnzeige("live", { offen: 0, bestaetigtUm: "21:07" }).text).toBe("Übungsleitung: live · alles gesendet 21:07");
        expect(syncAnzeige("live", { offen: 1, bestaetigtUm: "" }).text).toBe("Übungsleitung: live · 1 wird gesendet");
        expect(syncAnzeige("offline", { offen: 2, bestaetigtUm: "21:07" }).text).toBe("Keine Verbindung – 2 Sprüche nur hier");
        expect(syncAnzeige("offline", { offen: 2, bestaetigtUm: "21:07" }).title).toContain("21:07");
        expect(syncAnzeige("fehler", { offen: 1, bestaetigtUm: "" }).text).toBe("Fehler – 1 Spruch nur hier");
        expect(syncAnzeige("offline", { offen: 0, bestaetigtUm: "" }).text).toBe("Keine Verbindung – wird nachgereicht");
        expect(syncAnzeige("aus", { offen: 0, bestaetigtUm: "" }).text).toBe("Nur auf diesem Gerät");
        // Klartext statt „Sync“ (field-user P3).
        for (const state of ["aus", "verbinde", "live", "offline", "fehler"] as const) {
            expect(syncAnzeige(state, { offen: 0, bestaetigtUm: "" }).text).not.toMatch(/sync/i);
        }
    });

    it("zeigt den mitlaufenden Hinweis nur ohne Verbindung", () => {
        expect(syncLeistenText("live", { offen: 0, bestaetigtUm: "" })).toBe("");
        expect(syncLeistenText("aus", { offen: 3, bestaetigtUm: "" })).toBe("");
        expect(syncLeistenText("offline", { offen: 3, bestaetigtUm: "" })).toContain("3 Sprüche nur auf diesem Gerät");
        expect(syncLeistenText("offline", { offen: 1, bestaetigtUm: "" })).toContain("1 Spruch nur auf diesem Gerät");
        expect(syncLeistenText("offline", { offen: 0, bestaetigtUm: "" })).toContain("Keine Verbindung");
        expect(syncLeistenText("fehler", { offen: 0, bestaetigtUm: "" })).toContain("per Funk");
    });

    it("beschreibt je Karte, wo der Spruch steht", () => {
        expect(zustellText({ isUebertragen: true, istNaechster: false, nurLokal: true, syncZustand: "offline" }))
            .toEqual({ text: "Nur auf diesem Gerät – wird gesendet, sobald Netz da ist", lokal: true });
        expect(zustellText({ isUebertragen: true, istNaechster: false, nurLokal: true, syncZustand: "verbinde" }).lokal).toBe(false);
        expect(zustellText({ isUebertragen: true, istNaechster: false, syncZustand: "live" }).text).toBe("An die Übungsleitung gesendet");
        expect(zustellText({ isUebertragen: true, istNaechster: false }).text).toBe("Auf diesem Gerät gespeichert");
        expect(zustellText({ isUebertragen: true, istNaechster: false, bestaetigung: { abgesetztUm: "kaputt" } }).text).toBe("Leitung hat bestätigt");
    });
});

describe("X-Zeit: Rückstand vor Countdown", () => {
    const st = (n: Record<string, { uebertragen: boolean }> = {}) =>
        ({ hideTransmitted: false, nachrichten: n }) as unknown as TeilnehmerStorage;
    const liste = [
        { id: 1, empfaenger: ["B"], nachricht: "a", xZeitSlot: 0 },
        { id: 2, empfaenger: ["B"], nachricht: "b", xZeitSlot: 2 },
        { id: 3, empfaenger: ["B"], nachricht: "c", xZeitSlot: 10 }
    ];
    const jetzt = new Date(2026, 9, 5, 12, 5, 0).getTime();

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(jetzt);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("nennt Anzahl und Alter des Rückstands", () => {
        expect(rueckstandText(liste, st(), "12:00", jetzt)).toEqual({ text: "2 fällig, älteste seit 5 min · Nächste in 5:00", rueckstand: true });
        expect(rueckstandText(liste, st({ 1: { uebertragen: true } }), "12:03", jetzt)).toEqual({ text: "1 jetzt fällig · Nächste in 8:00", rueckstand: true });
        expect(rueckstandText(liste, st(), "11:00", jetzt).text).toBe("3 fällig, älteste seit 65 min");
    });

    it("zeigt ohne Rückstand nur den Countdown", () => {
        expect(rueckstandText(liste, st(), "12:30", jetzt)).toEqual({ text: "Nächste in 25:00", rueckstand: false });
        expect(rueckstandText(liste, st({ 1: { uebertragen: true }, 2: { uebertragen: true }, 3: { uebertragen: true } }), "12:00", jetzt).text)
            .toBe("Keine ausstehenden Nachrichten");
        expect(rueckstandText(liste, st(), "kaputt", jetzt).rueckstand).toBe(false);
    });
});

describe("Lage der Rückgängig-Leiste und Maßstab des Vordrucks", () => {
    it("legt die Leiste auf die Hälfte, in der nicht getippt wurde", () => {
        expect(leistenPosition(100, 800)).toBe("unten");
        expect(leistenPosition(700, 800)).toBe("oben");
        expect(leistenPosition(null, 800)).toBe("oben");
        expect(leistenPosition(100, 0)).toBe("oben");
    });

    it("füllt im Querformat die Breite statt zur Briefmarke zu schrumpfen", () => {
        const a5 = { width: 420, height: 595 };
        expect(massstabFuer(420, 1190, a5)).toBe(1);
        expect(massstabFuer(840, 595, a5)).toBe(1);
        // Niedriger Container: die Breite zählt, gescrollt wird im Fenster.
        expect(massstabFuer(840, MIN_LESBARE_HOEHE - 1, a5)).toBe(2);
    });
});

describe("Code-Eingabe springt ins zweite Feld", () => {
    it("wechselt nach sechs Zeichen in den Teilnehmercode", () => {
        const dom = new JSDOM("<input id=\"a\"><input id=\"b\">");
        const a = dom.window.document.getElementById("a") as HTMLInputElement;
        const b = dom.window.document.getElementById("b") as HTMLInputElement;
        bindeCodeSprung(a, b);
        a.focus();
        a.value = "K7M4Q";
        a.dispatchEvent(new dom.window.Event("input"));
        expect(dom.window.document.activeElement).toBe(a);
        a.value = "K7M4Q2";
        a.dispatchEvent(new dom.window.Event("input"));
        expect(dom.window.document.activeElement).toBe(b);

        // Steht im zweiten Feld schon etwas, wird nicht gesprungen.
        a.focus();
        b.value = "A1B2";
        a.dispatchEvent(new dom.window.Event("input"));
        expect(dom.window.document.activeElement).toBe(a);
        expect(() => bindeCodeSprung(null, b)).not.toThrow();
    });
});

describe("Zurücksetzen für alle braucht eine Verbindung", () => {
    beforeEach(() => {
        mocks.uiError.mockClear();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    const storage = { version: 1, uebungId: "u1", teilnehmer: "A", lastUpdated: "", hideTransmitted: false, xZeitBasis: "10:00", nachrichten: { 1: { uebertragen: true } } } as TeilnehmerStorage;

    it("lehnt ohne Verbindung ab und löscht nichts", () => {
        expect(resetErlaubt(null)).toBe(true);
        const live = { enabled: true, getState: () => "offline" as const, publishTeilnehmerStatus: vi.fn(), flush: vi.fn() };
        expect(resetErlaubt(live)).toBe(false);
        expect(mocks.uiError).toHaveBeenCalledWith(expect.stringContaining("es wurde nichts gelöscht"));

        vi.stubGlobal("navigator", { onLine: false });
        expect(resetErlaubt({ ...live, getState: () => "live" as const })).toBe(false);
        vi.stubGlobal("navigator", { onLine: true });
        expect(resetErlaubt({ ...live, getState: () => "live" as const })).toBe(true);
    });

    it("wartet begrenzt auf die Bestätigung und meldet, wenn sie ausbleibt", async () => {
        const publish = vi.fn();
        const flush = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        const live = { enabled: true, getState: () => "live" as const, publishTeilnehmerStatus: publish, flush };

        expect(await veroeffentlicheReset(live, storage, "T1")).toBe(true);
        expect(flush).toHaveBeenCalledWith(RESET_BESTAETIGUNG_MS);
        const doc = publish.mock.calls[0]?.[0];
        expect(doc.nachrichten["1"].uebertragen).toBe(false);
        expect(doc.xZeitBasis).toBeUndefined();

        expect(await veroeffentlicheReset(live, storage, "T1")).toBe(false);
        expect(mocks.uiError).toHaveBeenCalledWith(expect.stringContaining("nichts gelöscht"));

        expect(await veroeffentlicheReset(null, storage, "T1")).toBe(true);
    });
});
