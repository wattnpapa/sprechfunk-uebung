// AP-12: Der QR-Code auf den Aushängen muss lesbar sein, nicht nur „nach QR
// aussehen". Ein gedrucktes Blatt mit kaputtem Code fällt sonst erst auf, wenn
// es in einer Dienststelle hängt.
//
// Geprüft wird mit einem eigenen Decoder, der die Matrix nach ISO/IEC 18004
// zurückliest: Formatfeld → Maske → Datenmodule im Zickzack → Blöcke
// entschränken → Bitstrom parsen. Das deckt Platzierung, Maskierung,
// Verschränkung und Bitstrom ab.
//
// Die Reed-Solomon-Rechnung deckt der Rundlauf NICHT ab — der Decoder
// korrigiert ja nichts. Dafür gibt es die Syndromprobe: ein gültiges
// RS-Codewort ist durch das Generatorpolynom teilbar, alle Syndrome sind also
// null. Das ist die definierende Eigenschaft und unabhängig vom Encoder-Code.
//
// Der gebündelte Chromium hat keinen BarcodeDetector, ein echter Scanner steht
// hier also nicht zur Verfügung. Das ist die Grenze dieses Tests.

import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reine JS-Hilfsmodule ohne Typdeklarationen, absichtlich .mjs
import { kapazitaet, qrMatrix, qrSvg } from "../../scripts/lib/qrcode.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { AUSHAENGE, aushangUrl } from "../../scripts/lib/aushaenge.mjs";

type Matrix = boolean[][];

/** Blockstruktur je Version, Stufe M — unabhängig von der Encoder-Tabelle notiert. */
const BLOCKSTRUKTUR: Record<number, [number, number, number, number, number]> = {
    1: [10, 1, 16, 0, 0],
    2: [16, 1, 28, 0, 0],
    3: [26, 1, 44, 0, 0],
    4: [18, 2, 32, 0, 0],
    5: [24, 2, 43, 0, 0],
    6: [16, 4, 27, 0, 0],
    7: [18, 4, 31, 0, 0],
    8: [22, 2, 38, 2, 39],
    9: [22, 3, 36, 2, 37],
    10: [26, 4, 43, 1, 44]
};

const ZENTREN: Record<number, number[]> = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

// ------------------------------------------------------------- GF(256)

const EXP: number[] = [];
const LOG: number[] = [];
{
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

// ------------------------------------------------------------- Decoder

/** Welche Module gehören zu Funktionsmustern und tragen keine Daten. */
function funktionsmodule(version: number, groesse: number): boolean[][] {
    const belegt = Array.from({ length: groesse }, () => new Array(groesse).fill(false));
    const markiere = (zeile: number, spalte: number): void => {
        if (zeile >= 0 && zeile < groesse && spalte >= 0 && spalte < groesse) belegt[zeile][spalte] = true;
    };

    // Suchmuster samt Trennlinie und dem daneben liegenden Formatfeld.
    for (const [z0, s0] of [[0, 0], [0, groesse - 8], [groesse - 8, 0]]) {
        for (let z = 0; z < 9; z++) for (let s = 0; s < 9; s++) markiere(z0 + z, s0 + s);
    }
    // Taktmuster.
    for (let i = 0; i < groesse; i++) {
        markiere(6, i);
        markiere(i, 6);
    }
    // Ausrichtungsmuster.
    const zentren = ZENTREN[version];
    for (const z0 of zentren) {
        for (const s0 of zentren) {
            const beiSuchmuster = (z0 <= 8 && s0 <= 8)
                || (z0 <= 8 && s0 >= groesse - 9)
                || (z0 >= groesse - 9 && s0 <= 8);
            if (beiSuchmuster) continue;
            for (let z = -2; z <= 2; z++) for (let s = -2; s <= 2; s++) markiere(z0 + z, s0 + s);
        }
    }
    // Versionsfeld ab Version 7.
    if (version >= 7) {
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 3; j++) {
                markiere(groesse - 11 + j, i);
                markiere(i, groesse - 11 + j);
            }
        }
    }
    return belegt;
}

