// QR-Code-Encoder nach ISO/IEC 18004 (AP-12).
//
// Bewusst selbst geschrieben statt per npm-Paket: eine neue Abhängigkeit würde
// die package-lock.json neu schreiben, und das ist in diesem Projekt teuer
// (CI zieht aus npmjs, lokale Registry-Konfigurationen weichen ab). Der
// Funktionsumfang ist deshalb auf das begrenzt, was die Aushänge brauchen:
// Byte-Modus, Fehlerkorrektur M, Versionen 1 bis 10. Das reicht für URLs bis
// 213 Zeichen; darüber hinaus wird bewusst geworfen statt still zu kürzen.
//
// Reine Funktionen ohne Datei- und Netzzugriff. tests/seo/QrCode.test.ts liest
// die erzeugte Matrix mit einem eigenen Decoder zurück.

/** Fehlerkorrekturstufe M: 2 Bit im Formatfeld. */
const EC_LEVEL_BITS = 0b00;

/**
 * Blockstruktur je Version für Stufe M.
 * [EC-Codewörter je Block, Blöcke Gruppe 1, Datencodewörter Gruppe 1,
 *  Blöcke Gruppe 2, Datencodewörter Gruppe 2]
 */
const VERSIONEN = {
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

/** Mittelpunkte der Ausrichtungsmuster je Version. */
const AUSRICHTUNG = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50]
};

// ---------------------------------------------------------------- GF(256)

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d; // Primitivpolynom x^8+x^4+x^3+x^2+1
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
}

/** Generatorpolynom für `grad` Fehlerkorrektur-Codewörter. */
function generatorPolynom(grad) {
    let poly = [1];
    for (let i = 0; i < grad; i++) {
        const naechste = new Array(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j++) {
            naechste[j] ^= poly[j];
            naechste[j + 1] ^= gfMul(poly[j], EXP[i]);
        }
        poly = naechste;
    }
    return poly;
}

/** Reed-Solomon-Rest eines Datenblocks. */
function fehlerkorrektur(daten, anzahl) {
    const gen = generatorPolynom(anzahl);
    const rest = new Array(anzahl).fill(0);
    for (const byte of daten) {
        const faktor = byte ^ rest[0];
        rest.shift();
        rest.push(0);
        if (faktor !== 0) {
            for (let i = 0; i < anzahl; i++) {
                rest[i] ^= gfMul(gen[i + 1], faktor);
            }
        }
    }
    return rest;
}

// ------------------------------------------------------------- Bitstrom

/** Nutzbare Zeichen im Byte-Modus je Version (Stufe M). */
export function kapazitaet(version) {
    const [, b1, d1, b2, d2] = VERSIONEN[version];
    const datenBytes = b1 * d1 + b2 * d2;
    const zaehlerBits = version >= 10 ? 16 : 8;
    return Math.floor((datenBytes * 8 - 4 - zaehlerBits) / 8);
}

/** Kleinste Version, die `laenge` Bytes fasst. */
function versionFuer(laenge) {
    for (let version = 1; version <= 10; version++) {
        if (laenge <= kapazitaet(version)) return version;
    }
    throw new Error(
        `QR-Code: ${laenge} Bytes passen nicht in Version 10 (max. ${kapazitaet(10)}). `
        + "Kürzere URL wählen."
    );
}

