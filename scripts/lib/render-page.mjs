// Zusammenbau einer ausgelieferten Seite: sichtbarer FAQ-Block plus generiertes
// JSON-LD (AP-02).
//
// Bewusst ohne Datei- und Git-Zugriff: `dateModified` gibt der Aufrufer herein.
// Damit prüft der Vitest-Test genau den Code, der auch den Build erzeugt – eine
// zweite Nachbildung im Test würde irgendwann auseinanderlaufen.

import { HUB_CATEGORIES, HUB_SLUG, SITE_PAGES, SITE_URL } from "../site-pages.mjs";
import { ogUrl } from "./og-bilder.mjs";
import { hatDiagramm, renderDiagramm } from "./diagramme.mjs";
import { deutschesDatum, nurDatum } from "./lastmod.mjs";
import { buildGraph, escapeHtml, renderFaqHtml } from "./schema-graph.mjs";
import {
    FILTER_SKRIPT,
    LISTE_PLATZHALTER,
    VORLAGEN_PLATZHALTER,
    renderFilter,
    renderFunkspruchListe,
    renderVorlagenTabelle
} from "./funkspruch-seiten.mjs";
import { deutscheZahl } from "./funkspruch-daten.mjs";
import {
    relativerPfad,
    breadcrumbFuer,
    renderBreadcrumb,
    renderFooter,
    renderHauptnavigation,
    renderHubKategorie,
    renderWeiterlesen,
    renderWissenSidebar
} from "./navigation.mjs";
import {
    slugFuerUeberschrift,
    lesezeitMinuten,
    zaehleWoerter,
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
    page, html: quelle, dateModified = null, beschreibungen = {}, alleSeiten = SITE_PAGES,
    bestand = null
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
    html = ersetzeBestandszahlen(html, bestand);
    html = setzeOgBild(html, page, title);
    html = setzeHauptnavigation(html, page);
    html = ersetzeBreadcrumb(html, page);
    html = ersetzeFooter(html, page);
    html = setzeHubKarten(html, page, beschreibungen);
    // Vor den Einleitungsblöcken: das Inhaltsverzeichnis zählt die Abschnitte
    // der fertigen Seite, und die Liste bringt keine eigene h2 mit.
    html = setzeFunkspruchInhalte(html, page, bestand);

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

    // Umfang der Sammlung für Archivseiten: die Zahl steht im ItemList-Knoten,
    // die Einträge selbst bleiben im sichtbaren HTML (AP-08).
    const collectionAnzahl = page.archivVorlage && bestand
        ? (bestand.nachVorlage.get(page.archivVorlage) ?? []).length
        : undefined;

    const graph = buildGraph({
        page: { ...page, breadcrumb, faq, collectionAnzahl },
        title,
        description,
        dateModified,
        terme
    });

    // Erst IDs vergeben, dann das Verzeichnis daraus bauen – sonst verweist es
    // auf Anker, die es noch nicht gibt.
    html = ergaenzeUeberschriftIds(html);
    html = setzeEinleitungsbloecke(html, page);

    // Nach dem FAQ-Block, damit "Weiterlesen" der letzte Abschnitt vor dem
    // Footer ist – und vor der Seitenleiste, die </main> verschiebt.
    html = setzeDiagramm(html, page);
    html = setzeWeiterlesen(html, page, alleSeiten, beschreibungen);
    html = setzeWissenSidebar(html, page);
    html = setzeArtikelZeitstempel(html, page, dateModified);
    html = setzeSichtbaresDatum(html, dateModified, page);
    html = ersetzeJsonLd(html, graph);
    pruefeFaqSichtbar(page, faq, html);
    return { html, graph, faq, terme, title, description, breadcrumb };
}


/**
 * Setzt das Diagramm der Seite ein (AP-10).
 *
 * Platz ist direkt hinter Inhaltsverzeichnis bzw. „Kurz gesagt“ – also über dem
 * ersten Fachabschnitt. Damit steht es im sichtbaren Bereich, ohne die
 * Einleitung vom Titel zu trennen.
 *
 * Inline-SVG statt <img>: kein zusätzlicher Request, skaliert verlustfrei, und
 * über currentColor folgt es dem Dunkelmodus. width und height stehen im SVG,
 * damit kein Layout Shift entsteht.
 */
