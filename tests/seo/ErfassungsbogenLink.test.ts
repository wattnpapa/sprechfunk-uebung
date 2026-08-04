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

function linksAuf(html: string, ziel: string): string[] {
    return [...html.matchAll(/<a\s[^>]*>/gi)]
        .map(treffer => treffer[0])
        .filter(tag => tag.includes(`href="${ziel}`));
}

describe("Kontextuelle Links auf erfassungsbogen.app (AP-11)", () => {

    it.each(ERWARTETE_SEITEN)("/%s/ verlinkt erfassungsbogen.app im Fließtext", slug => {
        const seite = seiten.find(eintrag => eintrag.slug === slug);
        expect(seite, `Seite "${slug}" fehlt in der Registry`).toBeTruthy();

        const html = leseSeite(seite!.source);
        const links = linksAuf(html, ZIEL);
        expect(links.length, `${slug} verlinkt ${ZIEL} nicht`).toBeGreaterThanOrEqual(1);

        // Eigenes Projekt, redaktionell gewollt – ein nofollow wäre falsch.
        for (const tag of links) {
            expect(tag, `${slug} setzt nofollow auf den eigenen Projektlink`)
                .not.toMatch(/rel="[^"]*nofollow[^"]*"/i);
        }
    });

    it("verlinkt auf /open-source/ auch das Repository", () => {
        const seite = seiten.find(eintrag => eintrag.slug === "open-source")!;
        expect(linksAuf(leseSeite(seite.source), REPO).length).toBeGreaterThanOrEqual(1);
    });

    it("verlinkt erfassungsbogen.app von genau zwei Seiten aus", () => {
        // Kein Footer- oder Navigationslink auf allen Seiten: taucht der Link
        // auf weiteren Seiten auf, ist das eine bewusste redaktionelle
        // Entscheidung und gehört hier ergänzt.
        const verlinkende = seiten
            .filter(seite => leseSeite(seite.source).includes(ZIEL))
            .map(seite => seite.slug)
            .sort();

        expect(verlinkende).toEqual([...ERWARTETE_SEITEN].sort());
    });
});
