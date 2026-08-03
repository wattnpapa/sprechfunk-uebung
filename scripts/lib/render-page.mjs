// Zusammenbau einer ausgelieferten Seite: sichtbarer FAQ-Block plus generiertes
// JSON-LD (AP-02).
//
// Bewusst ohne Datei- und Git-Zugriff: `dateModified` gibt der Aufrufer herein.
// Damit prüft der Vitest-Test genau den Code, der auch den Build erzeugt – eine
// zweite Nachbildung im Test würde irgendwann auseinanderlaufen.

import { HUB_CATEGORIES, HUB_SLUG } from "../site-pages.mjs";
import { deutschesDatum, nurDatum } from "./lastmod.mjs";
import { buildGraph, escapeHtml, renderFaqHtml } from "./schema-graph.mjs";
import {
    breadcrumbFuer,
    renderBreadcrumb,
    renderFooter,
    renderHauptnavigation,
    renderHubKategorie
} from "./navigation.mjs";
import {
    extractDefinedTerms,
    extractFaqFromHtml,
    extractMetaDescription,
    extractTitle,
    plainText
} from "./page-metadata.mjs";

/** Einsetzstelle für den FAQ-Block auf der Startseite (SPA-Hülle). */
export const FAQ_PLATZHALTER = "<!-- AP-02:FAQ -->";

/**
 * Liefert das fertige HTML und den eingesetzten Graphen.
 * Wirft, wenn eine Zusicherung nicht hält – ein Build mit unsichtbaren
 * FAQ-Fragen oder fehlender Description darf nicht durchlaufen.
 */
export function renderPageWithStructuredData({
    page, html: quelle, dateModified = null, beschreibungen = {}
}) {
    const title = extractTitle(quelle);
    const description = extractMetaDescription(quelle);
    if (!title || !description) {
        throw new Error(`Seite "${page.slug || "/"}": <title> oder meta description fehlt.`);
    }

    // Seit AP-04 ist die Registry die Quelle der Brotkrumen, nicht das HTML:
    // nur so lässt sich die Hub-Ebene (Startseite › Wissen › Kategorie › Seite)
    // ergänzen, und sichtbares Markup und JSON-LD stammen garantiert aus
    // demselben Pfad.
    const breadcrumb = breadcrumbFuer(page);
    const terme = page.definedTerms ? extractDefinedTerms(quelle, page.definedTerms) : [];
    // /faq/ trägt die Fragen schon sichtbar im Markup; dort wird gelesen statt injiziert.
    const faq = page.faqFromPage ? extractFaqFromHtml(quelle) : (page.faq ?? []);
    if (page.faqFromPage && faq.length === 0) {
        throw new Error(`Seite "${page.slug}": faqFromPage gesetzt, aber keine sichtbaren Fragen gefunden.`);
    }

    // Globale Bausteine zuerst: Navigation, Brotkrumen und Footer werden
    // ersetzt, bevor FAQ-Block und Datumszeile daran verankert werden.
    let html = quelle;
    html = setzeHauptnavigation(html, page);
    html = ersetzeBreadcrumb(html, page);
    html = ersetzeFooter(html, page);
    html = setzeHubKarten(html, page, beschreibungen);

    if (!page.faqFromPage && faq.length > 0) {
        const block = renderFaqHtml(faq);
        // Auf der Startseite steht der Platzhalter innerhalb von #seoIntroArea,
        // das der Router nur ein- und ausblendet (src/core/AppView.ts). Vor
        // </main> eingesetzt läge der Block außerhalb aller Routen-Bereiche.
        if (html.includes(FAQ_PLATZHALTER)) {
            html = html.replace(FAQ_PLATZHALTER, block);
        } else if (html.includes("</main>")) {
            html = html.replace("</main>", `${block}</main>`);
        } else {
            throw new Error(`Seite "${page.slug || "/"}": weder ${FAQ_PLATZHALTER} noch </main> gefunden.`);
        }
    }

    const graph = buildGraph({
        page: { ...page, breadcrumb, faq },
        title,
        description,
        dateModified,
        terme
    });

    html = setzeArtikelZeitstempel(html, page, dateModified);
    html = setzeSichtbaresDatum(html, dateModified);
    html = ersetzeJsonLd(html, graph);
    pruefeFaqSichtbar(page, faq, html);
    return { html, graph, faq, terme, title, description, breadcrumb };
}

/**
 * Setzt die Hauptnavigation direkt hinter den Header (AP-04).
 *
 * Der bestehende Header bleibt unangetastet: auf der Startseite hängen daran
 * Theme-Umschalter, NATO-Uhr und die Modals der Anwendung. Die Navigation kommt
 * daher als eigenes <nav> darunter – auf allen 30 Seiten identisch und im
 * statischen HTML, also auch ohne JavaScript sichtbar.
 */
export function setzeHauptnavigation(html, page) {
    if (!html.includes("</header>")) {
        throw new Error(`Seite "${page.slug || "/"}": kein </header> für die Navigation gefunden.`);
    }
    return html.replace("</header>", `</header>\n\n${renderHauptnavigation(page.slug)}`);
}

/**
 * Ersetzt die vorhandene Brotkrumenleiste durch die aus der Registry erzeugte.
 * Seiten ohne Brotkrumen (Startseite) bleiben unverändert.
 */
export function ersetzeBreadcrumb(html, page) {
    const markup = renderBreadcrumb(page);
    if (markup === "") return html;

    const vorhandene = /<nav[^>]*>\s*<ol[^>]*class="[^"]*breadcrumb[^"]*"[\s\S]*?<\/ol>\s*<\/nav>\n?/i;
    if (vorhandene.test(html)) return html.replace(vorhandene, markup);

    // Neue Seite ohne Brotkrumen im Quelltext: hinter der Navigation einsetzen.
    if (html.includes("</nav>")) {
        const index = html.indexOf("</nav>") + "</nav>".length;
        return `${html.slice(0, index)}\n\n    ${markup}${html.slice(index)}`;
    }
    throw new Error(`Seite "${page.slug}": keine Stelle für die Brotkrumenleiste gefunden.`);
}

