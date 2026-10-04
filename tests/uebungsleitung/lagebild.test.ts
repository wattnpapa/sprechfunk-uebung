import { describe, expect, it } from "vitest";
import {
    anmeldeNachrichtKey,
    anmeldeZustand,
    berechneFaelligkeit,
    faelligFensterMs,
    faelligkeitLabel,
    formatUhrzeit,
    lageJeTeilnehmer,
    naechsteOffene,
    schaetzeEnde,
    sortiereNachrichtenplan,
    uhrzeitZuIso,
    vergibPlanNummern
} from "../../src/uebungsleitung/lagebild";

const MIN = 60000;

describe("Nachrichtenplan: Reihenfolge und eindeutige Nummern", () => {
    it("nummeriert fortlaufend statt je Absender", () => {
        const plan = vergibPlanNummern(sortiereNachrichtenplan([
            { sender: "A", nr: 1 },
            { sender: "B", nr: 1 },
            { sender: "A", nr: 2 },
            { sender: "B", nr: 2 }
        ]));

        expect(plan.map(n => n.planNr)).toEqual([1, 2, 3, 4]);
        expect(plan.map(n => `${n.sender}${n.nr}`)).toEqual(["A1", "B1", "A2", "B2"]);
        expect(new Set(plan.map(n => n.planNr)).size).toBe(4);
    });

    it("folgt im X-Zeit-Modus dem Zeitplan, nicht der Absendernummer", () => {
        const plan = sortiereNachrichtenplan([
            { sender: "EA", nr: 10, xZeitSlot: 5 },
            { sender: "EA", nr: 11, xZeitSlot: 3 },
            { sender: "Stab", nr: 9, xZeitSlot: 4 }
        ]);

        expect(plan.map(n => n.nr)).toEqual([11, 9, 10]);
    });

    it("nutzt die Szenario-Reihenfolge, wenn nicht alle Nachrichten einen Slot haben", () => {
        const plan = sortiereNachrichtenplan([
            { sender: "A", nr: 1, szenarioNr: 3 },
            { sender: "B", nr: 1, szenarioNr: 1, xZeitSlot: 9 },
            { sender: "A", nr: 2, szenarioNr: 2 }
        ]);

        expect(plan.map(n => n.szenarioNr)).toEqual([1, 2, 3]);
    });
});

describe("Fälligkeit im X-Zeit-Modus", () => {
    const basis = new Date(2026, 9, 4, 9, 0).getTime();
    const fenster = faelligFensterMs(1);

    it("unterscheidet überfällig, jetzt fällig und später", () => {
        const jetzt = basis + 10 * MIN;
        expect(berechneFaelligkeit(3, basis, jetzt, fenster)).toMatchObject({ zustand: "ueberfaellig", minuten: 7 });
        expect(berechneFaelligkeit(9, basis, jetzt, fenster)).toMatchObject({ zustand: "faellig" });
        expect(berechneFaelligkeit(10, basis, jetzt, fenster)).toMatchObject({ zustand: "faellig" });
        expect(berechneFaelligkeit(15, basis, jetzt, fenster)).toMatchObject({ zustand: "spaeter", minuten: 5 });
    });

    it("liefert die Soll-Uhrzeit und ein Label, das ohne Farbe lesbar ist", () => {
        const f = berechneFaelligkeit(3, basis, basis + 10 * MIN, fenster);
        expect(formatUhrzeit(f.sollMs)).toBe("09:03");
        expect(faelligkeitLabel(f)).toBe("überfällig 7 min");
        expect(faelligkeitLabel(berechneFaelligkeit(10, basis, basis + 10 * MIN, fenster))).toBe("jetzt fällig");
        expect(faelligkeitLabel(berechneFaelligkeit(15, basis, basis + 10 * MIN, fenster))).toBe("in 5 min");
        expect(faelligkeitLabel(berechneFaelligkeit(11, basis, basis + 10 * MIN + 30000, fenster))).toBe("gleich");
    });

    it("hält das Fälligkeitsfenster mindestens zwei Minuten offen", () => {
        expect(faelligFensterMs(undefined)).toBe(2 * MIN);
        expect(faelligFensterMs(5)).toBe(5 * MIN);
    });
});

