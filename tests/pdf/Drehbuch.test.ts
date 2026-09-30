import { describe, expect, it, vi } from "vitest";
import { Drehbuch } from "../../src/pdf/Drehbuch";
import { FunkUebung } from "../../src/models/FunkUebung";
import type { FuehrungsstellenUebung } from "../../src/types/FuehrungsstellenUebung";

function bauePdfMock() {
    const calls: { head: unknown; body: unknown }[] = [];
    const pdf = {
        internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
        setFont: vi.fn(() => pdf),
        setFontSize: vi.fn(() => pdf),
        text: vi.fn(() => pdf),
        line: vi.fn(() => pdf),
        setDrawColor: vi.fn(() => pdf),
        getTextWidth: vi.fn(() => 20),
        textWithLink: vi.fn(() => pdf),
        output: vi.fn(() => new Blob(["x"])),
        setPage: vi.fn(),
        addPage: vi.fn(),
        autoTable: vi.fn(function (this: unknown, opts: { head: unknown; body: unknown }) {
            calls.push({ head: opts.head, body: opts.body });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (pdf as any).lastAutoTable = { finalY: 100 };
            return this;
        }),
        lastAutoTable: { finalY: 80 },
        getNumberOfPages: vi.fn(() => 3)
    };
    return { pdf, calls };
}

function baueDrehbuch(): FuehrungsstellenUebung {
    const hintergrund = "Hintergrund der Rolle.";
    return {
        slug: "test",
        titel: "Testlage",
        beschreibung: "Beschreibung",
        lage: "Die Lage.",
        auftrag: "Der Auftrag.",
        dauerMinuten: 120,
        minAbschnitte: 2,
        uebergeordnet: { bezeichnung: "Führungsstab", hintergrund, nachrichten: [] },
        straenge: [
            { key: "a", bezeichnung: "Einsatzstelle A", hintergrund, nachrichten: [] },
            { key: "b", bezeichnung: "Einsatzstelle B", hintergrund, nachrichten: [] },
            { key: "c", bezeichnung: "Einsatzstelle C", hintergrund, nachrichten: [] }
        ]
    };
}

function baueUebung(beginn?: string): FunkUebung {
    const u = new FunkUebung("dev");
    u.name = "Führungsstellen-Test";
    u.teilnehmerListe = ["EL 10", "EA 11", "EA 12", "Kater"];
    u.fuehrungsstelle = {
        slug: "test", beuebteStelle: "EL 10", uebergeordnet: "Kater", unterstellt: ["EA 11", "EA 12"],
        ...(beginn ? { beginn } : {})
    };
    u.nachrichten = {
        "EL 10": [],
        "EA 11": [{ id: 1, empfaenger: ["EL 10"], nachricht: "Lage A", xZeitSlot: 5, szenarioNr: 2, weg: "funk", meldeart: "lagemeldung", erwartung: "Lagekarte" }],
        "EA 12": [],
        "Kater": [{ id: 1, empfaenger: ["EL 10"], nachricht: "Auftrag 1", xZeitSlot: 0, szenarioNr: 1, weg: "drucker", meldeart: "auftrag", betreff: "Einsatzauftrag Nr. 1", erwartung: "An EA 11" }]
    };
    return u;
}

describe("pdf/Drehbuch", () => {
    it("zeichnet Deckblatt, Rollenkarten und Zeitachse in Erzählreihenfolge", () => {
        const { pdf, calls } = bauePdfMock();
        const doc = new Drehbuch(baueUebung("09:00"), baueDrehbuch(), pdf as never);
        doc.draw();

        // Rollen, Lage, Auftrag, Rollenkarten, Zeitachse
        expect(calls).toHaveLength(5);
        const rollen = calls[0]?.body as string[][];
        expect(rollen[0]?.[1]).toBe("EL 10");
        // Zwei Abschnitte, drei Stränge: EA 11 führt A und C.
        expect(rollen[1]?.[2]).toBe("Einsatzstelle A\nEinsatzstelle C");
        expect(rollen[2]?.[2]).toBe("Einsatzstelle B");
        expect(rollen[3]?.[1]).toBe("Kater");

        const rollenkarten = calls[3]?.body as string[][];
        expect(rollenkarten[0]?.[0]).toBe("Führungsstab\nKater");
        expect(rollenkarten[3]?.[0]).toBe("Einsatzstelle C\nEA 11");

        const zeitachse = calls[4]?.body as (string | number)[][];
        expect(zeitachse.map(zeile => zeile[0])).toEqual([1, 2]);
        expect(zeitachse[0]?.[1]).toBe("+0:00\n09:00");
        expect(zeitachse[0]?.[3]).toBe("Ausdruck");
        expect(zeitachse[0]?.[4]).toBe("Auftrag");
        expect(zeitachse[0]?.[5]).toBe("Betreff: Einsatzauftrag Nr. 1\nAuftrag 1");
        expect(zeitachse[0]?.[6]).toBe("An EA 11");
        expect(zeitachse[1]?.[2]).toBe("EA 11");
        expect(pdf.setPage).toHaveBeenCalledTimes(3);
        expect(doc.blob()).toBeInstanceOf(Blob);
    });

    it("zeigt ohne Übungsbeginn nur den Offset und eine Lücke zum Eintragen", () => {
        const { pdf, calls } = bauePdfMock();
        new Drehbuch(baueUebung(), baueDrehbuch(), pdf as never).draw();
        const zeitachse = calls[4]?.body as (string | number)[][];
        expect(zeitachse[0]?.[1]).toBe("+0:00");
        const kopf = (pdf.text.mock.calls as unknown[][]).map(call => String(call[0])).join("\n");
        expect(kopf).toContain("________ Uhr");
    });

    it("verweigert Übungen ohne Rollenbesetzung", () => {
        const { pdf } = bauePdfMock();
        const u = baueUebung();
        u.fuehrungsstelle = undefined;
        expect(() => new Drehbuch(u, baueDrehbuch(), pdf as never)).toThrow(/keine Führungsstellen-Übung/);
    });
});
