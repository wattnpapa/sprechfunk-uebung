import { execFile } from "node:child_process";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { buildSitemap, canonicalUrl, SITEMAP_PAGES, SITE_PAGES, SITE_URL, STATIC_SUBPAGES } from "./site-pages.mjs";
import { renderPageWithStructuredData } from "./lib/render-page.mjs";
import { createGitRunner, resolveLastmod } from "./lib/lastmod.mjs";
import { ersterSatz, extractMetaDescription } from "./lib/page-metadata.mjs";
import { ARCHIV_VORLAGEN } from "./lib/funkspruch-daten.mjs";
import { BESTAND } from "./lib/funkspruch-bestand.mjs";
import { downloadDateiname, txtInhalt } from "./lib/funkspruch-seiten.mjs";
import { bilderDerSeite, buildBilderSitemap } from "./lib/bilder-sitemap.mjs";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const dist = path.join(root, "dist");

/**
 * Änderungsdatum je Seite (AP-03), einmal ermittelt und gemerkt: Sitemap,
 * JSON-LD und sichtbares Datum müssen denselben Wert tragen, und git log soll
 * nicht zweimal je Datei laufen. Steht bewusst hier oben – die Datei nutzt
 * top-level await, und const wird nicht gehoistet.
 */
const lastmodCache = new Map();
const runGit = createGitRunner(execFileAsync, root);

async function lastmodFuerSeite(page) {
    if (lastmodCache.has(page.slug)) return lastmodCache.get(page.slug);
    const iso = await resolveLastmod(page, runGit);
    lastmodCache.set(page.slug, iso);
    return iso;
}

/**
 * Kartentexte für den Hub (AP-04): je Seite der erste Satz ihrer eigenen
 * meta description. Muss vor dem Rendern der Seiten bereitstehen, weil
 * /wissen/ die Texte aller anderen Seiten braucht. Ein zweiter, handgepflegter
 * Beschreibungstext in der Registry würde von den Seiten abweichen.
 */
const beschreibungen = {};
for (const page of SITE_PAGES) {
    const quelle = await readFile(path.join(root, "src", page.source), "utf8");
    const description = extractMetaDescription(quelle);
    if (!description) {
        throw new Error(`Seite "${page.slug || "/"}": meta description fehlt, Hub-Karte nicht baubar.`);
    }
    beschreibungen[page.slug] = ersterSatz(description);
}

await mkdir(dist, { recursive: true });

await cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });
// Generator-Markup statisch in die Startseite einbetten: Ohne Vorbefüllung ist
// #mainAppArea beim ersten Paint leer, und der Einstiegstext springt nach der
// JS-Injection um die volle Generator-Höhe nach unten (CLS ≈ 0.6).
// GeneratorView.render() setzt beim Start dasselbe Markup erneut per innerHTML
// – identische Maße, kein Shift. Quelle bleibt allein viewMarkup.ts.
const viewMarkupTs = await readFile(path.join(root, "src", "generator", "viewMarkup.ts"), "utf8");
const markupMatch = viewMarkupTs.match(/GENERATOR_VIEW_MARKUP = '([\s\S]*)';/);
if (!markupMatch) {
    throw new Error("GENERATOR_VIEW_MARKUP nicht in src/generator/viewMarkup.ts gefunden");
}
const indexHtml = await readFile(path.join(root, "src", "index.html"), "utf8");
const generatorPlaceholder = "<!-- Wird von GeneratorView.ts befüllt -->";
if (!indexHtml.includes(generatorPlaceholder)) {
    throw new Error("Generator-Platzhalter nicht in src/index.html gefunden");
}
const startseite = SITE_PAGES.find(page => page.slug === "");
if (!startseite) {
    throw new Error("Startseite (slug \"\") fehlt in SITE_PAGES");
}
await writeFile(
    path.join(dist, "index.html"),
    await withStructuredData(startseite, indexHtml.replace(generatorPlaceholder, markupMatch[1])),
    "utf8"
);
await cp(path.join(root, "src", "404.html"), path.join(dist, "404.html"));
await cp(path.join(root, "howto.md"), path.join(dist, "howto.md"));
// style.css minifiziert ausliefern: Die Datei geht nicht durch den
// Rollup-Graph, weil auch die statischen Inhaltsseiten sie referenzieren.
// cssnano steht als Abhängigkeit von rollup-plugin-postcss bereit.
const mainCss = await readFile(path.join(root, "src", "styles", "main.css"), "utf8");
const { default: postcssLib } = await import("postcss");
const { default: cssnano } = await import("cssnano");
const minifiedCss = await postcssLib([cssnano()]).process(mainCss, { from: undefined });
await writeFile(path.join(dist, "style.css"), minifiedCss.css, "utf8");
await cp(path.join(root, "src", "firebase-config.js"), path.join(dist, "firebase-config.js"));
await cp(path.join(root, "src", "robots.txt"), path.join(dist, "robots.txt"));

