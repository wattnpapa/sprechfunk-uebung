import { createServer, type Server } from "node:http";

import { expect, test } from "@playwright/test";

// AP-12: Das einbettbare Widget wird auf einer fremden Seite geprüft, nicht auf
// der eigenen. Nur so zeigt sich, ob die Einbettung wirklich funktioniert –
// gleiche Herkunft würde die interessanten Fälle (Sandbox, fremde Requests,
// Cookies) gar nicht erst auslösen.
//
// Die „fremde Seite" läuft auf einem eigenen kleinen Server auf einem anderen
// Port als das Widget. Damit ist die Einbettung echt cross-origin, so wie
// später in einem Intranet.
//
// Warum ein echter Server und keine abgefangene Route: Chrome stuft eine per
// route.fulfill ausgelieferte Seite als „öffentlich" ein und verweigert ihr
// den Zugriff auf localhost (ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS). Der
// Rahmen bliebe leer – und die Prüfungen auf Cookies und fremde Anfragen wären
// still grün, ohne dass je etwas geladen worden wäre.

const FREMDER_PORT = 4321;
const FREMDE_SEITE = `http://localhost:${FREMDER_PORT}/ausbildung/`;
const WIDGET = "http://localhost:3000/embed/buchstabiertafel/";

let fremderServer: Server;

/** Der Einbettungscode, wie ihn /einbetten/ zum Kopieren anbietet. */
const testseite = (widgetUrl: string): string => `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>Ausbildung Sprechfunk</title></head>
<body>
<h1>Sprechfunkausbildung im Ortsverband</h1>
<iframe src="${widgetUrl}"
        title="Buchstabiertafel – Buchstabieren im BOS-Sprechfunk"
        width="100%" height="560" loading="eager"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        style="border:1px solid #dee2e6;border-radius:8px;max-width:100%"></iframe>
<p><small>Buchstabiertafel von <a href="https://sprechfunk-uebung.de/buchstabiertafel/">sprechfunk-uebung.de</a>
        – kostenlos und ohne Anmeldung, Lizenz EUPL-1.2</small></p>
</body></html>`;

test.describe("@seo Einbettbares Widget", () => {
    test.beforeAll(async () => {
        fremderServer = createServer((_anfrage, antwort) => {
            antwort.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            antwort.end(testseite(WIDGET));
        });
        await new Promise<void>(fertig => fremderServer.listen(FREMDER_PORT, "127.0.0.1", fertig));
    });

    test.afterAll(async () => {
        await new Promise<void>(fertig => fremderServer.close(() => fertig()));
    });

    test("wird auf einer fremden Seite vollständig angezeigt", async ({ page }) => {
        await page.goto(FREMDE_SEITE);

        const rahmen = page.frameLocator("iframe");
        await expect(rahmen.locator("h1")).toHaveText("Buchstabiertafel");

        const zeilen = rahmen.getByTestId("embed-tabelle").locator("tbody tr");
        await expect(zeilen).toHaveCount(32);

        // Stichproben aus der Tabelle, inklusive der Sonderfälle.
        await expect(rahmen.locator('tbody th:text-is("A")')).toBeVisible();
        await expect(rahmen.locator('tbody th:text-is("SCH")')).toBeVisible();
        await expect(rahmen.locator('tbody th:text-is("Ü")')).toBeVisible();
    });

    test("nennt im Rahmen die Quelle mit Link auf die Seite", async ({ page }) => {
        await page.goto(FREMDE_SEITE);
        const quelle = page.frameLocator("iframe").locator(".quelle a");
        await expect(quelle).toHaveAttribute("href", "https://sprechfunk-uebung.de/buchstabiertafel/");
    });

    test("trägt den eigentlichen Verweis außerhalb des Rahmens", async ({ page }) => {
        await page.goto(FREMDE_SEITE);
        // Ein Link im iframe steht auf unserer Seite, nicht auf der fremden.
        // Der Verweis, der zählt, ist der im Text der einbettenden Seite.
        const link = page.locator('body > p a[href="https://sprechfunk-uebung.de/buchstabiertafel/"]');
        await expect(link).toBeVisible();
    });

    test("setzt keine Cookies", async ({ page, context }) => {
        await page.goto(FREMDE_SEITE);
        await page.waitForLoadState("networkidle");

        expect(await context.cookies()).toEqual([]);
    });

    test("lädt nichts von fremden Hosts nach", async ({ page }) => {
        const angefragt: string[] = [];
        page.on("request", anfrage => angefragt.push(anfrage.url()));

        await page.goto(FREMDE_SEITE);
        await page.waitForLoadState("networkidle");

        const fremd = angefragt.filter(url =>
            !url.startsWith("http://localhost:3000/") && !url.startsWith(FREMDE_SEITE));
        expect(fremd, `unerwartete Anfragen: ${fremd.join(", ")}`).toEqual([]);
    });

    test("wird direkt aufgerufen nicht indexiert", async ({ page }) => {
        await page.goto("/embed/buchstabiertafel/");
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
        await expect(page.locator("link[rel=canonical]"))
            .toHaveAttribute("href", "https://sprechfunk-uebung.de/buchstabiertafel/");
    });
});

test.describe("@seo Seite /einbetten/", () => {
    test("zeigt den Code zum Kopieren und die Aushänge", async ({ page }) => {
        await page.goto("/einbetten/");

        const code = await page.getByTestId("embed-code").inputValue();
        expect(code).toContain('<iframe src="https://sprechfunk-uebung.de/embed/buchstabiertafel/"');
        expect(code).toContain("sandbox=");
        expect(code).not.toContain("allow-scripts");
        expect(code).toContain("sprechfunk-uebung.de/buchstabiertafel/");

        await expect(page.getByTestId("aushang-liste").locator("li")).toHaveCount(4);
        await expect(page.getByTestId("embed-vorschau").locator("iframe")).toHaveCount(1);
    });

    test("liefert alle vier Aushänge als PDF aus", async ({ page, request }) => {
        await page.goto("/einbetten/");
        const links = await page.getByTestId("aushang-liste").locator("a").all();
        expect(links).toHaveLength(4);

        for (const link of links) {
            const href = await link.getAttribute("href");
            const antwort = await request.get(new URL(href!, "http://localhost:3000/einbetten/").toString());
            expect(antwort.status(), `${href} nicht abrufbar`).toBe(200);
            expect((await antwort.body()).subarray(0, 5).toString()).toBe("%PDF-");
        }
    });

    test("verlinkt den Aushang auch auf der Fachseite", async ({ page }) => {
        await page.goto("/buchstabiertafel/");
        const karte = page.getByTestId("aushang-download");
        await expect(karte).toBeVisible();
        await expect(karte.locator('a[href$="buchstabiertafel-aushang.pdf"]')).toBeVisible();
    });
});
