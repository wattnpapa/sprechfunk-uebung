import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalUrl, SITE_PAGES, SITE_URL } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reine JS-Hilfsmodule ohne Typdeklarationen, absichtlich .mjs
import { renderPageWithStructuredData, sichtbarerText } from "../../scripts/lib/render-page.mjs";

const ROOT = path.resolve(__dirname, "..", "..");
// Fester Wert, damit die Erwartungen nicht von der Git-Historie abhängen.
const DATE_MODIFIED = "2026-08-01";
const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

interface Knoten { [key: string]: unknown }

function quelleLesen(source: string): string {
    return readFileSync(path.join(ROOT, "src", source), "utf8");
}

function graphFuer(page: { source: string }) {
    return renderPageWithStructuredData({
        page,
        html: quelleLesen(page.source),
        dateModified: DATE_MODIFIED
    });
}

/**
 * Pflichtfelder je Knotentyp. Bewusst als Datenstruktur, damit ein neuer Typ
 * nicht unbemerkt ohne Prüfung durchrutscht.
 */
const SCHEMA: Record<string, { pflicht: string[] }> = {
    Organization: { pflicht: ["@id", "name", "url", "logo", "sameAs"] },
    Person: { pflicht: ["@id", "name", "url"] },
    WebSite: { pflicht: ["@id", "name", "url", "inLanguage", "publisher"] },
    WebPage: { pflicht: ["@id", "url", "name", "description", "inLanguage", "isPartOf", "datePublished"] },
    BreadcrumbList: { pflicht: ["@id", "itemListElement"] },
    Article: { pflicht: ["@id", "headline", "description", "url", "author", "publisher", "datePublished", "mainEntityOfPage"] },
    HowTo: { pflicht: ["@id", "name", "step", "mainEntityOfPage"] },
    FAQPage: { pflicht: ["@id", "mainEntity"] },
    CollectionPage: { pflicht: ["@id", "name", "mainEntity", "mainEntityOfPage"] },
    DefinedTermSet: { pflicht: ["@id", "name", "hasDefinedTerm"] },
    SoftwareApplication: { pflicht: ["@id", "name", "applicationCategory", "operatingSystem", "offers", "license"] }
};

function typVon(knoten: Knoten): string {
    const typ = knoten["@type"];
    return Array.isArray(typ) ? String(typ[0]) : String(typ);
}

/** Sammelt alle @id-Referenzen ({"@id": "..."} ohne weitere Felder) rekursiv ein. */
function referenzen(wert: unknown, treffer: string[] = []): string[] {
    if (Array.isArray(wert)) {
        for (const eintrag of wert) referenzen(eintrag, treffer);
        return treffer;
    }
    if (wert !== null && typeof wert === "object") {
        const objekt = wert as Knoten;
        const schluessel = Object.keys(objekt);
        if (schluessel.length === 1 && schluessel[0] === "@id") {
            treffer.push(String(objekt["@id"]));
            return treffer;
        }
        for (const [name, inhalt] of Object.entries(objekt)) {
            if (name === "@id") continue;
            referenzen(inhalt, treffer);
        }
    }
    return treffer;
}

function alleSchluessel(wert: unknown, treffer: string[] = []): string[] {
    if (Array.isArray(wert)) {
        for (const eintrag of wert) alleSchluessel(eintrag, treffer);
        return treffer;
    }
    if (wert !== null && typeof wert === "object") {
        for (const [name, inhalt] of Object.entries(wert as Knoten)) {
            treffer.push(name);
            alleSchluessel(inhalt, treffer);
        }
    }
    return treffer;
}

