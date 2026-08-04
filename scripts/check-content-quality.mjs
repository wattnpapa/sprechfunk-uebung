#!/usr/bin/env node
// Prüft die Inhaltsseiten im gebauten Stand (AP-06).
//
// Aufruf:   node scripts/check-content-quality.mjs [--strict] [--no-report]
//   --strict      Verstöße beenden den Lauf mit Exit 1 (CI-Gate)
//   --no-report   seo/content-quality-report.md nicht schreiben

import { gzipSync } from "node:zlib";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_PAGES } from "./site-pages.mjs";
import { GRENZEN, pruefeAlle, ZIELWOERTER } from "./lib/content-quality.mjs";
import { plainText, zaehleWoerter } from "./lib/page-metadata.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const BERICHT = path.join(root, "seo", "content-quality-report.md");

const strict = process.argv.includes("--strict");
const ohneBericht = process.argv.includes("--no-report");

/** Blöcke, die nicht zum redaktionellen Text gehören. */
const GENERIERT = [
    /<footer[\s\S]*?<\/footer>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<nav[^>]*data-testid="breadcrumb"[\s\S]*?<\/nav>/gi,
    /<nav[^>]*data-testid="inhaltsverzeichnis"[\s\S]*?<\/nav>/gi,
    /<p[^>]*data-testid="aktualisiert-am"[\s\S]*?<\/p>/gi,
    /<section[^>]*data-testid="weiterlesen"[\s\S]*?<\/section>/gi,
    /<ul[^>]*data-testid="hub-liste-[^"]*"[\s\S]*?<\/ul>/gi
];

function redaktionell(html) {
    let teil = (html.match(/<main[\s\S]*?<\/main>/i) ?? [""])[0];
    for (const muster of GENERIERT) teil = teil.replace(muster, " ");
    return teil;
}

/**
 * Prosa der Seite, ohne Nachschlagetabellen. Tabellenzellen haben keine
 * Satzzeichen; als Text gelesen ergeben sie einen einzigen Satz mit 90 Wörtern
 * und verfälschen jede Lesbarkeitsmessung. Für die Wortzahl zählen sie mit,
 * denn sie sind echter Seiteninhalt.
 */
function prosa(html) {
    return redaktionell(html).replace(/<table[\s\S]*?<\/table>/gi, " ");
}

