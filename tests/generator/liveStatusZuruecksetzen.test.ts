import { describe, expect, it, vi } from "vitest";
import {
    baueZuruecksetzDokumente,
    setzeLiveStatusZurueck,
    type UebungsStand,
    ZURUECKSETZEN_BESTAETIGUNG_MS
} from "../../src/generator/liveStatusZuruecksetzen";
import { mergeLeitungLiveDoc, mergeLeitungPublicLiveDoc, mergeTeilnehmerLiveDoc } from "../../src/services/liveStatusMerge";
import type { TeilnehmerStorage, UebungsleitungStorage } from "../../src/types/Storage";

/**
 * Überschreiben setzt den Live-Status zurück (THW-Review 2026-10-05,
 * destructive-action P2-1, workflow W3). Geprüft wird, dass die Marker auf
 * den Geräten den alten Stand per Last-Write-Wins tatsächlich verdrängen.
 */

const ALT: UebungsStand = {
    teilnehmerListe: ["Heros 21/11", "Heros 22/11"],
    teilnehmerIds: { AB23: "Heros 21/11", CD45: "Heros 22/11" },
    nachrichten: {
        "Heros 21/11": [{ id: 1, empfaenger: ["x"], nachricht: "alt 1" }, { id: 2, empfaenger: ["x"], nachricht: "alt 2" }],
        "Heros 22/11": [{ id: 1, empfaenger: ["x"], nachricht: "alt 3" }]
    }
};

const NEU: UebungsStand = {
    teilnehmerListe: ["Heros 21/11", "Heros 22/11"],
    teilnehmerIds: { AB23: "Heros 21/11", CD45: "Heros 22/11" },
    nachrichten: {
        "Heros 21/11": [{ id: 1, empfaenger: ["x"], nachricht: "neu 1" }],
        "Heros 22/11": [{ id: 1, empfaenger: ["x"], nachricht: "neu 2" }, { id: 2, empfaenger: ["x"], nachricht: "neu 3" }]
    }
};

const VORHER = "2026-10-05T19:00:00.000Z";
const JETZT = "2026-10-05T20:00:00.000Z";

