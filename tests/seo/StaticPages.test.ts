import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error – reines JS-Modul ohne Typdeklaration, bewusst geteilt mit dem Build
import { buildSitemap, canonicalUrl, SITE_PAGES, SITE_URL, STATIC_SUBPAGES } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reines JS-Hilfsmodul ohne Typdeklarationen, absichtlich .mjs
import { renderPageWithStructuredData } from "../../scripts/lib/render-page.mjs";

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

    /**
     * Suchmaschinen und Sprachmodelle gleichen die Suchanfrage gegen Titel und
     * sichtbaren Seitentext ab. Der Produktname allein beantwortet "Sprechfunkuebung
     * online kostenlos" nicht – die Startseite muss den Nutzen ausschreiben. Der
     * Kopfbalken bleibt bewusst schlank (nur Produktname); Nutzen und Zugangshuerde
     * stehen im Einstiegstext (#seoIntroArea), der fuer Crawler im statischen HTML liegt.
     */
    it("nennt Nutzen und Zugangshuerde in Titel, Beschreibung und Einstiegstext", () => {
        const html = leseSeite("index.html");

        const titel = attribut(html, /<title>([^<]*)<\/title>/i)!;
        expect(titel).toMatch(/kostenlos/i);
        expect(titel).toMatch(/ohne Anmeldung/i);
        expect(titel).toContain("Sprechfunk Übungsgenerator");

        const beschreibung = metaInhalt(html, "description")!;
        expect(beschreibung).toMatch(/kostenlos/i);
        expect(beschreibung).toMatch(/ohne Anmeldung/i);
        expect(beschreibung).toMatch(/ohne Installation/i);

        const introStart = html.indexOf("id=\"seoIntroArea\"");
        expect(introStart, "Die Startseite braucht den Einstiegstext #seoIntroArea").toBeGreaterThan(-1);
        const intro = html.slice(introStart, html.indexOf("id=\"adminArea\""));

        // Die h1 der Startseite steht im Einstiegstext, nicht im Kopfbalken.
        const introUeberschrift = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(intro)?.[1];
        expect(introUeberschrift, "Die h1 der Startseite gehoert in #seoIntroArea").toBeTruthy();
        const introUeberschriftText = introUeberschrift!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        expect(introUeberschriftText).toMatch(/Sprechfunkübung online erstellen/);
        expect(introUeberschriftText).toMatch(/kostenlos/i);
        expect(introUeberschriftText).toMatch(/ohne Anmeldung/i);

        expect(intro).toMatch(/ohne Installation/i);
    });

    /**
     * Das Hauptkeyword muss in Titel, h1 und im Einstiegstext stehen – sonst
     * ordnet Google die Startseite dem Suchbegriff nicht zu. Der Test haelt die
     * drei Stellen zusammen, weil sie in verschiedenen Bloecken der Datei liegen
     * und beim Umformulieren einzeln verrutschen.
     */
    it("platziert das Hauptkeyword in Titel, h1 und Einstiegstext der Startseite", () => {
        const html = leseSeite("index.html");
        // "BOS Sprechfunk Übung" – mit oder ohne Bindestrich/Fuge geschrieben.
        const keyword = /BOS[- ]Sprechfunk[- ]?übung/i;

        expect(attribut(html, /<title>([^<]*)<\/title>/i)!).toMatch(keyword);

        const intro = html.slice(html.indexOf("id=\"seoIntroArea\""), html.indexOf("id=\"adminArea\""));
        expect(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(intro)![1]).toMatch(keyword);

        // Erste 100 Woerter des sichtbaren Einstiegstexts.
        const ersteWorte = intro
            .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
            .split(" ").slice(0, 100).join(" ");
        expect(ersteWorte, "Das Keyword fehlt in den ersten 100 Woertern").toMatch(keyword);
    });

    /**
     * Der Produktname im Kopfbalken war frueher die h1 jeder Seite – damit hatte
     * keine Unterseite eine Ueberschrift zu ihrem eigenen Thema. Der Test haelt
     * die Struktur fest: genau eine h1 je Seite, und sie beschreibt das Thema.
     */
    it.each(seiten.map(seite => [seite.slug || "(startseite)", seite] as const))(
        "%s hat genau eine themenbezogene h1",
        (_name, seite) => {
            const html = leseSeite(seite.source);

            const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
                .map(treffer => treffer[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

            expect(h1s, "Jede Seite braucht genau eine h1").toHaveLength(1);
            expect(h1s[0], "Der Produktname allein ist kein Seitenthema")
                .not.toBe("Sprechfunk Übungsgenerator");
            // Rechtsseiten ("Impressum") duerfen kurz sein, leer aber nicht.
            expect(h1s[0].length).toBeGreaterThan(5);
        }
    );

    /**
     * FAQ-Markup darf nur Fragen enthalten, die auch sichtbar auf der Seite stehen –
     * sonst gilt es als irrefuehrend und wird abgewertet. Das Schema und die
     * Ueberschriften stehen in derselben Datei und laufen beim Pflegen leicht auseinander.
     */
    it("bildet im FAQ-Schema nur sichtbar beantwortete Fragen ab", () => {
        // Seit AP-02 steht das JSON-LD nicht mehr in der Quelldatei, sondern wird
        // beim Build erzeugt. Geprüft wird daher der generierte Graph – die
        // Zusicherung bleibt dieselbe: keine Frage ohne sichtbare Antwort.
        const html = leseSeite("pages/faq.html");
        const seite = SITE_PAGES.find(eintrag => eintrag.slug === "faq")!;
        const { graph } = renderPageWithStructuredData({ page: seite, html, dateModified: "2026-08-01" });

        const schema = graph["@graph"].find((knoten: Record<string, unknown>) => knoten["@type"] === "FAQPage");
        expect(schema, "Die FAQ-Seite braucht ein FAQPage-Schema").toBeTruthy();

        const ueberschriften = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)]
            .map(treffer => treffer[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());

        expect(schema.mainEntity.length).toBeGreaterThan(0);
        for (const frage of schema.mainEntity) {
            expect(ueberschriften, `"${frage.name}" steht im Schema, aber in keiner <h3>`)
                .toContain(frage.name);
            expect(frage.acceptedAnswer?.text?.length ?? 0).toBeGreaterThan(40);
        }
    });

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
