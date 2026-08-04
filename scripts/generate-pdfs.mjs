// Erzeugt die druckfertigen A4-Aushänge (AP-12).
//
//   node scripts/generate-pdfs.mjs
//
// Läuft im Build hinter dem Postbuild-Schritt. Die Inhalte kommen aus den
// Seiten selbst, nicht aus einer zweiten Fassung — ein Aushang, der etwas
// anderes sagt als die Website, ist schlimmer als keiner.
//
// Das „Stand"-Datum stammt aus der Git-Historie der Quelldatei, nicht vom
// Build-Zeitpunkt. Sonst behauptet jeder Deploy, das Blatt sei neu.

import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { jsPDF } from "jspdf";

import { SITE_PAGES } from "./site-pages.mjs";
import { AUSHAENGE, aushangPfad, zeichneAushang } from "./lib/aushaenge.mjs";
import { createGitRunner, deutschesDatum, resolveLastmod } from "./lib/lastmod.mjs";
import { extractDefinedTerms } from "./lib/page-metadata.mjs";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL = path.join(ROOT, "dist", "downloads");

const runGit = createGitRunner(execFileAsync, ROOT);

/** Die Seite, aus der ein Aushang seinen Inhalt zieht. */
function seiteFuer(slug) {
    const seite = SITE_PAGES.find(eintrag => eintrag.slug === slug);
    if (!seite) throw new Error(`Aushang verweist auf unbekannten Slug "${slug}".`);
    return seite;
}

async function inhaltFuer(aushang) {
    const quelle = aushang.quelle;

    if (quelle.art === "tabelle") {
        const seite = seiteFuer(quelle.seite);
        const html = await readFile(path.join(ROOT, "src", seite.source), "utf8");
        return extractDefinedTerms(html, { tableIndex: quelle.tabelle });
    }

    if (quelle.art === "howto") {
        const seite = seiteFuer(quelle.seite);
        if (!seite.howTo) throw new Error(`Seite "${quelle.seite}" hat keine HowTo-Schritte.`);
        return seite.howTo.steps.map(schritt => ({ name: schritt.name, text: schritt.text }));
    }

    return [];
}

/** Änderungsdatum der inhaltlichen Quelle, deutsch formatiert. */
async function standFuer(aushang) {
    const slug = aushang.quelle.seite ?? aushang.ziel;
    const seite = seiteFuer(slug);
    const iso = await resolveLastmod(seite, runGit);
    // Ohne Historie (flacher Clone) lieber kein Datum als ein erfundenes.
    return iso ? deutschesDatum(iso) : "—";
}

async function main() {
    mkdirSync(ZIEL, { recursive: true });

    const zeilen = [];
    for (const aushang of AUSHAENGE) {
        const inhalt = await inhaltFuer(aushang);
        const stand = await standFuer(aushang);

        const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
        doc.setProperties({
            title: `${aushang.titel} – ${aushang.untertitel}`,
            subject: "Sprechfunkausbildung BOS",
            author: "sprechfunk-uebung.de",
            keywords: `BOS, Sprechfunk, ${aushang.titel}`,
            creator: "sprechfunk-uebung.de"
        });

        zeichneAushang(doc, aushang, inhalt, stand);

        const bytes = Buffer.from(doc.output("arraybuffer"));
        writeFileSync(path.join(ZIEL, aushang.dateiname), bytes);

        zeilen.push({
            name: aushang.dateiname,
            kb: Math.round(bytes.length / 1024),
            eintraege: inhalt.length,
            stand,
            pfad: aushangPfad(aushang)
        });
    }

    for (const zeile of zeilen) {
        const menge = zeile.eintraege > 0 ? `${zeile.eintraege} Einträge` : "Formular";
        console.log(`✓ ${zeile.name.padEnd(30)} ${String(zeile.kb).padStart(4)} KB  ${menge}, Stand ${zeile.stand}`);
    }
    console.log(`${zeilen.length} Aushänge geschrieben nach dist/downloads`);
}

main().catch(fehler => {
    console.error(fehler);
    process.exitCode = 1;
});
