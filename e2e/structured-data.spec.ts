import { expect, test } from "@playwright/test";

import { SITE_PAGES } from "../scripts/site-pages.mjs";

type Knoten = Record<string, unknown>;

const typVon = (knoten: Knoten): string => {
    const typ = knoten["@type"];
    return Array.isArray(typ) ? String(typ[0]) : String(typ);
};

const pfadVon = (slug: string): string => (slug === "" ? "/" : `/${slug}/`);

/** Liest den JSON-LD-Block der gerenderten Seite ein und prüft die Grundform. */
async function ladeGraph(page: import("@playwright/test").Page) {
    const rohBloecke = await page.locator('script[type="application/ld+json"]').allTextContents();
    // Genau ein Block je Seite: der Generator ersetzt alles Handgeschriebene.
    expect(rohBloecke, "Es muss genau einen JSON-LD-Block geben").toHaveLength(1);

    expect(() => JSON.parse(rohBloecke[0]), "JSON-LD muss valides JSON sein").not.toThrow();
    const graph = JSON.parse(rohBloecke[0]) as { "@context"?: unknown; "@graph"?: Knoten[] };

    expect(graph["@context"]).toBe("https://schema.org");
    expect(Array.isArray(graph["@graph"])).toBe(true);
    return graph["@graph"] as Knoten[];
}

for (const seite of SITE_PAGES) {
    const pfad = pfadVon(seite.slug);

    test(`@seo ${pfad} liefert einen validen JSON-LD-Graphen`, async ({ page }) => {
        await page.goto(pfad);
        const knoten = await ladeGraph(page);
        const typen = knoten.map(typVon);

        for (const pflicht of ["Organization", "WebSite", "WebPage"]) {
            expect(typen, `${pflicht} fehlt auf ${pfad}`).toContain(pflicht);
        }

        // Die Startseite ist die Wurzel und trägt bewusst keine Brotkrumenleiste.
        if (seite.slug !== "") {
            expect(typen, `BreadcrumbList fehlt auf ${pfad}`).toContain("BreadcrumbList");
        }

        // Jede @id-Referenz muss im Graphen auflösbar sein.
        const ids = new Set(knoten.map(eintrag => String(eintrag["@id"])));
        const referenzen: string[] = [];
        const sammle = (wert: unknown): void => {
            if (Array.isArray(wert)) { wert.forEach(sammle); return; }
            if (wert === null || typeof wert !== "object") return;
            const objekt = wert as Knoten;
            const schluessel = Object.keys(objekt);
            if (schluessel.length === 1 && schluessel[0] === "@id") {
                referenzen.push(String(objekt["@id"]));
                return;
            }
            for (const [name, inhalt] of Object.entries(objekt)) {
                if (name !== "@id") sammle(inhalt);
            }
        };
        sammle(knoten);
        for (const referenz of referenzen) {
            expect(ids.has(referenz), `Referenz ohne Knoten: ${referenz}`).toBe(true);
        }
    });

    test(`@seo ${pfad} zeigt jede FAQ-Frage sichtbar auf der Seite`, async ({ page }) => {
        await page.goto(pfad);
        const knoten = await ladeGraph(page);
        const faqKnoten = knoten.find(eintrag => typVon(eintrag) === "FAQPage");

        if (!faqKnoten) {
            // Rechtstexte tragen bewusst keine FAQ.
            expect(["impressum", "datenschutz"]).toContain(seite.slug);
            return;
        }

        const eintraege = faqKnoten.mainEntity as Knoten[];
        expect(eintraege.length).toBeGreaterThanOrEqual(3);

        // innerText enthält nur tatsächlich gerenderten Text – eingeklappte oder
        // ausgeblendete Bereiche fallen damit auf.
        const sichtbar = (await page.locator("body").innerText()).replace(/\s+/g, " ");
        for (const eintrag of eintraege) {
            const frage = String(eintrag.name).replace(/\s+/g, " ");
            expect(sichtbar, `Frage nicht im sichtbaren Text von ${pfad}: "${frage}"`).toContain(frage);

            const antwort = String((eintrag.acceptedAnswer as Knoten).text).replace(/\s+/g, " ");
            expect(sichtbar, `Antwort nicht im sichtbaren Text von ${pfad}`).toContain(antwort);
        }
    });
}

