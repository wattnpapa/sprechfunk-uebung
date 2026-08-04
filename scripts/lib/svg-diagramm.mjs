// SVG-Primitive für die Diagramme der Inhaltsseiten (AP-10).
//
// Reine Funktionen ohne Datei- und Netzzugriff. Die Diagramme sind bewusst
// deklarativ beschrieben (lib/diagramme.mjs) und werden hier gerendert: 20
// handgeschriebene SVG-Dateien wären 20-mal dieselben Rundungsfehler in der
// Ausrichtung, und eine Änderung am Stil müsste 20-mal nachgezogen werden.
//
// Farben: alles über currentColor, damit die Diagramme im Dunkelmodus ohne
// zweite Fassung mitgehen. Keine Füllung außer den bewusst hervorgehobenen
// Flächen – ein Diagramm, das im Dunkelmodus als weißer Block erscheint, ist
// schlimmer als keines.

import { escapeHtml } from "./schema-graph.mjs";

/** Rasterwerte in Nutzerkoordinaten. Ein Kasten ist 160 breit, 56 hoch. */
export const RASTER = {
    kastenBreite: 160,
    kastenHoehe: 56,
    spalte: 200,
    zeile: 96,
    rand: 12,
    radius: 8
};

const beschriftungsZeilen = (inhalt, maxZeichen = 22) => {
    const worte = String(inhalt).split(/\s+/);
    const zeilen = [];
    let aktuell = "";
    for (const wort of worte) {
        if (aktuell === "") {
            aktuell = wort;
        } else if (`${aktuell} ${wort}`.length <= maxZeichen) {
            aktuell += ` ${wort}`;
        } else {
            zeilen.push(aktuell);
            aktuell = wort;
        }
    }
    if (aktuell !== "") zeilen.push(aktuell);
    return zeilen;
};

/** Mehrzeiliger, zentrierter Text. */
export function text(x, y, inhalt, { klasse = "d-label", maxZeichen = 22, anker = "middle" } = {}) {
    const zeilen = beschriftungsZeilen(inhalt, maxZeichen);
    const start = y - ((zeilen.length - 1) * 15) / 2;
    return zeilen.map((zeile, index) =>
        `<text x="${x}" y="${(start + index * 15).toFixed(1)}" class="${klasse}"`
        + ` text-anchor="${anker}" dominant-baseline="middle">${escapeHtml(zeile)}</text>`
    ).join("");
}

/**
 * Kasten mit Beschriftung. `betont` hebt einen Kasten hervor – gefüllt wird mit
 * halbtransparentem currentColor, nicht mit Weiß, damit beide Themes tragen.
 */
export function kasten(x, y, inhalt, { betont = false, breite = RASTER.kastenBreite, hoehe = RASTER.kastenHoehe } = {}) {
    return "<g>"
        + `<rect x="${x}" y="${y}" width="${breite}" height="${hoehe}" rx="${RASTER.radius}"`
        + ` class="${betont ? "d-box d-box-betont" : "d-box"}"/>`
        + text(x + breite / 2, y + hoehe / 2, inhalt, { maxZeichen: Math.floor(breite / 7.5) })
        + "</g>";
}

