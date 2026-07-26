import { execFile } from "node:child_process";
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { buildSitemap, SITE_PAGES, STATIC_SUBPAGES } from "./site-pages.mjs";

const execFileAsync = promisify(execFile);

const root = process.cwd();
const dist = path.join(root, "dist");

await mkdir(dist, { recursive: true });

await cp(path.join(root, "assets"), path.join(dist, "assets"), { recursive: true });
await cp(path.join(root, "src", "index.html"), path.join(dist, "index.html"));
await cp(path.join(root, "src", "404.html"), path.join(dist, "404.html"));
await cp(path.join(root, "howto.md"), path.join(dist, "howto.md"));
await cp(path.join(root, "src", "styles", "main.css"), path.join(dist, "style.css"));
await cp(path.join(root, "src", "firebase-config.js"), path.join(dist, "firebase-config.js"));
await cp(path.join(root, "src", "robots.txt"), path.join(dist, "robots.txt"));

// Statische, crawlbare Inhaltsseiten als Verzeichnis-Index ablegen (=> /anleitung/, /faq/, ...).
for (const page of STATIC_SUBPAGES) {
    const target = path.join(dist, page.slug);
    await mkdir(target, { recursive: true });
    await cp(path.join(root, "src", page.source), path.join(target, "index.html"));
}

// sitemap.xml aus derselben Seitenliste erzeugen, damit sie beim Hinzufügen einer
// Seite nicht händisch nachgezogen werden muss.
const lastmodBySlug = {};
for (const page of SITE_PAGES) {
    lastmodBySlug[page.slug] = await lastModified(path.join(root, "src", page.source));
}
await writeFile(path.join(dist, "sitemap.xml"), buildSitemap(lastmodBySlug), "utf8");

/** Datum der letzten inhaltlichen Änderung: Git-Commit-Datum, sonst Datei-Zeitstempel. */
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
