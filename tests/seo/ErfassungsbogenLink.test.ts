import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error – reines JS-Modul ohne Typdeklaration, bewusst geteilt mit dem Build
import { SITE_PAGES } from "../../scripts/site-pages.mjs";

/**
 * erfassungsbogen.app ist ein zweites BOS-Werkzeug desselben Autors und wird
 * bewusst nur von genau zwei Stellen aus verlinkt – als redaktioneller
 * Fließtext-Link, nicht als Footer- oder Navigationslink auf allen Seiten
 * (AP-11). Der Test hält beide Zusicherungen fest: die Links existieren, und
 * es kommen nicht schleichend weitere Seiten dazu.
 */

const root = path.resolve(__dirname, "..", "..");

const ZIEL = "https://erfassungsbogen.app";
const ZIEL_HOST = "erfassungsbogen.app";
const REPO = "https://github.com/wattnpapa/erfassungsbogen";
const ERWARTETE_SEITEN = ["funkuebung-katastrophenschutz", "open-source"];

interface SitePage {
    slug: string;
    source: string;
}

const seiten = SITE_PAGES as SitePage[];

function leseSeite(source: string): string {
    return readFileSync(path.join(root, "src", source), "utf8");
}

/** Alle <a>-Tags der Seite mit ihrem href-Wert. */
function ankerTags(html: string): { tag: string; href: string }[] {
    return [...html.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>/gi)]
        .map(treffer => ({ tag: treffer[0], href: treffer[1] }));
}

/** Hostname eines href, oder "" bei relativen Zielen. */
function hostVon(href: string): string {
    try {
        return new URL(href).hostname;
    } catch {
        return "";
    }
}

function erfassungsbogenLinks(html: string): { tag: string; href: string }[] {
    // Exakter Host-Vergleich statt Teilstring: "erfassungsbogen.app.example"
    // soll nicht zählen (CodeQL js/incomplete-url-substring-sanitization).
    return ankerTags(html).filter(anker => hostVon(anker.href) === ZIEL_HOST);
}

describe("Kontextuelle Links auf erfassungsbogen.app (AP-11)", () => {

    it.each(ERWARTETE_SEITEN)("/%s/ verlinkt erfassungsbogen.app im Fließtext", slug => {
        const seite = seiten.find(eintrag => eintrag.slug === slug);
        expect(seite, `Seite "${slug}" fehlt in der Registry`).toBeTruthy();

        const html = leseSeite(seite!.source);
        const links = erfassungsbogenLinks(html);
        expect(links.length, `${slug} verlinkt ${ZIEL} nicht`).toBeGreaterThanOrEqual(1);

        // Eigenes Projekt, redaktionell gewollt – ein nofollow wäre falsch.
        for (const anker of links) {
            expect(anker.tag, `${slug} setzt nofollow auf den eigenen Projektlink`)
                .not.toMatch(/rel="[^"]*nofollow[^"]*"/i);
        }
    });

    it("verlinkt auf /open-source/ auch das Repository", () => {
        const seite = seiten.find(eintrag => eintrag.slug === "open-source")!;
        const repoLinks = ankerTags(leseSeite(seite.source))
            .filter(anker => anker.href === REPO);
        expect(repoLinks.length).toBeGreaterThanOrEqual(1);
    });

    it("verlinkt erfassungsbogen.app von genau zwei Seiten aus", () => {
        // Kein Footer- oder Navigationslink auf allen Seiten: taucht der Link
        // auf weiteren Seiten auf, ist das eine bewusste redaktionelle
        // Entscheidung und gehört hier ergänzt.
        const verlinkende = seiten
            .filter(seite => erfassungsbogenLinks(leseSeite(seite.source)).length > 0)
            .map(seite => seite.slug)
            .sort();

        expect(verlinkende).toEqual([...ERWARTETE_SEITEN].sort());
    });
});
