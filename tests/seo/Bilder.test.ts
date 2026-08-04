import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SITE_PAGES } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reine JS-Hilfsmodule ohne Typdeklarationen, absichtlich .mjs
import { DIAGRAMME, DIAGRAMM_SLUGS, hatDiagramm, renderDiagramm } from "../../scripts/lib/diagramme.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { renderPageWithStructuredData } from "../../scripts/lib/render-page.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { BESTAND } from "../../scripts/lib/funkspruch-bestand.mjs";

const ROOT = path.resolve(__dirname, "..", "..");

/** AP-10: keine Bilder über 200 KB. */
const MAX_BILD_BYTES = 200 * 1024;

interface Seite { slug: string; source: string; inSitemap?: boolean }
const alleSeiten = SITE_PAGES as Seite[];
const inhaltsseiten = alleSeiten.filter(seite => seite.slug !== "" && seite.inSitemap !== false);

const leseQuelle = (source: string) => readFileSync(path.join(ROOT, "src", source), "utf8");

/** Vorhandene WebP-Fassungen, wie der Build sie ermittelt. */
const webpMenge = (): Set<string> => {
    const menge = new Set<string>();
    const durchlaufen = (verzeichnis: string, praefix: string): void => {
        for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
            const relativ = `${praefix}/${eintrag.name}`;
            if (eintrag.isDirectory()) {
                durchlaufen(path.join(verzeichnis, eintrag.name), relativ);
            } else if (eintrag.name.endsWith(".webp")) {
                menge.add(relativ);
            }
        }
    };
    durchlaufen(path.join(ROOT, "assets"), "assets");
    return menge;
};

/**
 * Die fertig gerenderte Seite – nur so sind Diagramme und picture-Elemente
 * dabei. webpBilder muss mit, sonst entstünde keine <source> und der Test
 * prüfte etwas anderes als der Build erzeugt.
 */
const rendere = (seite: Seite): string => renderPageWithStructuredData({
    page: seite,
    html: leseQuelle(seite.source),
    dateModified: "2026-08-04",
    bestand: BESTAND,
    webpBilder: webpMenge()
}).html;

const bilderIn = (html: string): string[] => html.match(/<img[\s\S]*?>/g) ?? [];

describe("Jede Inhaltsseite zeigt ein Bild", () => {
    it.each(inhaltsseiten.map(seite => [seite.slug, seite] as const))(
        "%s hat ein Diagramm oder ein Bild",
        (_slug, seite) => {
            const html = rendere(seite);
            const hatBild = bilderIn(html).length > 0 || html.includes('data-testid="seiten-diagramm"');
            expect(hatBild, `${seite.slug} zeigt kein Bild und kein Diagramm`).toBe(true);
        }
    );

    it("hinterlegt für jede Inhaltsseite ein Diagramm", () => {
        const fehlend = inhaltsseiten
            .map(seite => seite.slug)
            .filter(slug => !hatDiagramm(slug));
        expect(fehlend, `ohne Diagramm: ${fehlend.join(", ")}`).toEqual([]);
    });

    it("führt kein Diagramm ohne zugehörige Seite", () => {
        const bekannt = new Set(alleSeiten.map(seite => seite.slug));
        for (const slug of DIAGRAMM_SLUGS as string[]) {
            expect(bekannt.has(slug), `Diagramm für unbekannten Slug "${slug}"`).toBe(true);
        }
    });
});

