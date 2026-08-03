// Zusammenbau einer ausgelieferten Seite: sichtbarer FAQ-Block plus generiertes
// JSON-LD (AP-02).
//
// Bewusst ohne Datei- und Git-Zugriff: `dateModified` gibt der Aufrufer herein.
// Damit prüft der Vitest-Test genau den Code, der auch den Build erzeugt – eine
// zweite Nachbildung im Test würde irgendwann auseinanderlaufen.

import { canonicalUrl } from "../site-pages.mjs";
import { buildGraph, renderFaqHtml } from "./schema-graph.mjs";
import {
    extractBreadcrumb,
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
export function renderPageWithStructuredData({ page, html: quelle, dateModified = null }) {
    const title = extractTitle(quelle);
    const description = extractMetaDescription(quelle);
    if (!title || !description) {
        throw new Error(`Seite "${page.slug || "/"}": <title> oder meta description fehlt.`);
    }

    const breadcrumb = extractBreadcrumb(quelle, canonicalUrl(page.slug));
    const terme = page.definedTerms ? extractDefinedTerms(quelle, page.definedTerms) : [];
    // /faq/ trägt die Fragen schon sichtbar im Markup; dort wird gelesen statt injiziert.
    const faq = page.faqFromPage ? extractFaqFromHtml(quelle) : (page.faq ?? []);
    if (page.faqFromPage && faq.length === 0) {
        throw new Error(`Seite "${page.slug}": faqFromPage gesetzt, aber keine sichtbaren Fragen gefunden.`);
    }

    let html = quelle;
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

    html = ersetzeJsonLd(html, graph);
    pruefeFaqSichtbar(page, faq, html);
    return { html, graph, faq, terme, title, description, breadcrumb };
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