async function leseSeite(page) {
    const datei = path.join(dist, page.slug, "index.html");
    const html = await readFile(datei, "utf8");
    const inhalt = redaktionell(html);

    return {
        slug: page.slug,
        titel: (html.match(/<title>([^<]*)<\/title>/i) ?? ["", ""])[1],
        description: (html.match(/<meta name="description" content="([^"]*)"/i) ?? ["", ""])[1],
        woerter: zaehleWoerter(plainText(inhalt)),
        text: plainText(prosa(html)),
        absaetze: [...inhalt.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(treffer => plainText(treffer[1])),
        ankerZiele: [...html.matchAll(/data-testid="inhaltsverzeichnis"[\s\S]*?<\/nav>/gi)]
            .flatMap(block => [...block[0].matchAll(/href="#([^"]+)"/g)].map(treffer => treffer[1])),
        ankerVorhanden: [...html.matchAll(/\bid="([^"]+)"/g)].map(treffer => treffer[1]),
        // gzip: das ist die tatsächlich übertragene Größe.
        transferBytes: gzipSync(Buffer.from(html, "utf8")).length,
        hatMetazeile: html.includes('data-testid="aktualisiert-am"'),
        hatKurzGesagt: html.includes('data-testid="kurz-gesagt"'),
        // /faq/ trägt die Fragen im eigenen Markup, ohne injizierten Block:
        // maßgeblich ist, ob ein FAQPage-Knoten im JSON-LD steht.
        hatFaq: html.includes('id="faq"') || html.includes('"FAQPage"'),
        hatWeiterlesen: html.includes('data-testid="weiterlesen"'),
        h2OhneId: [...redaktionell(html).matchAll(/<h2[^>]*>/gi)].filter(m => !/\bid=/.test(m[0])).length
    };
}

function baueBericht(seiten, verstoesse, erhoben) {
    const zeilen = ["# Inhaltsqualität", "",
        "Erzeugt von `scripts/check-content-quality.mjs`. Nicht von Hand bearbeiten.", "",
        `**Stand: ${erhoben}**`, "",
        "Gezählt wird nur redaktioneller Text. Navigation, Footer, Brotkrumen,",
        "Inhaltsverzeichnis, Metazeile, Seitenleiste und Weiterlesen-Block sind abgezogen.", "",
        "## Wortzahlen", "", "| Seite | Wörter | Ziel | Titel | Desc | gzip |", "| --- | ---: | ---: | ---: | ---: | ---: |"];

    for (const seite of [...seiten].sort((a, b) => a.woerter - b.woerter)) {
        const ziel = ZIELWOERTER[seite.slug] ?? GRENZEN.woerterMin;
        const marke = seite.woerter >= ziel ? "" : " (offen)";
        zeilen.push(`| \`/${seite.slug}/\` | ${seite.woerter}${marke} | ${ziel}`
            + ` | ${seite.titel.length} | ${seite.description.length}`
            + ` | ${Math.round(seite.transferBytes / 1024)} KB |`);
    }
    zeilen.push("");

    const nachRegel = new Map();
    for (const verstoss of verstoesse) {
        if (!nachRegel.has(verstoss.regel)) nachRegel.set(verstoss.regel, []);
        nachRegel.get(verstoss.regel).push(verstoss);
    }
    zeilen.push(`## Verstöße: ${verstoesse.length}`, "");
    if (verstoesse.length === 0) {
        zeilen.push("Keine.");
    } else {
        for (const [regel, liste] of nachRegel) {
            zeilen.push(`### ${regel} (${liste.length})`, "");
            for (const verstoss of liste) zeilen.push(`- \`/${verstoss.seite}/\`: ${verstoss.text}`);
            zeilen.push("");
        }
    }
    return zeilen.join("\n");
}

async function main() {
    const inhaltsseiten = SITE_PAGES.filter(page => page.slug !== "" && page.inSitemap !== false);
    const seiten = [];
    for (const page of inhaltsseiten) {
        try {
            seiten.push(await leseSeite(page));
        } catch {
            throw new Error(`dist-Datei für "${page.slug}" fehlt – erst "npm run build" ausführen.`);
        }
    }

    const verstoesse = pruefeAlle(seiten);

    if (!ohneBericht) {
        const erhoben = new Date().toISOString().slice(0, 10);
        await writeFile(BERICHT, `${baueBericht(seiten, verstoesse, erhoben)}\n`, "utf8");
        process.stdout.write(`Bericht geschrieben: ${path.relative(root, BERICHT)}\n`);
    }

    const nachRegel = new Map();
    for (const verstoss of verstoesse) {
        if (!nachRegel.has(verstoss.regel)) nachRegel.set(verstoss.regel, []);
        nachRegel.get(verstoss.regel).push(verstoss);
    }

    process.stdout.write(`\nInhaltsqualität: ${seiten.length} Seiten geprüft\n`);
    if (verstoesse.length === 0) {
        process.stdout.write("Keine Verstöße.\n");
    } else {
        process.stdout.write(`${verstoesse.length} Verstöße:\n`);
        for (const [regel, liste] of nachRegel) {
            process.stdout.write(`\n  ${regel} (${liste.length}):\n`);
            for (const verstoss of liste.slice(0, 30)) {
                process.stdout.write(`    /${verstoss.seite}/ – ${verstoss.text}\n`);
            }
            if (liste.length > 30) process.stdout.write(`    … und ${liste.length - 30} weitere\n`);
        }
    }

    if (verstoesse.length > 0 && strict) {
        process.stdout.write("\n--strict: Lauf schlägt wegen der Verstöße fehl.\n");
        process.exit(1);
    }
}

main().catch(fehler => {
    console.error(`check-content-quality: ${fehler.message}`);
    process.exit(1);
});
