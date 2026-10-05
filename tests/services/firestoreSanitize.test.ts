import { describe, expect, it } from "vitest";
import {
    extractDatum,
    hasNonEmptyRecord,
    isMissingIndexError,
    sanitizeDataForSave,
    zaehleNachrichten
} from "../../src/services/firestoreSanitize";

describe("firestoreSanitize", () => {
    it("erkennt fehlende Indizes an Code, Meldung und Serverantwort", () => {
        expect(isMissingIndexError(null)).toBe(false);
        expect(isMissingIndexError("text")).toBe(false);
        expect(isMissingIndexError({ code: "failed-precondition" })).toBe(true);
        expect(isMissingIndexError({ code: "firestore/failed-precondition" })).toBe(true);
        expect(isMissingIndexError({ message: "The query REQUIRES AN INDEX." })).toBe(true);
        expect(isMissingIndexError({ message: "see create_composite=abc" })).toBe(true);
        expect(isMissingIndexError({ customData: { serverResponse: "Requires an index" } })).toBe(true);
        expect(isMissingIndexError({ customData: { serverResponse: "create_composite" } })).toBe(true);
        expect(isMissingIndexError({ code: "permission-denied", message: "nein", customData: {} })).toBe(false);
        expect(isMissingIndexError({ code: 42, message: 7 })).toBe(false);
    });

    it("prüft Records und Datumswerte", () => {
        expect(hasNonEmptyRecord(undefined)).toBe(false);
        expect(hasNonEmptyRecord({})).toBe(false);
        expect(hasNonEmptyRecord({ a: 1 })).toBe(true);
        expect(extractDatum(undefined)).toBeUndefined();
        expect(extractDatum("kein Datum")).toBeUndefined();
        expect(extractDatum("2026-03-04")?.getFullYear()).toBe(2026);
        expect(extractDatum({ toDate: () => new Date("2025-01-02") })?.getMonth()).toBe(0);
        expect(zaehleNachrichten({ A: [1, 2], B: "x", C: [3] })).toBe(3);
    });

    it("bereinigt Dokumente vor dem Speichern und setzt Statistikfelder", () => {
        expect(sanitizeDataForSave(null)).toEqual({});
        const ergebnis = sanitizeDataForSave({
            teilnehmerListe: [" A ", "", 5, "B"],
            uebungCode: " k7m4q2 ",
            nachrichten: { A: [{ id: 1 }], " ": [{ id: 2 }], B: undefined },
            loesungswoerter: { A: "FUNK" },
            loesungsStaerken: [],
            teilnehmerIds: "kein Objekt",
            buchstabierenAn: 2,
            datum: "2026-05-10",
            weg: undefined
        });
        expect(ergebnis["teilnehmerListe"]).toEqual(["A", "B"]);
        expect(ergebnis["uebungCode"]).toBe("K7M4Q2");
        expect(ergebnis["nachrichten"]).toEqual({ A: [{ id: 1 }] });
        expect(ergebnis["loesungsStaerken"]).toEqual({});
        expect(ergebnis["teilnehmerIds"]).toEqual({});
        expect(ergebnis["statTeilnehmerAnzahl"]).toBe(2);
        expect(ergebnis["statNachrichtenAnzahl"]).toBe(1);
        expect(ergebnis["statHatLoesungswoerter"]).toBe(true);
        expect(ergebnis["statHatLoesungsStaerken"]).toBe(false);
        expect(ergebnis["statHatBuchstabieren"]).toBe(true);
        expect(ergebnis["statMonat"]).toBe(4);
        expect(ergebnis["statJahr"]).toBe(2026);
        expect("weg" in ergebnis).toBe(false);

        const ohneDatum = sanitizeDataForSave({ uebungCode: 5 });
        expect(ohneDatum["uebungCode"]).toBe("");
        expect("statMonat" in ohneDatum).toBe(false);
    });
});
