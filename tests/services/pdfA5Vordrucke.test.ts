import { beforeEach, describe, expect, it, vi } from "vitest";

const deckblaetter: string[] = [];
vi.mock("../../src/pdf/DeckblattTeilnehmer.js", () => ({
    DeckblattTeilnehmer: class {
        constructor(private teilnehmer: string) {}
        draw(): void {
            deckblaetter.push(this.teilnehmer);
        }
    }
}));

import {
    sammelVordruckBlob,
    teilnehmerVordruckPdf,
    vordruckPdfsJeTeilnehmer,
    vordruckSeiteBlob,
    type VordruckKlasse
} from "../../src/services/pdfA5Vordrucke";
import { FunkUebung } from "../../src/models/FunkUebung";
import type { Nachricht } from "../../src/types/Nachricht";

interface Aufruf {
    teilnehmer: string;
    nachricht: string;
    hideBackground: boolean | undefined;
    hideFooter: boolean | undefined;
}

const aufrufe: Aufruf[] = [];

const TestVordruck: VordruckKlasse = class {
    private args: ConstructorParameters<VordruckKlasse>;
    constructor(...args: ConstructorParameters<VordruckKlasse>) {
        this.args = args;
    }
    draw(): void {
        const [teilnehmer, , , nachricht, hideBackground, hideFooter] = this.args;
        aufrufe.push({ teilnehmer, nachricht: nachricht.nachricht, hideBackground, hideFooter });
    }
};

function uebung(): FunkUebung {
    const u = new FunkUebung("test");
    u.teilnehmerListe = ["A", "B", "C"];
    u.nachrichten = {
        A: [
            { id: 1, empfaenger: ["B"], nachricht: "eins" },
            { id: 2, empfaenger: ["C"], nachricht: "zwei" }
        ],
        B: [{ id: 1, empfaenger: ["A"], nachricht: "drei" }]
        // C sendet nichts, wie die beübte Stelle einer Führungsstellen-Übung.
    };
    return u;
}

describe("pdfA5Vordrucke", () => {
    beforeEach(() => {
        aufrufe.length = 0;
        deckblaetter.length = 0;
    });

    it("erzeugt je Teilnehmer Deckblatt plus eine Seite je Nachricht", () => {
        const { blob, totalPages } = teilnehmerVordruckPdf(TestVordruck, uebung(), "A", { hideBackground: true });
        expect(blob).toBeInstanceOf(Blob);
        expect(totalPages).toBe(3);
        expect(deckblaetter).toEqual(["A"]);
        expect(aufrufe).toEqual([
            { teilnehmer: "A", nachricht: "eins", hideBackground: true, hideFooter: false },
            { teilnehmer: "A", nachricht: "zwei", hideBackground: true, hideFooter: false }
        ]);
    });

    it("gibt Stellen ohne Nachrichten nur das Deckblatt", () => {
        expect(teilnehmerVordruckPdf(TestVordruck, uebung(), "C").totalPages).toBe(1);
    });

    it("liefert für jeden Teilnehmer ein PDF", () => {
        const map = vordruckPdfsJeTeilnehmer(TestVordruck, uebung(), { hideFooter: true });
        expect([...map.keys()]).toEqual(["A", "B", "C"]);
        expect(aufrufe.every(a => a.hideFooter === true && a.hideBackground === false)).toBe(true);
    });

    it("rendert eine einzelne Seite und prüft die Seitennummer", () => {
        const blob = vordruckSeiteBlob(TestVordruck, { funkUebung: uebung(), teilnehmer: "A", page: 2 });
        expect(blob).toBeInstanceOf(Blob);
        expect(aufrufe).toEqual([{ teilnehmer: "A", nachricht: "zwei", hideBackground: false, hideFooter: false }]);
        expect(() => vordruckSeiteBlob(TestVordruck, { funkUebung: uebung(), teilnehmer: "A", page: 3 }))
            .toThrow("Ungültige Seite");
        expect(() => vordruckSeiteBlob(TestVordruck, { funkUebung: uebung(), teilnehmer: "C", page: 1 }))
            .toThrow("Ungültige Seite");
    });

    it("meldet eine fehlende Nachricht innerhalb der Seitenzahl", () => {
        const u = uebung();
        u.nachrichten["A"] = [undefined as unknown as Nachricht];
        expect(() => vordruckSeiteBlob(TestVordruck, { funkUebung: u, teilnehmer: "A", page: 1 }))
            .toThrow("Nachricht nicht gefunden");
    });

    it("sammelt alle Vordrucke mit Trennblatt und überspringt Stellen ohne Nachrichten", () => {
        const blob = sammelVordruckBlob(TestVordruck, uebung(), { hideBackground: true, hideFooter: true });
        expect(blob).toBeInstanceOf(Blob);
        expect(deckblaetter).toEqual(["A", "B"]);
        expect(aufrufe.map(a => a.nachricht)).toEqual(["eins", "zwei", "drei"]);
        expect(aufrufe.every(a => a.hideBackground && a.hideFooter)).toBe(true);
    });

    it("nutzt ohne Angabe die Standarddarstellung", () => {
        sammelVordruckBlob(TestVordruck, uebung());
        expect(aufrufe.every(a => a.hideBackground === false && a.hideFooter === false)).toBe(true);
    });
});