describe("Schema-Graph je Seite", () => {
    it("die Registry deckt alle 29 ausgelieferten URLs ab", () => {
        expect(SITE_PAGES).toHaveLength(29);
    });

    for (const page of SITE_PAGES) {
        const label = page.slug === "" ? "/" : `/${page.slug}/`;

        describe(label, () => {
            const { graph, faq, html } = graphFuer(page);
            const knoten = graph["@graph"] as Knoten[];

            it("hat einen @context und einen nicht leeren @graph", () => {
                expect(graph["@context"]).toBe("https://schema.org");
                expect(Array.isArray(knoten)).toBe(true);
                expect(knoten.length).toBeGreaterThan(0);
            });

            it("enthält Organization, WebSite und WebPage", () => {
                const typen = knoten.map(typVon);
                expect(typen).toContain("Organization");
                expect(typen).toContain("WebSite");
                expect(typen).toContain("WebPage");
            });

            it("erfüllt für jeden Knoten die Pflichtfelder seines Typs", () => {
                for (const eintrag of knoten) {
                    const typ = typVon(eintrag);
                    const regel = SCHEMA[typ];
                    expect(regel, `Unbekannter Knotentyp "${typ}" – Schema ergänzen`).toBeDefined();
                    for (const feld of regel.pflicht) {
                        expect(eintrag[feld], `${typ}.${feld} fehlt auf ${label}`).toBeDefined();
                    }
                }
            });

            it("vergibt eindeutige, absolute @id je Knoten", () => {
                const ids = knoten.map(eintrag => String(eintrag["@id"]));
                expect(new Set(ids).size).toBe(ids.length);
                for (const id of ids) {
                    expect(id.startsWith(SITE_URL), `@id nicht absolut: ${id}`).toBe(true);
                    expect(id).toContain("#");
                }
            });

            it("löst jede @id-Referenz innerhalb des Graphen auf", () => {
                const vorhanden = new Set(knoten.map(eintrag => String(eintrag["@id"])));
                for (const referenz of referenzen(knoten)) {
                    expect(vorhanden.has(referenz), `Referenz ohne Knoten: ${referenz} auf ${label}`).toBe(true);
                }
            });

            it("verweist mit der WebPage auf die kanonische URL", () => {
                const webPage = knoten.find(eintrag => typVon(eintrag) === "WebPage")!;
                expect(webPage.url).toBe(canonicalUrl(page.slug));
                expect(webPage["@id"]).toBe(`${canonicalUrl(page.slug)}#webpage`);
            });

            it("nutzt ISO-Daten und ein fixes datePublished", () => {
                for (const eintrag of knoten) {
                    for (const feld of ["datePublished", "dateModified"]) {
                        if (eintrag[feld] === undefined) continue;
                        expect(String(eintrag[feld]), `${feld} nicht ISO`).toMatch(ISO_DATUM);
                    }
                }
                const webPage = knoten.find(eintrag => typVon(eintrag) === "WebPage")!;
                expect(webPage.datePublished).toBe(page.datePublished);
                expect(webPage.dateModified).toBe(DATE_MODIFIED);
            });

            it("führt keine erfundenen Bewertungen", () => {
                // aggregateRating/review ohne sichtbare Bewertungen verstößt gegen
                // die Richtlinien für strukturierte Daten.
                const schluessel = alleSchluessel(knoten);
                expect(schluessel).not.toContain("aggregateRating");
                expect(schluessel).not.toContain("review");
                expect(schluessel).not.toContain("ratingValue");
            });

            if (page.slug !== "") {
                it("hat eine BreadcrumbList mit item auf jedem Glied", () => {
                    const crumb = knoten.find(eintrag => typVon(eintrag) === "BreadcrumbList");
                    expect(crumb, `BreadcrumbList fehlt auf ${label}`).toBeDefined();
                    const glieder = crumb!.itemListElement as Knoten[];
                    expect(glieder.length).toBeGreaterThanOrEqual(2);
                    expect(glieder[0].name).toBe("Startseite");
                    expect(glieder[0].item).toBe(`${SITE_URL}/`);

                    glieder.forEach((glied, index) => {
                        expect(glied.position).toBe(index + 1);
                        // Der Rich-Results-Test verlangt `item` auf jedem Glied;
                        // fehlt es, sind die Navigationspfade ungültig.
                        expect(glied.item, `item fehlt auf Glied ${index + 1} von ${label}`).toBeDefined();
                        expect(String(glied.item)).toMatch(new RegExp(`^${SITE_URL}/`));
                        expect(String(glied.name).length).toBeGreaterThan(0);
                    });

                    // Das letzte Glied ist die Seite selbst.
                    expect(glieder[glieder.length - 1].item).toBe(canonicalUrl(page.slug));
                });
            }

            if (faq.length > 0) {
                it("bildet jede Frage als Question mit acceptedAnswer ab", () => {
                    const faqKnoten = knoten.find(eintrag => typVon(eintrag) === "FAQPage")!;
                    const fragen = faqKnoten.mainEntity as Knoten[];
                    expect(fragen).toHaveLength(faq.length);
                    for (const frage of fragen) {
                        expect(frage["@type"]).toBe("Question");
                        expect(String(frage.name).length).toBeGreaterThan(0);
                        const antwort = frage.acceptedAnswer as Knoten;
                        expect(antwort["@type"]).toBe("Answer");
                        expect(String(antwort.text).length).toBeGreaterThan(0);
                    }
                });

                it("hat mindestens drei und höchstens sechs Fragen", () => {
                    expect(faq.length).toBeGreaterThanOrEqual(3);
                    // /faq/ ist die dedizierte FAQ-Seite und darf mehr haben.
                    if (page.slug !== "faq") {
                        expect(faq.length).toBeLessThanOrEqual(6);
                    }
                });

                it("nennt jede Frage wortgleich im sichtbaren Text", () => {
                    const sichtbar = sichtbarerText(html);
                    for (const eintrag of faq) {
                        expect(sichtbar, `Frage nicht sichtbar auf ${label}: "${eintrag.q}"`)
                            .toContain(eintrag.q);
                    }
                });

                it("nennt jede Antwort wortgleich im sichtbaren Text", () => {
                    const sichtbar = sichtbarerText(html);
                    for (const eintrag of faq) {
                        expect(sichtbar, `Antwort nicht sichtbar auf ${label}: "${eintrag.a}"`)
                            .toContain(eintrag.a);
                    }
                });
            }

            if (page.howTo) {
                it("bildet die Schritte als HowToStep mit Position ab", () => {
                    const howTo = knoten.find(eintrag => typVon(eintrag) === "HowTo")!;
                    const schritte = howTo.step as Knoten[];
                    expect(schritte).toHaveLength(page.howTo.steps.length);
                    schritte.forEach((schritt, index) => {
                        expect(schritt["@type"]).toBe("HowToStep");
                        expect(schritt.position).toBe(index + 1);
                        expect(String(schritt.text).length).toBeGreaterThan(0);
                    });
                });
            }

            if (page.definedTerms) {
                it("liest die Nachschlagebegriffe aus der sichtbaren Tabelle", () => {
                    const set = knoten.find(eintrag => typVon(eintrag) === "DefinedTermSet")!;
                    const begriffe = set.hasDefinedTerm as Knoten[];
                    expect(begriffe.length).toBeGreaterThan(0);
                    const sichtbar = sichtbarerText(html);
                    for (const begriff of begriffe) {
                        expect(begriff["@type"]).toBe("DefinedTerm");
                        expect(sichtbar, `Begriff nicht sichtbar: ${begriff.name}`)
                            .toContain(String(begriff.description));
                    }
                });
            }
        });
    }
});

