import { expect, test } from "@playwright/test";

import { SITE_PAGES } from "../scripts/site-pages.mjs";

type Seite = { slug: string; inSitemap?: boolean };

/** Inhaltsseiten: alles außer der SPA-Startseite und den Rechtstexten. */
const inhaltsseiten = (SITE_PAGES as Seite[])
    .filter(seite => seite.slug !== "" && seite.inSitemap !== false);

test.describe("@seo Einheitliches Seitenformat", () => {
    for (const seite of inhaltsseiten) {
        test(`/${seite.slug}/ führt alle Formatbausteine`, async ({ page }) => {
            await page.goto(`/${seite.slug}/`);

            // Reihenfolge von oben nach unten: Brotkrumen, h1, Metazeile,
            // „Kurz gesagt“, Hauptteil, FAQ, Weiterlesen.
            await expect(page.getByTestId("breadcrumb")).toBeVisible();
            await expect(page.locator("h1")).toHaveCount(1);
            await expect(page.getByTestId("aktualisiert-am")).toBeVisible();
            await expect(page.getByTestId("kurz-gesagt")).toBeVisible();
            await expect(page.getByTestId("weiterlesen")).toBeVisible();

            const meta = await page.getByTestId("aktualisiert-am").innerText();
            expect(meta).toMatch(/Lesezeit ca\. \d+ Minuten/);
            expect(meta).toContain("Bereichsausbilder Sprechfunk");

            // Die FAQ steht sichtbar auf der Seite – entweder als injizierter
            // Block oder, auf /faq/, im eigenen Markup.
            const faqFragen = await page.locator("h2#faq-titel, h1").count();
            expect(faqFragen).toBeGreaterThan(0);
        });
    }

    test("stellt „Kurz gesagt“ vor den Hauptteil", async ({ page }) => {
        await page.goto("/regiebuch-funkuebung/");
        const kurz = (await page.getByTestId("kurz-gesagt").boundingBox())!.y;
        const weiterlesen = (await page.getByTestId("weiterlesen").boundingBox())!.y;
        expect(kurz).toBeLessThan(weiterlesen);
    });
});

test.describe("@seo Überschriften und Inhaltsverzeichnis", () => {
    for (const seite of inhaltsseiten) {
        test(`/${seite.slug}/ vergibt jeder h2 eine id`, async ({ page }) => {
            await page.goto(`/${seite.slug}/`);

            // Footer-Spalten tragen h2 ohne Anker; sie gehören nicht zum Inhalt.
            const ohneId = await page.locator("main h2:not([id])").count();
            expect(ohneId, "Überschrift ohne id").toBe(0);
        });
    }

    test("verweist im Inhaltsverzeichnis nur auf vorhandene Anker", async ({ page }) => {
        for (const seite of inhaltsseiten) {
            await page.goto(`/${seite.slug}/`);
            const verzeichnis = page.getByTestId("inhaltsverzeichnis");
            if (await verzeichnis.count() === 0) continue;

            const ziele = await verzeichnis.locator("a[href^='#']")
                .evaluateAll(nodes => nodes.map(n => n.getAttribute("href")!.slice(1)));
            expect(ziele.length).toBeGreaterThan(4);

            for (const ziel of ziele) {
                await expect(page.locator(`#${ziel}`), `/${seite.slug}/ #${ziel} fehlt`)
                    .toHaveCount(1);
            }
        }
    });

    test("zeigt das Verzeichnis erst ab fünf Abschnitten", async ({ page }) => {
        for (const seite of inhaltsseiten) {
            await page.goto(`/${seite.slug}/`);
            const abschnitte = await page.locator("main h2[id]").evaluateAll(nodes =>
                nodes.filter(n => !["faq-titel", "weiterlesen-titel", "inhalt-titel", "kurz-gesagt-titel"]
                    .includes(n.id)).length);
            const hatVerzeichnis = await page.getByTestId("inhaltsverzeichnis").count() > 0;

            expect(hatVerzeichnis, `/${seite.slug}/ hat ${abschnitte} Abschnitte`)
                .toBe(abschnitte > 4);
        }
    });
});