test("@seo die Startseite behält den FAQ-Block beim Routenwechsel im DOM", async ({ page }) => {
    // Der FAQ-Block liegt in #seoIntroArea, das der Router nur ein- und
    // ausblendet. Läge er in einem Bereich, dessen innerHTML überschrieben wird,
    // verschwände er nach dem ersten Render – und das JSON-LD verwiese auf
    // unsichtbaren Text.
    await page.goto("/");
    await expect(page.locator("#faq")).toBeVisible();

    await page.goto("/#/admin");
    await expect(page.locator("#faq")).toHaveCount(1);
});

test("@seo Sitemap führt keine changefreq/priority und keine Rechtstexte", async ({ request }) => {
    const antwort = await request.get("/sitemap.xml");
    expect(antwort.status()).toBe(200);
    const xml = await antwort.text();

    expect(xml).not.toContain("changefreq");
    expect(xml).not.toContain("priority");
    expect(xml).not.toContain("/impressum/");
    expect(xml).not.toContain("/datenschutz/");

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(treffer => treffer[1]);
    expect(locs).toHaveLength(SITE_PAGES.length - 2);
});

test("@seo Sitemap trägt unterschiedliche lastmod-Werte", async ({ request }) => {
    // Tragen alle URLs denselben Wert, ist das das Muster, an dem Google das
    // Feld domainweit entwertet – genau der Zustand vor AP-03.
    const xml = await (await request.get("/sitemap.xml")).text();
    const werte = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(treffer => treffer[1]);

    expect(werte.length).toBeGreaterThan(0);
    expect(new Set(werte).size, "alle URLs tragen denselben lastmod").toBeGreaterThan(1);
    for (const wert of werte) {
        expect(wert).toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2}))?$/);
    }
});

test("@seo Rechtstexte bleiben erreichbar und im Footer verlinkt", async ({ page, request }) => {
    for (const slug of ["impressum", "datenschutz"]) {
        const antwort = await request.get(`/${slug}/`);
        expect(antwort.status(), `/${slug}/ muss 200 liefern`).toBe(200);
        // Nicht in der Sitemap heißt nicht deindexiert.
        expect(await antwort.text()).not.toContain("noindex");
    }

    await page.goto("/");
    await expect(page.getByTestId("footer-link-impressum")).toHaveAttribute("href", "impressum/");
    await expect(page.getByTestId("footer-link-datenschutz")).toHaveAttribute("href", "datenschutz/");
});

test("@seo Inhaltsseiten zeigen das Änderungsdatum sichtbar und maschinenlesbar", async ({ page }) => {
    await page.goto("/funkuebung-feuerwehr/");

    const zeile = page.getByTestId("aktualisiert-am");
    await expect(zeile).toBeVisible();
    // Seit AP-06 ist daraus die vollständige Metazeile geworden:
    // Datum · Lesezeit · Autor.
    await expect(zeile).toContainText(/^Aktualisiert am \d{2}\.\d{2}\.\d{4} · Lesezeit ca\. \d+ Minuten · von /);

    // Sichtbares Datum, article:modified_time und JSON-LD müssen denselben Tag nennen.
    const datumAttribut = await zeile.locator("time").getAttribute("datetime");
    expect(datumAttribut).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const metaModified = await page.locator('meta[property="article:modified_time"]')
        .getAttribute("content");
    expect(metaModified?.slice(0, 10)).toBe(datumAttribut);

    const knoten = await ladeGraph(page);
    const webPage = knoten.find(eintrag => typVon(eintrag) === "WebPage")!;
    expect(String(webPage.dateModified).slice(0, 10)).toBe(datumAttribut);

    // published_time bleibt fix und darf nicht mit modified_time verschmelzen.
    const metaPublished = await page.locator('meta[property="article:published_time"]')
        .getAttribute("content");
    expect(metaPublished).toBe(String(webPage.datePublished));
});

test("@seo führt nirgends erfundene Bewertungen", async ({ page }) => {
    for (const seite of SITE_PAGES.slice(0, 5)) {
        await page.goto(pfadVon(seite.slug));
        const roh = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("");
        expect(roh).not.toContain("aggregateRating");
        expect(roh).not.toContain("ratingValue");
    }
});
