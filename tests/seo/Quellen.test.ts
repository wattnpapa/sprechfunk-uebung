// AP-11: Quellenangaben müssen belegt sein, nicht plausibel klingen.
//
// Der Test prüft nicht, ob eine Quelle „gut" ist – das kann er nicht. Er prüft
// das, was maschinell falsifizierbar ist: dass jede auf einer Seite genannte
// Fundstelle im Register steht und dort als am Dokument geprüft markiert ist.
// Eine erfundene Abschnittsnummer fällt damit auf, bevor sie online geht.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SITE_PAGES } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reine JS-Hilfsmodule ohne Typdeklarationen, absichtlich .mjs
import { PRUEFDATUM, QUELLEN, QUELLEN_SEITEN, SEITEN_QUELLEN, hatQuellen, renderQuellenAbschnitt } from "../../scripts/lib/quellen.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { renderPageWithStructuredData } from "../../scripts/lib/render-page.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { BESTAND } from "../../scripts/lib/funkspruch-bestand.mjs";

const ROOT = path.resolve(__dirname, "..", "..");

interface Seite { slug: string; source: string; inSitemap?: boolean }
const alleSeiten = SITE_PAGES as Seite[];
const inhaltsseiten = alleSeiten.filter(seite => seite.slug !== "" && seite.inSitemap !== false);

const quelle = (seite: Seite): string =>
    readFileSync(path.join(ROOT, "src", seite.source), "utf8");

const rendere = (seite: Seite): string => renderPageWithStructuredData({
    page: seite,
    html: quelle(seite),
    dateModified: "2026-08-04",
    bestand: BESTAND
}).html;

/**
 * Sichtbarer Text ohne Markup und ohne HTML-Kommentare (dort stehen Belege).
 *
 * Die Skript-Regex trägt `i` und lässt Attribute im schließenden Tag zu:
 * Browser akzeptieren `</SCRIPT foo="bar">`, und eine Regex, die das übersieht,
 * ist der klassische Fehler beim Filtern von HTML (CodeQL js/bad-tag-filter).
 * Hier laufen zwar nur eigene Seiten durch, aber ein Muster, das anderswo
 * kopiert wird, sollte nicht das kaputte sein.
 */
const text = (html: string): string => html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