describe("ETA mit Mindeststichprobe", () => {
    const t0 = Date.UTC(2026, 9, 4, 18, 0);

    it("schätzt nichts aus vier schnellen Klicks", () => {
        const eta = schaetzeEnde([t0, t0 + 1000, t0 + 2000, t0 + 3000], 70, 66);
        expect(eta.etaMs).toBeNull();
        expect(eta.grund).toBe("zu-wenig-daten");
    });

    it("braucht neben der Anzahl auch eine Mindestspanne", () => {
        const schnell = [0, 1, 2, 3, 4].map(i => t0 + i * 10000);
        expect(schaetzeEnde(schnell, 20, 15).etaMs).toBeNull();
    });

    it("rechnet ab ausreichender Stichprobe hoch", () => {
        const stempel = [0, 1, 2, 3, 4].map(i => t0 + i * MIN);
        const eta = schaetzeEnde(stempel, 10, 5);
        expect(eta.etaMs).toBe(t0 + 4 * MIN + 5 * MIN);
        expect(eta.restMinuten).toBe(5);
        expect(eta.stichprobe).toBe(5);
    });

    it("meldet fertig, wenn nichts mehr offen ist", () => {
        expect(schaetzeEnde([t0, t0 + MIN], 2, 0)).toMatchObject({ etaMs: t0 + MIN, grund: "fertig" });
        expect(schaetzeEnde([], 0, 0).etaMs).toBeNull();
    });
});

describe("Anmeldung und Anmelde-Funkspruch", () => {
    const uebung = { anmeldungAktiv: true, nachrichten: { A: [{ id: 1, empfaenger: ["B"], nachricht: "Anmeldung" }] } };

    it("erkennt die Nachricht 1 als Anmelde-Funkspruch, nur bei aktiver Anmeldung", () => {
        expect(anmeldeNachrichtKey(uebung, "A")).toBe("A__1");
        expect(anmeldeNachrichtKey(uebung, "C")).toBeNull();
        expect(anmeldeNachrichtKey({ ...uebung, anmeldungAktiv: false }, "A")).toBeNull();
    });

    it("führt Tabelle, Funkspruch und Selbstmeldung zu einer Anmeldung zusammen", () => {
        expect(anmeldeZustand(undefined, undefined)).toEqual({});
        expect(anmeldeZustand({ angemeldetUm: "2026-10-04T19:05:00Z" }, undefined))
            .toEqual({ angemeldetUm: "2026-10-04T19:05:00Z", quelle: "leitung" });
        expect(anmeldeZustand(undefined, { abgesetztUm: "2026-10-04T19:02:00Z" }))
            .toEqual({ angemeldetUm: "2026-10-04T19:02:00Z", quelle: "funkspruch" });
        expect(anmeldeZustand({ angemeldetUm: "2026-10-04T19:05:00Z" }, { gemeldetUm: "2026-10-04T19:01:00Z" }))
            .toEqual({ angemeldetUm: "2026-10-04T19:01:00Z", quelle: "teilnehmer" });
        expect(anmeldeZustand({ angemeldetUm: "kaputt" }, undefined)).toEqual({});
    });
});

describe("Papier-Nachtrag", () => {
    const jetzt = new Date(2026, 9, 4, 20, 0);

    it("deutet HH:MM als heutige Uhrzeit", () => {
        const iso = uhrzeitZuIso("19:05", undefined, jetzt);
        expect(new Date(iso as string).getHours()).toBe(19);
        expect(new Date(iso as string).getDate()).toBe(4);
    });

    it("nimmt bei einer Uhrzeit in der Zukunft den Vortag", () => {
        const iso = uhrzeitZuIso("23:50", undefined, jetzt);
        expect(new Date(iso as string).getDate()).toBe(3);
    });

    it("behält beim Korrigieren den Tag des bisherigen Zeitpunkts", () => {
        const vorher = new Date(2026, 9, 2, 18, 0).toISOString();
        const iso = uhrzeitZuIso("18:20", vorher, jetzt);
        expect(new Date(iso as string).getDate()).toBe(2);
        expect(new Date(iso as string).getMinutes()).toBe(20);
    });

    it("weist ungültige Eingaben ab", () => {
        expect(uhrzeitZuIso("25:00", undefined, jetzt)).toBeNull();
        expect(uhrzeitZuIso("19.05", undefined, jetzt)).toBeNull();
        expect(uhrzeitZuIso("", undefined, jetzt)).toBeNull();
    });
});

describe("Lage je Teilnehmer", () => {
    const plan = [
        { sender: "A", nr: 1 },
        { sender: "A", nr: 2 },
        { sender: "B", nr: 1 },
        { sender: "B", nr: 2 }
    ];
    const effektiv = {
        "A__1": { abgesetztUm: "x", erledigtUm: "x" },
        "B__1": { gemeldetUm: "y", erledigtUm: "y" }
    };

    it("zählt offen und zu bestätigen, die meisten offenen zuerst", () => {
        const lage = lageJeTeilnehmer([...plan, { sender: "B", nr: 3 }], effektiv);
        expect(lage).toEqual([
            { teilnehmer: "B", offen: 2, gesamt: 3, nurGemeldet: 1 },
            { teilnehmer: "A", offen: 1, gesamt: 2, nurGemeldet: 0 }
        ]);
    });

    it("liefert die nächsten offenen in Planreihenfolge", () => {
        expect(naechsteOffene(plan, effektiv, 1)).toEqual([{ sender: "A", nr: 2 }]);
        expect(naechsteOffene(plan, effektiv, 5)).toHaveLength(2);
    });
});
