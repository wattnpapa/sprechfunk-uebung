// Zentraler JSON-LD-Generator (AP-02).
//
// Erzeugt je Seite genau einen @graph mit Organization, WebSite, WebPage,
// BreadcrumbList und dem seitenspezifischen Typ. Alle Knoten sind über @id
// verknüpft statt dupliziert.
//
// Reine Funktionen, kein Datei- oder Netzzugriff: der Graph ist damit ohne
// Build testbar. Das Einsetzen ins HTML macht scripts/postbuild-copy.mjs.
//
// Grundsatz: Es wird nichts behauptet, was nicht auf der Seite steht. FAQ-Texte
// und Nachschlagebegriffe stammen aus derselben Quelle wie das sichtbare Markup,
// darum können strukturierte Daten und Seiteninhalt nicht auseinanderlaufen.

import { canonicalUrl, SITE_URL } from "../site-pages.mjs";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const AUTHOR_ID = `${SITE_URL}/#autor`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

export const SCHEMA_TYPES = ["Article", "HowTo", "FAQPage", "CollectionPage", "ProfilePage", "WebPage"];

const LOGO_URL = `${SITE_URL}/assets/favicon.png`;
const OG_IMAGE_URL = `${SITE_URL}/assets/og-image.png`;
const REPO_URL = "https://github.com/wattnpapa/sprechfunk-uebung";
const PROFILE_URL = "https://github.com/wattnpapa";
// Porträt aus dem Autoren-Modal der Startseite – dieselbe Quelle, kein zweites Bild.
const PORTRAIT_URL = "https://www.gravatar.com/avatar/b4d8c8a87a392586b9caee287180163b?s=400";

/** Knoten-@id je Seite. Ein Fragment je Rolle, damit Referenzen eindeutig sind. */
export function nodeId(slug, fragment) {
    return `${canonicalUrl(slug)}#${fragment}`;
}

/** Entfernt Felder ohne Wert, damit kein `"author": null` im Graph landet. */
function kompakt(objekt) {
    const ergebnis = {};
    for (const [schluessel, wert] of Object.entries(objekt)) {
        if (wert === undefined || wert === null) continue;
        if (Array.isArray(wert) && wert.length === 0) continue;
        ergebnis[schluessel] = wert;
    }
    return ergebnis;
}

function thingListe(namen) {
    return (namen ?? []).map(name => ({ "@type": "Thing", name }));
}

export function buildOrganization() {
    return {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "Sprechfunk Übungsgenerator",
        description: "Privates, ehrenamtliches Open-Source-Projekt für die Sprechfunkausbildung "
            + "im Bevölkerungs- und Katastrophenschutz. Kein Angebot einer Behörde.",
        url: `${SITE_URL}/`,
        // Die Seite, die diese Entität beschreibt (AP-11). Bewusst als URL und
        // nicht als @id-Referenz: der Knoten der Zielseite liegt in deren
        // eigenem Graphen, ein @id darauf bliebe hier unauflösbar.
        mainEntityOfPage: canonicalUrl("ueber-das-projekt"),
        founder: { "@id": AUTHOR_ID },
        logo: {
            "@type": "ImageObject",
            url: LOGO_URL,
            width: 1024,
            height: 1024
        },
        sameAs: [PROFILE_URL, REPO_URL]
    };
}

/** Die Person hinter dem Projekt. Bleibt als eigener Knoten erhalten, weil
 *  Autorschaft und Betreiber fachlich zwei verschiedene Aussagen sind.
 *
 *  Alle Angaben stehen sichtbar auf /autor/ und im Autoren-Modal der Startseite.
 *  Das Ehrenamt im THW steht als `memberOf`, nicht als `worksFor`: es ist eine
 *  Mitgliedschaft, kein Beschäftigungsverhältnis, und ein falsches Feld wäre
 *  hier eine Behauptung über eine Behörde. */