describe("HowTo nur bei sichtbarer Schrittfolge", () => {
    // Der Befund verlangt HowTo unter anderem für /regiebuch-funkuebung/,
    // /digitale-funkuebung/ und die Startseite – dort steht aber keine
    // nummerierte Schrittfolge sichtbar auf der Seite. Die Bedingung des
    // Arbeitspakets hat Vorrang; dieser Test hält den Zustand fest.
    for (const slug of ["", "regiebuch-funkuebung", "digitale-funkuebung"]) {
        it(`vergibt kein HowTo für "${slug || "/"}"`, () => {
            const page = SITE_PAGES.find(eintrag => eintrag.slug === slug)!;
            expect(page.howTo).toBeUndefined();
            const { graph } = graphFuer(page);
            const typen = (graph["@graph"] as Knoten[]).map(typVon);
            expect(typen).not.toContain("HowTo");
        });
    }

    for (const slug of ["anleitung", "funkuebung-planen", "funkuebung-dienstabend"]) {
        it(`vergibt HowTo für "/${slug}/"`, () => {
            const page = SITE_PAGES.find(eintrag => eintrag.slug === slug)!;
            const { graph } = graphFuer(page);
            const typen = (graph["@graph"] as Knoten[]).map(typVon);
            expect(typen).toContain("HowTo");
        });
    }
});

