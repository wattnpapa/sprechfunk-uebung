// Globale Navigation, Brotkrumen, Footer und Hub-Karten (AP-04).
//
// Alles wird zur Buildzeit erzeugt und in jede Seite eingesetzt. Zwei Gründe:
// 1. Ohne JavaScript sichtbar – ein Crawler ohne JS-Ausführung sieht dieselbe
//    Navigation wie ein Browser.
// 2. Eine Quelle für alle 30 Seiten. Handgeschriebene Header sind vorher genau
//    deshalb auseinandergelaufen (Unterseiten drei Links, Startseite vier).
//
// Reine Funktionen mit relativen Pfaden: die statischen Seiten liegen unter
// /<slug>/index.html und verlinken relativ (../), die Startseite unter / (./).

import { escapeHtml } from "./schema-graph.mjs";
import { HUB_CATEGORIES, HUB_SLUG, MAIN_NAV, canonicalUrl, hubSeiten } from "../site-pages.mjs";

/** Relativer Pfad von einer Seite zu einer anderen. */
export function relativerPfad(vonSlug, zuSlug) {
    const auf = vonSlug === "" ? "" : "../";
    return zuSlug === "" ? (auf || "./") : `${auf}${zuSlug}/`;
}

const GITHUB = "https://github.com/wattnpapa/sprechfunk-uebung";

/**
 * Hauptnavigation. Auf Mobilgeräten ein <details>-Element: das ist ohne
 * JavaScript bedienbar, von Haus aus tastaturfähig und braucht kein
 * ARIA-Gebastel für den Aufklappzustand.
 */
export function renderHauptnavigation(aktuellerSlug) {
    const eintraege = MAIN_NAV.map(eintrag => {
        const aktiv = eintrag.slug === aktuellerSlug;
        const href = relativerPfad(aktuellerSlug, eintrag.slug);
        // aria-current markiert die aktive Seite; der Link bleibt ein Link,
        // damit die Navigation auf jeder Seite gleich aufgebaut ist.
        return `                <li class="nav-item">`
            + `<a class="nav-link${aktiv ? " active" : ""}" href="${href}"`
            + `${aktiv ? ' aria-current="page"' : ""}`
            + ` data-testid="nav-${eintrag.slug || "start"}">${escapeHtml(eintrag.label)}</a></li>`;
    }).join("\n");

    const github = `                <li class="nav-item">`
        + `<a class="nav-link" href="${GITHUB}" rel="noopener noreferrer" target="_blank"`
        + ` data-testid="nav-github">GitHub</a></li>`;

    return `<nav class="site-nav" aria-label="Hauptnavigation" data-testid="hauptnavigation">
    <div class="container">
        <!-- open ist Absicht: ein zugeklapptes <details> versteckt seinen Inhalt
             auch für Prüfwerkzeuge und Crawler. So stehen die Links immer im
             Layout; auf kleinen Bildschirmen lässt sich die Leiste zuklappen,
             auf großen ist die Zusammenfassung ausgeblendet. -->
        <details class="site-nav-details" open>
            <summary class="site-nav-summary" data-testid="nav-umschalter">Menü</summary>
            <ul class="site-nav-list">
${eintraege}
${github}
            </ul>
        </details>
    </div>
</nav>
`;
}

/**
 * Brotkrumenpfad einer Seite als Datenstruktur, Quelle für sichtbares Markup
 * UND JSON-LD. Inhaltsseiten hängen unter dem Hub und seiner Kategorie:
 * Startseite › Wissen › Funkübungen planen und durchführen › Funkübung Feuerwehr
 */
export function breadcrumbFuer(page) {
    if (page.slug === "") return [];

    const pfad = [{ name: "Startseite", slug: "" }];
    if (page.slug !== HUB_SLUG && page.hubCategory) {
        const kategorie = HUB_CATEGORIES.find(eintrag => eintrag.key === page.hubCategory);
        pfad.push({ name: "Wissen", slug: HUB_SLUG });
        if (kategorie) {
            // Die Kategorie ist ein Abschnitt des Hubs, keine eigene URL.
            pfad.push({ name: kategorie.label, url: `${canonicalUrl(HUB_SLUG)}#${kategorie.anchor}` });
        }
    }
    pfad.push({ name: page.label ?? page.slug });
    return pfad;
}