/** Daten- und Fehlerkorrekturcodewörter, bereits verschränkt. */
function codewoerter(bytes, version) {
    const [ecAnzahl, b1, d1, b2, d2] = VERSIONEN[version];
    const datenBytes = b1 * d1 + b2 * d2;
    const zaehlerBits = version >= 10 ? 16 : 8;

    // Bitstrom: Modus 0100 (Byte), Zeichenzahl, Nutzdaten.
    const bits = [];
    const schreibe = (wert, laenge) => {
        for (let i = laenge - 1; i >= 0; i--) bits.push((wert >> i) & 1);
    };
    schreibe(0b0100, 4);
    schreibe(bytes.length, zaehlerBits);
    for (const byte of bytes) schreibe(byte, 8);

    // Abschluss, Auffüllen auf volle Bytes, dann die festen Füllbytes.
    const maxBits = datenBytes * 8;
    for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const daten = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
        daten.push(byte);
    }
    const fuell = [0xec, 0x11];
    let fuellIndex = 0;
    while (daten.length < datenBytes) daten.push(fuell[fuellIndex++ % 2]);

    // In Blöcke zerlegen und je Block die Fehlerkorrektur rechnen.
    const bloecke = [];
    let gelesen = 0;
    for (let i = 0; i < b1; i++) {
        bloecke.push(daten.slice(gelesen, gelesen + d1));
        gelesen += d1;
    }
    for (let i = 0; i < b2; i++) {
        bloecke.push(daten.slice(gelesen, gelesen + d2));
        gelesen += d2;
    }
    const ec = bloecke.map(block => fehlerkorrektur(block, ecAnzahl));

    // Verschränken: erst spaltenweise die Daten, dann spaltenweise die EC.
    const ergebnis = [];
    const maxDaten = Math.max(d1, d2);
    for (let i = 0; i < maxDaten; i++) {
        for (const block of bloecke) if (i < block.length) ergebnis.push(block[i]);
    }
    for (let i = 0; i < ecAnzahl; i++) {
        for (const block of ec) ergebnis.push(block[i]);
    }
    return ergebnis;
}

// -------------------------------------------------------------- Matrix

const MASKEN = [
    (i, j) => (i + j) % 2 === 0,
    (i) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0
];

/** Leere Matrix mit allen Funktionsmustern; `reserviert` markiert sie. */
function grundmuster(version) {
    const groesse = version * 4 + 17;
    const matrix = Array.from({ length: groesse }, () => new Array(groesse).fill(false));
    const reserviert = Array.from({ length: groesse }, () => new Array(groesse).fill(false));

    const setze = (zeile, spalte, wert) => {
        matrix[zeile][spalte] = wert;
        reserviert[zeile][spalte] = true;
    };

    // Suchmuster mit Trennlinie, in allen drei Ecken.
    for (const [zeile0, spalte0] of [[0, 0], [0, groesse - 7], [groesse - 7, 0]]) {
        for (let z = -1; z <= 7; z++) {
            for (let s = -1; s <= 7; s++) {
                const zeile = zeile0 + z;
                const spalte = spalte0 + s;
                if (zeile < 0 || zeile >= groesse || spalte < 0 || spalte >= groesse) continue;
                const imRing = (z >= 0 && z <= 6 && (s === 0 || s === 6))
                    || (s >= 0 && s <= 6 && (z === 0 || z === 6));
                const imKern = z >= 2 && z <= 4 && s >= 2 && s <= 4;
                setze(zeile, spalte, imRing || imKern);
            }
        }
    }

    // Taktmuster.
    for (let i = 8; i < groesse - 8; i++) {
        setze(6, i, i % 2 === 0);
        setze(i, 6, i % 2 === 0);
    }

    // Ausrichtungsmuster, außer wo sie ein Suchmuster überdecken würden.
    const zentren = AUSRICHTUNG[version];
    for (const zeile0 of zentren) {
        for (const spalte0 of zentren) {
            const beiSuchmuster = (zeile0 <= 8 && spalte0 <= 8)
                || (zeile0 <= 8 && spalte0 >= groesse - 9)
                || (zeile0 >= groesse - 9 && spalte0 <= 8);
            if (beiSuchmuster) continue;
            for (let z = -2; z <= 2; z++) {
                for (let s = -2; s <= 2; s++) {
                    const rand = Math.max(Math.abs(z), Math.abs(s));
                    setze(zeile0 + z, spalte0 + s, rand !== 1);
                }
            }
        }
    }

    // Dunkles Modul und die für das Formatfeld freigehaltenen Stellen.
    setze(groesse - 8, 8, true);
    for (let i = 0; i < 9; i++) {
        if (!reserviert[8][i]) setze(8, i, false);
        if (!reserviert[i][8]) setze(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
        if (!reserviert[8][groesse - 1 - i]) setze(8, groesse - 1 - i, false);
        if (!reserviert[groesse - 1 - i][8]) setze(groesse - 1 - i, 8, false);
    }

    // Versionsfeld ab Version 7.
    if (version >= 7) {
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 3; j++) {
                setze(groesse - 11 + j, i, false);
                setze(i, groesse - 11 + j, false);
            }
        }
    }

    return { matrix, reserviert, groesse };
}