export function buildAuthor() {
    return {
        "@type": "Person",
        "@id": AUTHOR_ID,
        name: "Johannes Rudolph",
        jobTitle: "Bereichsausbilder Sprechfunk (THW)",
        description: "Seit 2007 im Technischen Hilfswerk aktiv, Gruppenführer der Fachgruppe "
            + "Kommunikation und Bereichsausbilder für Sprechfunk.",
        url: `${SITE_URL}/autor/`,
        image: PORTRAIT_URL,
        worksFor: { "@id": ORGANIZATION_ID },
        memberOf: {
            "@type": "Organization",
            name: "Technisches Hilfswerk",
            url: "https://www.thw.de/"
        },
        knowsAbout: [
            "BOS-Funk",
            "Sprechfunkausbildung",
            "Digitalfunk",
            "Katastrophenschutz"
        ],
        sameAs: [PROFILE_URL, REPO_URL]
    };
}

/**
 * ProfilePage für /autor/. Der Hauptgegenstand ist die Person selbst – sie
 * steht als eigener Knoten im Graphen, hier wird sie nur referenziert, damit
 * es nicht zwei Fassungen derselben Person gibt.
 */
export function buildProfilePage({ page, title, description, dateModified }) {
    return kompakt({
        "@type": "ProfilePage",
        "@id": nodeId(page.slug, "profile"),
        mainEntityOfPage: { "@id": nodeId(page.slug, "webpage") },
        name: title,
        description,
        inLanguage: "de",
        url: canonicalUrl(page.slug),
        datePublished: page.datePublished,
        dateModified: dateModified ?? undefined,
        mainEntity: { "@id": AUTHOR_ID }
    });
}

export function buildWebSite() {
    return {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: "Sprechfunk Übungsgenerator",
        alternateName: ["BOS-Sprechfunk Übungsgenerator", "Funkübungsgenerator"],
        url: `${SITE_URL}/`,
        inLanguage: "de",
        publisher: { "@id": ORGANIZATION_ID }
    };
}

/** Die Anwendung selbst. Nur auf der Startseite Teil des Graphen. */
export function buildSoftwareApplication() {
    return {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": SOFTWARE_ID,
        name: "Sprechfunk Übungsgenerator",
        alternateName: ["BOS-Sprechfunk Übungsgenerator", "Funkübungsgenerator"],
        applicationCategory: ["EmergencyApplication", "EducationalApplication", "BusinessApplication"],
        applicationSubCategory: "Sprechfunkausbildung",
        operatingSystem: "Web",
        browserRequirements: "Moderner Browser mit aktiviertem JavaScript",
        url: `${SITE_URL}/`,
        inLanguage: "de",
        isAccessibleForFree: true,
        offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock"
        },
        license: "https://spdx.org/licenses/EUPL-1.2.html",
        codeRepository: REPO_URL,
        author: { "@id": AUTHOR_ID },
        publisher: { "@id": ORGANIZATION_ID },
        audience: {
            "@type": "Audience",
            audienceType: "Ausbilder und Übungsleitungen im Bevölkerungs- und Katastrophenschutz "
                + "(THW, Feuerwehr, Rettungsdienst, Hilfsorganisationen)"
        },
        softwareHelp: {
            "@type": "CreativeWork",
            name: "Anleitung",
            url: `${SITE_URL}/anleitung/`
        }
    };
}

export function buildBreadcrumb(page) {
    const eintraege = page.breadcrumb ?? [];
    if (eintraege.length === 0) return null;
    return {
        "@type": "BreadcrumbList",
        "@id": nodeId(page.slug, "breadcrumb"),
        itemListElement: eintraege.map((eintrag, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: eintrag.name,
            // `item` ist auf JEDEM Glied Pflicht – der Rich-Results-Test meldet
            // sonst "Feld item fehlt" und die Navigationspfade gelten als
            // ungültig. Das letzte Glied ist die Seite selbst, deshalb ihre
            // eigene kanonische URL. `url` kommt aus der sichtbaren
            // Brotkrumenleiste, `slug` erlaubt Einträge direkt aus der Registry.
            item: eintrag.url ?? canonicalUrl(eintrag.slug ?? page.slug)
        }))
    };
}

