import { describe, expect, it } from "vitest";
import {
    createRandomSeed,
    createSeededRng,
    randomElement,
    randomInt,
    randomIntBetween,
    shuffle
} from "../../src/utils/random";

describe("shuffle", () => {
    it("keeps every element and leaves the input untouched", () => {
        const original = ["A", "B", "C", "D", "E"];
        const kopie = [...original];

        const gemischt = shuffle(original, createSeededRng("test"));

        expect(gemischt).not.toBe(original);
        expect(original).toEqual(kopie);
        expect([...gemischt].sort()).toEqual([...original].sort());
    });

    it("handles empty and single-element lists", () => {
        expect(shuffle([])).toEqual([]);
        expect(shuffle(["A"])).toEqual(["A"]);
    });

    it("produces every permutation about equally often", () => {
        // Seed fixiert den Lauf: der Test ist damit aussagekräftig und trotzdem
        // nicht flaky.
        const rng = createSeededRng("gleichverteilung");
        const durchlaeufe = 60000;
        const erwartetProPermutation = durchlaeufe / 6;
        const haeufigkeit = new Map<string, number>();

        for (let i = 0; i < durchlaeufe; i++) {
            const key = shuffle(["A", "B", "C"], rng).join("");
            haeufigkeit.set(key, (haeufigkeit.get(key) ?? 0) + 1);
        }

        expect(haeufigkeit.size).toBe(6);
        haeufigkeit.forEach(anzahl => {
            // 5 % Toleranz: eine echte Gleichverteilung liegt deutlich darunter,
            // die Verzerrung eines sort-basierten Shuffles deutlich darüber.
            expect(Math.abs(anzahl - erwartetProPermutation)).toBeLessThan(erwartetProPermutation * 0.05);
        });
    });

    it("moves every element into every position about equally often", () => {
        const rng = createSeededRng("positionen");
        const durchlaeufe = 20000;
        const elemente = ["A", "B", "C", "D", "E"];
        const erwartet = durchlaeufe / elemente.length;
        const positionen = new Map<string, number[]>(
            elemente.map(element => [element, new Array<number>(elemente.length).fill(0)])
        );

        for (let i = 0; i < durchlaeufe; i++) {
            shuffle(elemente, rng).forEach((element, index) => {
                const zaehler = positionen.get(element);
                if (zaehler) {
                    zaehler[index] = (zaehler[index] ?? 0) + 1;
                }
            });
        }

        positionen.forEach(zaehler => {
            zaehler.forEach(anzahl => {
                expect(Math.abs(anzahl - erwartet)).toBeLessThan(erwartet * 0.06);
            });
        });
    });
});

describe("createSeededRng", () => {
    it("repeats the exact same sequence for the same seed", () => {
        const a = createSeededRng("uebung-2026");
        const b = createSeededRng("uebung-2026");
        const folgeA = Array.from({ length: 50 }, () => a());
        const folgeB = Array.from({ length: 50 }, () => b());

        expect(folgeA).toEqual(folgeB);
    });

    it("stays stable across releases", () => {
        // Regressionsschutz: ändert sich der Algorithmus, lassen sich
        // gespeicherte Seeds nicht mehr nachstellen.
        const rng = createSeededRng("uebung-2026");

        expect([rng(), rng(), rng()]).toEqual([
            0.24008428351953626,
            0.742266098735854,
            0.8367802232969552
        ]);
    });

    it("produces different sequences for similar seeds", () => {
        const a = createSeededRng("uebung-1");
        const b = createSeededRng("uebung-2");

        expect(a()).not.toBeCloseTo(b(), 5);
    });

    it("stays inside [0, 1)", () => {
        const rng = createSeededRng(12345);
        for (let i = 0; i < 1000; i++) {
            const wert = rng();
            expect(wert).toBeGreaterThanOrEqual(0);
            expect(wert).toBeLessThan(1);
        }
    });

    it("shuffles reproducibly when seeded", () => {
        const liste = Array.from({ length: 20 }, (_, i) => i);

        const ersterLauf = shuffle(liste, createSeededRng("abc"));
        const zweiterLauf = shuffle(liste, createSeededRng("abc"));
        const andererSeed = shuffle(liste, createSeededRng("xyz"));

        expect(ersterLauf).toEqual(zweiterLauf);
        expect(ersterLauf).not.toEqual(andererSeed);
    });
});

describe("randomInt / randomElement", () => {
    it("stays below the exclusive maximum", () => {
        const rng = createSeededRng("grenzen");
        for (let i = 0; i < 500; i++) {
            const wert = randomInt(7, rng);
            expect(wert).toBeGreaterThanOrEqual(0);
            expect(wert).toBeLessThan(7);
            expect(Number.isInteger(wert)).toBe(true);
        }
    });

    it("covers both bounds of randomIntBetween", () => {
        const rng = createSeededRng("spanne");
        const gesehen = new Set<number>();

        for (let i = 0; i < 500; i++) {
            const wert = randomIntBetween(4, 7, rng);
            expect(wert).toBeGreaterThanOrEqual(4);
            expect(wert).toBeLessThanOrEqual(7);
            gesehen.add(wert);
        }

        expect([...gesehen].sort()).toEqual([4, 5, 6, 7]);
    });

    it("returns min when the bounds are equal or swapped", () => {
        const rng = createSeededRng("vertauscht");

        expect(randomIntBetween(5, 5, rng)).toBe(5);
        // Vertauschte Grenzen dürfen nie unter min rutschen – genau daran ist
        // die 85-%-Stufe in getRandomSubsetOfOthers gescheitert.
        for (let i = 0; i < 100; i++) {
            expect(randomIntBetween(6, 2, rng)).toBe(6);
        }
    });

    it("returns undefined for an empty list", () => {
        expect(randomElement([], createSeededRng("leer"))).toBeUndefined();
    });

    it("only returns elements of the list", () => {
        const rng = createSeededRng("elemente");
        const liste = ["A", "B", "C"];
        for (let i = 0; i < 100; i++) {
            expect(liste).toContain(randomElement(liste, rng));
        }
    });
});

describe("createRandomSeed", () => {
    it("creates distinct non-empty seeds", () => {
        const seeds = new Set(Array.from({ length: 50 }, () => createRandomSeed()));

        expect(seeds.size).toBe(50);
        seeds.forEach(seed => expect(seed.length).toBeGreaterThan(0));
    });
});
