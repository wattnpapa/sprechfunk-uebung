import { expect, test } from "@playwright/test";

// Befunde aus dem THW-Review vom 2026-10-04 (docs/reviews/2026-10-04-thw/):
// Vordruck-Vorschau, Übungsleitungs-PDF, Sprungmarken, Navigation, Theme und
// Offline-Neuladen. Läuft im Mock-Modus wie e2e/app.spec.ts.

const seed = {
    u1: {
        id: "u1",
        name: "Mock Übung",
        datum: "2026-02-14T09:00:00.000Z",
        createDate: "2026-02-14T20:00:00.000Z",
        buildVersion: "dev",
        uebungCode: "K7M4Q2",
        leitung: "Heros Wind 10",
        rufgruppe: "T_OL_GOLD-1",
        teilnehmerListe: ["Heros Oldenburg 16/11", "Heros Oldenburg 17/12"],
        teilnehmerIds: { A1B2: "Heros Oldenburg 16/11", C3D4: "Heros Oldenburg 17/12" },
        nachrichten: {
            "Heros Oldenburg 16/11": [
                { id: 1, empfaenger: ["Heros Oldenburg 17/12"], nachricht: "Lage unverändert." },
                { id: 2, empfaenger: ["Heros Oldenburg 17/12"], nachricht: "Meldepunkt erreicht." }
            ],
            "Heros Oldenburg 17/12": [
                { id: 1, empfaenger: ["Heros Oldenburg 16/11"], nachricht: "Verstanden." }
            ]
        },
        spruecheProTeilnehmer: 2,
        spruecheAnAlle: 0,
        spruecheAnMehrere: 0,
        buchstabierenAn: 0,
        loesungswoerter: {},
        loesungsStaerken: {},
        checksumme: "abc",
        funksprueche: [],
        anmeldungAktiv: false,
        verwendeteVorlagen: ["thwleer"],
        istStandardKonfiguration: false
    }
};

test.beforeEach(async ({ context }) => {
    await context.addInitScript(daten => {
        window.localStorage.setItem("useFirestoreEmulator", "1");
        window.localStorage.setItem("e2eFirestoreSeed", JSON.stringify(daten));
    }, seed);
});

test("@teilnehmer Vordruck-Vorschau zeichnet den Vordruck (B1)", async ({ page }) => {
    const fehler: string[] = [];
    page.on("pageerror", e => fehler.push(String(e)));
    await page.goto("/#/teilnehmer/u1/A1B2");
    await expect(page.locator("#teilnehmerNachrichtenBody tr").first()).toBeVisible();

    await page.locator("[data-doc-view='meldevordruck']").first().click();
    await expect(page.locator("#teilnehmerDocPage")).toContainText("Seite");

    // Entweder gezeichnet oder – nie – ein leerer Rahmen ohne Meldung.
    await expect.poll(async () => page.evaluate(() => {
        const canvas = document.getElementById("teilnehmerPdfCanvas") as HTMLCanvasElement | null;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || canvas.width === 0) return 0;
        const daten = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let gezeichnet = 0;
        for (let i = 3; i < daten.length; i += 400) if ((daten[i] ?? 0) > 0) gezeichnet++;
        return gezeichnet;
    }), { timeout: 15_000 }).toBeGreaterThan(100);
    await expect(page.locator("#teilnehmerPdfFehler")).toHaveCount(0);
    expect(fehler.filter(f => f.includes("getOrInsertComputed"))).toEqual([]);
});

test.describe("@teilnehmer Vordruck-Fenster am Smartphone", () => {
    test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

    test("liegt über der fixierten Kopfzeile, Schließen-Knopf ist voll erreichbar", async ({ page }) => {
        await page.goto("/#/teilnehmer/u1/A1B2");
        await expect(page.locator("#teilnehmerNachrichtenBody tr").first()).toBeVisible();
        await page.locator("[data-doc-view='meldevordruck']").first().click();
        await expect(page.locator("#teilnehmerDocModal.show")).toBeVisible();
        const getroffen = await page.evaluate(() => {
            const knopf = document.getElementById("btn-doc-close")!.getBoundingClientRect();
            return document.elementFromPoint(knopf.left + knopf.width / 2, knopf.top + 2)?.id;
        });
        expect(getroffen).toBe("btn-doc-close");
    });
});

test("@uebungsleitung Übungsleitung als PDF klappt als erste Aktion (B2)", async ({ page }) => {
    await page.goto("/#/uebungsleitung/u1");
    await expect(page.locator("#exportUebungsleitungPdf")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.locator("#exportUebungsleitungPdf").click();
    const datei = await download;
    const pfad = await datei.path();
    expect(pfad).toBeTruthy();
});

test("@routing Sprungmarken schalten die Ansicht nicht um, Startseite ohne App-Inhaltsverzeichnis (B4)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("inhaltsverzeichnis")).toHaveCount(0);

    await page.evaluate(() => {
        window.location.hash = "#teilnehmer";
    });
    await expect(page.locator("#mainAppArea")).toBeVisible();
    await expect(page.locator("#teilnehmerArea")).toBeHidden();
});

test("@routing Navigation markiert „Übung erstellen“ nur im Generator", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("nav-start")).toHaveAttribute("aria-current", "page");

    await page.goto("/#/teilnehmer/u1/A1B2");
    await expect(page.locator("#teilnehmerArea")).toBeVisible();
    await expect(page.getByTestId("nav-start")).not.toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("nav-start")).not.toHaveClass(/active/);
});

