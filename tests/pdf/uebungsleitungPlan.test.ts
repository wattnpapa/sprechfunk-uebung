import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import { FunkUebung } from "../../src/models/FunkUebung";
import { Uebungsleitung } from "../../src/pdf/Uebungsleitung";
import {
    FS_PLAN_KOPF,
    FS_TEILNEHMER_KOPF,
    fuehrungsstellenPlanZeilen,
    fuehrungsstellenRolle,
    klassischePlanZeilen,
    loesungswortSpaltenBreite,
    pdfPlan
} from "../../src/pdf/uebungsleitungPlan";
import { buildPlan } from "../../src/uebungsleitung/nachrichtenplan";

// THW-Review 2026-10-05: workflow W4 (Führungsstellen-PDF im klassischen
// Layout), W9 (Nummern Papier ↔ Bildschirm), analog-first P3-5 (Lösungswort
// mitten im Wort umbrochen).

const klassisch = () => {
    const u = new FunkUebung("dev");
    u.teilnehmerListe = ["B", "A"];
    u.nachrichten = {
        B: [{ id: 1, empfaenger: ["A"], nachricht: "B1" }, { id: 2, empfaenger: ["A"], nachricht: "B2" }],
        A: [{ id: 1, empfaenger: ["B"], nachricht: "A1" }]
    };
    return u;
};

const fuehrungsstelle = () => {
    const u = new FunkUebung("dev");
    u.teilnehmerListe = ["Stelle 10", "EA 1", "Stab"];
    u.fuehrungsstelle = { slug: "hochwasser", beuebteStelle: "Stelle 10", uebergeordnet: "Stab", unterstellt: ["EA 1"], beginn: "19:30" };
    u.nachrichten = {
        "Stelle 10": [],
        "EA 1": [{ id: 1, empfaenger: ["Stelle 10"], nachricht: "Lage EA 1", xZeitSlot: 3, weg: "funk", meldeart: "lagemeldung", erwartung: "Lagekarte nachführen" }],
        Stab: [{ id: 1, empfaenger: ["Stelle 10"], nachricht: "Auftrag", xZeitSlot: 1, weg: "drucker", meldeart: "auftrag", betreff: "Räumung", erwartung: "Quittieren" }]
    };
    return u;
};

describe("Übungsleitungs-PDF: Plan wie am Bildschirm", () => {
    it("gleiche Reihenfolge und fortlaufende Nummer wie der Nachrichtenplan der Ansicht", () => {
        const u = klassisch();
        const pdf = pdfPlan(u).map(e => [e.planNr, e.sender, e.nr]);
        const bildschirm = buildPlan(u).map(e => [e.planNr, e.sender, e.nr]);
        expect(pdf).toEqual(bildschirm);
    });

    it("Nr-Spalte zeigt Plan-Nr und Abs.-Nr., Stand und Notiz kommen mit", () => {
        const u = klassisch();
        const { zeilen, absNr } = klassischePlanZeilen(u, {
            nachrichten: { "A__1": { abgesetztUm: "2026-10-05T19:05:00.000Z", notiz: "verspätet" } }
        });
        expect(zeilen.map(z => z[0])).toEqual(["1\nAbs.-Nr. 1", "2\nAbs.-Nr. 1", "3\nAbs.-Nr. 2"]);
        expect(absNr).toEqual([1, 1, 2]);
        const a1 = zeilen.find(z => z[2] === "A")!;
        expect(a1[3]).toContain("Anmerkung:\nverspätet");
        expect(a1[4]).not.toBe("");
    });

    it("übersteht fehlende Listen", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(pdfPlan({ nachrichten: { A: null } as any })).toEqual([]);
    });
});

describe("Übungsleitungs-PDF der Führungsstellen-Übung", () => {
    it("Plan nach X-Zeit mit Weg, Erwartung und Ist-Spalte, ohne Lösungswort", () => {
        const zeilen = fuehrungsstellenPlanZeilen(fuehrungsstelle(), {
            nachrichten: { "EA 1__1": { abgesetztUm: "2026-10-05T19:33:00.000Z", notiz: "Karte nicht nachgeführt" } }
        });
        expect(FS_PLAN_KOPF.join(" ")).not.toMatch(/Lösungswort|Stärke/);
        expect(zeilen).toHaveLength(2);
        expect(zeilen[0]?.slice(0, 6)).toEqual([
            "1", "+0:01 (19:31)", "Stab\n→ Stelle 10", "Ausdruck · Auftrag", "Betreff: Räumung\nAuftrag", "Quittieren"
        ]);
        expect(zeilen[1]?.[0]).toBe("2");
        expect(zeilen[1]?.[6]).not.toBe("");
        expect(zeilen[1]?.[7]).toBe("Karte nicht nachgeführt");
    });

    it("Rollen der Stellen", () => {
        const u = fuehrungsstelle();
        expect(fuehrungsstellenRolle(u, "Stelle 10")).toMatch(/beübte Stelle/);
        expect(fuehrungsstellenRolle(u, "EA 1")).toMatch(/Einsatzabschnitt/);
        expect(fuehrungsstellenRolle(u, "Stab")).toMatch(/übergeordnete/);
        expect(fuehrungsstellenRolle(u, "fremd")).toBe("");
        expect(fuehrungsstellenRolle(klassisch(), "A")).toBe("");
    });

    it("das PDF nutzt beide Führungsstellen-Tabellen", () => {
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const tabellen: Array<{ head: string[][] }> = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdf as any).autoTable = vi.fn((opts: { head: string[][] }) => {
            tabellen.push(opts);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (pdf as any).lastAutoTable = { finalY: 100 };
        });
        new Uebungsleitung(fuehrungsstelle(), pdf, null).draw();
        expect(tabellen.map(t => t.head[0])).toEqual([FS_TEILNEHMER_KOPF, FS_PLAN_KOPF]);
    });
});

describe("Lösungswort-Spalten", () => {
    it("lange Wörter bekommen genug Breite, die Grenzen gelten", () => {
        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        const messen = (t: string) => pdf.getTextWidth(t);
        const breite = loesungswortSpaltenBreite(["FUNK", "EINSATZBESPRECHUNG"], messen, 36, 55);
        expect(breite).toBeGreaterThan(messen("EINSATZBESPRECHUNG") + 4);
        expect(loesungswortSpaltenBreite(["FUNK"], messen, 36, 55)).toBe(36);
        expect(loesungswortSpaltenBreite(["X".repeat(200)], messen, 36, 55)).toBe(55);
        expect(loesungswortSpaltenBreite([], messen, 36, 55)).toBe(36);
    });
});