export function buildWebPage({ page, title, description, dateModified }) {
    return kompakt({
        "@type": "WebPage",
        "@id": nodeId(page.slug, "webpage"),
        url: canonicalUrl(page.slug),
        name: title,
        description,
        inLanguage: "de",
        isPartOf: { "@id": WEBSITE_ID },
        breadcrumb: page.breadcrumb?.length ? { "@id": nodeId(page.slug, "breadcrumb") } : undefined,
        primaryImageOfPage: { "@type": "ImageObject", url: OG_IMAGE_URL },
        datePublished: page.datePublished,
        dateModified: dateModified ?? undefined,
        about: thingListe(page.about)
    });
}

function buildArticle({ page, title, description, dateModified }) {
    return kompakt({
        "@type": "Article",
        "@id": nodeId(page.slug, "article"),
        mainEntityOfPage: { "@id": nodeId(page.slug, "webpage") },
        headline: title,
        description,
        inLanguage: "de",
        url: canonicalUrl(page.slug),
        image: OG_IMAGE_URL,
        author: { "@id": AUTHOR_ID },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@id": WEBSITE_ID },
        datePublished: page.datePublished,
        dateModified: dateModified ?? undefined,
        about: thingListe(page.about)
    });
}

export function buildHowTo({ page, description, dateModified }) {
    const howTo = page.howTo;
    if (!howTo) return null;
    return kompakt({
        "@type": "HowTo",
        "@id": nodeId(page.slug, "howto"),
        mainEntityOfPage: { "@id": nodeId(page.slug, "webpage") },
        name: howTo.name,
        description: howTo.description ?? description,
        inLanguage: "de",
        totalTime: howTo.totalTime,
        author: { "@id": AUTHOR_ID },
        publisher: { "@id": ORGANIZATION_ID },
        datePublished: page.datePublished,
        dateModified: dateModified ?? undefined,
        step: howTo.steps.map((schritt, index) => kompakt({
            "@type": "HowToStep",
            position: index + 1,
            name: schritt.name,
            text: schritt.text,
            url: schritt.anchor ? `${canonicalUrl(page.slug)}#${schritt.anchor}` : undefined
        }))
    });
}

/** FAQPage-Knoten aus den Fragen der Registry. Dieselbe Quelle rendert den
 *  sichtbaren Block, siehe renderFaqHtml — deshalb keine unsichtbaren Fragen. */
export function buildFaqPage({ page, dateModified }) {
    const faq = page.faq ?? [];
    if (faq.length === 0) return null;
    return kompakt({
        "@type": "FAQPage",
        "@id": nodeId(page.slug, "faq"),
        inLanguage: "de",
        isPartOf: { "@id": WEBSITE_ID },
        datePublished: page.datePublished,
        dateModified: dateModified ?? undefined,
        mainEntity: faq.map(eintrag => ({
            "@type": "Question",
            name: eintrag.q,
            acceptedAnswer: { "@type": "Answer", text: eintrag.a }
        }))
    });
}

export function buildCollection({ page, title, description }) {
    const eintraege = page.collection ?? [];
    const anzahl = page.collectionAnzahl ?? 0;
    if (eintraege.length === 0 && anzahl === 0) return null;

    // Große Sammlungen (Funkspruch-Archiv, AP-08) nennen nur ihren Umfang.
    // 752 ListItem-Knoten wären ein Vielfaches des Seiteninhalts an Markup,
    // ohne dass ein Auswerter mehr erfährt als aus der sichtbaren Liste –
    // itemListElement ist bei ItemList nicht verlangt.
    const mainEntity = eintraege.length === 0
        ? { "@type": "ItemList", numberOfItems: anzahl }
        : {
            "@type": "ItemList",
            numberOfItems: eintraege.length,
            itemListElement: eintraege.map((eintrag, index) => kompakt({
                "@type": "ListItem",
                position: index + 1,
                name: eintrag.name,
                url: eintrag.slug === undefined ? eintrag.url : canonicalUrl(eintrag.slug)
            }))
        };

    return kompakt({
        "@type": "CollectionPage",
        "@id": nodeId(page.slug, "collection"),
        mainEntityOfPage: { "@id": nodeId(page.slug, "webpage") },
        name: title,
        description,
        inLanguage: "de",
        mainEntity
    });
}