/** Sichtbare Brotkrumenleiste, erzeugt aus derselben Struktur wie das JSON-LD. */
export function renderBreadcrumb(page) {
    const pfad = breadcrumbFuer(page);
    if (pfad.length === 0) return "";

    const glieder = pfad.map((glied, index) => {
        const letzte = index === pfad.length - 1;
        if (letzte) {
            return `            <li class="breadcrumb-item active" aria-current="page">`
                + `${escapeHtml(glied.name)}</li>`;
        }
        const href = glied.url
            ? glied.url.replace(canonicalUrl(HUB_SLUG), relativerPfad(page.slug, HUB_SLUG))
            : relativerPfad(page.slug, glied.slug);
        return `            <li class="breadcrumb-item">`
            + `<a href="${href}">${escapeHtml(glied.name)}</a></li>`;
    }).join("\n");

    return `<nav aria-label="Brotkrumennavigation" class="container mt-3" data-testid="breadcrumb">
        <ol class="breadcrumb mb-0">
${glieder}
        </ol>
    </nav>
`;
}

/** Eine Karte je Seite. `beschreibung` ist der erste Satz ihrer meta description. */
export function renderHubKarte(page, aktuellerSlug, beschreibung) {
    const href = relativerPfad(aktuellerSlug, page.slug);
    return `                <li class="col">
                    <a class="card h-100 text-decoration-none hub-karte" href="${href}" data-testid="hub-karte-${page.slug}">
                        <div class="card-body">
                            <h3 class="h6 card-title">${escapeHtml(page.label ?? page.slug)}</h3>
                            <p class="card-text small mb-0">${escapeHtml(beschreibung)}</p>
                        </div>
                    </a>
                </li>`;
}

/**
 * Kartenliste einer Kategorie. `beschreibungen` bildet slug -> Satz ab und wird
 * beim Build aus den meta descriptions der Zielseiten gefüllt – so gibt es
 * keinen zweiten, handgepflegten Beschreibungstext.
 */
export function renderHubKategorie(kategorie, beschreibungen, aktuellerSlug = HUB_SLUG) {
    const seiten = hubSeiten(kategorie.key);
    const karten = seiten
        .map(page => renderHubKarte(page, aktuellerSlug, beschreibungen[page.slug] ?? ""))
        .join("\n");
    return `            <ul class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3 list-unstyled mb-0" data-testid="hub-liste-${kategorie.key}">
${karten}
            </ul>`;
}

/**
 * Footer in Spalten (AP-04). Die meistgefragten Inhaltsseiten stehen in der
 * Wissen-Spalte, damit sie sitewide verlinkt sind.
 */
export function renderFooter(aktuellerSlug) {
    const link = (slug, text, testid) =>
        `                <li><a href="${relativerPfad(aktuellerSlug, slug)}"`
        + `${testid ? ` data-testid="${testid}"` : ""}>${escapeHtml(text)}</a></li>`;

    const spalten = [
        {
            titel: "Anwendung",
            eintraege: [
                link("", "Übung erstellen", "footer-link-start"),
                link("anleitung", "Anleitung", "footer-link-anleitung"),
                link("funktionen", "Funktionen", "footer-link-funktionen"),
                link("faq", "FAQ", "footer-link-faq")
            ]
        },
        {
            titel: "Wissen",
            eintraege: [
                link(HUB_SLUG, "Alle Themen", "footer-link-wissen"),
                link("sprechfunk-regeln", "Sprechfunk-Regeln", "footer-link-sprechfunk-regeln"),
                link("buchstabiertafel", "Buchstabiertafel", "footer-link-buchstabiertafel"),
                link("betriebsworte", "Betriebsworte", "footer-link-betriebsworte"),
                link("meldevordruck", "Meldevordruck", "footer-link-meldevordruck"),
                link("funksprueche", "Funksprüche", "footer-link-funksprueche")
            ]
        },
        {
            titel: "Rechtliches",
            eintraege: [
                link("impressum", "Impressum", "footer-link-impressum"),
                link("datenschutz", "Datenschutz", "footer-link-datenschutz"),
                "                <li><a href=\"mailto:johannes.rudolph@thw-oldenburg.de\">Kontakt</a></li>"
            ]
        },
        {
            titel: "Projekt",
            eintraege: [
                link("open-source", "Kostenlos & Open Source", "footer-link-open-source"),
                `                <li><a href="${GITHUB}" target="_blank" rel="noopener noreferrer">GitHub</a></li>`,
                `                <li><a href="${GITHUB}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">EUPL-1.2-Lizenz</a></li>`
            ]
        }
    ];

    const markup = spalten.map(spalte => `        <div class="col-6 col-lg-3">
            <h2 class="h6 footer-spalten-titel">${escapeHtml(spalte.titel)}</h2>
            <ul class="footer-links-liste list-unstyled mb-0">
${spalte.eintraege.join("\n")}
            </ul>
        </div>`).join("\n");

    return `<footer class="main-footer" data-testid="site-footer">
    <div class="container">
      <div class="row g-4">
${markup}
      </div>
    </div>
</footer>
`;
}
