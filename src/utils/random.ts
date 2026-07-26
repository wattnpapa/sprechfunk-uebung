/**
 * Zufallsquelle im Format von `Math.random`: liefert eine Zahl aus [0, 1).
 */
export type Rng = () => number;

/**
 * Mischt eine Liste nach Fisher-Yates: jede der n! Anordnungen ist gleich
 * wahrscheinlich.
 *
 * `[...liste].sort(() => Math.random() - 0.5)` leistet das nicht. Eine
 * Vergleichsfunktion ohne konsistente Ordnung verletzt die Annahmen von
 * `Array.prototype.sort`; wie stark das Ergebnis verzerrt ist, hängt vom
 * Sortieralgorithmus der jeweiligen Engine ab.
 */
export function shuffle<T>(liste: readonly T[], rng: Rng = Math.random): T[] {
    const gemischt = liste.slice();
    for (let i = gemischt.length - 1; i > 0; i--) {
        const j = randomInt(i + 1, rng);
        // i und j liegen konstruktionsbedingt im gültigen Bereich.
        const zwischenspeicher = gemischt[i] as T;
        gemischt[i] = gemischt[j] as T;
        gemischt[j] = zwischenspeicher;
    }
    return gemischt;
}

/**
 * Ganzzahl aus [0, maxExklusiv).
 */
export function randomInt(maxExklusiv: number, rng: Rng = Math.random): number {
    return Math.floor(rng() * maxExklusiv);
}

/**
 * Ganzzahl aus [min, max] – beide Grenzen inklusive.
 *
 * Liegt `max` unter `min`, ist die Spanne leer und es kommt `min` zurück.
 * Handgeschriebenes `Math.floor(rng() * (max - min + 1)) + min` liefert an
 * dieser Stelle negative Werte, sobald die Grenzen vertauscht sind.
 */
export function randomIntBetween(min: number, max: number, rng: Rng = Math.random): number {
    const spanne = Math.max(0, max - min);
    return min + randomInt(spanne + 1, rng);
}

/**
 * Zufälliges Element der Liste, `undefined` bei leerer Liste.
 */
export function randomElement<T>(liste: readonly T[], rng: Rng = Math.random): T | undefined {
    return liste[randomInt(liste.length, rng)];
}

/**
 * Deterministische Zufallsquelle (mulberry32) zu einem Seed: gleicher Seed
 * ergibt dieselbe Zahlenfolge – unabhängig von Browser, Node-Version und
 * Laufzeit.
 */
export function createSeededRng(seed: string | number): Rng {
    let zustand = (typeof seed === "number" ? seed : hashSeed(seed)) >>> 0;
    return () => {
        zustand = (zustand + 0x6d2b79f5) >>> 0;
        let t = zustand;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Erzeugt einen neuen, kurzen Seed für einen Übungslauf.
 */
export function createRandomSeed(): string {
    const c = globalThis.crypto;
    if (c && typeof c.getRandomValues === "function") {
        const werte = c.getRandomValues(new Uint32Array(2));
        return `${(werte[0] ?? 0).toString(36)}${(werte[1] ?? 0).toString(36)}`;
    }
    // Fallback für ältere Laufzeiten
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * xmur3: verteilt einen beliebigen String gleichmäßig auf 32 Bit, damit auch
 * sehr ähnliche Seeds ("uebung-1", "uebung-2") weit auseinanderliegende
 * Zahlenfolgen ergeben.
 */
function hashSeed(seed: string): number {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
}
