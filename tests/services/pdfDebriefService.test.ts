import { describe, expect, it } from "vitest";
import { buildDebriefSentRows, zaehleDebrief } from "../../src/services/pdfDebriefService";
import type { UebungsleitungStorage } from "../../src/types/Storage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const uebung: any = {
    id: "u1",
    name: "Ü",
    nachrichten: {
        A: [
            { id: 1, empfaenger: ["B"], nachricht: "nur vom Teilnehmer gemeldet" },
            { id: 2, empfaenger: ["B"], nachricht: "von der Leitung bestätigt" },
            { id: 3, empfaenger: ["B"], nachricht: "offen" },
            { id: 4, empfaenger: ["B"], nachricht: "nachgetragen" }
        ]
    }
};

const storage = {
    version: 1,
    uebungId: "u1",
    lastUpdated: "",
    teilnehmer: {},
    nachrichten: {
        "A__1": { gemeldetUm: "2026-10-04T17:01:00.000Z" },
        "A__2": { abgesetztUm: "2026-10-04T17:02:00.000Z", gemeldetUm: "2026-10-04T17:01:30.000Z" },
        "A__4": { abgesetztUm: "2026-10-04T17:04:00.000Z", nachgetragen: true }
    }
} as unknown as UebungsleitungStorage;

describe("Debrief: Teilnehmer-Meldung und Bestätigung der Leitung", () => {
    it("zählt Selbstmeldungen mit und weist beide Quellen getrennt aus", () => {
        expect(zaehleDebrief(uebung, storage, "A")).toEqual({ gesamt: 4, erledigt: 3, gemeldet: 2, bestaetigt: 2 });
    });

    it("zeigt je Nachricht gemeldet, bestätigt und den Stand", () => {
        const rows = buildDebriefSentRows(uebung, storage, "A");

        expect(rows[0]?.[3]).not.toBe("–");
        expect(rows[0]?.[4]).toBe("–");
        expect(rows[0]?.[5]).toBe("erledigt");
        expect(rows[1]?.[4]).not.toBe("–");
        expect(rows[2]?.[5]).toBe("offen");
        expect(rows[3]?.[4]).toContain("(nachgetragen)");
    });

    it("liefert eine Platzhalterzeile ohne gesendete Nachrichten", () => {
        expect(buildDebriefSentRows(uebung, storage, "X")[0]).toHaveLength(7);
        expect(zaehleDebrief(uebung, storage, "X").gesamt).toBe(0);
    });
});