/** Maskennummer aus dem Formatfeld links oben. */
function leseMaske(matrix: Matrix): { maske: number; ecBits: number } {
    const bits: number[] = [];
    for (let i = 0; i <= 5; i++) bits[i] = matrix[8][i] ? 1 : 0;
    bits[6] = matrix[8][7] ? 1 : 0;
    bits[7] = matrix[8][8] ? 1 : 0;
    bits[8] = matrix[7][8] ? 1 : 0;
    for (let i = 9; i <= 14; i++) bits[i] = matrix[14 - i][8] ? 1 : 0;

    let wert = 0;
    for (let i = 14; i >= 0; i--) wert = (wert << 1) | bits[i];
    const roh = (wert ^ 0x5412) >> 10;
    return { ecBits: (roh >> 3) & 0b11, maske: roh & 0b111 };
}

const MASKEN: ((i: number, j: number) => boolean)[] = [
    (i, j) => (i + j) % 2 === 0,
    (i) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0
];

/** Liest die Nutzdaten aus einer Modulmatrix zurück. */
function dekodiere(matrix: Matrix, groesse: number): { text: string; codewoerter: number[]; version: number } {
    const version = (groesse - 17) / 4;
    const belegt = funktionsmodule(version, groesse);
    const { maske } = leseMaske(matrix);

    // Zickzack von rechts unten, Taktspalte 6 überspringen.
    const bits: number[] = [];
    let aufwaerts = true;
    for (let rechts = groesse - 1; rechts > 0; rechts -= 2) {
        if (rechts === 6) rechts = 5;
        for (let schritt = 0; schritt < groesse; schritt++) {
            const zeile = aufwaerts ? groesse - 1 - schritt : schritt;
            for (const spalte of [rechts, rechts - 1]) {
                if (belegt[zeile][spalte]) continue;
                const roh = matrix[zeile][spalte];
                bits.push((MASKEN[maske](zeile, spalte) ? !roh : roh) ? 1 : 0);
            }
        }
        aufwaerts = !aufwaerts;
    }

    const strom: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
        strom.push(byte);
    }

    // Verschränkung rückgängig machen.
    const [ecAnzahl, b1, d1, b2, d2] = BLOCKSTRUKTUR[version];
    const laengen = [...Array(b1).fill(d1), ...Array(b2).fill(d2)];
    const bloecke: number[][] = laengen.map(() => []);
    let index = 0;
    for (let i = 0; i < Math.max(d1, d2); i++) {
        for (let b = 0; b < laengen.length; b++) {
            if (i < laengen[b]) bloecke[b].push(strom[index++]);
        }
    }
    const ecBloecke: number[][] = laengen.map(() => []);
    for (let i = 0; i < ecAnzahl; i++) {
        for (let b = 0; b < laengen.length; b++) ecBloecke[b].push(strom[index++]);
    }

    const daten = bloecke.flat();
    const datenBits: number[] = [];
    for (const byte of daten) for (let i = 7; i >= 0; i--) datenBits.push((byte >> i) & 1);

    const lies = (start: number, laenge: number): number => {
        let wert = 0;
        for (let i = 0; i < laenge; i++) wert = (wert << 1) | datenBits[start + i];
        return wert;
    };
    const modus = lies(0, 4);
    if (modus !== 0b0100) throw new Error(`Unerwarteter Modus ${modus}, erwartet Byte-Modus`);
    const zaehlerBits = version >= 10 ? 16 : 8;
    const laenge = lies(4, zaehlerBits);
    const nutz: number[] = [];
    for (let i = 0; i < laenge; i++) nutz.push(lies(4 + zaehlerBits + i * 8, 8));

    // Vollständige Codewörter je Block, für die Syndromprobe.
    const vollstaendig = bloecke.map((block, i) => [...block, ...ecBloecke[i]]);
    return {
        text: new TextDecoder().decode(new Uint8Array(nutz)),
        codewoerter: vollstaendig.flat(),
        version
    };
}

/** Syndrome eines Blocks; bei fehlerfreiem RS-Codewort sind alle null. */
function syndrome(codewort: number[], ecAnzahl: number): number[] {
    const ergebnis: number[] = [];
    for (let i = 0; i < ecAnzahl; i++) {
        let summe = 0;
        for (const byte of codewort) summe = mul(summe, EXP[i]) ^ byte;
        ergebnis.push(summe);
    }
    return ergebnis;
}

// --------------------------------------------------------------- Tests

const PROBEN = [
    "https://sprechfunk-uebung.de/",
    "https://sprechfunk-uebung.de/buchstabiertafel/",
    "https://sprechfunk-uebung.de/betriebsworte/",
    "https://sprechfunk-uebung.de/meldevordruck/",
    "https://sprechfunk-uebung.de/funkuebung-planen/",
    "A",
    "Übung mit Umlaut",
    "x".repeat(200)
];

