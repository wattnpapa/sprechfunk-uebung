import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SITE_PAGES } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reines JS-Hilfsmodul ohne Typdeklarationen, absichtlich .mjs
import { renderPageWithStructuredData } from "../../scripts/lib/render-page.mjs";
import { GENERATOR_VIEW_MARKUP } from "../../src/generator/viewMarkup";
import { istRoutenHash } from "../../src/core/router";
import { BESTAND } from "../../scripts/lib/funkspruch-bestand.mjs";

// B4 (THW-Review 2026-10-04): Das Inhaltsverzeichnis der Startseite entstand
// aus den h2 der eingebetteten Rollenansichten. Seine Sprungmarken („#teilnehmer“,
// „#kopfdaten“ …) las der Hash-Router als Route – Ergebnis war eine leere Seite.
describe("Startseite: Sprungmarken und Router", () => {
    const root = path.resolve(__dirname, "..", "..");
    const quelle = readFileSync(path.join(root, "src", "index.html"), "utf8")
        .replace("<!-- Wird von GeneratorView.ts befüllt -->", GENERATOR_VIEW_MARKUP);
    const startseite = SITE_PAGES.find(seite => seite.slug === "")!;
    const { html } = renderPageWithStructuredData({
        page: startseite, html: quelle, dateModified: "2026-10-04", bestand: BESTAND
    });

    it("bekommt kein Inhaltsverzeichnis aus App-Überschriften", () => {
        expect(html).not.toContain("data-testid=\"inhaltsverzeichnis\"");
    });

    it("jede Sprungmarke zeigt auf ein vorhandenes Ziel und wird nicht als Route gelesen", () => {
        const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(t => t[1]));
        const anker = [...html.matchAll(/href="(#[^"]*)"/g)].map(t => t[1]!);
        for (const ziel of anker) {
            if (ziel.startsWith("#/")) {
                continue; // echte App-Route
            }
            expect(istRoutenHash(ziel), `${ziel} würde die Ansicht umschalten`).toBe(false);
            expect(ids.has(ziel.slice(1)), `${ziel} hat kein Ziel`).toBe(true);
        }
    });

    it("Inhaltsseiten behalten ihr Verzeichnis", () => {
        const seite = SITE_PAGES.find(eintrag => eintrag.slug === "anleitung")!;
        const anleitung = readFileSync(path.join(root, "src", seite.source), "utf8");
        const gerendert = renderPageWithStructuredData({
            page: seite, html: anleitung, dateModified: "2026-10-04", bestand: BESTAND
        }).html;
        // Die Anleitung pflegt ihr Verzeichnis selbst oder bekommt es generiert –
        // in beiden Fällen stehen Sprungmarken darin, die keine Routen sind.
        const anker = [...gerendert.matchAll(/href="(#[a-z][^"]*)"/g)].map(t => t[1]!);
        expect(anker.length).toBeGreaterThan(0);
        for (const ziel of anker) {
            expect(istRoutenHash(ziel)).toBe(false);
        }
    });
});