describe("Maße und Alternativtexte der Rasterbilder", () => {
    it.each(alleSeiten.map(seite => [seite.source] as const))(
        "%s: kein img ohne alt, width oder height",
        source => {
            for (const bild of bilderIn(leseQuelle(source))) {
                const kurz = bild.replace(/\s+/g, " ").slice(0, 90);
                expect(/\balt="/.test(bild), `alt fehlt: ${kurz}`).toBe(true);
                // width und height verhindern den Layout Shift: ohne sie kennt
                // der Browser das Seitenverhältnis erst nach dem Laden.
                expect(/\bwidth="\d+"/.test(bild), `width fehlt: ${kurz}`).toBe(true);
                expect(/\bheight="\d+"/.test(bild), `height fehlt: ${kurz}`).toBe(true);
            }
        }
    );

    it("lädt jedes Bild außer dem ersten einer Seite verzögert", () => {
        for (const seite of alleSeiten) {
            const bilder = bilderIn(leseQuelle(seite.source));
            // Das erste Bild kann über der Falz liegen und darf nicht lazy sein;
            // alle weiteren sollen es sein.
            bilder.slice(1).forEach((bild, index) => {
                expect(/loading="lazy"/.test(bild),
                    `${seite.source}: Bild ${index + 2} ohne loading="lazy"`).toBe(true);
            });
        }
    });
});

/**
 * Alt-Texte, die nur Zielkeywords aneinanderreihen, helfen niemandem: ein
 * Bildschirmleser liest sie vor, und sie beschreiben nichts.
 */
describe("Alternativtexte beschreiben, statt Keywords zu reihen", () => {
    const KEYWORD_KETTEN = [
        "bos sprechfunk übung", "funkübung generator", "sprechfunkübung kostenlos",
        "funkübung feuerwehr generator", "funkübung online", "sprechfunk übungsgenerator"
    ];

    /**
     * Ein Alternativtext gilt als Beschreibung, wenn er ein Verb oder eine
     * Beziehung ausdrückt. Das Arbeitspaket formuliert die Regel als
     * „Zielkeywords ohne Verb“: eine Kette aus Substantiven beschreibt nichts,
     * „Rufnamen eintragen, Vorlage wählen“ dagegen schon.
     *
     * Verben erkennt die erste Gruppe an der deutschen Endung, Beziehungen die
     * zweite an Präpositionen und Konjunktionen. Eine der beiden muss greifen.
     */
    const VERB = /\b\p{L}{3,}(?:en|ern|eln|et|ert|t)\b/u;
    const BEZIEHUNG = /\b(mit|ohne|von|über|zwischen|aus|im|in|für|und|als|auf|nebeneinander|darunter|gegenüber|der|des|dem)\b/i;
    const beschreibt = (wert: string): boolean => VERB.test(wert) || BEZIEHUNG.test(wert);

    const altTexte = (): { quelle: string; text: string }[] => {
        const treffer: { quelle: string; text: string }[] = [];
        for (const seite of alleSeiten) {
            for (const bild of bilderIn(leseQuelle(seite.source))) {
                const alt = /\balt="([^"]*)"/.exec(bild)?.[1];
                if (alt !== undefined) treffer.push({ quelle: seite.source, text: alt });
            }
        }
        for (const slug of DIAGRAMM_SLUGS as string[]) {
            treffer.push({
                quelle: `Diagramm ${slug}`,
                text: (DIAGRAMME as Record<string, { alt: string }>)[slug]!.alt
            });
        }
        return treffer;
    };

    it("enthält keine reine Keyword-Kette", () => {
        for (const { quelle, text } of altTexte()) {
            const klein = text.toLowerCase();
            for (const kette of KEYWORD_KETTEN) {
                expect(klein, `${quelle}: Alt-Text enthält die Keyword-Kette „${kette}“`)
                    .not.toContain(kette);
            }
        }
    });

    it("beschreibt in mehr als drei Wörtern", () => {
        for (const { quelle, text } of altTexte()) {
            const woerter = text.trim().split(/\s+/).filter(Boolean);
            expect(woerter.length, `${quelle}: Alt-Text „${text}“ ist zu knapp`)
                .toBeGreaterThan(3);
        }
    });

    it("enthält ein Verb oder eine Beziehung, statt Begriffe zu reihen", () => {
        for (const { quelle, text } of altTexte()) {
            expect(beschreibt(text),
                `${quelle}: Alt-Text „${text}“ reiht Begriffe ohne Verb oder Beziehung`).toBe(true);
        }
    });

    it("erkennt eine reine Substantivkette als Verstoß", () => {
        // Gegenprobe: ohne diese Zusicherung könnte die Regel alles durchlassen.
        expect(beschreibt("Funkübung Feuerwehr Generator Sprechfunk")).toBe(false);
        expect(beschreibt("Rufnamen eintragen, Vorlage wählen")).toBe(true);
    });

    it("wiederholt nicht den Seitentitel", () => {
        for (const seite of alleSeiten) {
            const html = leseQuelle(seite.source);
            const titel = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
            for (const bild of bilderIn(html)) {
                const alt = /\balt="([^"]*)"/.exec(bild)?.[1] ?? "";
                if (alt === "") continue;
                expect(alt, `${seite.source}: Alt-Text ist der Seitentitel`).not.toBe(titel);
            }
        }
    });
});

