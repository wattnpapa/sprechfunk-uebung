// Erzeugt die einbettbaren Widgets (AP-12).
//
//   node scripts/generate-embed.mjs
//
// Der Inhalt kommt aus derselben Tabelle wie die Seite selbst. Ein Widget, das
// in fremden Intranets hängt und etwas anderes sagt als die Website, wäre der
// schlechteste denkbare Ausgang dieses Arbeitspakets.

import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SITE_PAGES } from "./site-pages.mjs";
import { EMBEDS, embedPfad, renderEmbed } from "./lib/embed.mjs";
import { extractDefinedTerms } from "./lib/page-metadata.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

async function main() {
    for (const embed of EMBEDS) {
        const seite = SITE_PAGES.find(eintrag => eintrag.slug === embed.quelle.seite);
        if (!seite) throw new Error(`Widget "${embed.slug}": unbekannte Quellseite.`);

        const html = await readFile(path.join(ROOT, "src", seite.source), "utf8");
        const zeilen = extractDefinedTerms(html, { tableIndex: embed.quelle.tabelle });

        const ziel = path.join(DIST, embedPfad(embed));
        mkdirSync(ziel, { recursive: true });
        const inhalt = renderEmbed(embed, zeilen);
        writeFileSync(path.join(ziel, "index.html"), inhalt, "utf8");

        console.log(
            `✓ ${embedPfad(embed).padEnd(28)} ${String(Math.round(inhalt.length / 1024)).padStart(3)} KB  `
            + `${zeilen.length} Zeilen`
        );
    }
    console.log(`${EMBEDS.length} Widget(s) geschrieben nach dist/embed`);
}

main().catch(fehler => {
    console.error(fehler);
    process.exitCode = 1;
});