describe("Live-Status nach dem Überschreiben zurücksetzen", () => {
    it("deckt Nachrichten der alten und der neuen Fassung ab", () => {
        const docs = baueZuruecksetzDokumente(ALT, NEU, JETZT);
        expect(Object.keys(docs.leitungPublic.nachrichten).sort()).toEqual([
            "Heros 21/11__1", "Heros 21/11__2", "Heros 22/11__1", "Heros 22/11__2"
        ]);
        expect(docs.leitungPublic.nachrichten["Heros 21/11__2"]).toEqual({ geaendertUm: JETZT });
        expect(docs.leitung.nachrichtenNotizen["Heros 22/11__2"]).toEqual({ notiz: "", geaendertUm: JETZT });
        expect(docs.leitung.teilnehmer).toEqual({
            "Heros 21/11": { geaendertUm: JETZT },
            "Heros 22/11": { geaendertUm: JETZT }
        });
        const teilnehmer = docs.teilnehmer.find(doc => doc.teilnehmerId === "AB23");
        expect(teilnehmer).toMatchObject({ teilnehmer: "Heros 21/11", lastUpdated: JETZT });
        expect(teilnehmer?.nachrichten).toEqual({
            "1": { uebertragen: false, geaendertUm: JETZT },
            "2": { uebertragen: false, geaendertUm: JETZT }
        });
    });

    it("verdrängt auf den Geräten abgesetzte Sprüche, Anmeldungen und Notizen", () => {
        const docs = baueZuruecksetzDokumente(ALT, NEU, JETZT);
        const leitung: UebungsleitungStorage = {
            version: 1,
            uebungId: "u1",
            lastUpdated: VORHER,
            xZeitBasis: "19:00",
            teilnehmer: { "Heros 21/11": { angemeldetUm: VORHER, geaendertUm: VORHER, notizen: "laut" } },
            nachrichten: {
                "Heros 21/11__1": { abgesetztUm: VORHER, statusGeaendertUm: VORHER, notiz: "gut", notizGeaendertUm: VORHER }
            }
        };
        const nachPublic = mergeLeitungPublicLiveDoc(leitung, docs.leitungPublic).merged;
        const nachIntern = mergeLeitungLiveDoc(nachPublic, docs.leitung).merged;
        expect(nachIntern.nachrichten["Heros 21/11__1"]?.abgesetztUm).toBeUndefined();
        expect(nachIntern.nachrichten["Heros 21/11__1"]?.notiz).toBe("");
        expect(nachIntern.teilnehmer["Heros 21/11"]?.angemeldetUm).toBeUndefined();
        // Die X-Zeit-Basis ist eine Uhrzeit, kein Stand, und bleibt.
        expect(nachIntern.xZeitBasis).toBe("19:00");

        const tn: TeilnehmerStorage = {
            teilnehmer: "Heros 21/11",
            lastUpdated: VORHER,
            hideTransmitted: false,
            nachrichten: { "1": { uebertragen: true, uebertragenUm: VORHER, geaendertUm: VORHER } }
        };
        const tnDoc = docs.teilnehmer.find(doc => doc.teilnehmerId === "AB23");
        expect(tnDoc).toBeDefined();
        const tnNach = mergeTeilnehmerLiveDoc(tn, tnDoc!).merged;
        expect(tnNach.nachrichten["1"]?.uebertragen).toBe(false);
    });

    it("schreibt alle Dokumente, wartet auf die Bestätigung und räumt auf", async () => {
        const live = {
            enabled: true,
            publishLeitungPublic: vi.fn(),
            publishLeitungInternal: vi.fn(),
            publishTeilnehmerStatus: vi.fn(),
            flush: vi.fn().mockResolvedValue(true),
            dispose: vi.fn()
        };
        const fabrik = vi.fn(() => live);

        expect(await setzeLiveStatusZurueck(null, "u1", { alt: ALT, neu: NEU }, fabrik)).toBe(true);

        expect(fabrik).toHaveBeenCalledWith(null, "u1");
        expect(live.publishLeitungPublic).toHaveBeenCalledTimes(1);
        expect(live.publishLeitungInternal).toHaveBeenCalledTimes(1);
        expect(live.publishTeilnehmerStatus).toHaveBeenCalledTimes(2);
        expect(live.flush).toHaveBeenCalledWith(ZURUECKSETZEN_BESTAETIGUNG_MS);
        expect(live.dispose).toHaveBeenCalled();
    });

    it("meldet eine ausbleibende Bestätigung und übergeht abgeschalteten Live-Sync", async () => {
        const basis = {
            publishLeitungPublic: vi.fn(),
            publishLeitungInternal: vi.fn(),
            publishTeilnehmerStatus: vi.fn(),
            dispose: vi.fn()
        };
        const ohneBestaetigung = { ...basis, enabled: true, flush: vi.fn().mockResolvedValue(false) };
        expect(await setzeLiveStatusZurueck(null, "u1", { alt: ALT, neu: NEU }, () => ohneBestaetigung)).toBe(false);

        const kaputt = { ...basis, enabled: true, flush: vi.fn().mockRejectedValue(new Error("weg")) };
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(await setzeLiveStatusZurueck(null, "u1", { alt: ALT, neu: NEU }, () => kaputt)).toBe(false);
        expect(kaputt.dispose).toHaveBeenCalled();

        const aus = { ...basis, enabled: false, flush: vi.fn() };
        expect(await setzeLiveStatusZurueck(null, "u1", { alt: ALT, neu: NEU }, () => aus)).toBe(true);
        expect(aus.flush).not.toHaveBeenCalled();
    });
});
