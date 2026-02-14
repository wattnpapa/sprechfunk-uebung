import { describe, expect, it, vi } from "vitest";
import { GeneratorStatsService } from "../../src/generator/GeneratorStatsService";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("GeneratorStatsService", () => {
    it("calculates duration stats deterministically", () => {
        const svc = new GeneratorStatsService();
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

        const nachrichten = [
            { id: 1, empfaenger: ["B"], nachricht: "AAAA" }, // len 4
            { id: 2, empfaenger: ["B", "C"], nachricht: "BBBBBB" } // len 6
        ];

        const stats = svc.berechneUebungsdauer(nachrichten);
        expect(stats.optimal).toBeGreaterThan(0);
        expect(stats.schlecht).toBeGreaterThan(0);
        expect(stats.durchschnittOptimal).toBeGreaterThan(0);
        expect(stats.optimalFormatted.stunden).toBeGreaterThanOrEqual(0);

        randomSpy.mockRestore();
    });

    it("uses repetition factor when random < 0.3", () => {
        const svc = new GeneratorStatsService();
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);

        const nachrichten = [
            { id: 1, empfaenger: ["B"], nachricht: "AAAA" }
        ];

        const stats = svc.berechneUebungsdauer(nachrichten);
        expect(stats.schlecht).toBeGreaterThan(stats.optimal);

        randomSpy.mockRestore();
    });

    it("handles empty messages", () => {
        const svc = new GeneratorStatsService();
        const stats = svc.berechneUebungsdauer([]);
        expect(stats.durchschnittOptimal).toBe(0);
        expect(stats.durchschnittSchlecht).toBe(0);
    });

    it("calculates distribution", () => {
        const svc = new GeneratorStatsService();
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B", "C"];
        uebung.leitung = "A";
        uebung.nachrichten = {
            B: [
                { id: 1, empfaenger: ["C"], nachricht: "X" },
                { id: 2, empfaenger: ["Alle"], nachricht: "Y" }
            ],
            C: [
                { id: 1, empfaenger: ["B"], nachricht: "Z" }
            ]
        };

        const { labels, counts } = svc.berechneVerteilung(uebung);
        expect(labels).toEqual(["B", "C"]);
        expect(counts.length).toBe(2);
        expect(counts[0]).toBeGreaterThan(0);
        expect(counts[1]).toBeGreaterThan(0);
    });

    it("counts 'Alle' for all except sender", () => {
        const svc = new GeneratorStatsService();
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B", "C"];
        uebung.leitung = "A";
        uebung.nachrichten = {
            B: [{ id: 1, empfaenger: ["Alle"], nachricht: "X" }]
        };

        const { labels, counts } = svc.berechneVerteilung(uebung);
        const idxB = labels.indexOf("B");
        const idxC = labels.indexOf("C");
        expect(counts[idxB]).toBeGreaterThanOrEqual(0);
        expect(counts[idxC]).toBeGreaterThan(0);
    });

    it("ignores recipients not in distribution", () => {
        const svc = new GeneratorStatsService();
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B"];
        uebung.leitung = "A";
        uebung.nachrichten = {
            B: [
                { id: 1, empfaenger: ["X"], nachricht: "Hello" },
                { id: 2, empfaenger: ["B"], nachricht: "Self" }
            ]
        };

        const { labels, counts } = svc.berechneVerteilung(uebung);
        expect(labels).toEqual(["B"]);
        expect(counts[0]).toBeGreaterThanOrEqual(0);
    });

    it("excludes leitung from labels", () => {
        const svc = new GeneratorStatsService();
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        uebung.leitung = "A";
        uebung.nachrichten = { A: [] };

        const { labels, counts } = svc.berechneVerteilung(uebung);
        expect(labels).toEqual([]);
        expect(counts).toEqual([]);
    });
});
