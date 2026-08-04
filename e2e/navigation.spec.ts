import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { HUB_CATEGORIES, HUB_SLUG, MAIN_NAV, SITE_PAGES } from "../scripts/site-pages.mjs";

type Seite = { slug: string; label: string; hubCategory?: string; inSitemap?: boolean };

const seiten = SITE_PAGES as Seite[];
const pfadVon = (slug: string) => (slug === "" ? "/" : `/${slug}/`);

/** Seiten, die der Hub verlinken muss: alles außer Startseite, Hub und Rechtstexten. */
const hubZiele = seiten.filter(seite =>
    seite.slug !== "" && seite.slug !== HUB_SLUG && seite.inSitemap !== false);

test.describe("@seo Globale Navigation", () => {
    for (const seite of seiten) {
        test(`${pfadVon(seite.slug)} trägt dieselbe Hauptnavigation`, async ({ page }) => {
            await page.goto(pfadVon(seite.slug));

            const nav = page.getByTestId("hauptnavigation");
            await expect(nav).toBeVisible();

            // Alle definierten Einträge, in derselben Reihenfolge, auf jeder Seite.
            const beschriftungen = await nav.locator(".site-nav-list .nav-link").allInnerTexts();
            expect(beschriftungen.map(t => t.trim()))
                .toEqual([...MAIN_NAV.map((e: { label: string }) => e.label), "GitHub"]);

            for (const eintrag of MAIN_NAV as { slug: string; label: string }[]) {
                await expect(page.getByTestId(`nav-${eintrag.slug || "start"}`)).toBeVisible();
            }
        });
    }

    test("markiert die aktive Seite mit aria-current", async ({ page }) => {
        await page.goto(`/${HUB_SLUG}/`);
        await expect(page.getByTestId(`nav-${HUB_SLUG}`)).toHaveAttribute("aria-current", "page");
        // Auf einer anderen Seite darf derselbe Eintrag es nicht tragen.
        await page.goto("/faq/");
        await expect(page.getByTestId(`nav-${HUB_SLUG}`)).not.toHaveAttribute("aria-current", "page");
        await expect(page.getByTestId("nav-faq")).toHaveAttribute("aria-current", "page");
    });

    test("setzt kein nofollow auf interne Links", async ({ page }) => {
        await page.goto(`/${HUB_SLUG}/`);
        const nofollow = await page.locator('a[rel*="nofollow"]').count();
        expect(nofollow).toBe(0);
    });
});

test.describe("@seo Content-Hub", () => {
    test("verlinkt jede Content-Seite mit einem Klick", async ({ page }) => {
        await page.goto(`/${HUB_SLUG}/`);

        for (const ziel of hubZiele) {
            const karte = page.getByTestId(`hub-karte-${ziel.slug}`);
            await expect(karte, `Karte für /${ziel.slug}/ fehlt auf dem Hub`).toBeVisible();
            await expect(karte).toHaveAttribute("href", `../${ziel.slug}/`);
        }
    });

    test("gliedert die Karten in alle Kategorien", async ({ page }) => {
        await page.goto(`/${HUB_SLUG}/`);

        let summe = 0;
        for (const kategorie of HUB_CATEGORIES as { key: string; label: string; anchor: string }[]) {
            const liste = page.getByTestId(`hub-liste-${kategorie.key}`);
            await expect(liste).toBeVisible();
            const anzahl = await liste.locator("[data-testid^='hub-karte-']").count();
            expect(anzahl, `Kategorie ${kategorie.key} ist leer`).toBeGreaterThan(0);
            summe += anzahl;
            // Der Anker muss existieren, weil die Brotkrumen darauf verweisen.
            await expect(page.locator(`#${kategorie.anchor}`)).toBeVisible();
        }
        expect(summe).toBe(hubZiele.length);
    });

    test("bringt eigenen Text, nicht nur eine Linkliste", async ({ page }) => {
        await page.goto(`/${HUB_SLUG}/`);
        const gesamt = (await page.locator("main").innerText()).split(/\s+/).filter(Boolean).length;
        const kartenText = (await page.locator("[data-testid^='hub-karte-']").allInnerTexts())
            .join(" ").split(/\s+/).filter(Boolean).length;

        expect(gesamt - kartenText, "Hub braucht mindestens 600 Wörter eigenen Text")
            .toBeGreaterThanOrEqual(600);
    });
});

