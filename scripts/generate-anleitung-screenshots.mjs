// Erzeugt die Screenshots für die bebilderte Anleitung (assets/anleitung/*.png).
// Manuell ausführen, wenn sich die Oberfläche ändert:
//   npm run build && npm run serve   (in einem zweiten Terminal)
//   npm run anleitung:screenshots
// Die Bilder werden eingecheckt, damit der normale Build ohne Browser auskommt.
// Nachbearbeitung vor dem Commit (Bildgröße halbieren und komprimieren):
//   cd assets/anleitung
//   for f in *.png; do sips --resampleWidth 1600 "$f"; done   # nur Bilder > 1600px
//   npx -y pngquant-bin --quality=70-90 --speed 1 --ext .png --force *.png
//
// Läuft komplett gegen den lokalen Mock-Firestore (localStorage), es werden
// keine echten Firebase-Daten gelesen oder geschrieben.

/* global window, document -- nur in Browser-Callbacks (addInitScript/evaluate) */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.ANLEITUNG_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = path.join(process.cwd(), "assets", "anleitung");

try {
    await fetch(`${BASE}/`);
} catch {
    console.error(`Kein Server unter ${BASE} erreichbar – erst "npm run build && npm run serve" starten.`);
    process.exit(1);
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
    locale: "de-DE"
});
await context.addInitScript(() => {
    window.localStorage.setItem("useFirestoreEmulator", "1");
    // Nur initial leeren – läuft bei jeder Navigation und darf die
    // inzwischen generierte Übung nicht wieder wegwerfen.
    if (!window.localStorage.getItem("e2eFirestoreSeed")) {
        window.localStorage.setItem("e2eFirestoreSeed", JSON.stringify({}));
    }
    window.localStorage.setItem("theme", "light");
});

const page = await context.newPage();
page.setDefaultTimeout(20000);

const shot = async (locator, name) => {
    await locator.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log("✓", name);
};

// ---------------------------------------------------------------- Generator
await page.goto(`${BASE}/`);
await page.waitForSelector("#funkspruchVorlage option[value='thwleer']");

await page.locator("#datum").fill("2026-08-22");
await page.locator("#nameDerUebung").fill("Monatsübung Sprechfunk August");
await page.locator("#rufgruppe").fill("T_OL_GOLD-1");
await page.locator("#leitung").fill("Heros Wind 10");

const names = [
    "Heros Oldenburg 21/11",
    "Heros Oldenburg 22/12",
    "Heros Oldenburg 24/14",
    "Heros Oldenburg 86/11"
];
const addBtn = page.locator("#addTeilnehmerBtn");
const inputs = page.locator("#teilnehmer-body .teilnehmer-input");
while ((await inputs.count()) < names.length) {
    await addBtn.click();
}
while ((await inputs.count()) > names.length) {
    await page.locator("#teilnehmer-body .delete-teilnehmer").last().click();
}
for (let i = 0; i < names.length; i++) {
    await inputs.nth(i).fill(names[i]);
}

await page.locator("#spruecheProTeilnehmer").fill("15");
await page.locator("#prozentAnAlle").fill("10");
await page.locator("#prozentAnMehrere").fill("5");
await page.locator("#prozentAnBuchstabieren").fill("10");
await page.locator("#prozentAnBuchstabieren").blur();

// Individuelle Lösungswörter, damit die Spalte in der Teilnehmerverwaltung sichtbar ist
await page.locator("#individuelleLoesungswoerter").check();
await page.waitForSelector("#teilnehmer-body input[id^='loesungswort-']");

await page.selectOption("#funkspruchVorlage", ["thwleer"]);
await page.waitForTimeout(500);

const cards = page.locator(".generator-setup-layout > div > .card");
await shot(cards.nth(0), "generator-kopfdaten");
await shot(cards.nth(1), "generator-einstellungen");
await shot(cards.nth(2), "generator-teilnehmer");
await shot(page.locator(".generator-setup-layout"), "generator-uebersicht");

await page.locator("#startUebungBtn").click();
await page.waitForSelector("#uebung-links", { state: "visible" });
await page.waitForTimeout(800);

// Links einsammeln, bevor der DOM-Ersatz die Texte verändert
const links = await page.locator("#links-teilnehmer-container .generator-link-row").evaluateAll(rows =>
    rows.map(row => ({
        type: row.getAttribute("data-link-type"),
        url: row.querySelector(".generator-link-url code")?.textContent?.trim() ?? ""
    }))
);

