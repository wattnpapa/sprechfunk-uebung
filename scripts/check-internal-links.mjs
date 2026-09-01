#!/usr/bin/env node
// Prüft die interne Verlinkung im gebauten Stand (AP-05).
//
// Aufruf:   node scripts/check-internal-links.mjs [--strict] [--no-report]
//   --strict      Verstöße beenden den Lauf mit Exit 1 (CI-Gate)
//   --no-report   seo/internal-links-report.md nicht schreiben
//
// Ohne --strict werden Verstöße nur gemeldet. So lässt sich das Skript in CI
// einhängen, bevor der Bestand aufgeräumt ist.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HUB_SLUG, SITE_PAGES } from "./site-pages.mjs";
import { ankerHinweise, baueBericht, pruefeRegeln } from "./lib/internal-links.mjs";
import { plainText } from "./lib/page-metadata.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const BERICHT = path.join(root, "seo", "internal-links-report.md");

const strict = process.argv.includes("--strict");
const ohneBericht = process.argv.includes("--no-report");

/**
 * Blöcke, die auf jeder Seite gleich sind und deshalb nicht als redaktionelle
 * Verlinkung zählen. Sie werden vor der Auswertung aus dem main-Bereich
 * geschnitten – die Seitenleiste liegt bereits außerhalb von <main>.
 */
const GENERIERTE_BLOECKE = [
    /<nav[^>]*data-testid="breadcrumb"[\s\S]*?<\/nav>/gi,
    /<p[^>]*data-testid="aktualisiert-am"[\s\S]*?<\/p>/gi,
    /<section[^>]*data-testid="weiterlesen"[\s\S]*?<\/section>/gi,
    /<ul[^>]*data-testid="hub-liste-[^"]*"[\s\S]*?<\/ul>/gi
];

/** Wandelt einen href in einen Registry-Slug um, oder null bei externem Ziel. */
function slugAusHref(href) {
    if (/^(https?:|mailto:|tel:|#|data:)/i.test(href)) return null;
    const ohneAnker = href.split("#")[0].split("?")[0];
    if (ohneAnker === "") return null;
    // Relativ ausgelieferte Pfade: "../", "./", "funksprueche/", "../faq/"
    const bereinigt = ohneAnker.replace(/^(\.\.\/|\.\/)+/, "").replace(/\/+$/, "");
    // Dateien (PDF, Bilder) sind keine Seiten.
    if (/\.[a-z0-9]{2,5}$/i.test(bereinigt)) return null;
    return bereinigt;
}

async function leseSeite(slug) {
    const datei = slug === "" ? path.join(dist, "index.html") : path.join(dist, slug, "index.html");
    return readFile(datei, "utf8");
}

async function main() {
    const seiten = SITE_PAGES.map(page => ({
        slug: page.slug,
        // Inhaltsseiten: alles außer der SPA-Startseite und den Rechtstexten.
        istInhalt: page.slug !== "" && page.inSitemap !== false
    }));

    const links = [];
    for (const seite of seiten) {
        let html;
        try {
            html = await leseSeite(seite.slug);
        } catch {
            throw new Error(`dist-Datei für "${seite.slug || "/"}" fehlt – erst "npm run build" ausführen.`);
        }

        const mainBereich = (html.match(/<main[\s\S]*?<\/main>/i) ?? [""])[0];
        let fliesstext = mainBereich;
        for (const muster of GENERIERTE_BLOECKE) fliesstext = fliesstext.replace(muster, " ");

        // Zähler für Regel 4 erfasst alle internen Links im main-Bereich,
        // einschließlich der generierten Blöcke – es geht um die Seitenlast.
        seite.linksImMain = [...mainBereich.matchAll(/<a[^>]+href="([^"]*)"/gi)]
            .filter(treffer => slugAusHref(treffer[1]) !== null).length;
        // Der Hub ist von der Obergrenze ausgenommen: seine Kartenliste ist der
        // Seiteninhalt und wächst mit jeder neuen Seite (siehe lib/internal-links.mjs).
        seite.istHub = seite.slug === HUB_SLUG;

        for (const treffer of fliesstext.matchAll(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
            const ziel = slugAusHref(treffer[1]);
            if (ziel === null) continue;
            links.push({ von: seite.slug, zu: ziel, anker: plainText(treffer[2]) });
        }
    }

    const verstoesse = pruefeRegeln(seiten, links);
    const hinweise = ankerHinweise(seiten, links);

    if (!ohneBericht) {
        const erhoben = new Date().toISOString().slice(0, 10);
        await writeFile(BERICHT, `${baueBericht({ seiten, links, verstoesse, hinweise, erhoben })}\n`, "utf8");
        process.stdout.write(`Bericht geschrieben: ${path.relative(root, BERICHT)}\n`);
    }

    const nachRegel = new Map();
    for (const verstoss of verstoesse) {
        if (!nachRegel.has(verstoss.regel)) nachRegel.set(verstoss.regel, []);
        nachRegel.get(verstoss.regel).push(verstoss);
    }

    process.stdout.write(`\nInterne Verlinkung: ${links.length} Fließtext-Links auf ${seiten.length} Seiten\n`);
    if (verstoesse.length === 0) {
        process.stdout.write("Keine Verstöße.\n");
    } else {
        process.stdout.write(`${verstoesse.length} Verstöße:\n`);
        for (const [regel, liste] of nachRegel) {
            process.stdout.write(`\n  ${regel} (${liste.length}):\n`);
            for (const verstoss of liste) {
                process.stdout.write(`    /${verstoss.seite}/ – ${verstoss.text}\n`);
            }
        }
    }
    if (hinweise.length > 0) {
        process.stdout.write(`\nHinweise zu Ankertext-Varianten (${hinweise.length}):\n`);
        for (const hinweis of hinweise) {
            process.stdout.write(`    /${hinweis.seite}/ – ${hinweis.text}\n`);
        }
    }

    if (verstoesse.length > 0 && strict) {
        process.stdout.write("\n--strict: Lauf schlägt wegen der Verstöße fehl.\n");
        process.exit(1);
    }
}

main().catch(fehler => {
    console.error(`check-internal-links: ${fehler.message}`);
    process.exit(1);
});
