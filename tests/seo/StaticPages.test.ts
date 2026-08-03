import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error – reines JS-Modul ohne Typdeklaration, bewusst geteilt mit dem Build
import {
    buildSitemap, canonicalUrl, HUB_CATEGORIES, HUB_SLUG, SITEMAP_PAGES, SITE_PAGES, SITE_URL,
    STATIC_SUBPAGES
} from "../../scripts/site-pages.mjs";
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
    sources: string[];
    inSitemap?: boolean;
    hubCategory?: string;
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

    /**
     * Seit AP-04 verlinkt die Startseite nicht mehr alle 28 Unterseiten
     * hintereinander, sondern gezielt – die Tiefe kommt über den Hub /wissen/.
     * Die Zusicherung ist deshalb die Klicktiefe: höchstens zwei Klicks von der
     * Startseite zu jeder Seite, also direkt oder über den Hub. Die Hub-Karten
     * entstehen erst beim Build, hier zählt die Kategoriezuordnung der Registry.
     */
    it("erreicht jede Unterseite in höchstens zwei Klicks von der Startseite", () => {
        const start = leseSeite("index.html");
        const hubMarkup = leseSeite("pages/wissen.html");

        for (const seite of STATIC_SUBPAGES as SitePage[]) {
            const direkt = start.includes(`href="${seite.slug}/"`);
            const ueberHub = seite.hubCategory !== undefined
                && hubMarkup.includes(`<!-- AP-04:KARTEN:${seite.hubCategory} -->`);
            // Rechtstexte hängen im Footer, der auf jeder Seite steht.
            const imFooter = seite.inSitemap === false;

            expect(direkt || ueberHub || imFooter,
                `${seite.slug} ist weder direkt, noch über den Hub, noch im Footer erreichbar`)
                .toBe(true);
        }
    });

    it("verlinkt den Hub von der Startseite aus", () => {
        // Ohne diesen Link wäre die zweite Klickebene nicht erreichbar.
        expect(leseSeite("index.html")).toContain(`href="${HUB_SLUG}/"`);
    });

    it("ordnet jede Inhaltsseite genau einer Hub-Kategorie zu", () => {
        const schluessel = new Set(HUB_CATEGORIES.map((k: { key: string }) => k.key));
        const ohne = (STATIC_SUBPAGES as SitePage[])
            .filter(seite => seite.slug !== HUB_SLUG && seite.inSitemap !== false)
            .filter(seite => !schluessel.has(seite.hubCategory ?? ""));

        expect(ohne.map(seite => seite.slug), "Seiten ohne Hub-Kategorie").toEqual([]);
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

    it("enthält genau die Canonicals der Sitemap-Seiten", () => {
        const xml = buildSitemap();
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(treffer => treffer[1]);

        expect(locs).toEqual(SITEMAP_PAGES.map((seite: SitePage) => canonicalUrl(seite.slug)));
    });

    it("nimmt die Rechtstexte nicht auf, behält sie aber in der Registry", () => {
        const xml = buildSitemap();

        // Nicht in der Crawl-Priorisierung …
        expect(xml).not.toContain(canonicalUrl("impressum"));
        expect(xml).not.toContain(canonicalUrl("datenschutz"));
        // … aber weiterhin registriert und damit ausgeliefert und verlinkt.
        for (const slug of ["impressum", "datenschutz"]) {
            expect(seiten.map(seite => seite.slug)).toContain(slug);
            expect(STATIC_SUBPAGES.map((seite: SitePage) => seite.slug)).toContain(slug);
        }
        expect(SITEMAP_PAGES).toHaveLength(seiten.length - 2);
    });

    it("schreibt lastmod als ISO-Zeitstempel, wenn einer bekannt ist", () => {
        const xml = buildSitemap({ "": "2026-08-01T17:19:45+02:00" });

        expect(xml).toContain("<lastmod>2026-08-01T17:19:45+02:00</lastmod>");
        expect([...xml.matchAll(/<lastmod>/g)]).toHaveLength(1);
    });

    it("lässt lastmod weg, statt ein Datum zu raten", () => {
        // Kein Wert für eine Seite heißt: Feld weglassen. Ein falsches lastmod
        // entwertet das Feld domainweit, ein fehlendes kostet nur das Signal.
        const xml = buildSitemap({});

        expect(xml).not.toContain("<lastmod>");
        expect([...xml.matchAll(/<loc>/g)]).toHaveLength(SITEMAP_PAGES.length);
    });

    it("führt weder changefreq noch priority", () => {
        // Google wertet beides nicht aus; ungepflegte Werte sind schlechter als keine.
        const xml = buildSitemap({ "": "2026-08-01T17:19:45+02:00" });

        expect(xml).not.toContain("changefreq");
        expect(xml).not.toContain("priority");
        for (const seite of seiten as unknown as Record<string, unknown>[]) {
            expect(seite.changefreq).toBeUndefined();
            expect(seite.priority).toBeUndefined();
        }
    });

    it("entspricht dem Schema von sitemaps.org", () => {
        const lastmods = Object.fromEntries(
            SITEMAP_PAGES.map((seite: SitePage, index: number) =>
                [seite.slug, `2026-08-0${(index % 3) + 1}T10:00:00+02:00`])
        );
        const xml = buildSitemap(lastmods);

        expect(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
        expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
        expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);

        // Nur die im Schema erlaubten Kindelemente von <url>.
        const erlaubt = new Set(["loc", "lastmod", "changefreq", "priority"]);
        const bloecke = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(treffer => treffer[1]);
        expect(bloecke).toHaveLength(SITEMAP_PAGES.length);
        for (const block of bloecke) {
            const tags = [...block.matchAll(/<(\w+)>/g)].map(treffer => treffer[1]);
            expect(tags[0], "loc muss zuerst stehen").toBe("loc");
            for (const tag of tags) expect(erlaubt).toContain(tag);
            expect(new Set(tags).size, "kein Kindelement doppelt").toBe(tags.length);
        }

        // <loc> absolut, <lastmod> als W3C-Datum.
        for (const loc of [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(t => t[1])) {
            expect(loc.startsWith(`${SITE_URL}/`)).toBe(true);
            expect(loc).not.toContain("&");
        }
        for (const wert of [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(t => t[1])) {
            expect(wert).toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2}))?$/);
            expect(Number.isNaN(Date.parse(wert))).toBe(false);
        }
        // 50.000 URLs bzw. 50 MB sind die Grenzen des Formats.
        expect(bloecke.length).toBeLessThanOrEqual(50_000);
        expect(Buffer.byteLength(xml, "utf8")).toBeLessThan(50 * 1024 * 1024);
    });

    it("ist in der robots.txt verlinkt", () => {
        const robots = readFileSync(path.join(root, "src", "robots.txt"), "utf8");

        expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    });
});