// Bild-Einträge für die Bilder-Sitemap (AP-10), gesammelt beim Rendern:
// nur das fertige HTML kennt die eingesetzten Bilder.
const bilderProSeite = [];

// Statische, crawlbare Inhaltsseiten als Verzeichnis-Index ablegen (=> /anleitung/, /faq/, ...).
for (const page of STATIC_SUBPAGES) {
    const target = path.join(dist, page.slug);
    await mkdir(target, { recursive: true });
    const quelle = await readFile(path.join(root, "src", page.source), "utf8");
    const fertig = await withStructuredData(page, quelle);
    await writeFile(path.join(target, "index.html"), fertig, "utf8");
    if (page.inSitemap !== false) {
        bilderProSeite.push({
            url: canonicalUrl(page.slug),
            bilder: bilderDerSeite(page, fertig, SITE_URL)
        });
    }
}

// sitemap.xml aus derselben Seitenliste erzeugen, damit sie beim Hinzufügen einer
// Seite nicht händisch nachgezogen werden muss. Rechtstexte sind über
// inSitemap: false ausgenommen (SITEMAP_PAGES).
const lastmodBySlug = {};
for (const page of SITEMAP_PAGES) {
    lastmodBySlug[page.slug] = await lastmodFuerSeite(page);
}
await writeFile(path.join(dist, "sitemap.xml"), buildSitemap(lastmodBySlug), "utf8");

// Bilder-Sitemap. Die Startseite kommt dazu, weil sie das Autorenbild trägt.
const startseiteHtml = await readFile(path.join(dist, "index.html"), "utf8");
bilderProSeite.unshift({
    url: canonicalUrl(""),
    bilder: bilderDerSeite(startseite, startseiteHtml, SITE_URL)
});
await writeFile(path.join(dist, "sitemap-images.xml"), buildBilderSitemap(bilderProSeite), "utf8");

const ohneDatum = SITEMAP_PAGES.filter(page => !lastmodBySlug[page.slug]);
if (ohneDatum.length > 0) {
    // Kein harter Abbruch: ein Tarball-Build ohne Git ist ein legitimer Fall.
    // Sichtbar machen muss man es trotzdem, sonst fällt ein flacher Klon in CI
    // erst auf, wenn die Sitemap draußen schon wertlos ist.
    process.stdout.write(
        `Hinweis: für ${ohneDatum.length} von ${SITEMAP_PAGES.length} Seiten war kein `
        + "Commit-Datum ermittelbar – lastmod bleibt dort weg. "
        + "Braucht der Deploy-Job fetch-depth: 0?\n"
    );
}

/**
 * Setzt den generierten JSON-LD-Graphen und – wo Fragen hinterlegt sind – den
 * sichtbaren FAQ-Block in eine Seite ein (AP-02). Die Logik steht in
 * lib/render-page.mjs, damit der Vitest-Test denselben Code prüft.
 */
async function withStructuredData(page, quelle) {
    const { html } = renderPageWithStructuredData({
        page,
        html: quelle,
        dateModified: await lastmodFuerSeite(page),
        beschreibungen,
        bestand: BESTAND
    });
    return html;
}

// Downloads des Funkspruch-Archivs (AP-08). Sie liegen unter dist/assets/,
// damit sie wie die übrigen Downloads ausgeliefert werden und nicht mit einer
// Seiten-URL kollidieren. Format ist exakt das Upload-Format des Generators,
// also eine Nachricht je Zeile – so schließt sich der Kreis vom Fund über den
// Download zurück in die eigene Übung.
for (const vorlage of ARCHIV_VORLAGEN) {
    const eintraege = BESTAND.nachVorlage.get(vorlage.slug) ?? [];
    if (eintraege.length === 0) {
        throw new Error(`Vorlage "${vorlage.slug}" ist im Archiv, hat aber keine Funksprüche.`);
    }
    await writeFile(
        path.join(dist, "assets", downloadDateiname(vorlage.slug)),
        txtInhalt(eintraege),
        "utf8"
    );
}


const bundleCssPath = path.join(dist, "bundle.css");
try {
    const css = await readFile(bundleCssPath, "utf8");
    const normalized = css.replaceAll("../webfonts/", "./webfonts/");
    if (normalized !== css) {
        await writeFile(bundleCssPath, normalized, "utf8");
    }
} catch {
    // ignore if bundle.css does not exist yet
}