/** Pfeil von (x1,y1) nach (x2,y2), optional beschriftet. */
export function pfeil(x1, y1, x2, y2, beschriftung = "") {
    const mitteX = (x1 + x2) / 2;
    const mitteY = (y1 + y2) / 2;
    return "<g>"
        + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="d-arrow" marker-end="url(#d-spitze)"/>`
        + (beschriftung ? text(mitteX, mitteY - 12, beschriftung, { klasse: "d-caption", maxZeichen: 26 }) : "")
        + "</g>";
}

/** Waagerechte Zeitachse mit Marken. */
export function zeitachse(x, y, breite, marken) {
    const teile = [`<line x1="${x}" y1="${y}" x2="${x + breite}" y2="${y}" class="d-arrow" marker-end="url(#d-spitze)"/>`];
    for (const marke of marken) {
        const px = x + breite * marke.anteil;
        teile.push(`<line x1="${px.toFixed(1)}" y1="${y - 7}" x2="${px.toFixed(1)}" y2="${y + 7}" class="d-tick"/>`);
        teile.push(text(px, y + 24, marke.label, { klasse: "d-caption", maxZeichen: 16 }));
    }
    return teile.join("");
}

/** Gemeinsame Formatvorlagen und der Pfeilkopf. */
const STIL = `<defs>
        <marker id="d-spitze" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
        </marker>
    </defs>
    <style>
        .d-box { fill: none; stroke: currentColor; stroke-width: 1.5; opacity: 0.85; }
        .d-box-betont { fill: currentColor; fill-opacity: 0.12; stroke-width: 2.5; opacity: 1; }
        .d-arrow { stroke: currentColor; stroke-width: 1.5; opacity: 0.7; fill: none; }
        .d-tick { stroke: currentColor; stroke-width: 1.5; opacity: 0.6; }
        .d-label { font-size: 13px; font-weight: 600; fill: currentColor; }
        .d-caption { font-size: 11.5px; fill: currentColor; opacity: 0.75; }
    </style>`;

/**
 * Baut das vollständige SVG.
 *
 * `titel` und `beschreibung` landen in <title> und <desc>. `role="img"` plus
 * aria-labelledby macht die Grafik als ein Bild lesbar, statt jeden Textknoten
 * einzeln vorzulesen.
 *
 * width und height stehen zusätzlich zur viewBox, damit der Browser das
 * Seitenverhältnis vor dem Laden kennt – sonst entsteht genau der Layout Shift,
 * den das Arbeitspaket ausschließt.
 */
export function svg({ id, breite, hoehe, titel, beschreibung, inhalt }) {
    return `<svg class="seiten-diagramm" viewBox="0 0 ${breite} ${hoehe}"`
        + ` width="${breite}" height="${hoehe}" role="img"`
        + ` aria-labelledby="${id}-titel ${id}-desc"`
        + ` xmlns="http://www.w3.org/2000/svg">
    <title id="${id}-titel">${escapeHtml(titel)}</title>
    <desc id="${id}-desc">${escapeHtml(beschreibung)}</desc>
    ${STIL}
    ${inhalt}
</svg>`;
}

/**
 * Kette waagerechter Kästen mit Pfeilen dazwischen – das häufigste Muster
 * (Ablauf, Verfahren, Aufbau).
 */
export function kette(schritte, { y = 20, beschriftungen = [] } = {}) {
    const teile = [];
    schritte.forEach((schritt, index) => {
        const x = RASTER.rand + index * RASTER.spalte;
        teile.push(kasten(x, y, schritt.text ?? schritt, { betont: schritt.betont === true }));
        if (index < schritte.length - 1) {
            teile.push(pfeil(
                x + RASTER.kastenBreite,
                y + RASTER.kastenHoehe / 2,
                x + RASTER.spalte,
                y + RASTER.kastenHoehe / 2,
                beschriftungen[index] ?? ""
            ));
        }
    });
    return {
        inhalt: teile.join("\n    "),
        breite: RASTER.rand * 2 + (schritte.length - 1) * RASTER.spalte + RASTER.kastenBreite,
        hoehe: y + RASTER.kastenHoehe + RASTER.rand
    };
}

/**
 * Zwei Spalten gegenübergestellt, je mit Überschrift und Einträgen – für
 * Unterscheidungen wie TMO gegen DMO oder Flächenlage gegen Einsatzlage.
 */
export function gegenueber(links, rechts) {
    const spaltenBreite = 260;
    const abstand = 40;
    const zeilenHoehe = 26;
    const kopfHoehe = 40;
    const maxZeilen = Math.max(links.punkte.length, rechts.punkte.length);
    const hoehe = kopfHoehe + maxZeilen * zeilenHoehe + RASTER.rand * 3;

    const spalte = (daten, x) => {
        const teile = [
            `<rect x="${x}" y="${RASTER.rand}" width="${spaltenBreite}"`
            + ` height="${hoehe - RASTER.rand * 2}" rx="${RASTER.radius}" class="d-box"/>`,
            text(x + spaltenBreite / 2, RASTER.rand + 24, daten.titel, { maxZeichen: 30 })
        ];
        daten.punkte.forEach((punkt, index) => {
            const y = RASTER.rand + kopfHoehe + 14 + index * zeilenHoehe;
            teile.push(`<circle cx="${x + 18}" cy="${y}" r="3" fill="currentColor" opacity="0.7"/>`);
            teile.push(text(x + 32, y, punkt, { klasse: "d-caption", maxZeichen: 34, anker: "start" }));
        });
        return teile.join("");
    };

    return {
        inhalt: [spalte(links, RASTER.rand), spalte(rechts, RASTER.rand + spaltenBreite + abstand)].join("\n    "),
        breite: RASTER.rand * 2 + spaltenBreite * 2 + abstand,
        hoehe
    };
}

/**
 * Beschrifteter Aufbau eines zusammengesetzten Begriffs: die Teile stehen
 * nebeneinander, darunter steht, was jeder Teil bedeutet.
 */
export function aufbau(teile) {
    const hoehe = 150;
    const breiten = teile.map(teil => Math.max(90, String(teil.wert).length * 13 + 30));
    const gesamt = breiten.reduce((summe, wert) => summe + wert, 0) + (teile.length - 1) * 14;
    const elemente = [];
    let x = RASTER.rand;
    teile.forEach((teil, index) => {
        const breite = breiten[index];
        elemente.push(kasten(x, 20, teil.wert, { breite, hoehe: 50, betont: teil.betont === true }));
        elemente.push(`<line x1="${x + breite / 2}" y1="70" x2="${x + breite / 2}" y2="88" class="d-arrow"/>`);
        elemente.push(text(x + breite / 2, 104, teil.bedeutung, { klasse: "d-caption", maxZeichen: 18 }));
        x += breite + 14;
    });
    return {
        inhalt: elemente.join("\n    "),
        breite: gesamt + RASTER.rand * 2,
        hoehe
    };
}