/** Datenbits im Zickzack von rechts unten nach links oben einsetzen. */
function setzeDaten(matrix, reserviert, groesse, bytes) {
    const bits = [];
    for (const byte of bytes) {
        for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
    }

    let index = 0;
    let aufwaerts = true;
    for (let rechts = groesse - 1; rechts > 0; rechts -= 2) {
        // Die senkrechte Taktspalte wird übersprungen, nicht mitgezählt.
        if (rechts === 6) rechts = 5;
        for (let schritt = 0; schritt < groesse; schritt++) {
            const zeile = aufwaerts ? groesse - 1 - schritt : schritt;
            for (const spalte of [rechts, rechts - 1]) {
                if (reserviert[zeile][spalte]) continue;
                matrix[zeile][spalte] = index < bits.length ? bits[index] === 1 : false;
                index++;
            }
        }
        aufwaerts = !aufwaerts;
    }
}

function formatBits(maskennummer) {
    const roh = (EC_LEVEL_BITS << 3) | maskennummer;
    let rest = roh << 10;
    for (let i = 14; i >= 10; i--) {
        if ((rest >> i) & 1) rest ^= 0x537 << (i - 10);
    }
    return ((roh << 10) | rest) ^ 0x5412;
}

function versionBits(version) {
    let rest = version << 12;
    for (let i = 17; i >= 12; i--) {
        if ((rest >> i) & 1) rest ^= 0x1f25 << (i - 12);
    }
    return (version << 12) | rest;
}

function setzeFormat(matrix, groesse, maskennummer) {
    const bits = formatBits(maskennummer);
    const lies = i => ((bits >> i) & 1) === 1;

    for (let i = 0; i <= 5; i++) matrix[8][i] = lies(i);
    matrix[8][7] = lies(6);
    matrix[8][8] = lies(7);
    matrix[7][8] = lies(8);
    for (let i = 9; i <= 14; i++) matrix[14 - i][8] = lies(i);

    for (let i = 0; i <= 7; i++) matrix[groesse - 1 - i][8] = lies(i);
    for (let i = 8; i <= 14; i++) matrix[8][groesse - 15 + i] = lies(i);
}

function setzeVersion(matrix, groesse, version) {
    if (version < 7) return;
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
        const wert = ((bits >> i) & 1) === 1;
        const zeile = Math.floor(i / 3);
        const spalte = i % 3;
        matrix[groesse - 11 + spalte][zeile] = wert;
        matrix[zeile][groesse - 11 + spalte] = wert;
    }
}

