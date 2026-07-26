// Erzeugt das Social-Preview-Bild (assets/og-image.png, 1200x630) aus einer HTML-Vorlage.
// Manuell ausführen, wenn sich Titel oder Gestaltung ändern: npm run og:image
// Das Ergebnis wird eingecheckt, damit der normale Build ohne Browser auskommt.

import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const target = path.join(root, "assets", "og-image.png");

const template = `<!DOCTYPE html>
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
    h1 { font-size: 82px; line-height: 1.04; font-weight: 700; letter-spacing: -0.02em; }
    p { font-size: 34px; line-height: 1.35; color: #d8e6ff; max-width: 900px; }
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
        BOS-Sprechfunk
    </div>

    <div>
        <h1>Sprechfunk<br>Übungsgenerator</h1>
        <p style="margin-top: 26px;">
            Funksprüche automatisch verteilen, Meldevordruck und Nachrichtenvordruck
            als PDF drucken, die Übung live begleiten.
        </p>
    </div>

    <div class="footer">
        <span class="domain">sprechfunk-uebung.de</span>
        <span class="badges">
            <span class="badge">Kostenlos</span>
            <span class="badge">Open Source</span>
            <span class="badge">Ohne Anmeldung</span>
        </span>
    </div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(template, { waitUntil: "load" });
await page.screenshot({ path: target, type: "png" });
await browser.close();

console.log(`og-image geschrieben: ${path.relative(root, target)} (1200x630)`);