export function setzeDiagramm(html, page) {
    if (page.slug === undefined || page.slug === "" || page.inSitemap === false) return html;
    if (!hatDiagramm(page.slug)) return html;

    const figur = renderDiagramm(page.slug);

    const tocEnde = html.indexOf('data-testid="inhaltsverzeichnis"');
    if (tocEnde >= 0) {
        const rest = html.slice(tocEnde);
        const treffer = /<\/nav>\n?/.exec(rest);
        if (treffer) {
            const pos = tocEnde + treffer.index + treffer[0].length;
            return `${html.slice(0, pos)}${figur}\n${html.slice(pos)}`;
        }
    }

    const kurzEnde = html.indexOf('data-testid="kurz-gesagt"');
    if (kurzEnde >= 0) {
        const rest = html.slice(kurzEnde);
        const treffer = /<\/section>\n?/.exec(rest);
        if (treffer) {
            const pos = kurzEnde + treffer.index + treffer[0].length;
            return `${html.slice(0, pos)}${figur}\n${html.slice(pos)}`;
        }
    }

    // Letzter Rückfall: vor den ersten Kartenblock nach der h1.
    const h1 = html.search(/<h1[\s>]/i);
    if (h1 < 0) return html;
    const anker = /<(?:section|div)\s+class="[^"]*card[^"]*"/gi;
    anker.lastIndex = h1;
    const treffer = anker.exec(html);
    if (!treffer) return html;
    return `${html.slice(0, treffer.index)}${figur}\n${html.slice(treffer.index)}`;
}

/**
 * Setzt das seitenindividuelle Social-Preview-Bild (AP-10).
 *
 * Vorher teilten sich alle Seiten ein Bild; in Chat- und Netzwerkvorschauen war
 * damit nicht erkennbar, welche Seite geteilt wurde. Die Quelldateien tragen
 * weiter einen Platzhalterpfad – maßgeblich ist, was hier eingesetzt wird, damit
 * Dateiname und Tag garantiert aus derselben Ableitung stammen.
 *
 * `og:image:alt` bekommt den Seitentitel: er beschreibt, was im Bild steht,
 * denn das Bild zeigt genau diesen Titel.
 */