test.describe("@seo Themen-Seitenleiste", () => {
    const wissensSeiten = [
        ...seiten.filter(seite => seite.hubCategory !== undefined),
        seiten.find(seite => seite.slug === HUB_SLUG)!
    ];

    for (const seite of wissensSeiten) {
        test(`${pfadVon(seite.slug)} zeigt die vollständige Themenliste`, async ({ page }) => {
            await page.goto(pfadVon(seite.slug));

            const sidebar = page.getByTestId("wissen-sidebar");
            await expect(sidebar).toBeVisible();

            // Alle Inhaltsseiten stehen in der Leiste, nicht nur die eigene Kategorie.
            for (const ziel of hubZiele) {
                await expect(sidebar.getByTestId(`sidebar-link-${ziel.slug}`)).toHaveCount(1);
            }
        });
    }

    test("hebt die aktuelle Seite hervor und klappt ihre Kategorie auf", async ({ page }) => {
        await page.goto("/buchstabiertafel/");

        const aktiv = page.getByTestId("sidebar-link-buchstabiertafel");
        await expect(aktiv).toHaveAttribute("aria-current", "page");
        await expect(aktiv).toBeVisible();

        // Die Kategorie der Seite ist offen, eine andere nicht.
        await expect(page.getByTestId("sidebar-gruppe-grundlagen")).toHaveAttribute("open", "");
        await expect(page.getByTestId("sidebar-gruppe-technik")).not.toHaveAttribute("open", "");

        // Genau eine Seite ist als aktuell markiert.
        expect(await page.locator('.wissen-sidebar-link[aria-current="page"]').count()).toBe(1);
    });

    test("erscheint nicht außerhalb des Wissensbereichs", async ({ page }) => {
        for (const pfad of ["/", "/impressum/", "/datenschutz/"]) {
            await page.goto(pfad);
            await expect(page.getByTestId("wissen-sidebar"), `${pfad} braucht keine Themenleiste`)
                .toHaveCount(0);
        }
    });

    test("liegt links neben dem Inhalt", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto("/funkuebung-feuerwehr/");

        const leiste = await page.getByTestId("wissen-sidebar").boundingBox();
        const inhalt = await page.locator("main.wissen-inhalt").boundingBox();
        expect(leiste, "Seitenleiste nicht im Layout").toBeTruthy();
        expect(inhalt, "Inhaltsspalte nicht im Layout").toBeTruthy();
        // Links daneben, nicht darüber.
        expect(leiste!.x).toBeLessThan(inhalt!.x);
        expect(leiste!.y).toBeLessThan(inhalt!.y + 80);
    });

    test("ist ohne JavaScript vollständig vorhanden", async ({ browser }) => {
        const kontext = await browser.newContext({ javaScriptEnabled: false });
        const seite = await kontext.newPage();
        await seite.goto("/funkuebung-feuerwehr/");

        await expect(seite.getByTestId("wissen-sidebar")).toBeVisible();
        expect(await seite.locator(".wissen-sidebar-link").count()).toBe(hubZiele.length);
        await kontext.close();
    });
});

test.describe("@seo Weiterlesen-Block", () => {
    for (const seite of hubZiele) {
        test(`${pfadVon(seite.slug)} bietet genau drei Lesetipps`, async ({ page }) => {
            await page.goto(pfadVon(seite.slug));

            const block = page.getByTestId("weiterlesen");
            await expect(block).toBeVisible();
            await expect(block.getByRole("heading", { name: "Weiterlesen" })).toBeVisible();

            const karten = block.locator("[data-testid^='weiterlesen-']");
            await expect(karten).toHaveCount(3);

            // Kein Selbstverweis, jedes Ziel nur einmal, jede Karte mit Text.
            const ziele: string[] = [];
            for (let i = 0; i < 3; i += 1) {
                const karte = karten.nth(i);
                const href = await karte.getAttribute("href");
                expect(href).not.toBe(`../${seite.slug}/`);
                ziele.push(href ?? "");
                expect((await karte.innerText()).trim().length).toBeGreaterThan(10);
            }
            expect(new Set(ziele).size, "Ziele müssen verschieden sein").toBe(3);
        });
    }

    test("fehlt auf Startseite und Rechtstexten", async ({ page }) => {
        for (const pfad of ["/", "/impressum/", "/datenschutz/"]) {
            await page.goto(pfad);
            await expect(page.getByTestId("weiterlesen"), `${pfad} braucht keinen Block`)
                .toHaveCount(0);
        }
    });

    test("steht als letzter Abschnitt vor dem Footer", async ({ page }) => {
        await page.goto("/funkuebung-feuerwehr/");
        const blockOben = (await page.getByTestId("weiterlesen").boundingBox())!.y;
        const footerOben = (await page.getByTestId("site-footer").boundingBox())!.y;
        expect(blockOben).toBeLessThan(footerOben);
    });

    test("funktioniert ohne JavaScript", async ({ browser }) => {
        const kontext = await browser.newContext({ javaScriptEnabled: false });
        const seite = await kontext.newPage();
        await seite.goto("/buchstabiertafel/");

        await expect(seite.getByTestId("weiterlesen")).toBeVisible();
        const karten = seite.locator("[data-testid^='weiterlesen-']");
        await expect(karten).toHaveCount(3);
        // Die Karten sind echte Links, kein per Skript nachgerüstetes Verhalten.
        await expect(karten.first()).toHaveAttribute("href", /^\.\.\/[a-z-]+\/$/);
        await kontext.close();
    });
});

