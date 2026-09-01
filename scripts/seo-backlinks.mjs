#!/usr/bin/env node
// Monatsauswertung der verweisenden Domains (AP-12).
//
// Aufruf:   node scripts/seo-backlinks.mjs [--monat 2026-08]
// Ergebnis: seo/backlinks/YYYY-MM.csv und seo/backlinks-report.md
//
// Ablauf für den Menschen:
//   1. Search Console → Links → „Top verweisende Websites" → Exportieren (CSV)
//   2. Datei nach seo/backlinks/eingang/ legen (Name egal)
//   3. npm run backlinks:report
//
// Warum kein API-Abruf: die Search-Console-API hat keinen Endpunkt für den
// Links-Bericht. Es gibt `searchanalytics`, `sitemaps` und `urlInspection` –
// verweisende Domains stehen in keinem davon. Ein Skript, das eine Anmeldung
// verlangt und danach nichts holen kann, wäre eine Attrappe.
//
// Ohne Eingangsdatei läuft das Skript als No-Op durch (Exit 0), damit ein
// Fork oder ein CI-Lauf ohne Export nicht bricht.

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { alsCsv, baueBericht, parseExport, vormonat } from "./lib/backlinks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKLINK_DIR = path.join(ROOT, "seo", "backlinks");
const EINGANG_DIR = path.join(BACKLINK_DIR, "eingang");
const BERICHT = path.join(ROOT, "seo", "backlinks-report.md");

/** --monat 2026-08, sonst der laufende Monat. */
function gewaehlterMonat() {
    const index = process.argv.indexOf("--monat");
    if (index !== -1 && process.argv[index + 1]) {
        const wert = process.argv[index + 1];
        if (!/^\d{4}-\d{2}$/.test(wert)) {
            throw new Error(`--monat erwartet das Format JJJJ-MM, bekam "${wert}".`);
        }
        return wert;
    }
    const jetzt = new Date();
    return `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, "0")}`;
}

async function leseMonat(monat) {
    const datei = path.join(BACKLINK_DIR, `${monat}.csv`);
    if (!existsSync(datei)) return null;
    return parseExport(await readFile(datei, "utf8"));
}

async function main() {
    const monat = gewaehlterMonat();

    if (!existsSync(EINGANG_DIR)) {
        console.log(`Kein Eingangsordner ${path.relative(ROOT, EINGANG_DIR)} – nichts zu tun.`);
        console.log("Search Console → Links → „Top verweisende Websites\" → Exportieren,");
        console.log("CSV dort ablegen und erneut ausführen.");
        return;
    }

    const dateien = (await readdir(EINGANG_DIR)).filter(name => name.toLowerCase().endsWith(".csv"));
    if (dateien.length === 0) {
        console.log("Keine CSV im Eingangsordner – nichts zu tun.");
        return;
    }

    // Mehrere Exporte desselben Monats werden zusammengeführt: die Oberfläche
    // trennt „verweisende Websites" und „verweisende Seiten" in zwei Berichte.
    const roh = [];
    for (const name of dateien) {
        roh.push(await readFile(path.join(EINGANG_DIR, name), "utf8"));
    }
    const aktuell = parseExport(roh.join("\n"));
    if (aktuell.length === 0) {
        console.log("Export enthält keine verwertbaren Zeilen – Format geprüft?");
        return;
    }

    await mkdir(BACKLINK_DIR, { recursive: true });
    await writeFile(path.join(BACKLINK_DIR, `${monat}.csv`), alsCsv(aktuell), "utf8");

    const vorherMonat = vormonat(monat);
    const vorher = await leseMonat(vorherMonat);
    await writeFile(BERICHT, `${baueBericht({ monat, aktuell, vorher, vorherMonat })}\n`, "utf8");

    console.log(`${aktuell.length} verweisende Domains für ${monat} normalisiert.`);
    console.log(`Bericht: ${path.relative(ROOT, BERICHT)}`);
    if (!vorher) console.log(`Kein Vormonat (${vorherMonat}) – Bericht ist eine Bestandsaufnahme.`);
    console.log(`Die Eingangsdatei(en) können nach dem Prüfen gelöscht werden: ${dateien.join(", ")}`);
}

main().catch(fehler => {
    console.error(fehler.message);
    process.exitCode = 1;
});