/** Bewertung nach den vier Straftermen der Norm; kleiner ist besser. */
function strafpunkte(matrix, groesse) {
    let punkte = 0;

    // 1: Läufe gleicher Farbe ab fünf Modulen.
    for (let i = 0; i < groesse; i++) {
        for (const waagerecht of [true, false]) {
            let laufFarbe = null;
            let laufLaenge = 0;
            for (let j = 0; j < groesse; j++) {
                const wert = waagerecht ? matrix[i][j] : matrix[j][i];
                if (wert === laufFarbe) {
                    laufLaenge++;
                } else {
                    if (laufLaenge >= 5) punkte += 3 + (laufLaenge - 5);
                    laufFarbe = wert;
                    laufLaenge = 1;
                }
            }
            if (laufLaenge >= 5) punkte += 3 + (laufLaenge - 5);
        }
    }

    // 2: gleichfarbige 2×2-Blöcke.
    for (let i = 0; i < groesse - 1; i++) {
        for (let j = 0; j < groesse - 1; j++) {
            const wert = matrix[i][j];
            if (wert === matrix[i][j + 1] && wert === matrix[i + 1][j] && wert === matrix[i + 1][j + 1]) {
                punkte += 3;
            }
        }
    }

    // 3: suchmusterähnliche Folgen.
    const MUSTER = [true, false, true, true, true, false, true, false, false, false, false];
    const UMGEKEHRT = [...MUSTER].reverse();
    const passt = (werte, muster) => muster.every((wert, i) => werte[i] === wert);
    for (let i = 0; i < groesse; i++) {
        for (let j = 0; j + 11 <= groesse; j++) {
            const waagerecht = [];
            const senkrecht = [];
            for (let k = 0; k < 11; k++) {
                waagerecht.push(matrix[i][j + k]);
                senkrecht.push(matrix[j + k][i]);
            }
            if (passt(waagerecht, MUSTER) || passt(waagerecht, UMGEKEHRT)) punkte += 40;
            if (passt(senkrecht, MUSTER) || passt(senkrecht, UMGEKEHRT)) punkte += 40;
        }
    }

    // 4: Abweichung vom hälftigen Dunkelanteil.
    let dunkel = 0;
    for (const zeile of matrix) for (const wert of zeile) if (wert) dunkel++;
    const anteil = (dunkel * 100) / (groesse * groesse);
    punkte += Math.floor(Math.abs(anteil - 50) / 5) * 10;

    return punkte;
}

/**
 * Erzeugt die Modulmatrix für `text`.
 *
 * @param {string} text Nutzdaten, üblicherweise eine URL.
 * @returns {{ matrix: boolean[][], groesse: number, version: number, maske: number }}
 */
export function qrMatrix(text) {
    const bytes = [...new TextEncoder().encode(text)];
    const version = versionFuer(bytes.length);
    const daten = codewoerter(bytes, version);

    let beste = null;
    for (let maskennummer = 0; maskennummer < 8; maskennummer++) {
        const { matrix, reserviert, groesse } = grundmuster(version);
        setzeDaten(matrix, reserviert, groesse, daten);
        for (let i = 0; i < groesse; i++) {
            for (let j = 0; j < groesse; j++) {
                if (!reserviert[i][j] && MASKEN[maskennummer](i, j)) matrix[i][j] = !matrix[i][j];
            }
        }
        setzeFormat(matrix, groesse, maskennummer);
        setzeVersion(matrix, groesse, version);

        const punkte = strafpunkte(matrix, groesse);
        if (beste === null || punkte < beste.punkte) {
            beste = { matrix, groesse, version, maske: maskennummer, punkte };
        }
    }

    return { matrix: beste.matrix, groesse: beste.groesse, version, maske: beste.maske };
}

/**
 * QR-Code als SVG-Zeichenkette. `rand` in Modulen (die Norm verlangt 4).
 * Ein einziger Pfad statt vieler Rechtecke: das hält die Datei klein.
 */
export function qrSvg(text, { rand = 4, farbe = "#000000" } = {}) {
    const { matrix, groesse } = qrMatrix(text);
    const gesamt = groesse + rand * 2;
    const teile = [];
    for (let i = 0; i < groesse; i++) {
        for (let j = 0; j < groesse; j++) {
            if (matrix[i][j]) teile.push(`M${j + rand} ${i + rand}h1v1h-1z`);
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gesamt} ${gesamt}" `
        + `shape-rendering="crispEdges" role="img" aria-label="QR-Code">`
        + `<rect width="${gesamt}" height="${gesamt}" fill="#ffffff"/>`
        + `<path fill="${farbe}" d="${teile.join("")}"/></svg>`;
}