describe("QR-Code", () => {
    it.each(PROBEN)("dekodiert %s wieder zum Ausgangstext", text => {
        const { matrix, groesse } = qrMatrix(text);
        expect(dekodiere(matrix, groesse).text).toBe(text);
    });

    it.each(PROBEN)("erzeugt für %s ein gültiges Reed-Solomon-Codewort", text => {
        const { matrix, groesse } = qrMatrix(text);
        const { version, codewoerter } = dekodiere(matrix, groesse);
        const [ecAnzahl, b1, d1, b2, d2] = BLOCKSTRUKTUR[version];
        const laengen = [...Array(b1).fill(d1 + ecAnzahl), ...Array(b2).fill(d2 + ecAnzahl)];

        let start = 0;
        for (const laenge of laengen) {
            const block = codewoerter.slice(start, start + laenge);
            start += laenge;
            expect(syndrome(block, ecAnzahl)).toEqual(new Array(ecAnzahl).fill(0));
        }
    });

    it("hat die Suchmuster in allen drei Ecken", () => {
        const { matrix, groesse } = qrMatrix("https://sprechfunk-uebung.de/");
        for (const [z0, s0] of [[0, 0], [0, groesse - 7], [groesse - 7, 0]]) {
            expect(matrix[z0 + 0][s0 + 0], "äußerer Ring").toBe(true);
            expect(matrix[z0 + 1][s0 + 1], "heller Ring").toBe(false);
            expect(matrix[z0 + 3][s0 + 3], "Kern").toBe(true);
        }
    });

    it("hat ein durchgehend abwechselndes Taktmuster", () => {
        const { matrix, groesse } = qrMatrix("https://sprechfunk-uebung.de/");
        for (let i = 8; i < groesse - 8; i++) {
            expect(matrix[6][i]).toBe(i % 2 === 0);
            expect(matrix[i][6]).toBe(i % 2 === 0);
        }
    });

    it("wählt die kleinste passende Version", () => {
        expect(qrMatrix("A").version).toBe(1);
        expect(qrMatrix("x".repeat(kapazitaet(1))).version).toBe(1);
        expect(qrMatrix("x".repeat(kapazitaet(1) + 1)).version).toBe(2);
    });

    it("bricht ab, statt eine zu lange URL still zu kürzen", () => {
        expect(() => qrMatrix("x".repeat(kapazitaet(10) + 1))).toThrow(/passen nicht/);
    });

    it("erkennt einen verfälschten Code auch wirklich", () => {
        // Gegenprobe: ohne sie würde der Rundlauf auch bei einem Decoder grün,
        // der einfach immer den Ausgangstext zurückgibt.
        const text = "https://sprechfunk-uebung.de/buchstabiertafel/";
        const { matrix, groesse } = qrMatrix(text);
        const verfaelscht = matrix.map((zeile: boolean[]) => [...zeile]);
        // Ein Datenmodul weit weg von allen Funktionsmustern umkippen.
        verfaelscht[groesse - 3][groesse - 3] = !verfaelscht[groesse - 3][groesse - 3];
        const [ecAnzahl] = BLOCKSTRUKTUR[(groesse - 17) / 4];
        const { codewoerter } = dekodiere(verfaelscht, groesse);
        const alleNull = syndrome(codewoerter, ecAnzahl).every(wert => wert === 0);
        expect(alleNull, "verfälschter Code darf die Syndromprobe nicht bestehen").toBe(false);
    });

    it("liefert ein SVG mit vier Modulen Ruhezone", () => {
        const svg = qrSvg("https://sprechfunk-uebung.de/") as string;
        const { groesse } = qrMatrix("https://sprechfunk-uebung.de/");
        expect(svg).toContain(`viewBox="0 0 ${groesse + 8} ${groesse + 8}"`);
        expect(svg).toContain("<path");
        expect(svg).not.toContain("<script");
    });
});

describe("QR-Codes der Aushänge", () => {
    it.each(AUSHAENGE as { slug: string; ziel: string }[])(
        "$slug verweist auf die eigene Seite",
        aushang => {
            const url = aushangUrl(aushang) as string;
            const { matrix, groesse } = qrMatrix(url);
            expect(dekodiere(matrix, groesse).text).toBe(url);
            expect(url.startsWith("https://sprechfunk-uebung.de/")).toBe(true);
        }
    );
});
