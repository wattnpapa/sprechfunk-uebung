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

/**
 * Themen-Seitenleiste für den Wissensbereich: die vollständige Baumstruktur
 * aller Inhaltsseiten, gruppiert nach Kategorie.
 *
 * Steht auf dem Hub und auf jeder Themenseite, damit von überall aus alle
 * Inhalte sichtbar sind, ohne über den Hub zurückzugehen. Quelle ist dieselbe
 * Registry wie für Hub-Karten und Brotkrumen.
 *
 * Die Kategorie der aktuellen Seite ist aufgeklappt, die übrigen sind
 * zugeklappt – sonst stünden auf jeder Seite 26 Links offen. Alle Gruppen sind
 * <details>, also ohne JavaScript bedienbar und per Tastatur erreichbar.
 */
export function renderWissenSidebar(aktuellerSlug) {
    const gruppen = HUB_CATEGORIES.map(kategorie => {
        const seiten = hubSeiten(kategorie.key);
        if (seiten.length === 0) return "";

        const istAktiveKategorie = seiten.some(seite => seite.slug === aktuellerSlug);
        const eintraege = seiten.map(seite => {
            const aktiv = seite.slug === aktuellerSlug;
            return `                    <li>`
                + `<a class="wissen-sidebar-link${aktiv ? " active" : ""}"`
                + ` href="${relativerPfad(aktuellerSlug, seite.slug)}"`
                + `${aktiv ? ' aria-current="page"' : ""}`
                + ` data-testid="sidebar-link-${seite.slug}">${escapeHtml(seite.label ?? seite.slug)}</a></li>`;
        }).join("\n");

        return `            <details class="wissen-sidebar-gruppe"${istAktiveKategorie ? " open" : ""}`
            + ` data-testid="sidebar-gruppe-${kategorie.key}">
                <summary class="wissen-sidebar-titel">${escapeHtml(kategorie.label)}</summary>
                <ul class="wissen-sidebar-liste list-unstyled">
${eintraege}
                </ul>
            </details>`;
    }).filter(Boolean).join("\n");

    // aria-label unterscheidet die Landmarke von Haupt- und Brotkrumennavigation;
    // mehrere gleich benannte nav-Elemente sind ein Barrierefreiheitsverstoß.
    return `    <aside class="wissen-sidebar" data-testid="wissen-sidebar">
        <nav aria-label="Themen im Sprechfunk-Wissen">
            <p class="wissen-sidebar-kopf">
                <a href="${relativerPfad(aktuellerSlug, HUB_SLUG)}">Sprechfunk-Wissen</a>
            </p>
${gruppen}
        </nav>
    </aside>
`;
}

/** Anzahl der Ziele im Weiterlesen-Block. Drei ist die Vorgabe aus AP-05. */
export const WEITERLESEN_ANZAHL = 3;

/**
 * Ziele des Weiterlesen-Blocks (AP-05).
 *
 * `related` wird redaktionell gepflegt – automatisch aus Textähnlichkeit
 * berechnete Empfehlungen wären beliebig und würden bei jeder Textänderung
 * springen. Reicht die Liste nicht, füllt der Build aus demselben Cluster auf,
 * damit keine Seite ohne Block bleibt.
 */
export function verwandteSeiten(page, alleSeiten) {
    const kandidaten = [];
    const aufnehmen = slug => {
        if (slug === page.slug) return;
        if (kandidaten.some(seite => seite.slug === slug)) return;
        const ziel = alleSeiten.find(seite => seite.slug === slug);
        // Rechtstexte und die SPA-Startseite sind keine Lesetipps.
        if (!ziel || ziel.slug === "" || ziel.inSitemap === false) return;
        kandidaten.push(ziel);
    };

    for (const slug of page.related ?? []) aufnehmen(slug);

    if (kandidaten.length < WEITERLESEN_ANZAHL && page.hubCategory) {
        for (const seite of hubSeiten(page.hubCategory)) {
            if (kandidaten.length >= WEITERLESEN_ANZAHL) break;
            aufnehmen(seite.slug);
        }
    }
    // Letzte Reserve: der Hub selbst, damit der Block nie unvollständig ist.
    if (kandidaten.length < WEITERLESEN_ANZAHL) aufnehmen(HUB_SLUG);

    return kandidaten.slice(0, WEITERLESEN_ANZAHL);
}

/**
 * Weiterlesen-Block am Ende einer Inhaltsseite. Statisches Markup, damit er
 * ohne JavaScript funktioniert.
 */
export function renderWeiterlesen(page, alleSeiten, beschreibungen = {}) {
    const ziele = verwandteSeiten(page, alleSeiten);
    if (ziele.length === 0) return "";

    const karten = ziele.map(ziel => `                <li class="col">
                    <a class="card h-100 text-decoration-none hub-karte" href="${relativerPfad(page.slug, ziel.slug)}" data-testid="weiterlesen-${ziel.slug}">
                        <div class="card-body">
                            <h3 class="h6 card-title">${escapeHtml(ziel.label ?? ziel.slug)}</h3>
                            <p class="card-text small mb-0">${escapeHtml(beschreibungen[ziel.slug] ?? "")}</p>
                        </div>
                    </a>
                </li>`).join("\n");

    return `        <section class="card shadow-sm my-4" id="weiterlesen" aria-labelledby="weiterlesen-titel" data-testid="weiterlesen">
            <div class="card-header"><h2 class="h4 mb-0" id="weiterlesen-titel">Weiterlesen</h2></div>
            <div class="card-body">
                <ul class="row row-cols-1 row-cols-sm-3 g-3 list-unstyled mb-0">
${karten}
                </ul>
            </div>
        </section>
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
