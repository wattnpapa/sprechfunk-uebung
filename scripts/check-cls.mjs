#!/usr/bin/env node
// Misst Cumulative Layout Shift je Seite (AP-10).
//
// Aufruf (Server muss laufen):
//   npm run build && npm run serve
//   npm run cls:check
//
// Gemessen wird über die Layout-Instability-API, nicht über Lighthouse. Grund:
// es ist derselbe Kennwert, aber der Lauf ist reproduzierbar, versionierbar und
// braucht keine zusätzliche Abhängigkeit. Lighthouse liest denselben
// PerformanceObserver aus.
//
// --strict beendet den Lauf mit Exit 1, sobald eine Seite über der Grenze liegt.

/* global window, document -- nur in Browser-Callbacks (addInitScript/evaluate) */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

import { SITEMAP_PAGES } from "./site-pages.mjs";

const BASE = process.env.CLS_BASE_URL ?? "http://127.0.0.1:3000";
const BERICHT = path.join(process.cwd(), "seo", "cls-report.md");
const strict = process.argv.includes("--strict");

/** Grenzwert. Google nennt 0.1 als „gut"; das Arbeitspaket verlangt 0. */
const GRENZE = 0.001;

/** Fenstergrößen: ein Layout Shift zeigt sich oft nur in einer Breite. */
const FENSTER = [
    { name: "Desktop", viewport: { width: 1440, height: 900 } },
    { name: "Smartphone", viewport: { width: 390, height: 844 } }
];

try {
    await fetch(`${BASE}/`);
} catch {
    console.error(`Kein Server unter ${BASE} – erst "npm run build && npm run serve" starten.`);
    process.exit(1);
}

const browser = await chromium.launch();
const ergebnisse = [];

for (const fenster of FENSTER) {
    for (const seite of SITEMAP_PAGES) {
        // Frischer Kontext je Seite: mit einem gemeinsamen Kontext zahlt nur die
        // erste Seite das Laden der Schrift, alle weiteren messen einen warmen
        // Cache. Die Werte schwankten dadurch zwischen zwei Läufen um eine
        // Größenordnung. Gemessen wird deshalb der Erstbesuch – der schlechteste
        // und einzige belastbare Fall.
        const context = await browser.newContext({ viewport: fenster.viewport });
        const page = await context.newPage();

        // Beobachter vor dem Laden setzen, sonst entgehen die frühen Shifts.
        await context.addInitScript(() => {
            window.__cls = 0;
            new PerformanceObserver(liste => {
                for (const eintrag of liste.getEntries()) {
                    // Shifts nach einer Eingabe zählen nicht zum Kennwert.
                    if (!eintrag.hadRecentInput) window.__cls += eintrag.value;
                }
            }).observe({ type: "layout-shift", buffered: true });
        });

        const pfad = seite.slug === "" ? "/" : `/${seite.slug}/`;

        await page.goto(`${BASE}${pfad}`, { waitUntil: "load" });
        // Bis zum Seitenende scrollen: ein Shift entsteht typisch erst, wenn ein
        // verzögert geladenes Bild ankommt.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1200);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);

        const cls = await page.evaluate(() => window.__cls ?? 0);
        ergebnisse.push({ fenster: fenster.name, pfad, cls });
        process.stdout.write(
            `${cls > GRENZE ? "✗" : "✓"} ${fenster.name.padEnd(11)} ${pfad.padEnd(48)} CLS ${cls.toFixed(4)}\n`
        );

        await context.close();
    }
}

await browser.close();

const ueber = ergebnisse.filter(eintrag => eintrag.cls > GRENZE);
const groesste = ergebnisse.reduce((wert, eintrag) => Math.max(wert, eintrag.cls), 0);
const erhoben = new Date().toISOString().slice(0, 10);

const zeilen = [
    "# Cumulative Layout Shift", "",
    "Erzeugt von `scripts/check-cls.mjs`. Nicht von Hand bearbeiten.", "",
    `**Stand: ${erhoben}**`, "",
    "Gemessen über die Layout-Instability-API in Chromium, je Seite in zwei",
    "Fenstergrößen, nach vollständigem Scrollen bis zum Seitenende – ein Shift",
    "entsteht typisch erst, wenn ein verzögert geladenes Bild ankommt.", "",
    `Größter gemessener Wert: **${groesste.toFixed(4)}** (Grenze ${GRENZE}).`, "",
    `Seiten über der Grenze: **${ueber.length}**`, "",
    "| Fenster | Seite | CLS |", "| --- | --- | ---: |"
];
for (const eintrag of ergebnisse) {
    zeilen.push(`| ${eintrag.fenster} | \`${eintrag.pfad}\` | ${eintrag.cls.toFixed(4)} |`);
}
await writeFile(BERICHT, `${zeilen.join("\n")}\n`, "utf8");

process.stdout.write(`\nBericht: ${path.relative(process.cwd(), BERICHT)}\n`);
process.stdout.write(`größter Wert: ${groesste.toFixed(4)} – ${ueber.length} Seiten über ${GRENZE}\n`);

if (ueber.length > 0 && strict) {
    process.exit(1);
}