describe("Diagramme sind zugänglich und maßhaltig", () => {
    it.each((DIAGRAMM_SLUGS as string[]).map(slug => [slug] as const))(
        "%s trägt title, desc, Maße und role",
        slug => {
            const figur = renderDiagramm(slug);
            expect(figur).toContain('role="img"');
            expect(figur).toMatch(/<title id="diagramm-[a-z0-9-]+-titel">/);
            expect(figur).toMatch(/<desc id="diagramm-[a-z0-9-]+-desc">/);
            expect(figur).toMatch(/width="\d+" height="\d+"/);
            expect(figur).toMatch(/viewBox="0 0 \d+ \d+"/);
            expect(figur).toContain("<figcaption");
        }
    );

    it("verweist mit aria-labelledby auf beide Textknoten", () => {
        const figur = renderDiagramm("funkrufnamen");
        const verweise = /aria-labelledby="([^"]*)"/.exec(figur)?.[1]?.split(" ") ?? [];
        expect(verweise).toHaveLength(2);
        for (const id of verweise) {
            expect(figur, `id="${id}" fehlt im SVG`).toContain(`id="${id}"`);
        }
    });

    it("nutzt currentColor, damit der Dunkelmodus greift", () => {
        const figur = renderDiagramm("bos-funk");
        expect(figur).toContain("currentColor");
        // Keine festen Hellwerte: ein weiß gefüllter Kasten wäre im
        // Dunkelmodus ein Block, der den Text verdeckt.
        expect(figur).not.toMatch(/fill="#(fff|ffffff)"/i);
        expect(figur).not.toMatch(/fill="white"/i);
    });

    it("bleibt je Diagramm unter 6 KB", () => {
        for (const slug of DIAGRAMM_SLUGS as string[]) {
            const bytes = Buffer.byteLength(renderDiagramm(slug), "utf8");
            expect(bytes, `${slug} ist ${bytes} Bytes groß`).toBeLessThan(6 * 1024);
        }
    });

    it("beschreibt jedes Diagramm mit Titel, Bildunterschrift und Alt-Text", () => {
        for (const [slug, eintrag] of Object.entries(
            DIAGRAMME as Record<string, { titel: string; beschreibung: string; alt: string }>
        )) {
            expect(eintrag.titel.length, `${slug}: Titel fehlt`).toBeGreaterThan(5);
            expect(eintrag.beschreibung.length, `${slug}: Bildunterschrift fehlt`).toBeGreaterThan(20);
            expect(eintrag.alt.length, `${slug}: Alt-Text fehlt`).toBeGreaterThan(20);
            // Bildunterschrift und Alt-Text sollen nicht identisch sein: der eine
            // ordnet ein, der andere ersetzt das Bild.
            expect(eintrag.alt, `${slug}: Alt-Text gleicht der Bildunterschrift`)
                .not.toBe(eintrag.beschreibung);
        }
    });
});

describe("WebP-Auslieferung über picture", () => {
    it("liefert jede WebP-Datei kleiner als ihr PNG", () => {
        // Kernaussage der Messung: WebP ist nicht per se kleiner. Bei
        // palettierten Oberflächenaufnahmen war es bis zu 188 Prozent größer.
        // Es darf nur dort liegen, wo es gewinnt.
        for (const webp of webpMenge()) {
            const png = webp.replace(/\.webp$/, ".png");
            const pfadWebp = path.join(ROOT, webp);
            const pfadPng = path.join(ROOT, png);
            if (!existsSync(pfadPng)) continue;
            expect(statSync(pfadWebp).size,
                `${webp} ist größer als ${png} – dann gehört die Datei nicht dorthin`)
                .toBeLessThan(statSync(pfadPng).size);
        }
    });

    it("hüllt genau die Bilder mit WebP-Schwester in picture", () => {
        const menge = webpMenge();
        for (const seite of alleSeiten) {
            const html = rendere(seite);
            for (const bild of bilderIn(html)) {
                const src = /\bsrc="([^"]*)"/.exec(bild)?.[1];
                if (src === undefined || !src.endsWith(".png")) continue;
                const relativ = src.replace(/^(\.\.\/)+/, "");
                const hatWebp = menge.has(relativ.replace(/\.png$/, ".webp"));
                const inPicture = html.includes(`<source srcset="${src.replace(/\.png$/, ".webp")}"`);
                expect(inPicture,
                    `${seite.slug || "/"}: ${relativ} ${hatWebp ? "hat WebP, aber keine source" : "hat keine WebP-Datei, aber eine source"}`)
                    .toBe(hatWebp);
            }
        }
    });

    it("behält das img als Fallback im picture", () => {
        const html = rendere(alleSeiten.find(seite => seite.slug === "anleitung")!);
        expect(html).toContain("<picture>");
        // Ohne <img> im <picture> zeigen ältere Browser nichts an.
        const stellen = [...html.matchAll(/<picture>[\s\S]*?<\/picture>/g)];
        expect(stellen.length).toBeGreaterThan(0);
        for (const [block] of stellen) {
            expect(block).toContain("<img");
            expect(block).toContain('type="image/webp"');
        }
    });
});

describe("Dateigrößen der ausgelieferten Bilder", () => {
    const bildDateien = (): string[] => {
        const dateien = new Set<string>();
        for (const seite of alleSeiten) {
            for (const bild of bilderIn(leseQuelle(seite.source))) {
                const quelle = /\bsrc="([^"]*)"/.exec(bild)?.[1];
                if (quelle === undefined) continue;
                if (quelle.startsWith("http")) continue;
                dateien.add(quelle.replace(/^(\.\.\/)+/, ""));
            }
        }
        return [...dateien];
    };

    it("hält jedes Bild unter 200 KB", () => {
        for (const datei of bildDateien()) {
            const pfad = path.join(ROOT, datei);
            let groesse: number;
            try {
                groesse = statSync(pfad).size;
            } catch {
                throw new Error(`Bild fehlt: ${datei}`);
            }
            expect(groesse, `${datei} ist ${Math.round(groesse / 1024)} KB groß`)
                .toBeLessThanOrEqual(MAX_BILD_BYTES);
        }
    });
});
