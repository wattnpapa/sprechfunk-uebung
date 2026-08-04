// Erzeugt je Seite ein Social-Preview-Bild (assets/og/<slug>.jpg, 1200x630).
//
// Manuell ausführen, wenn sich Titel oder Gestaltung ändern:
//   npm run og:image
//
// Die Ergebnisse werden eingecheckt. Das ist Absicht: der normale Build bleibt
// dadurch ohne Browser lauffähig – auch der von Dependabot und ein Tarball-Build
// ohne Playwright. Ein Test hält fest, dass für jede Seite ein Bild vorliegt;
// fehlt eines, schlägt er fehl und verlangt diesen Lauf.

/* global document -- nur in Browser-Callbacks (evaluate) */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

import { HUB_CATEGORIES, SITE_PAGES } from "./site-pages.mjs";
import { extractTitle } from "./lib/page-metadata.mjs";
import { ogDateiname, ogKicker } from "./lib/og-bilder.mjs";

const root = process.cwd();
const ziel = path.join(root, "assets", "og");

await mkdir(ziel, { recursive: true });

/** Obergrenze je Bild (AP-10: keine Bilder über 200 KB). */
const MAX_BYTES = 200 * 1024;

const vorlage = (kicker, titel) => `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        width: 1200px;
        height: 630px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 72px 80px;
        background: linear-gradient(135deg, #0b2545 0%, #13315c 55%, #0d6efd 160%);
        color: #ffffff;
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    .kicker {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        font-size: 26px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #8fc0ff;
    }
    /* Titelgröße nach Länge: die 50 bis 60 Zeichen der Seitentitel sollen in
       drei Zeilen passen, ohne die Fußzeile zu verdrängen. */
    h1 { font-weight: 700; letter-spacing: -0.02em; }
    h1.lang { font-size: 58px; line-height: 1.1; }
    h1.mittel { font-size: 70px; line-height: 1.08; }
    h1.kurz { font-size: 82px; line-height: 1.04; }
    .footer { display: flex; align-items: center; justify-content: space-between; }
    .domain { font-size: 30px; font-weight: 600; color: #ffffff; }
    .badges { display: flex; gap: 14px; }
    .badge {
        font-size: 24px;
        font-weight: 600;
        padding: 12px 22px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.35);
        color: #eaf2ff;
    }
    svg { flex: none; }
</style>
</head>
<body>
    <div class="kicker">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="#8fc0ff" aria-hidden="true">
            <path d="M12 6.5a2.5 2.5 0 0 1 1.25 4.67L16.4 21h-2.1l-.72-2.3h-3.16L9.7 21H7.6l3.15-9.83A2.5 2.5 0 0 1 12 6.5Zm0 5.9-.86 2.7h1.72L12 12.4ZM6.4 2.9l1.4 1.5a8.6 8.6 0 0 0 0 11.2l-1.4 1.5a10.6 10.6 0 0 1 0-14.2Zm11.2 0a10.6 10.6 0 0 1 0 14.2l-1.4-1.5a8.6 8.6 0 0 0 0-11.2l1.4-1.5ZM3.2 0l1.4 1.5a12.9 12.9 0 0 0 0 17l-1.4 1.5a14.9 14.9 0 0 1 0-20Zm17.6 0a14.9 14.9 0 0 1 0 20l-1.4-1.5a12.9 12.9 0 0 0 0-17L20.8 0Z"/>
        </svg>
        ${kicker}
    </div>

    <div>
        <h1 class="${titel.length > 46 ? "lang" : titel.length > 30 ? "mittel" : "kurz"}">${titel}</h1>
    </div>

    <div class="footer">
        <span class="domain">sprechfunk-uebung.de</span>
        <span class="badges">
            <span class="badge">Kostenlos</span>
            <span class="badge">Ohne Anmeldung</span>
        </span>
    </div>
</body>
</html>`;

const maskiere = wert => String(wert)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1
});
const page = await context.newPage();

let erzeugt = 0;
let groesste = 0;
let groessteDatei = "";

for (const seite of SITE_PAGES) {
    const quelle = await readFile(path.join(root, "src", seite.source), "utf8");
    const titel = extractTitle(quelle);
    if (!titel) throw new Error(`Seite "${seite.slug || "/"}": <title> fehlt.`);

    // Das Marken-Suffix gehört nicht in das Bild – die Marke steht in der
    // Fußzeile. Auf der Startseite bliebe sonst kein Platz für das Thema.
    const ohneSuffix = titel.replace(/\s*\|\s*Sprechfunk Übungsgenerator\s*$/, "");
    const kicker = ogKicker(seite, HUB_CATEGORIES);
    const dateiname = ogDateiname(seite.slug);

    await page.setContent(vorlage(maskiere(kicker), maskiere(ohneSuffix)), { waitUntil: "load" });

    // Zusicherung gegen abgeschnittene Titel: die Fußzeile muss vollständig
    // innerhalb der 630 Pixel liegen.
    const passt = await page.evaluate(() => {
        const fuss = document.querySelector(".footer");
        return fuss !== null && fuss.getBoundingClientRect().bottom <= 630;
    });
    if (!passt) throw new Error(`Titel zu lang für das OG-Bild: "${ohneSuffix}"`);

    const puffer = await page.screenshot({ type: "jpeg", quality: 88 });
    await writeFile(path.join(ziel, dateiname), puffer);

    if (puffer.length > groesste) {
        groesste = puffer.length;
        groessteDatei = dateiname;
    }
    erzeugt++;
    process.stdout.write(`✓ ${dateiname.padEnd(38)} ${String(Math.round(puffer.length / 1024)).padStart(3)} KB  ${kicker}\n`);
}

await browser.close();

process.stdout.write(`\n${erzeugt} OG-Bilder geschrieben in ${path.relative(root, ziel)}\n`);
process.stdout.write(`größte Datei: ${groessteDatei} mit ${Math.round(groesste / 1024)} KB\n`);
if (groesste > MAX_BYTES) {
    console.error(`\n${groessteDatei} liegt über ${MAX_BYTES / 1024} KB – Gestaltung prüfen.`);
    process.exit(1);
}
