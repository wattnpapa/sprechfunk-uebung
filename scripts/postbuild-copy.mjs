import { execFile } from "node:child_process";
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { buildSitemap, SITE_PAGES, STATIC_SUBPAGES } from "./site-pages.mjs";
import { renderPageWithStructuredData } from "./lib/render-page.mjs";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const dist = path.join(root, "dist");

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

// Statische, crawlbare Inhaltsseiten als Verzeichnis-Index ablegen (=> /anleitung/, /faq/, ...).
for (const page of STATIC_SUBPAGES) {
    const target = path.join(dist, page.slug);
    await mkdir(target, { recursive: true });
    const quelle = await readFile(path.join(root, "src", page.source), "utf8");
    await writeFile(path.join(target, "index.html"), await withStructuredData(page, quelle), "utf8");
}

// sitemap.xml aus derselben Seitenliste erzeugen, damit sie beim Hinzufügen einer
// Seite nicht händisch nachgezogen werden muss.
const lastmodBySlug = {};
for (const page of SITE_PAGES) {
    lastmodBySlug[page.slug] = await lastModified(path.join(root, "src", page.source));
}
await writeFile(path.join(dist, "sitemap.xml"), buildSitemap(lastmodBySlug), "utf8");

/**
 * Setzt den generierten JSON-LD-Graphen und – wo Fragen hinterlegt sind – den
 * sichtbaren FAQ-Block in eine Seite ein (AP-02). Die Logik steht in
 * lib/render-page.mjs, damit der Vitest-Test denselben Code prüft.
 */
async function withStructuredData(page, quelle) {
    const { html } = renderPageWithStructuredData({
        page,
        html: quelle,
        dateModified: await lastModified(path.join(root, "src", page.source))
    });
    return html;
}

/** Datum der letzten inhaltlichen Änderung: Git-Commit-Datum, sonst Datei-Zeitstempel.
 *  Achtung: braucht die volle Git-Historie. Bei flachem Clone (fetch-depth 1)
 *  liefert git log für jede Datei den Tip-Commit – deshalb setzt der
 *  Deploy-Workflow fetch-depth: 0. */
async function lastModified(file) {
    try {
        const { stdout } = await execFileAsync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: root });
        const committed = stdout.trim();
        if (committed) {
            return committed;
        }
    } catch {
        // kein Git-Checkout (z. B. Tarball-Build) – Datei-Zeitstempel genügt
    }
    const { mtime } = await stat(file);
    return mtime.toISOString().slice(0, 10);
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
