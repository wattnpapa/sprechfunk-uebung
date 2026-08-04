// Bilder-Sitemap (AP-10).
//
// Bewusst eine eigene Datei statt image:-Einträge in der sitemap.xml: die
// Haupt-Sitemap trägt seit AP-03 nur <loc> und <lastmod>, und ein zweiter
// Namensraum dort hätte die Tests auf ihre Schlankheit gebrochen. Referenziert
// wird sie aus robots.txt.
//
// Reine Funktionen ohne Dateizugriff – geschrieben wird in postbuild-copy.mjs.

import { escapeHtml } from "./schema-graph.mjs";
import { DIAGRAMME } from "./diagramme.mjs";
import { ogDateiname, OG_VERZEICHNIS } from "./og-bilder.mjs";

/**
 * Bild-Einträge einer Seite.
 *
 * Inline-SVG-Diagramme gehören nicht hinein: sie haben keine eigene URL, die
 * ein Crawler abrufen könnte. Aufgenommen werden die Rasterbilder aus dem
 * Quelltext und das Social-Preview-Bild der Seite.
 */
export function bilderDerSeite(page, html, siteUrl) {
    const eintraege = [];

    for (const treffer of String(html).matchAll(/<img[\s\S]*?>/g)) {
        const tag = treffer[0];
        const src = /\bsrc="([^"]*)"/.exec(tag)?.[1];
        const alt = /\balt="([^"]*)"/.exec(tag)?.[1] ?? "";
        if (!src || src.startsWith("http")) continue;
        eintraege.push({
            loc: `${siteUrl}/${src.replace(/^(\.\.\/)+/, "")}`,
            titel: alt
        });
    }

    // Das Social-Preview-Bild ist eine eigene, abrufbare Datei.
    const diagramm = DIAGRAMME[page.slug];
    eintraege.push({
        loc: `${siteUrl}/${OG_VERZEICHNIS}/${ogDateiname(page.slug)}`,
        titel: diagramm ? diagramm.titel : "Sprechfunk Übungsgenerator"
    });

    return eintraege;
}

/**
 * Baut die sitemap-images.xml.
 *
 * `seiten` ist eine Liste von { url, bilder: [{ loc, titel }] }. Seiten ohne
 * Bild fallen weg – ein <url>-Element ohne image:image wäre gültig, aber leer.
 */
export function buildBilderSitemap(seiten) {
    const bloecke = seiten
        .filter(seite => seite.bilder.length > 0)
        .map(seite => [
            "  <url>",
            `    <loc>${seite.url}</loc>`,
            ...seite.bilder.flatMap(bild => [
                "    <image:image>",
                `      <image:loc>${bild.loc}</image:loc>`,
                bild.titel ? `      <image:title>${escapeHtml(bild.titel)}</image:title>` : null,
                "    </image:image>"
            ].filter(Boolean)),
            "  </url>"
        ].join("\n"));

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
        ...bloecke,
        "</urlset>",
        ""
    ].join("\n");
}
