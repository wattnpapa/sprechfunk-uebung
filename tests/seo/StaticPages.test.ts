import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error – reines JS-Modul ohne Typdeklaration, bewusst geteilt mit dem Build
import { buildSitemap, canonicalUrl, SITE_PAGES, SITE_URL, STATIC_SUBPAGES } from "../../scripts/site-pages.mjs";

/**
 * Die indexierbaren Seiten sind statisches HTML: Fehler in Canonical, Titel oder
 * Sitemap fallen weder beim Kompilieren noch im E2E-Test auf, sondern erst
 * Wochen später in der Search Console. Dieser Test hält die Pflichtangaben
 * zusammen mit der Seitenliste aus scripts/site-pages.mjs konsistent.
 */

const root = path.resolve(__dirname, "..", "..");

interface SitePage {
    slug: string;
    source: string;
    changefreq: string;
    priority: string;
}

const seiten = SITE_PAGES as SitePage[];

function leseSeite(source: string): string {
    return readFileSync(path.join(root, "src", source), "utf8");
}

function attribut(html: string, muster: RegExp): string | undefined {
    return muster.exec(html)?.[1];
}

function metaInhalt(html: string, name: string): string | undefined {
    return attribut(html, new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, "i"));
}

function ogInhalt(html: string, property: string): string | undefined {
    return attribut(html, new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`, "i"));
}

describe("Statische Seiten: SEO-Pflichtangaben", () => {

    it.each(seiten.map(seite => [seite.slug || "(startseite)", seite] as const))(
        "%s liefert Titel, Beschreibung und Canonical",
        (_name, seite) => {
            const html = leseSeite(seite.source);

            expect(attribut(html, /<html\s+lang="([^"]*)"/i)).toBe("de");

            const titel = attribut(html, /<title>([^<]*)<\/title>/i);
            expect(titel).toBeTruthy();
            expect(titel!.length).toBeLessThanOrEqual(120);

            const beschreibung = metaInhalt(html, "description");
            expect(beschreibung).toBeTruthy();
            expect(beschreibung!.length).toBeGreaterThanOrEqual(50);

            expect(attribut(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i))
                .toBe(canonicalUrl(seite.slug));
        }
    );

    it.each(seiten.map(seite => [seite.slug || "(startseite)", seite] as const))(
        "%s verweist auf das Social-Preview-Bild statt auf das Favicon",
        (_name, seite) => {
            const html = leseSeite(seite.source);

            expect(ogInhalt(html, "og:url")).toBe(canonicalUrl(seite.slug));
            expect(ogInhalt(html, "og:image")).toBe(`${SITE_URL}/assets/og-image.png`);
            expect(ogInhalt(html, "og:image:width")).toBe("1200");
            expect(ogInhalt(html, "og:image:height")).toBe("630");
        }
    );

    it("verlinkt jede Unterseite von der Startseite aus", () => {
        const start = leseSeite("index.html");

        for (const seite of STATIC_SUBPAGES as SitePage[]) {
            expect(start, `${seite.slug} ist von der Startseite aus nicht erreichbar`)
                .toContain(`href="${seite.slug}/"`);
        }
    });

    it("nennt in der 404-Seite nur existierende Ziele und bleibt auf noindex", () => {
        const html = readFileSync(path.join(root, "src", "404.html"), "utf8");

        expect(metaInhalt(html, "robots")).toContain("noindex");

        const ziele = [...html.matchAll(/href="\/([a-z0-9-]*)\/"/g)].map(treffer => treffer[1]);
        const bekannt = new Set(seiten.map(seite => seite.slug));
        for (const ziel of ziele) {
            expect(bekannt, `404-Seite verlinkt unbekanntes Ziel /${ziel}/`).toContain(ziel);
        }
    });
});

describe("Sitemap", () => {

    it("enthält genau die Canonicals der registrierten Seiten", () => {
        const xml = buildSitemap();
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(treffer => treffer[1]);

        expect(locs).toEqual(seiten.map(seite => canonicalUrl(seite.slug)));
    });

    it("schreibt lastmod als ISO-Datum, wenn eines bekannt ist", () => {
        const xml = buildSitemap({ "": "2026-07-26" });

        expect(xml).toContain("<lastmod>2026-07-26</lastmod>");
        expect([...xml.matchAll(/<lastmod>/g)]).toHaveLength(1);
    });

    it("ist wohlgeformtes XML mit gültigen Prioritäten", () => {
        const xml = buildSitemap();

        expect(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
        expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);

        for (const seite of seiten) {
            expect(Number(seite.priority)).toBeGreaterThan(0);
            expect(Number(seite.priority)).toBeLessThanOrEqual(1);
            expect(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"])
                .toContain(seite.changefreq);
        }
    });

    it("ist in der robots.txt verlinkt", () => {
        const robots = readFileSync(path.join(root, "src", "robots.txt"), "utf8");

        expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    });
});
