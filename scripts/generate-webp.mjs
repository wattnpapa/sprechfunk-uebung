// Erzeugt WebP-Fassungen der Rasterbilder (AP-10).
//
//   npm run bilder:webp
//
// Kodiert wird mit Chromium über Canvas. Das ist Absicht: Playwright ist als
// Entwicklungsabhängigkeit schon da, und sharp wäre eine zusätzliche native
// Abhängigkeit für eine Aufgabe, die der vorhandene Browser erledigt.
//
// AVIF deckt dieser Weg nicht ab – Chromium kann AVIF dekodieren, aber nicht
// über Canvas kodieren. Wer AVIF will, braucht sharp oder avifenc; das wäre
// eine bewusste Abhängigkeitsentscheidung.
//
// Die Ergebnisse werden eingecheckt, damit der normale Build ohne Browser
// auskommt – dieselbe Begründung wie bei den Social-Preview-Bildern.

/* global document, Image -- nur in Browser-Callbacks (evaluate) */

import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const ASSETS = path.join(root, "assets");

/** Qualität der WebP-Kodierung. 0.82 hält Screenshots lesbar. */
const QUALITAET = 0.82;

/** Mindestersparnis in Prozent, damit die WebP-Fassung entsteht. */
const MINDESTGEWINN = 5;

/** Sammelt alle PNG-Dateien unter assets/, ohne Favicon und Social-Previews. */
async function pngDateien(verzeichnis, gesammelt = []) {
    for (const eintrag of await readdir(verzeichnis, { withFileTypes: true })) {
        const vollpfad = path.join(verzeichnis, eintrag.name);
        if (eintrag.isDirectory()) {
            // assets/og enthält die Social-Previews; die sind bereits JPEG.
            if (eintrag.name === "og") continue;
            await pngDateien(vollpfad, gesammelt);
        } else if (eintrag.name.endsWith(".png") && eintrag.name !== "favicon.png") {
            gesammelt.push(vollpfad);
        }
    }
    return gesammelt;
}

const dateien = (await pngDateien(ASSETS)).sort();
if (dateien.length === 0) {
    console.error("Keine PNG-Dateien unter assets/ gefunden.");
    process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");

let umgewandelt = 0;
let gespart = 0;
const uebersprungen = [];

for (const quelle of dateien) {
    const ziel = quelle.replace(/\.png$/, ".webp");
    const base64 = (await readFile(quelle)).toString("base64");

    const ergebnis = await page.evaluate(async ({ daten, qualitaet }) => {
        const bild = new Image();
        bild.src = `data:image/png;base64,${daten}`;
        await bild.decode();

        const leinwand = document.createElement("canvas");
        leinwand.width = bild.naturalWidth;
        leinwand.height = bild.naturalHeight;
        leinwand.getContext("2d").drawImage(bild, 0, 0);

        const url = leinwand.toDataURL("image/webp", qualitaet);
        // Zusicherung: liefert der Browser PNG zurück, hat er WebP nicht kodiert.
        if (!url.startsWith("data:image/webp")) return null;
        return { base64: url.split(",")[1], breite: leinwand.width, hoehe: leinwand.height };
    }, { daten: base64, qualitaet: QUALITAET });

    if (ergebnis === null) {
        await browser.close();
        console.error(`Chromium hat ${path.basename(quelle)} nicht als WebP kodiert.`);
        process.exit(1);
    }

    const puffer = Buffer.from(ergebnis.base64, "base64");
    const vorher = (await stat(quelle)).size;
    const anteil = Math.round((1 - puffer.length / vorher) * 100);
    const relativ = path.relative(ASSETS, ziel);

    // Nur behalten, wenn WebP wirklich kleiner ist.
    //
    // Gemessen am 2026-08-04: bei sieben der zwölf Bilder ist WebP GRÖSSER als
    // das PNG, beim Meldevordruck um 188 Prozent. Ursache sind die bereits mit
    // pngquant palettierten Vorlagen – bei flächigen Oberflächenaufnahmen und
    // Linienzeichnungen schlägt ein palettiertes PNG verlustbehaftetes WebP.
    // Ein <picture> mit größerer WebP-Quelle würde die Seite verlangsamen,
    // also entsteht die Datei dort gar nicht.
    if (anteil < MINDESTGEWINN) {
        try {
            await unlink(ziel);
        } catch {
            // Datei gab es noch nicht – nichts zu tun.
        }
        uebersprungen.push({ datei: relativ, anteil });
        process.stdout.write(
            `– ${relativ.padEnd(42)} übersprungen: WebP wäre `
            + `${anteil >= 0 ? `nur ${anteil} %` : `${Math.abs(anteil)} % größer`}\n`
        );
        continue;
    }

    await writeFile(ziel, puffer);
    gespart += vorher - puffer.length;
    umgewandelt++;
    process.stdout.write(
        `✓ ${relativ.padEnd(42)}`
        + ` ${String(Math.round(vorher / 1024)).padStart(4)} KB → ${String(Math.round(puffer.length / 1024)).padStart(4)} KB`
        + ` (-${anteil} %) ${ergebnis.breite}x${ergebnis.hoehe}\n`
    );
}

await browser.close();

process.stdout.write(`\n${umgewandelt} Bilder umgewandelt, ${Math.round(gespart / 1024)} KB gespart.\n`);
if (uebersprungen.length > 0) {
    process.stdout.write(
        `${uebersprungen.length} Bilder bleiben PNG, weil WebP dort nicht kleiner ist:\n`
    );
    for (const eintrag of uebersprungen) {
        process.stdout.write(`  ${eintrag.datei} (${eintrag.anteil} %)\n`);
    }
}