describe("Quellenregister", () => {
    it("kennt nur Seiten, die es auch gibt", () => {
        const slugs = new Set(alleSeiten.map(seite => seite.slug));
        for (const slug of QUELLEN_SEITEN as string[]) {
            expect(slugs.has(slug), `Quellen für unbekannten Slug "${slug}"`).toBe(true);
        }
    });

    it("verweist nur auf Abschnitte, die am Dokument gelesen wurden", () => {
        for (const [slug, eintrag] of Object.entries(SEITEN_QUELLEN as Record<string, {
            quellen: { id: string; abschnitte?: string[] }[];
        }>)) {
            for (const bezug of eintrag.quellen) {
                const dokument = (QUELLEN as Record<string, { abschnitte?: Record<string, string> }>)[bezug.id];
                expect(dokument, `Unbekannte Quelle "${bezug.id}" bei ${slug}`).toBeDefined();
                for (const nummer of bezug.abschnitte ?? []) {
                    expect(
                        dokument.abschnitte?.[nummer],
                        `${slug} zitiert Abschnitt ${nummer} aus "${bezug.id}", der nicht als geprüft hinterlegt ist`
                    ).toBeTruthy();
                }
            }
        }
    });

    it("nennt zu jeder Quelle ein Prüfdatum", () => {
        for (const [id, dokument] of Object.entries(QUELLEN as Record<string, { geprueft?: string }>)) {
            expect(dokument.geprueft, `Quelle "${id}" ohne Prüfdatum`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });

    it("sagt bei einer nicht einsehbaren Quelle, was ungeprüft blieb", () => {
        // Das THW-Handbuch war nur dem Titel nach zu belegen; das darf nicht
        // stillschweigend wie eine geprüfte Fundstelle aussehen.
        const dokumente = QUELLEN as Record<string, { abschnitte?: Record<string, string>; ungeprueft?: string; url?: string }>;
        for (const [id, dokument] of Object.entries(dokumente)) {
            const ohneFundstellen = Object.keys(dokument.abschnitte ?? {}).length === 0;
            if (ohneFundstellen && dokument.url === undefined) {
                expect(dokument.ungeprueft, `Quelle "${id}" ohne Fundstellen und ohne Hinweis, was ungeprüft ist`).toBeTruthy();
            }
        }
    });
});

describe("Quellenabschnitt auf der Seite", () => {
    it.each(QUELLEN_SEITEN as string[])("%s trägt einen sichtbaren Quellenabschnitt", slug => {
        const seite = inhaltsseiten.find(eintrag => eintrag.slug === slug);
        expect(seite, `Seite "${slug}" fehlt in der Registry`).toBeDefined();
        const html = rendere(seite as Seite);
        expect(html).toContain('data-testid="quellen"');
        expect(html).toContain("Grundlagen und Quellen");
    });

    it("nennt das Prüfdatum im gerenderten Abschnitt", () => {
        const abschnitt = renderQuellenAbschnitt("sprechfunk-regeln") as string;
        expect(abschnitt).toContain(PRUEFDATUM);
    });

    it("sagt ausdrücklich, wenn keine geprüfte Quelle vorliegt", () => {
        // /funkmeldesystem/ hat bewusst keine Quelle. Statt zu schweigen, muss
        // die Seite das benennen – sonst liest sich Weglassen wie Beleg.
        const abschnitt = renderQuellenAbschnitt("funkmeldesystem") as string;
        expect(abschnitt).toContain("keine am Dokument geprüfte Quelle");
    });

    it("bricht ab, statt eine unbelegte Fundstelle zu drucken", () => {
        expect(() => renderQuellenAbschnitt("gibt-es-nicht")).toThrow();
    });
});

describe("Keine erfundenen Fundstellen im Fließtext", () => {
    // Zulässige Abschnittsnummern: alles, was im Register als gelesen steht.
    const erlaubt = new Set<string>();
    for (const dokument of Object.values(QUELLEN as Record<string, { abschnitte?: Record<string, string> }>)) {
        for (const nummer of Object.keys(dokument.abschnitte ?? {})) erlaubt.add(nummer);
    }

    // „Abschnitt 4.1", „Kapitel 2.5" – die Formen, in denen auf den Seiten auf
    // eine Vorschrift verwiesen wird. „Ziffer" und „Nummer" sind hier bewusst
    // nicht dabei: im Sprechfunk meint „Ziffer 2" die Zahl, nicht die
    // Fundstelle (Zahlenansage, Funkrufnamen-Stellen).
    const FUNDSTELLE = /\b(?:Abschnitt|Kapitel)\s+(\d+(?:\.\d+)*)/g;

    it.each(inhaltsseiten.map(seite => [seite.slug, seite] as const))(
        "%s nennt keine Abschnittsnummer außerhalb des Registers",
        (slug, seite) => {
            const inhalt = text(quelle(seite));
            const genannt = [...inhalt.matchAll(FUNDSTELLE)].map(treffer => treffer[1]);
            const unbelegt = genannt.filter(nummer => !erlaubt.has(nummer));
            expect(
                unbelegt,
                `${slug} nennt Fundstellen, die nicht als geprüft im Register stehen: ${unbelegt.join(", ")}`
            ).toEqual([]);
        }
    );

    it("erkennt eine erfundene Fundstelle auch wirklich", () => {
        // Gegenprobe: ohne sie würde der Test auch bei kaputtem Regex grün.
        const inhalt = text("<p>Das steht in Abschnitt 99.7 der Vorschrift.</p>");
        const genannt = [...inhalt.matchAll(FUNDSTELLE)].map(treffer => treffer[1]);
        expect(genannt).toEqual(["99.7"]);
        expect(erlaubt.has("99.7")).toBe(false);
    });

    it("hält eine geprüfte Fundstelle für zulässig", () => {
        // Zweite Gegenprobe: der Test darf nicht dadurch grün sein, dass er
        // grundsätzlich nichts durchlässt.
        const inhalt = text("<p>Die Verkehrsarten stehen in Abschnitt 4.1.</p>");
        const genannt = [...inhalt.matchAll(FUNDSTELLE)].map(treffer => treffer[1]);
        expect(genannt).toEqual(["4.1"]);
        expect(erlaubt.has("4.1")).toBe(true);
    });
});

describe("Regelseiten sind an das Register angeschlossen", () => {
    // Wer eine Vorschrift beim Namen nennt, muss auch sagen, was daraus
    // geprüft wurde. Sonst steht der Name da wie ein Beleg, ohne einer zu sein.
    const VORSCHRIFT = /\b(?:PDV|DV)\s?810\.3\b/;

    it.each(inhaltsseiten.map(seite => [seite.slug, seite] as const))(
        "%s nennt die PDV/DV 810.3 nur mit Eintrag im Register",
        (slug, seite) => {
            if (!VORSCHRIFT.test(text(quelle(seite)))) return;
            expect(
                hatQuellen(slug),
                `${slug} nennt die PDV/DV 810.3, hat aber keinen Eintrag in SEITEN_QUELLEN`
            ).toBe(true);
        }
    );
});