/**
 * DefinedTermSet für Nachschlagetabellen. `terme` kommt aus der sichtbaren
 * Tabelle der Seite (Extraktion im Postbuild), nicht aus einer Zweitquelle.
 */
export function buildDefinedTermSet({ page, terme }) {
    if (!page.definedTerms || !terme || terme.length === 0) return null;
    return {
        "@type": "DefinedTermSet",
        "@id": nodeId(page.slug, "terms"),
        name: page.definedTerms.name,
        inLanguage: "de",
        // Kein inDefinedTermSet je Begriff: die Zugehörigkeit steht bereits durch
        // hasDefinedTerm fest. Bei 32 Begriffen (Buchstabiertafel) sparen die
        // eingesparten Rückverweise rund ein Drittel des JSON-LD-Umfangs.
        hasDefinedTerm: terme.map(term => kompakt({
            "@type": "DefinedTerm",
            name: term.name,
            description: term.description
        }))
    };
}

/** Der seitenspezifische Hauptknoten laut schemaType. */
function buildPrimary(kontext) {
    switch (kontext.page.schemaType) {
        case "Article": return buildArticle(kontext);
        case "HowTo": return buildHowTo(kontext);
        case "FAQPage": return buildFaqPage(kontext);
        case "CollectionPage": return buildCollection(kontext);
        case "ProfilePage": return buildProfilePage(kontext);
        case "WebPage": return null; // WebPage ist bereits Teil jedes Graphen
        default:
            throw new Error(`Unbekannter schemaType "${kontext.page.schemaType}" für Slug "${kontext.page.slug}"`);
    }
}

/**
 * Baut den vollständigen Graphen einer Seite.
 * `dateModified` kommt aus der Git-Historie (Postbuild) und ist bewusst kein
 * Build-Datum — bei flachem Clone lieber weglassen als falsch behaupten.
 */
export function buildGraph({ page, title, description, dateModified = null, terme = [] }) {
    if (!SCHEMA_TYPES.includes(page.schemaType)) {
        throw new Error(`Unbekannter schemaType "${page.schemaType}" für Slug "${page.slug}"`);
    }

    const kontext = { page, title, description, dateModified, terme };
    const knoten = [
        buildOrganization(),
        buildAuthor(),
        buildWebSite(),
        buildWebPage(kontext),
        buildBreadcrumb(page)
    ];

    if (page.software) knoten.push(buildSoftwareApplication());

    const primary = buildPrimary(kontext);
    if (primary) knoten.push(primary);

    // Zusatzknoten, die nicht schon Hauptknoten sind.
    const vorhanden = new Set(knoten.filter(Boolean).map(n => n["@id"]));
    for (const zusatz of [buildFaqPage(kontext), buildHowTo(kontext), buildCollection(kontext), buildDefinedTermSet(kontext)]) {
        if (zusatz && !vorhanden.has(zusatz["@id"])) {
            knoten.push(zusatz);
            vorhanden.add(zusatz["@id"]);
        }
    }

    return { "@context": "https://schema.org", "@graph": knoten.filter(Boolean) };
}

const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, zeichen => ESCAPE[zeichen]);
}

/**
 * Sichtbarer FAQ-Block. Bewusst ohne Accordion/`details`: eingeklappter Text
 * gilt in Prüfwerkzeugen als nicht sichtbar, und die Anforderung lautet, dass
 * jede Frage aus dem JSON-LD wortgleich im sichtbaren Text steht.
 */
export function renderFaqHtml(faq, { heading = "Häufige Fragen" } = {}) {
    if (!faq || faq.length === 0) return "";
    const eintraege = faq.map(eintrag => `                <h3 class="h6 mt-3">${escapeHtml(eintrag.q)}</h3>
                <p class="mb-0">${escapeHtml(eintrag.a)}</p>`).join("\n");

    return `        <section class="card shadow-sm my-4" id="faq" aria-labelledby="faq-titel">
            <div class="card-header"><h2 class="h4 mb-0" id="faq-titel">${escapeHtml(heading)}</h2></div>
            <div class="card-body">
${eintraege}
            </div>
        </section>
`;
}
