// Zentrale Registrierung aller statisch ausgelieferten, indexierbaren Seiten.
// Quelle der Wahrheit für Build (postbuild-copy.mjs), Sitemap und SEO-Tests.

export const SITE_URL = "https://sprechfunk-uebung.de";

/**
 * slug     – Verzeichnis unterhalb der Domain ("" = Startseite)
 * source   – Datei unterhalb von src/
 * priority – Sitemap-Priorität
 */
export const SITE_PAGES = [
    { slug: "", source: "index.html", changefreq: "weekly", priority: "1.0" },
    { slug: "anleitung", source: "pages/anleitung.html", changefreq: "monthly", priority: "0.9" },
    { slug: "buchstabiertafel", source: "pages/buchstabiertafel.html", changefreq: "yearly", priority: "0.8" },
    { slug: "meldevordruck", source: "pages/meldevordruck.html", changefreq: "yearly", priority: "0.8" },
    { slug: "funksprueche", source: "pages/funksprueche.html", changefreq: "monthly", priority: "0.8" },
    { slug: "faq", source: "pages/faq.html", changefreq: "monthly", priority: "0.7" },
    { slug: "impressum", source: "pages/impressum.html", changefreq: "yearly", priority: "0.2" },
    { slug: "datenschutz", source: "pages/datenschutz.html", changefreq: "yearly", priority: "0.2" }
];

/** Seiten, die als eigenes Verzeichnis (=> /slug/index.html) ausgeliefert werden. */
export const STATIC_SUBPAGES = SITE_PAGES.filter(page => page.slug !== "");

export function canonicalUrl(slug) {
    return slug ? `${SITE_URL}/${slug}/` : `${SITE_URL}/`;
}

/**
 * Baut die sitemap.xml. `lastmod` wird je Seite als ISO-Datum (YYYY-MM-DD) erwartet;
 * Seiten ohne Datum werden ohne <lastmod> ausgegeben.
 */
export function buildSitemap(lastmodBySlug = {}) {
    const entries = SITE_PAGES.map(page => {
        const lastmod = lastmodBySlug[page.slug];
        return [
            "  <url>",
            `    <loc>${canonicalUrl(page.slug)}</loc>`,
            lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
            `    <changefreq>${page.changefreq}</changefreq>`,
            `    <priority>${page.priority}</priority>`,
            "  </url>"
        ].filter(Boolean).join("\n");
    });

    return [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
        ...entries,
        "</urlset>",
        ""
    ].join("\n");
}