describe("Zusicherungen des Generators", () => {
    const minimal = (rumpf: string) =>
        `<html><head><title>T</title><meta name="description" content="D"></head><body><main>${rumpf}</main></body></html>`;

    const seite = { slug: "test", source: "pages/test.html", schemaType: "Article", datePublished: "2026-01-01" };

    it("wirft ohne <title>", () => {
        expect(() => renderPageWithStructuredData({
            page: seite,
            html: '<html><head><meta name="description" content="D"></head><body><main></main></body></html>'
        })).toThrow(/title/i);
    });

    it("wirft ohne meta description", () => {
        expect(() => renderPageWithStructuredData({
            page: seite,
            html: "<html><head><title>T</title></head><body><main></main></body></html>"
        })).toThrow(/description/i);
    });

    it("wirft bei unbekanntem schemaType", () => {
        expect(() => renderPageWithStructuredData({
            page: { ...seite, schemaType: "Erfunden" },
            html: minimal("")
        })).toThrow(/schemaType/);
    });

    it("wirft, wenn faqFromPage gesetzt ist, die Seite aber keine Fragen zeigt", () => {
        expect(() => renderPageWithStructuredData({
            page: { ...seite, schemaType: "FAQPage", faqFromPage: true },
            html: minimal("<p>ohne Fragen</p>")
        })).toThrow(/keine sichtbaren Fragen/);
    });

    it("wirft, wenn kein Platzhalter und kein </main> für den FAQ-Block existiert", () => {
        expect(() => renderPageWithStructuredData({
            page: { ...seite, faq: [{ q: "Frage?", a: "Antwort." }] },
            html: '<html><head><title>T</title><meta name="description" content="D"></head><body></body></html>'
        })).toThrow(/weder .* noch <\/main>/);
    });

    it("setzt den FAQ-Block vor </main> ein und macht die Fragen sichtbar", () => {
        const { html, graph } = renderPageWithStructuredData({
            page: { ...seite, faq: [{ q: "Wie geht das?", a: "So geht das." }] },
            html: minimal("<p>Inhalt</p>")
        });
        expect(html).toContain('id="faq"');
        expect(sichtbarerText(html)).toContain("Wie geht das?");
        const typen = (graph["@graph"] as Knoten[]).map(typVon);
        expect(typen).toContain("FAQPage");
    });

    it("maskiert HTML in Fragen und Antworten", () => {
        const { html } = renderPageWithStructuredData({
            page: { ...seite, faq: [{ q: "Was ist <b>fett</b>?", a: "Ein & Zeichen." }] },
            html: minimal("")
        });
        expect(html).toContain("&lt;b&gt;");
        expect(html).toContain("&amp;");
    });

    it("lässt dateModified weg, wenn keines übergeben wird", () => {
        const { graph } = renderPageWithStructuredData({ page: seite, html: minimal("") });
        for (const knoten of graph["@graph"] as Knoten[]) {
            expect(knoten.dateModified).toBeUndefined();
        }
    });
});

describe("kein handgeschriebenes JSON-LD in den Quelldateien", () => {
    for (const page of SITE_PAGES) {
        it(`${page.source} enthält kein ld+json`, () => {
            expect(quelleLesen(page.source)).not.toContain("application/ld+json");
        });
    }
});
