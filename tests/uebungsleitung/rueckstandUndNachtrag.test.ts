import { describe, expect, it } from "vitest";
import { rolleCountdownText, rueckstandFuerRolle, rueckstandText } from "../../src/uebungsleitung/rueckstand";
import { uhrzeitZuIso } from "../../src/uebungsleitung/nachtrag";
import { anmeldeZustand, istOffen } from "../../src/uebungsleitung/lagebild";

const basis = new Date(2026, 9, 5, 19, 30).getTime();

describe("Rückstand einer Rolle (THW-Review 2026-10-05, workflow W2)", () => {
    const nachrichten = [
        { id: 1, xZeitSlot: 3 },
        { id: 2, xZeitSlot: 10 },
        { id: 3, xZeitSlot: 95 },
        { id: 4, xZeitSlot: 110 },
        { id: 5 }
    ];

    it("zählt Überfälliges und Fälliges wie die Leitung und nennt die älteste", () => {
        const jetztMs = basis + 96 * 60000;
        const r = rueckstandFuerRolle(nachrichten, () => false, basis, { jetztMs, intervallMinuten: 2 });
        expect(r.ueberfaellig).toBe(2);
        expect(r.faellig).toBe(1);
        expect(r.ersteFaelligeId).toBe(1);
        expect(r.aeltesteSeitMinuten).toBe(93);
        expect(r.naechsteId).toBe(4);
        expect(r.naechsteInMs).toBe(14 * 60000);
        expect(rueckstandText(r)).toBe("2 überfällig, älteste seit 93 min, 1 jetzt fällig – Nr. 1 jetzt einspielen");
    });

    it("übergeht erledigte bzw. ausgelassene Nachrichten", () => {
        const jetztMs = basis + 11 * 60000;
        const r = rueckstandFuerRolle(nachrichten, id => id === 1, basis, { jetztMs });
        expect(r.ueberfaellig).toBe(0);
        expect(r.faellig).toBe(1);
        expect(r.ersteFaelligeId).toBe(2);
        expect(rueckstandText(r)).toBe("1 jetzt fällig – Nr. 2 jetzt einspielen");
    });

    it("hat ohne Rückstand keinen Text", () => {
        const r = rueckstandFuerRolle(nachrichten, () => false, basis, { jetztMs: basis });
        expect(rueckstandText(r)).toBeNull();
        expect(r.naechsteId).toBe(1);
    });

    it("baut die Countdown-Zeile: Rückstand vor dem nächsten Termin", () => {
        const jetzt = new Date(basis + 96 * 60000);
        expect(rolleCountdownText(nachrichten, () => false, "19:30", { jetzt, intervallMinuten: 2 }))
            .toBe("2 überfällig, älteste seit 93 min, 1 jetzt fällig – Nr. 1 jetzt einspielen · Nächste in 14:00");
        expect(rolleCountdownText(nachrichten, () => false, "19:30", { jetzt: new Date(basis) })).toBe("Nächste in 3:00");
        expect(rolleCountdownText(nachrichten, () => true, "19:30", { jetzt })).toBe("Keine ausstehenden Nachrichten");
        expect(rolleCountdownText(nachrichten, id => id !== 1, "19:30", { jetzt })).toContain("Nr. 1 jetzt einspielen");
        expect(rolleCountdownText(nachrichten, id => id !== 1, "19:30", { jetzt })).not.toContain("Nächste");
        expect(rolleCountdownText(nachrichten, () => false, "kaputt")).toBeNull();
    });
});

describe("Papier-Nachtrag am Übungstag (THW-Review 2026-10-05, analog P2-2)", () => {
    const uebungsDatum = new Date("2026-10-05T00:00:00");

    it("bezieht eine Uhrzeit drei Tage später auf das Übungsdatum", () => {
        const now = new Date(2026, 9, 8, 20, 0);
        const iso = uhrzeitZuIso("19:20", undefined, now, { uebungsDatum });
        expect(new Date(iso as string)).toEqual(new Date(2026, 9, 5, 19, 20));
    });

    it("legt Zeiten vor der X-Zeit-Basis auf den Folgetag (Übung über Mitternacht)", () => {
        const now = new Date(2026, 9, 8, 20, 0);
        const iso = uhrzeitZuIso("00:15", undefined, now, { uebungsDatum, basis: "22:00" });
        expect(new Date(iso as string)).toEqual(new Date(2026, 9, 6, 0, 15));
    });

    it("behält bei einer Korrektur den Tag der vorhandenen Zeit, solange er zur Übung passt", () => {
        const now = new Date(2026, 9, 8, 20, 0);
        const amFolgetag = new Date(2026, 9, 6, 0, 10).toISOString();
        expect(new Date(uhrzeitZuIso("00:20", amFolgetag, now, { uebungsDatum }) as string)).toEqual(new Date(2026, 9, 6, 0, 20));
        // Eine falsch abgelegte Zeit (drei Tage später) wird auf den Übungstag gezogen.
        const falscherTag = new Date(2026, 9, 8, 19, 20).toISOString();
        expect(new Date(uhrzeitZuIso("19:25", falscherTag, now, { uebungsDatum }) as string)).toEqual(new Date(2026, 9, 5, 19, 25));
    });

    it("nimmt am Übungsabend selbst keine Zukunftszeit an", () => {
        const now = new Date(2026, 9, 5, 0, 30);
        const iso = uhrzeitZuIso("23:50", undefined, now, { uebungsDatum });
        expect(new Date(iso as string)).toEqual(new Date(2026, 9, 4, 23, 50));
    });

    it("lehnt ungültige Eingaben ab", () => {
        expect(uhrzeitZuIso("25:00", undefined, new Date(), { uebungsDatum })).toBeNull();
        expect(uhrzeitZuIso("19-20")).toBeNull();
        expect(uhrzeitZuIso("19:60")).toBeNull();
    });
});

describe("Anmeldezeit folgt der Korrektur des Anmeldespruchs (THW-Review 2026-10-05, analog P2-1)", () => {
    it("nimmt die von Hand korrigierte Zeit statt der früheren Klickzeit", () => {
        const zustand = anmeldeZustand(
            { angemeldetUm: "2026-10-05T19:01:00.000Z" },
            { abgesetztUm: "2026-10-05T19:10:00.000Z", nachgetragen: true }
        );
        expect(zustand).toEqual({ angemeldetUm: "2026-10-05T19:10:00.000Z", quelle: "funkspruch" });
    });

    it("bleibt ohne Korrektur beim frühesten Zeitpunkt", () => {
        const zustand = anmeldeZustand(
            { angemeldetUm: "2026-10-05T19:05:00.000Z" },
            { abgesetztUm: "2026-10-05T19:10:00.000Z", gemeldetUm: "2026-10-05T19:00:00.000Z" } as never
        );
        expect(zustand).toEqual({ angemeldetUm: "2026-10-05T19:00:00.000Z", quelle: "teilnehmer" });
        expect(anmeldeZustand(undefined, { abgesetztUm: "kaputt", nachgetragen: true })).toEqual({});
    });

    it("zählt ausgelassene Zeilen nicht als offen", () => {
        expect(istOffen(undefined)).toBe(true);
        expect(istOffen({ ausgelassen: true })).toBe(false);
        expect(istOffen({ erledigtUm: "x" })).toBe(false);
    });
});