test.describe("@seo Klicktiefe", () => {
    test("erreicht jede Content-Seite in höchstens zwei Klicks von der Startseite", async ({ page }) => {
        const slugsVon = async (pfad: string, prefix: RegExp) => {
            await page.goto(pfad);
            const hrefs = await page.locator("a[href]").evaluateAll(nodes =>
                nodes.map(n => n.getAttribute("href") ?? ""));
            return new Set(hrefs.map(href => href.replace(prefix, "").replace(/\/$/, "")));
        };

        const inEinemKlick = await slugsVon("/", /^\.\//);
        const inZweiKlicks = await slugsVon(`/${HUB_SLUG}/`, /^\.\.\//);

        const unerreichbar = hubZiele
            .filter(ziel => !inEinemKlick.has(ziel.slug) && !inZweiKlicks.has(ziel.slug))
            .map(ziel => ziel.slug);
        expect(unerreichbar, "in mehr als zwei Klicks erreichbar").toEqual([]);
    });
});

test.describe("@seo Brotkrumen", () => {
    for (const seite of seiten.filter(s => s.slug !== "")) {
        test(`${pfadVon(seite.slug)}: sichtbare Brotkrumen und BreadcrumbList stimmen überein`, async ({ page }) => {
            await page.goto(pfadVon(seite.slug));

            const sichtbar = (await page.getByTestId("breadcrumb").locator("li").allInnerTexts())
                .map(t => t.trim());

            const rohBloecke = await page.locator('script[type="application/ld+json"]').allTextContents();
            const graph = JSON.parse(rohBloecke[0])["@graph"] as Record<string, unknown>[];
            const liste = graph.find(knoten => knoten["@type"] === "BreadcrumbList");
            expect(liste, "BreadcrumbList fehlt").toBeTruthy();

            const ausSchema = (liste!.itemListElement as { name: string }[]).map(glied => glied.name);
            expect(ausSchema).toEqual(sichtbar);

            // Das letzte Glied ist die aktuelle Seite und nicht verlinkt.
            const letztes = page.getByTestId("breadcrumb").locator("li").last();
            await expect(letztes).toHaveAttribute("aria-current", "page");
            expect(await letztes.locator("a").count()).toBe(0);
        });
    }

    test("hängt Content-Seiten unter Hub und Kategorie", async ({ page }) => {
        await page.goto("/funkuebung-feuerwehr/");
        const glieder = (await page.getByTestId("breadcrumb").locator("li").allInnerTexts())
            .map(t => t.trim());
        expect(glieder).toEqual([
            "Startseite", "Wissen", "Funkübungen planen und durchführen", "Funkübung Feuerwehr"
        ]);
    });
});

test.describe("@seo Navigation ohne JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    for (const slug of ["", HUB_SLUG, "funkuebung-feuerwehr"]) {
        test(`${pfadVon(slug)} zeigt Navigation und Brotkrumen auch ohne JS`, async ({ page }) => {
            await page.goto(pfadVon(slug));

            await expect(page.getByTestId("hauptnavigation")).toBeVisible();
            for (const eintrag of MAIN_NAV as { slug: string }[]) {
                await expect(page.getByTestId(`nav-${eintrag.slug || "start"}`)).toBeVisible();
            }
            if (slug !== "") {
                await expect(page.getByTestId("breadcrumb")).toBeVisible();
            }
            await expect(page.getByTestId("site-footer")).toBeVisible();
        });
    }

    test("liefert die Hub-Karten ohne JS aus", async ({ page }) => {
        await page.goto(`/${HUB_SLUG}/`);
        const karten = await page.locator("[data-testid^='hub-karte-']").count();
        expect(karten).toBe(hubZiele.length);
    });
});

test.describe("@seo Barrierefreiheit", () => {
    const pruefe = async (page: Page, pfad: string) => {
        await page.goto(pfad);
        const ergebnis = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
        const meldungen = ergebnis.violations.map(v => `${v.id} (${v.nodes.length}×): ${v.help}`);
        expect(meldungen, `axe-core-Verstöße auf ${pfad}`).toEqual([]);
    };

    test("Hub-Seite ist frei von axe-core-Verstößen", async ({ page }) => {
        await pruefe(page, `/${HUB_SLUG}/`);
    });

    test("Content-Seite ist frei von axe-core-Verstößen", async ({ page }) => {
        await pruefe(page, "/funkuebung-feuerwehr/");
    });

    test("Mobilnavigation ist per Tastatur bedienbar", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`/${HUB_SLUG}/`);

        const umschalter = page.getByTestId("nav-umschalter");
        await expect(umschalter).toBeVisible();

        // Offen ausgeliefert, damit Inhalt und Crawler die Links sehen.
        const details = page.locator(".site-nav-details");
        await expect(details).toHaveAttribute("open", "");

        // Fokussieren und mit der Tastatur zuklappen …
        await umschalter.focus();
        await expect(umschalter).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(details).not.toHaveAttribute("open", "");

        // … und wieder aufklappen.
        await page.keyboard.press("Enter");
        await expect(details).toHaveAttribute("open", "");
        await expect(page.getByTestId("nav-faq")).toBeVisible();
    });
});