// Fürs Bild die lokale Test-URL durch die echte Domain ersetzen
await page.evaluate(() => {
    document.querySelectorAll("#uebung-links code").forEach(el => {
        el.textContent = (el.textContent ?? "").replace(/http:\/\/127\.0\.0\.1:3000/g, "https://sprechfunk-uebung.de");
    });
});
await shot(page.locator(".generator-result-card"), "generator-links");

await page.locator("#tab-stats-btn").click();
await page.waitForTimeout(1200); // Chart-Animation abwarten
await shot(page.locator(".generator-result-card"), "generator-statistik");

// Die angezeigten Code-Texte sind teils gekürzt ("…") – Übungsleitungs-Link
// deshalb aus der Übungs-ID des Generator-Links ableiten. Die Kurzlink-Form
// (?uc=&tc=) löst im Mock nicht auf, daher die Pfad-Form wie in den E2E-Tests.
const uebungUrl = links.find(l => l.type === "übung")?.url ?? "";
const uebungId = uebungUrl.split("/").pop();
const teilnehmerLink = links.find(l => l.type === "teilnehmer")?.url;
if (!uebungId || !teilnehmerLink) {
    throw new Error(`Links nicht gefunden: ${JSON.stringify(links)}`);
}
const teilnehmerCode = /tc=([A-Z0-9]+)/.exec(teilnehmerLink)?.[1];

// ------------------------------------------------------------- Teilnehmer
await page.goto(`${BASE}/#/teilnehmer/${uebungId}/${teilnehmerCode}`);
await page.reload(); // Hash-Navigation allein löst den Routenwechsel nicht aus
await page.waitForSelector("#teilnehmerNachrichtenBody tr");
// Zwei Nachrichten als übertragen markieren, damit der Status sichtbar wird
await page.locator("#teilnehmerNachrichtenBody tr").nth(0).locator(".btn-toggle-uebertragen-chip").click();
await page.locator("#teilnehmerNachrichtenBody tr").nth(1).locator(".btn-toggle-uebertragen-chip").click();
await page.waitForTimeout(500);
await shot(page.locator("#teilnehmerArea"), "teilnehmer-uebersicht");

// Vordruck-Ansicht (Meldevordruck) als ganzer Viewport inklusive Tastenkürzeln
await page.locator("[data-doc-view='meldevordruck']").first().click();
await page.waitForSelector("#teilnehmerDocModal.show");
await page.waitForFunction(() =>
    document.querySelector("#teilnehmerDocPage")?.textContent?.includes("Seite"));
await page.waitForTimeout(1500); // PDF-Rendering abwarten
await page.screenshot({ path: path.join(OUT, "teilnehmer-vordruck.png") });
console.log("✓ teilnehmer-vordruck");
await page.keyboard.press("Escape");

// ---------------------------------------------------------- Übungsleitung
await page.goto(`${BASE}/#/uebungsleitung/${uebungId}`);
await page.reload();
await page.waitForSelector("#uebungsleitungTeilnehmer tr");
// Einen Teilnehmer anmelden und eine Nachricht absetzen, damit das Tracking sichtbar wird
await page.locator("#uebungsleitungTeilnehmer tr", { hasText: names[0] })
    .locator("button[data-action='anmelden']").click();
await page.locator("#uebungsleitungNachrichten button[data-action='abgesetzt']").first().click();
await page.waitForTimeout(500);

// Übersicht: sichtbarer Viewport von oben (Meta + Teilnehmertabelle)
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "uebungsleitung-uebersicht.png") });
console.log("✓ uebungsleitung-uebersicht");

// Nachrichtenplan ist sehr lang – nur Kopf (Filter) und die ersten Zeilen zeigen
const nachrichtenCard = page.locator(".card", { has: page.locator("#uebungsleitungNachrichten") }).last();
await nachrichtenCard.scrollIntoViewIfNeeded();
const box = await nachrichtenCard.boundingBox();
await page.screenshot({
    path: path.join(OUT, "uebungsleitung-nachrichten.png"),
    clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 900) }
});
console.log("✓ uebungsleitung-nachrichten");

await browser.close();
console.log(`Screenshots geschrieben nach: ${path.relative(process.cwd(), OUT)}`);