/** Ersetzt den Footer durch die vierspaltige Fassung. */
export function ersetzeFooter(html, page) {
    const vorhandener = /<footer[^>]*>[\s\S]*?<\/footer>\n?/i;
    if (!vorhandener.test(html)) {
        throw new Error(`Seite "${page.slug || "/"}": kein <footer> zum Ersetzen gefunden.`);
    }
    return html.replace(vorhandener, renderFooter(page.slug));
}

/**
 * Füllt die Kartenlisten des Hubs. Je Kategorie steht ein Platzhalter
 * <!-- AP-04:KARTEN:<key> --> in src/pages/wissen.html; die Karten entstehen aus
 * der Registry, die Kartentexte aus der meta description der Zielseite. Damit
 * gibt es keinen zweiten, handgepflegten Beschreibungstext.
 */
export function setzeHubKarten(html, page, beschreibungen) {
    if (page.slug !== HUB_SLUG) return html;

    let ergebnis = html;
    for (const kategorie of HUB_CATEGORIES) {
        const platzhalter = `<!-- AP-04:KARTEN:${kategorie.key} -->`;
        if (!ergebnis.includes(platzhalter)) {
            throw new Error(`Hub-Seite: Platzhalter ${platzhalter} fehlt.`);
        }
        ergebnis = ergebnis.replace(platzhalter, renderHubKategorie(kategorie, beschreibungen));
    }
    return ergebnis;
}

/**
 * Die sichtbare Datumszeile hängt hinter der Brotkrumenleiste. Bewusst kein
 * Platzhalter je Seite: der Anker existiert auf allen 28 Inhaltsseiten schon,
 * und beim Anlegen einer neuen Seite kann man ihn nicht vergessen.
 * Die Startseite hat keine Brotkrumen und bekommt daher keine Zeile.
 */
const BREADCRUMB_ENDE = /(<ol[^>]*class="[^"]*breadcrumb[^"]*"[\s\S]*?<\/ol>\s*<\/nav>)/i;

/**
 * Setzt article:published_time und article:modified_time (AP-03).
 * published_time kommt aus dem fixen datePublished der Registry,
 * modified_time aus der Git-Historie. Fehlt der Wert, wird das Meta-Tag
 * weggelassen statt ein Datum zu erfinden.
 */
export function setzeArtikelZeitstempel(html, page, dateModified) {
    const tags = [];
    if (page.datePublished) {
        tags.push(`    <meta property="article:published_time" content="${escapeHtml(page.datePublished)}">`);
    }
    if (dateModified) {
        tags.push(`    <meta property="article:modified_time" content="${escapeHtml(dateModified)}">`);
    }
    if (tags.length === 0) return html;
    return html.replace("</head>", `${tags.join("\n")}\n</head>`);
}

/**
 * Hängt die sichtbare Datumszeile hinter die Brotkrumenleiste.
 * Ohne ermittelbares Datum oder ohne Brotkrumen bleibt die Seite unverändert –
 * lieber keine Angabe als eine erfundene.
 */
export function setzeSichtbaresDatum(html, dateModified) {
    if (!dateModified || !BREADCRUMB_ENDE.test(html)) return html;
    const zeile = `\n    <p class="container text-body-secondary small mt-2 mb-0" data-testid="aktualisiert-am">`
        + `Aktualisiert am <time datetime="${escapeHtml(nurDatum(dateModified))}">`
        + `${escapeHtml(deutschesDatum(dateModified))}</time></p>`;
    return html.replace(BREADCRUMB_ENDE, `$1${zeile}`);
}

/** Entfernt etwaige ld+json-Blöcke und setzt genau einen neuen ein. */
export function ersetzeJsonLd(html, graph) {
    const block = `    <script type="application/ld+json">\n${JSON.stringify(graph, null, 4)}\n    </script>`;
    let ersetzt = false;
    const ohneAlte = html.replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, () => {
        if (ersetzt) return "";
        ersetzt = true;
        return `${block}\n`;
    });
    if (ersetzt) return ohneAlte;
    return html.replace("</head>", `${block}\n</head>`);
}

/**
 * Sichtbarer Text der Seite, ohne Skripte und Tags.
 *
 * Nutzt bewusst dasselbe plainText wie die Extraktion: Würden Vergleichsseite
 * und extrahierter Text unterschiedlich normalisieren, schlüge die
 * Sichtbarkeitsprüfung an Inline-Markup fehl, obwohl der Text stimmt.
 */
export function sichtbarerText(html) {
    return plainText(
        html
            .replace(/<script[\s\S]*?<\/script>/g, " ")
            .replace(/<style[\s\S]*?<\/style>/g, " ")
    );
}

/**
 * Harte Zusicherung: jede Frage im JSON-LD muss wortgleich im sichtbaren Text
 * stehen. Unsichtbare FAQ-Fragen verstoßen gegen die Richtlinien für
 * strukturierte Daten – das darf kein Build stillschweigend ausliefern.
 */
export function pruefeFaqSichtbar(page, faq, html) {
    const sichtbar = sichtbarerText(html);
    for (const eintrag of faq) {
        if (!sichtbar.includes(eintrag.q.replace(/\s+/g, " "))) {
            throw new Error(`Seite "${page.slug || "/"}": FAQ-Frage nicht im sichtbaren Text: "${eintrag.q}"`);
        }
    }
}