test.describe("@smoke Theme (B5)", () => {
    test.use({ colorScheme: "dark" });

    test("steht vor dem Laden des Bundles fest, auch auf Inhaltsseiten", async ({ page }) => {
        await page.route("**/bundle.js", async route => {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await route.continue();
        });
        await page.goto("/", { waitUntil: "commit" });
        await page.waitForSelector("body");
        await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
        await expect(page.locator("meta[name=theme-color]")).toHaveAttribute("content", "#0e1526");

        await page.goto("/funkuebung-thw/");
        await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
    });

    test("eigene Wahl bleibt beim Systemwechsel", async ({ page }) => {
        await page.goto("/");
        await page.getByTestId("theme-toggle-desktop").click();
        await expect(page.locator("body")).toHaveAttribute("data-theme", "light");

        await page.emulateMedia({ colorScheme: "light" });
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
    });
});

test.describe("@smoke Offline", () => {
    test.use({ serviceWorkers: "allow" });

    test("Neuladen ohne Netz öffnet die App aus dem Service Worker", async ({ page, context }) => {
        await page.goto("/");
        await page.evaluate(async () => {
            await navigator.serviceWorker.ready;
        });
        await page.reload();
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

        await context.setOffline(true);
        try {
            await page.reload();
            await expect(page.locator("#startUebungBtn")).toBeVisible();
        } finally {
            await context.setOffline(false);
        }
    });
});

// Befunde aus dem zweiten THW-Review vom 2026-10-05 (docs/reviews/2026-10-05-thw/).
test("@uebungsleitung Debrief: ein Klick, genau ein Download (offline P3-4)", async ({ page }) => {
    await page.goto("/#/uebungsleitung/u1");
    const knopf = page.locator("button[data-action=\"download-debrief\"]").first();
    await expect(knopf).toBeVisible();
    let downloads = 0;
    page.on("download", () => {
        downloads += 1;
    });
    const erster = page.waitForEvent("download");
    await knopf.click();
    const datei = await erster;
    await page.waitForTimeout(1500);
    expect(downloads).toBe(1);
    // Nur ASCII im Dateinamen, sonst kam die Datei als „download“ an.
    expect(datei.suggestedFilename()).toMatch(/^[\x20-\x7E]+\.pdf$/);
});

test("@uebungsleitung Link ohne Übungs-ID zeigt eine Meldung statt eines leeren Gerüsts (error-recovery P3-4)", async ({ page }) => {
    await page.goto("/#/uebungsleitung/");
    await expect(page.locator("#uebungsleitungMeta")).toContainText("fehlt die Übungs-ID");
});

test.describe("Druckteil ohne Service Worker", () => {
// Der Service Worker holt den Neuversuch sonst selbst ab, an page.route
// vorbei; geprüft wird hier der Lader in der Seite.
test.use({ serviceWorkers: "block" });

test("@generator Druckteil nach Netzaussetzer ohne Neuladen wieder ladbar, eine Meldung (offline P1-1, P3-2)", async ({ page }) => {
    // Auch Neuversuche mit angehängtem Parameter blockieren.
    const druckteil = /\/pdfGenerator-[^/]*\.js/;
    await page.route(druckteil, route => route.abort("internetdisconnected"));
    await page.goto("/#/generator/u1");
    const zip = page.locator("#zipAllPdfsBtn");
    await expect(zip).toBeVisible();

    await zip.click();
    await expect(page.locator(".app-toast.is-error")).toHaveCount(1);
    await zip.click();
    await expect(page.locator(".app-toast.is-error")).toHaveCount(1);
    await expect(page.locator(".app-toast.is-error")).toContainText("Druckfunktion");

    await page.unroute(druckteil);
    const download = page.waitForEvent("download", { timeout: 20_000 });
    await zip.click();
    expect((await download).suggestedFilename()).toMatch(/^[\x20-\x7E]+\.zip$/);
});
});

test.describe("@seo Theme-Umschalter (Night Befunde 5, 6)", () => {
    test("Inhaltsseite: umschalten, beschriften, merken", async ({ page }) => {
        await page.goto("/buchstabiertafel/");
        const knopf = page.getByTestId("theme-toggle-seite");
        await expect(knopf).toHaveText("🌙 Dark Mode");
        await knopf.click();
        await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
        await expect(knopf).toHaveText("☀️ Light Mode");
        await page.reload();
        await expect(page.locator("body")).toHaveAttribute("data-theme", "dark");
        await expect(page.getByTestId("theme-toggle-seite")).toHaveText("☀️ Light Mode");
    });

    test("Inhaltsseite am Smartphone: Umschalter sichtbar, Inhalt nicht breiter als der Bildschirm", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 800 });
        for (const pfad of ["/buchstabiertafel/", "/anleitung/"]) {
            await page.goto(pfad);
            await expect(page.getByTestId("theme-toggle-seite-mobil")).toBeVisible();
            const breite = await page.locator("main").evaluate(el => el.getBoundingClientRect().right);
            expect(breite, pfad).toBeLessThanOrEqual(375);
        }
    });

    test("App: Beschriftung stimmt schon vor dem Bundle", async ({ page, context }) => {
        await context.addInitScript(() => window.localStorage.setItem("theme", "dark"));
        await page.route("**/bundle.js", async route => {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await route.continue();
        });
        await page.goto("/", { waitUntil: "commit" });
        await expect(page.getByTestId("theme-toggle-desktop")).toHaveText("☀️ Light Mode", { timeout: 1200 });
    });
});