export function setzeOgBild(html, page, titel) {
    const url = ogUrl(page.slug ?? "", SITE_URL);
    const alt = escapeHtml(String(titel ?? "").replace(/\s*\|\s*Sprechfunk Übungsgenerator\s*$/, ""));

    let ergebnis = html
        .replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${url}$2`)
        .replace(/(<meta name="twitter:image" content=")[^"]*(">)/, `$1${url}$2`)
        .replace(/(<meta property="og:image:alt" content=")[^"]*(">)/, `$1${alt}$2`);

    // Rechtstexte tragen im Quelltext gar keine og-Bildtags. Ohne diesen Zweig
    // hätten genau sie keine Vorschau – und der Ersetzungsversuch oben liefe
    // stillschweigend ins Leere.
    if (!/<meta property="og:image"/.test(ergebnis)) {
        if (!ergebnis.includes("</head>")) {
            throw new Error(`Seite "${page.slug || "/"}": kein </head> für die Bildtags.`);
        }
        return ergebnis.replace("</head>", `${[
            `    <meta property="og:image" content="${url}">`,
            '    <meta property="og:image:width" content="1200">',
            '    <meta property="og:image:height" content="630">',
            `    <meta property="og:image:alt" content="${alt}">`,
            `    <meta name="twitter:image" content="${url}">`
        ].join("\n")}\n</head>`);
    }

    // Einzelne fehlende Tags ergänzen. Die Rechtstexte haben og:image, aber
    // kein twitter:image – ein Zweig, der nur beim Fehlen aller Tags greift,
    // hätte genau sie übersehen.
    const ergaenze = (marke, zeile) => {
        if (new RegExp(marke).test(ergebnis)) return;
        ergebnis = ergebnis.replace(
            /(<meta property="og:image" content="[^"]*">)/,
            `$1\n${zeile}`
        );
    };
    ergaenze('<meta property="og:image:alt"', `    <meta property="og:image:alt" content="${alt}">`);
    ergaenze('<meta name="twitter:image"', `    <meta name="twitter:image" content="${url}">`);
    return ergebnis;
}

/**
 * Setzt die Bestandszahlen in den Fließtext ein (AP-08, Punkt 5).
 *
 * Die Zahl steht an rund einem Dutzend Stellen auf der Domain. Als Platzhalter
 * im Quelltext gepflegt kann sie nicht auseinanderlaufen: sie stammt immer aus
 * dem gezählten Bestand. Ein unaufgelöster Platzhalter bricht den Build – eine
 * ausgelieferte Seite mit „{{FUNKSPRUECHE_GESAMT}} Funksprüche“ wäre schlimmer
 * als eine veraltete Zahl.
 */
export const BESTAND_PLATZHALTER = {
    "{{FUNKSPRUECHE_GESAMT}}": bestand => deutscheZahl(bestand.anzahlGesamt),
    "{{FUNKSPRUECHE_ARCHIV}}": bestand => deutscheZahl(bestand.anzahlArchiv)
};

export function ersetzeBestandszahlen(html, bestand) {
    let ergebnis = html;
    for (const [platzhalter, wert] of Object.entries(BESTAND_PLATZHALTER)) {
        if (!ergebnis.includes(platzhalter)) continue;
        if (!bestand) {
            throw new Error(`Platzhalter ${platzhalter} gefunden, aber kein Bestand übergeben.`);
        }
        ergebnis = ergebnis.replaceAll(platzhalter, wert(bestand));
    }
    return ergebnis;
}

/**
 * Setzt Funkspruch-Liste, Filter und Vorlagen-Übersicht ein (AP-08).
 *
 * Der Bestand kommt als Argument herein, damit diese Datei ohne Dateizugriff
 * bleibt. Fehlt er, während eine Seite ihn braucht, wirft die Funktion: eine
 * Archivseite mit leerem Platzhalter wäre eine ausgelieferte, leere Seite.
 */
export function setzeFunkspruchInhalte(html, page, bestand) {
    const brauchtListe = html.includes(LISTE_PLATZHALTER);
    const brauchtTabelle = html.includes(VORLAGEN_PLATZHALTER);
    if (!brauchtListe && !brauchtTabelle) return html;

    if (!bestand) {
        throw new Error(`Seite "${page.slug}": Funkspruch-Bestand fehlt, Platzhalter nicht auflösbar.`);
    }

    let ergebnis = html;

    if (brauchtTabelle) {
        ergebnis = ergebnis.replace(VORLAGEN_PLATZHALTER, renderVorlagenTabelle(bestand, page.slug));
    }

    if (brauchtListe) {
        const eintraege = bestand.nachVorlage.get(page.archivVorlage);
        if (!eintraege || eintraege.length === 0) {
            throw new Error(`Seite "${page.slug}": keine Funksprüche für Vorlage "${page.archivVorlage}".`);
        }
        ergebnis = ergebnis.replace(
            LISTE_PLATZHALTER,
            `${renderFilter(eintraege)}\n${renderFunkspruchListe(eintraege)}`
        );
        if (!ergebnis.includes("</body>")) {
            throw new Error(`Seite "${page.slug}": kein </body> für das Filterskript gefunden.`);
        }
        ergebnis = ergebnis.replace("</body>", `${FILTER_SKRIPT}</body>`);
    }

    return ergebnis;
}

/** Grenze, ab der eine Seite ein Inhaltsverzeichnis bekommt (AP-06). */
export const TOC_AB_H2 = 4;

/** Bereiche, deren Überschriften nicht zum redaktionellen Inhalt gehören. */
const GENERIERTE_ABSCHNITTE = [
    /<footer[\s\S]*?<\/footer>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<section[^>]*data-testid="weiterlesen"[\s\S]*?<\/section>/gi
];

/** Nur der redaktionelle Teil einer Seite, ohne generierte Blöcke. */
function redaktionellerTeil(html) {
    const main = (html.match(/<main[\s\S]*?<\/main>/i) ?? [""])[0];
    let rest = main;
    for (const muster of GENERIERTE_ABSCHNITTE) rest = rest.replace(muster, " ");
    return rest;
}

/**
 * Gibt jeder redaktionellen h2 ohne id eine stabile id (AP-06).
 * Ohne Anker lässt sich kein Inhaltsverzeichnis bauen und niemand kann auf
 * einen Abschnitt verlinken.
 */
export function ergaenzeUeberschriftIds(html) {
    const belegt = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(treffer => treffer[1]));

    return html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (ganz, attribute, inhalt) => {
        if (/\bid=/.test(attribute)) return ganz;
        let id = slugFuerUeberschrift(inhalt);
        let zaehler = 2;
        while (belegt.has(id)) id = `${slugFuerUeberschrift(inhalt)}-${zaehler++}`;
        belegt.add(id);
        return `<h2${attribute} id="${id}">${inhalt}</h2>`;
    });
}

/** Baut das Inhaltsverzeichnis, sobald es mehr als TOC_AB_H2 Abschnitte gibt. */
export function baueInhaltsverzeichnis(html) {
    const abschnitte = [...redaktionellerTeil(html).matchAll(/<h2[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/gi)]
        .map(treffer => ({ id: treffer[1], titel: plainText(treffer[2]) }))
        // FAQ, Weiterlesen und das Verzeichnis selbst sind eigene Blöcke.
        .filter(eintrag => !["faq-titel", "weiterlesen-titel", "inhalt-titel"].includes(eintrag.id));

    if (abschnitte.length <= TOC_AB_H2) return "";

    const eintraege = abschnitte.map(eintrag =>
        `                <li><a href="#${eintrag.id}">${escapeHtml(eintrag.titel)}</a></li>`).join("\n");

    return `        <nav class="card shadow-sm my-4" id="inhalt" aria-labelledby="inhalt-titel" data-testid="inhaltsverzeichnis">
            <div class="card-header"><h2 class="h5 mb-0" id="inhalt-titel">Inhalt</h2></div>
            <div class="card-body">
                <ol class="mb-0">
${eintraege}
                </ol>
            </div>
        </nav>
`;
}

/** „Kurz gesagt“: beantwortet die Suchanfrage in drei bis vier Sätzen (AP-06). */
export function baueKurzGesagt(page) {
    if (!page.kurzGesagt) return "";
    return `        <section class="card shadow-sm my-4" id="kurz-gesagt" aria-labelledby="kurz-gesagt-titel" data-testid="kurz-gesagt">
            <div class="card-header"><h2 class="h5 mb-0" id="kurz-gesagt-titel">Kurz gesagt</h2></div>
            <div class="card-body">
                <p class="mb-0">${escapeHtml(page.kurzGesagt)}</p>
            </div>
        </section>
`;
}

/**
 * Setzt „Kurz gesagt“ und Inhaltsverzeichnis zwischen Einleitung und Hauptteil.
 *
 * Anker ist der erste Kartenblock nach der h1 – die Seiten nutzen teils
 * <section class="card">, teils <div class="card mb-3">. Ein Anker auf
 * </section> allein hätte sieben Seiten übersprungen.
 */
export function setzeEinleitungsbloecke(html, page) {
    const bloecke = baueKurzGesagt(page) + baueInhaltsverzeichnis(html);
    if (bloecke === "") return html;

    const h1 = html.search(/<h1[\s>]/i);
    if (h1 < 0) return html;

    const anker = /<(?:section|div)\s+class="[^"]*card[^"]*"/gi;
    anker.lastIndex = h1;
    const treffer = anker.exec(html);
    if (!treffer) return html;

    return `${html.slice(0, treffer.index)}${bloecke}${html.slice(treffer.index)}`;
}

/**
 * Setzt den Weiterlesen-Block als letzten Abschnitt vor dem Footer (AP-05).
 * Startseite und Rechtstexte bekommen keinen: die SPA-Hülle hat kein
 * redaktionelles Ende, und Rechtstexte sind keine Lesestrecke.
 */
export function setzeWeiterlesen(html, page, alleSeiten, beschreibungen) {
    if (page.slug === "" || page.inSitemap === false) return html;

    const block = renderWeiterlesen(page, alleSeiten, beschreibungen);
    if (block === "") return html;
    if (!html.includes("</main>")) {
        throw new Error(`Seite "${page.slug}": kein </main> für den Weiterlesen-Block gefunden.`);
    }
    return html.replace("</main>", `${block}</main>`);
}

/**
 * Stellt die Themen-Seitenleiste neben den Inhalt (Wissensbereich).
 *
 * Betroffen sind der Hub und alle Seiten mit hubCategory. Dafür wird das
 * vorhandene <main> in ein Grid gehüllt: die Klasse `container` wandert vom
 * <main> auf den Wrapper, sonst entstünden zwei verschachtelte Container mit
 * doppeltem Innenabstand.
 */
export function setzeWissenSidebar(html, page) {
    const imWissensbereich = page.slug === HUB_SLUG || page.hubCategory !== undefined;
    if (!imWissensbereich) return html;

    const mainStart = /<main([^>]*)class="([^"]*)"([^>]*)>/i;
    const treffer = mainStart.exec(html);
    if (!treffer) {
        throw new Error(`Seite "${page.slug}": kein <main> mit class für die Seitenleiste gefunden.`);
    }
    if (!html.includes("</main>")) {
        throw new Error(`Seite "${page.slug}": kein </main> für die Seitenleiste gefunden.`);
    }

    const klassen = treffer[2].split(/\s+/).filter(Boolean);
    const hatContainer = klassen.includes("container");
    const mainKlassen = klassen.filter(klasse => klasse !== "container").join(" ");

    const wrapperKlassen = ["wissen-layout", hatContainer ? "container" : null]
        .filter(Boolean).join(" ");

    const neuesMain = `<div class="${wrapperKlassen}">\n${renderWissenSidebar(page.slug)}`
        + `    <main${treffer[1]}class="${mainKlassen} wissen-inhalt"${treffer[3]}>`;

    return html
        .replace(mainStart, neuesMain)
        .replace(/<\/main>/, "</main>\n</div>");
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
export function setzeSichtbaresDatum(html, dateModified, page = {}) {
    if (!BREADCRUMB_ENDE.test(html)) return html;

    const teile = [];
    if (dateModified) {
        teile.push(`Aktualisiert am <time datetime="${escapeHtml(nurDatum(dateModified))}">`
            + `${escapeHtml(deutschesDatum(dateModified))}</time>`);
    }

    // Lesezeit aus dem redaktionellen Text, nicht aus der ganzen Seite:
    // Navigation, Footer und Seitenleiste liest niemand mit.
    const woerter = zaehleWoerter(sichtbarerText(redaktionellerTeil(html)));
    if (woerter > 0) teile.push(`Lesezeit ca. ${lesezeitMinuten(woerter)} Minuten`);

    // Autorenangabe verweist bis AP-11 auf das Impressum; dort steht der Autor.
    if (page.slug !== undefined && page.inSitemap !== false) {
        const impressum = relativerPfad(page.slug ?? "", "impressum");
        teile.push(`von <a href="${impressum}">Johannes Rudolph</a>, `
            + "Bereichsausbilder Sprechfunk (THW)");
    }

    if (teile.length === 0) return html;
    const zeile = `\n    <p class="container text-body-secondary small mt-2 mb-0" data-testid="aktualisiert-am">`
        + `${teile.join(" · ")}</p>`;
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
