import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SITE_PAGES, SITE_URL } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reine JS-Hilfsmodule ohne Typdeklarationen, absichtlich .mjs
import { OG_VERZEICHNIS, ogDateiname, ogKicker, ogUrl } from "../../scripts/lib/og-bilder.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { setzeOgBild } from "../../scripts/lib/render-page.mjs";

const ROOT = path.resolve(__dirname, "..", "..");
const BILDER = path.join(ROOT, OG_VERZEICHNIS);

/** AP-10: keine Bilder über 200 KB. */
const MAX_BYTES = 200 * 1024;

interface Seite { slug: string; source: string; hubCategory?: string; inSitemap?: boolean }
const seiten = SITE_PAGES as Seite[];

const leseQuelle = (source: string) => readFileSync(path.join(ROOT, "src", source), "utf8");
const titelVon = (source: string) =>
    /<title>([^<]*)<\/title>/i.exec(leseQuelle(source))?.[1] ?? "";

describe("Dateinamen und URLs", () => {
    it("bildet die Startseite auf start.jpg ab", () => {
        expect(ogDateiname("")).toBe("start.jpg");
    });

    it("ersetzt Schrägstriche verschachtelter Slugs durch Bindestriche", () => {
        // Sonst legte ein Slug wie funksprueche/vorlage/thw-lehrte ein
        // Unterverzeichnis an und der Pfad im Tag zeigte ins Leere.
        expect(ogDateiname("funksprueche/vorlage/thw-lehrte"))
            .toBe("funksprueche-vorlage-thw-lehrte.jpg");
    });

    it("liefert eine absolute URL unter assets/og/", () => {
        expect(ogUrl("faq", SITE_URL)).toBe(`${SITE_URL}/assets/og/faq.jpg`);
    });

    it("vergibt für jede Seite einen eindeutigen Dateinamen", () => {
        const namen = seiten.map(seite => ogDateiname(seite.slug));
        expect(new Set(namen).size).toBe(namen.length);
    });
});

describe("Kategoriezeile", () => {
    it("nennt auf der Startseite den Fachbereich", () => {
        expect(ogKicker({ slug: "" })).toBe("BOS-Sprechfunk");
    });

    it("nennt bei Rechtstexten Rechtliches", () => {
        expect(ogKicker({ slug: "impressum", inSitemap: false })).toBe("Rechtliches");
    });

    it("übernimmt die Bezeichnung der Hub-Kategorie", () => {
        const kategorien = [{ key: "technik", label: "Technik der Funkstrecke" }];
        expect(ogKicker({ slug: "antennen", hubCategory: "technik" }, kategorien))
            .toBe("Technik der Funkstrecke");
    });

    it("fällt auf den Sammelbegriff zurück, statt zu raten", () => {
        expect(ogKicker({ slug: "irgendwas" })).toBe("Sprechfunk-Wissen");
    });
});

describe("Erzeugte Bilder liegen vollständig vor", () => {
    it.each(seiten.map(seite => [seite.slug || "(startseite)", seite] as const))(
        "%s hat ein eigenes Bild",
        (_name, seite) => {
            const datei = path.join(BILDER, ogDateiname(seite.slug));
            expect(existsSync(datei),
                `${ogDateiname(seite.slug)} fehlt – "npm run og:image" ausführen`).toBe(true);
        }
    );

    it("hält jedes Bild unter 200 KB", () => {
        for (const seite of seiten) {
            const datei = path.join(BILDER, ogDateiname(seite.slug));
            if (!existsSync(datei)) continue;
            const groesse = statSync(datei).size;
            expect(groesse, `${ogDateiname(seite.slug)} ist ${Math.round(groesse / 1024)} KB groß`)
                .toBeLessThanOrEqual(MAX_BYTES);
        }
    });

    it("führt keine Bilder ohne zugehörige Seite", () => {
        // Wird eine Seite umbenannt oder entfernt, bleibt sonst eine Datei
        // zurück, die niemand mehr referenziert.
        const erwartet = new Set(seiten.map(seite => ogDateiname(seite.slug)));
        const vorhanden = readdirSync(BILDER).filter(name => name.endsWith(".jpg"));
        for (const name of vorhanden) {
            expect(erwartet.has(name), `${name} gehört zu keiner Seite mehr`).toBe(true);
        }
    });

    it("nutzt kein geteiltes Vorschaubild mehr", () => {
        expect(existsSync(path.join(ROOT, "assets", "og-image.png")),
            "assets/og-image.png ist durch die seitenindividuellen Bilder ersetzt").toBe(false);
    });
});

describe("Eingesetzte Meta-Tags", () => {
    const tag = (html: string, name: string, attribut = "property") =>
        new RegExp(`<meta ${attribut}="${name}" content="([^"]*)"`).exec(html)?.[1];

    it.each(seiten.map(seite => [seite.slug || "(startseite)", seite] as const))(
        "%s trägt ihr eigenes Bild in og:image und twitter:image",
        (_name, seite) => {
            const html = setzeOgBild(leseQuelle(seite.source), seite, titelVon(seite.source));
            const erwartet = ogUrl(seite.slug, SITE_URL);
            expect(tag(html, "og:image")).toBe(erwartet);
            expect(tag(html, "twitter:image", "name")).toBe(erwartet);
        }
    );

    it("setzt og:image:alt auf den Seitentitel ohne Marken-Suffix", () => {
        const seite = seiten.find(eintrag => eintrag.slug === "")!;
        const titel = titelVon(seite.source);
        const html = setzeOgBild(leseQuelle(seite.source), seite, titel);
        const alt = tag(html, "og:image:alt")!;
        expect(alt).not.toContain("| Sprechfunk Übungsgenerator");
        // Der Titel der Startseite enthält ein „&“; im Attribut steht es
        // maskiert. Verglichen wird deshalb gegen den maskierten Titel.
        expect(titel.replaceAll("&", "&amp;")).toContain(alt);
    });

    it("ergänzt og:image:alt, wenn die Quelle keines hat", () => {
        const html = setzeOgBild(
            '<meta property="og:image" content="platzhalter">',
            { slug: "faq" },
            "Ein Titel"
        );
        expect(html).toContain('<meta property="og:image:alt" content="Ein Titel">');
    });

    it("maskiert Sonderzeichen im Alternativtext", () => {
        const html = setzeOgBild(
            '<meta property="og:image" content="x"><meta property="og:image:alt" content="alt">',
            { slug: "faq" },
            'Titel mit "Anführung" & Zeichen'
        );
        expect(html).toContain("&amp;");
        expect(html).not.toContain('content="Titel mit "');
    });
});
