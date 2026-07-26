import { expect, test, type Page } from "@playwright/test";

const setParticipants = async (page: Page, names: string[]) => {
    const addButton = page.locator("#addTeilnehmerBtn");
    const inputs = page.locator("#teilnehmer-body .teilnehmer-input");

    while ((await inputs.count()) < names.length) {
        await addButton.click();
    }

    const total = await inputs.count();
    for (let i = 0; i < total; i++) {
        const input = inputs.nth(i);
        await input.fill(names[i] ?? "");
    }
};

const makeSeedData = () => {
    const base = {
        id: "u1",
        name: "Mock Übung",
        datum: "2026-02-14T09:00:00.000Z",
        createDate: "2026-02-14T20:00:00.000Z",
        buildVersion: "dev",
        uebungCode: "K7M4Q2",
        leitung: "Heros Wind 10",
        rufgruppe: "T_OL_GOLD-1",
        teilnehmerListe: ["Heros Oldenburg 16/11", "Heros Oldenburg 17/12"],
        teilnehmerIds: {
            A1B2: "Heros Oldenburg 16/11",
            C3D4: "Heros Oldenburg 17/12"
        },
        teilnehmerStellen: {
            "Heros Oldenburg 16/11": "Trupp Alpha",
            "Heros Oldenburg 17/12": "Trupp Bravo"
        },
        nachrichten: {
            "Heros Oldenburg 16/11": [
                { id: 1, empfaenger: ["Heros Oldenburg 17/12"], nachricht: "Lage unverändert." },
                { id: 3, empfaenger: ["Heros Oldenburg 17/12"], nachricht: "Meldepunkt erreicht." }
            ],
            "Heros Oldenburg 17/12": [
                { id: 2, empfaenger: ["Heros Oldenburg 16/11"], nachricht: "Verstanden und wiederhole: Lage okay." }
            ]
        },
        spruecheProTeilnehmer: 10,
        spruecheAnAlle: 1,
        spruecheAnMehrere: 2,
        buchstabierenAn: 0,
        loesungswoerter: {
            "Heros Oldenburg 16/11": "ALPHA",
            "Heros Oldenburg 17/12": "BRAVO"
        },
        loesungsStaerken: {},
        checksumme: "abc",
        funksprueche: [],
        anmeldungAktiv: true,
        verwendeteVorlagen: ["thwleer"],
        istStandardKonfiguration: false
    };

    const result: Record<string, typeof base> = { u1: base };
    for (let i = 2; i <= 12; i++) {
        const id = `u${i}`;
        const hour = String(20 - i).padStart(2, "0");
        result[id] = {
            ...base,
            id,
            name: `Seed Übung ${i}`,
            createDate: `2026-02-14T${hour}:00:00.000Z`
        };
    }
    return result;
};

// Auf dem Context statt der Seite, damit auch zusätzlich geöffnete Tabs
// (Live-Sync-Tests) denselben Seed sehen.
test.beforeEach(async ({ context }) => {
    const seedData = makeSeedData();
    await context.addInitScript(seed => {
        window.localStorage.setItem("useFirestoreEmulator", "1");
        window.localStorage.setItem("e2eFirestoreSeed", JSON.stringify(seed));
    }, seedData);
});

test("@smoke @generator loads main app shell", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sprechfunk Übungsgenerator" })).toBeVisible();
    await expect(page.getByTestId("route-generator")).toBeVisible();
});

test("@smoke @generator double click on theme toggle enables startrek theme", async ({ page }) => {
    await page.goto("/");
    const btn = page.getByTestId("theme-toggle-desktop");
    await btn.dblclick();
    await expect(page.locator("body")).toHaveAttribute("data-theme", "startrek");
});

test("@generator generator loesungswort option toggles central input", async ({ page }) => {
    await page.goto("/");
    const centralRadio = page.locator("#zentralLoesungswort");
    const centralInput = page.locator("#zentralLoesungswortContainer");
    await centralRadio.check();
    await expect(centralInput).toBeVisible();
});

test("@generator generator source toggle switches between templates and upload", async ({ page }) => {
    await page.goto("/");
    const uploadRadio = page.locator("#optionUpload");
    const vorlagenRadio = page.locator("#optionVorlagen");
    const vorlagenSelect = page.locator("#funkspruchVorlage");
    const uploadContainer = page.locator("#fileUploadContainer");

    await expect(vorlagenSelect).toBeVisible();
    await expect(uploadContainer).toBeHidden();

    await uploadRadio.check();
    await expect(uploadContainer).toBeVisible();

    await vorlagenRadio.check();
    await expect(uploadContainer).toBeHidden();
});

test("@generator quick join strip is always visible on generator route", async ({ page }) => {
    await page.goto("/#/generator");

    const joinForm = page.locator("#generatorQuickJoinForm");
    const uebungCodeInput = page.locator("#generatorQuickJoinUebungCode");
    const teilnehmerCodeInput = page.locator("#generatorQuickJoinTeilnehmerCode");
    const submitButton = page.locator("#generatorQuickJoinForm button[type='submit']");

    await expect(joinForm).toBeVisible();
    await expect(uebungCodeInput).toBeVisible();
    await expect(teilnehmerCodeInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    await page.goto("/#/teilnehmer");
    await expect(page.locator("#teilnehmerArea")).toBeVisible();

    await page.goto("/#/generator");
    await expect(joinForm).toBeVisible();
    await expect(uebungCodeInput).toBeVisible();
    await expect(teilnehmerCodeInput).toBeVisible();
});

test("@generator distribution percent inputs are editable and update absolute values", async ({ page }) => {
    await page.goto("/");

    const proTeilnehmer = page.locator("#spruecheProTeilnehmer");
    const prozentMehrere = page.locator("#prozentAnMehrere");
    const prozentBuchstabieren = page.locator("#prozentAnBuchstabieren");

    await proTeilnehmer.fill("100");

    await prozentMehrere.fill("6");
    await expect(prozentMehrere).toHaveValue("6");
    await expect(page.locator("#spruecheAnMehrere")).toHaveValue("6");
    await expect(page.locator("#calcAnMehrere")).toHaveText("6");

    await prozentBuchstabieren.fill("1");
    await expect(prozentBuchstabieren).toHaveValue("1");
    await expect(page.locator("#spruecheAnBuchstabieren")).toHaveValue("1");
    await expect(page.locator("#calcAnBuchstabieren")).toHaveText("1");

    await prozentBuchstabieren.press("ArrowUp");
    await expect(prozentBuchstabieren).toHaveValue("2");
    await expect(page.locator("#spruecheAnBuchstabieren")).toHaveValue("2");
    await expect(page.locator("#calcAnBuchstabieren")).toHaveText("2");
});

test("@generator can add participant row in generator table", async ({ page }) => {
    await page.goto("/");
    const rows = page.locator("#teilnehmer-body tr");
    const addBtn = page.locator("#addTeilnehmerBtn");

    const before = await rows.count();
    await addBtn.click();
    await expect(rows).toHaveCount(before + 1);
});

test("@generator all generator inputs are editable and keep values", async ({ page }) => {
    await page.goto("/");

    await page.locator("#datum").fill("2026-02-15");
    await page.locator("#nameDerUebung").fill("E2E Übung");
    await page.locator("#rufgruppe").fill("RG-42");
    await page.locator("#leitung").fill("Heros Test 1");
    await page.locator("#spruecheProTeilnehmer").fill("12");
    await page.locator("#prozentAnAlle").fill("8");
    await page.locator("#prozentAnMehrere").fill("16");
    await page.locator("#prozentAnBuchstabieren").fill("4");
    await page.locator("#anmeldungAktiv").uncheck();
    await page.locator("#autoStaerkeErgaenzen").check();

    await expect(page.locator("#datum")).toHaveValue("2026-02-15");
    await expect(page.locator("#nameDerUebung")).toHaveValue("E2E Übung");
    await expect(page.locator("#rufgruppe")).toHaveValue("RG-42");
    await expect(page.locator("#leitung")).toHaveValue("Heros Test 1");
    await expect(page.locator("#spruecheProTeilnehmer")).toHaveValue("12");
    await expect(page.locator("#prozentAnAlle")).toHaveValue("8");
    await expect(page.locator("#prozentAnMehrere")).toHaveValue("16");
    await expect(page.locator("#prozentAnBuchstabieren")).toHaveValue("4");
    await expect(page.locator("#spruecheAnAlle")).toHaveValue("1");
    await expect(page.locator("#spruecheAnMehrere")).toHaveValue("2");
    await expect(page.locator("#spruecheAnBuchstabieren")).toHaveValue("0");
    await expect(page.locator("#anmeldungAktiv")).not.toBeChecked();
    await expect(page.locator("#autoStaerkeErgaenzen")).toBeChecked();

    await page.locator("#optionUpload").check();
    await expect(page.locator("#fileUploadContainer")).toBeVisible();
    await page.locator("#funksprueche").setInputFiles({
        name: "funksprueche.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("TEST 1\nTEST 2\n")
    });
    const uploadedName = await page.locator("#funksprueche").evaluate(el => (el as HTMLInputElement).files?.[0]?.name ?? "");
    expect(uploadedName).toBe("funksprueche.txt");

    await page.locator("#optionVorlagen").check();
    await expect(page.locator("#fileUploadContainer")).toBeHidden();
    // Bewusst ohne feste Anzahl: Die Vorlagenliste waechst, der Test darf davon nicht brechen.
    await expect(page.locator("#funkspruchVorlage option")).not.toHaveCount(0);
    await expect(page.locator("#funkspruchVorlage option[value='thwleer']")).toHaveCount(1);
    await expect(page.locator("#funkspruchVorlage option[value='thwmelle']")).toHaveCount(1);
    await page.selectOption("#funkspruchVorlage", ["thwleer", "thwmelle"]);
    const selectedTemplates = await page.locator("#funkspruchVorlage").evaluate(el =>
        Array.from((el as HTMLSelectElement).selectedOptions).map(o => o.value)
    );
    expect(selectedTemplates).toEqual(["thwleer", "thwmelle"]);

    await page.locator("#zentralLoesungswort").check();
    await expect(page.locator("#zentralLoesungswortContainer")).toBeVisible();
    await page.locator("#zentralLoesungswortInput").fill("DELTA");
    await expect(page.locator("#zentralLoesungswortInput")).toHaveValue("DELTA");
    await page.locator("#individuelleLoesungswoerter").check();
    await expect(page.locator("#loesungswortHeader")).toBeVisible();
    await page.locator("#keineLoesungswoerter").check();
    await expect(page.locator("#zentralLoesungswortContainer")).toBeHidden();

    const firstTeilnehmer = page.locator("#teilnehmer-body .teilnehmer-input").first();
    await firstTeilnehmer.fill("Heros E2E 11/1");
    await expect(firstTeilnehmer).toHaveValue("Heros E2E 11/1");
    await page.locator("#showStellennameCheckbox").check();
    const firstStelle = page.locator("#teilnehmer-body .stellenname-input").first();
    await firstStelle.fill("FGr 1");
    await expect(firstStelle).toHaveValue("FGr 1");
});

test("@generator generates exercise with extended custom participant list", async ({ page }) => {
    await page.goto("/");

    await setParticipants(page, [
        "Florian Musterstadt 33/44",
        "Heros Beispielstadt 42/1",
        "Florian Musterstadt 54/2",
        "Heros Beispielstadt 61/10"
    ]);
    await page.locator("#nameDerUebung").fill("OV Funkprobe");
    await page.selectOption("#funkspruchVorlage", ["thwleer"]);

    await page.locator("#startUebungBtn").click();

    await expect(page.locator("#uebung-links")).toBeVisible();
    await expect(page.locator("#links-teilnehmer-container .generator-link-row[data-link-type='teilnehmer']")).toHaveCount(4);
    await expect(page.locator("#links-teilnehmer-container")).toContainText("Florian Musterstadt 33/44");
    await expect(page.locator("#links-teilnehmer-container")).toContainText("Heros Beispielstadt 42/1");
    await expect(page.locator("#links-teilnehmer-container")).toContainText("Florian Musterstadt 54/2");
    await expect(page.locator("#links-teilnehmer-container")).toContainText("Heros Beispielstadt 61/10");
    await expect(page.locator("#links-teilnehmer-container .generator-link-row[data-link-type='teilnehmer'] .generator-link-url code").first()).toContainText("#/teilnehmer?uc=");
    await expect(page.locator("#links-teilnehmer-container")).toContainText("Teilnehmer Code:");
});

test("@generator blocks generation when participant names are duplicates", async ({ page }) => {
    await page.goto("/");

    await setParticipants(page, [
        "Florian Musterstadt 33/44",
        "Florian Musterstadt 33/44"
    ]);

    await page.locator("#startUebungBtn").click();

    await expect(page.locator("#globalToastContainer")).toContainText("Teilnehmernamen müssen eindeutig sein.");
    await expect(page.locator("#uebung-links")).toBeHidden();
});

test("@generator blocks generation when no participant name is provided", async ({ page }) => {
    await page.goto("/");

    await setParticipants(page, ["", ""]);

    await page.locator("#startUebungBtn").click();

    await expect(page.locator("#globalToastContainer")).toContainText("Bitte mindestens einen Teilnehmer mit Funkrufnamen angeben.");
    await expect(page.locator("#uebung-links")).toBeHidden();
});

test("@generator individual loesungswoerter shows per-participant inputs", async ({ page }) => {
    await page.goto("/");
    await page.locator("#individuelleLoesungswoerter").check();

    await expect(page.locator("#loesungswortHeader")).toBeVisible();
    await expect(page.locator("#teilnehmer-body input[id^='loesungswort-']").first()).toBeVisible();
});

test("@generator none loesungswoerter hides central input and shuffle button", async ({ page }) => {
    await page.goto("/");

    await page.locator("#zentralLoesungswort").check();
    await expect(page.locator("#zentralLoesungswortContainer")).toBeVisible();
    await expect(page.locator("#shuffleButton")).toBeVisible();

    await page.locator("#keineLoesungswoerter").check();
    await expect(page.locator("#zentralLoesungswortContainer")).toBeHidden();
    await expect(page.locator("#shuffleButton")).toBeHidden();
});

test("@generator show stellenname toggle adds and removes column", async ({ page }) => {
    await page.goto("/");
    const checkbox = page.locator("#showStellennameCheckbox");

    await checkbox.check();
    await expect(page.getByRole("columnheader", { name: "Name der Stelle" })).toBeVisible();

    await checkbox.uncheck();
    await expect(page.getByRole("columnheader", { name: "Name der Stelle" })).toBeHidden();
});

test("@generator delete participant removes a row", async ({ page }) => {
    await page.goto("/");
    const rows = page.locator("#teilnehmer-body tr");
    const deleteButtons = page.locator(".delete-teilnehmer");

    const before = await rows.count();
    await deleteButtons.first().click();
    await expect(rows).toHaveCount(before - 1);
});

test("@smoke @generator theme toggle click switches between light and dark", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const btn = page.getByTestId("theme-toggle-desktop");

    await expect(body).toHaveAttribute("data-theme", "light");
    await btn.click();
    await expect(body).toHaveAttribute("data-theme", "dark");
    await btn.click();
    await expect(body).toHaveAttribute("data-theme", "light");
});

test("@smoke loads howto markdown into modal content", async ({ page }) => {
    await page.goto("/");

    await page.evaluate(() => {
        const modal = document.getElementById("howtoModal");
        if (modal) {
            modal.dispatchEvent(new Event("show.bs.modal"));
        }
    });

    await expect(page.locator("#howtoContent")).not.toContainText("Lädt...");
    await expect(page.locator("#howtoContent")).toContainText("Sprechfunk");
});

const readJsonLd = (page: Page) =>
    page.$$eval("script[type='application/ld+json']", nodes =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodes.map(node => JSON.parse(node.textContent ?? "{}") as any)
    );

test("@smoke start page exposes SoftwareApplication schema and links the content pages", async ({ page }) => {
    await page.goto("/");

    const [software] = await readJsonLd(page);
    expect(software["@type"]).toContain("SoftwareApplication");
    expect(software.applicationCategory).toContain("EmergencyApplication");
    expect(software.license).toContain("EUPL-1.2");
    expect(software.softwareHelp.url).toContain("/anleitung/");

    await expect(page.getByTestId("footer-link-anleitung")).toHaveAttribute("href", "anleitung/");
    await expect(page.getByTestId("footer-link-faq")).toHaveAttribute("href", "faq/");
    await expect(page.getByTestId("footer-link-buchstabiertafel")).toHaveAttribute("href", "buchstabiertafel/");
    await expect(page.getByTestId("footer-link-meldevordruck")).toHaveAttribute("href", "meldevordruck/");
    await expect(page.getByTestId("footer-link-funksprueche")).toHaveAttribute("href", "funksprueche/");
    await expect(page.getByTestId("footer-link-impressum")).toHaveAttribute("href", "impressum/");
    await expect(page.getByTestId("footer-link-datenschutz")).toHaveAttribute("href", "datenschutz/");

    const website = (await readJsonLd(page)).find(entry => entry["@type"] === "WebSite");
    expect(website.publisher.sameAs).toContain("https://github.com/wattnpapa");
});

test("@smoke start page shows the intro text only in generator mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("seo-intro")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Sprechfunkübungen erstellen/ })).toBeVisible();

    await page.goto("/#/admin");
    await expect(page.getByTestId("seo-intro")).toBeHidden();
});

test("@smoke buchstabiertafel page lists the BOS and DIN 5009 tables", async ({ page }) => {
    await page.goto("/buchstabiertafel/");

    await expect(page).toHaveTitle(/Buchstabiertafel/);
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute(
        "href",
        "https://sprechfunk-uebung.de/buchstabiertafel/"
    );

    // Stichproben aus allen drei Tafeln – vertauschte Spalten fielen sonst nicht auf.
    await expect(page.getByRole("cell", { name: "Anton", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Chemnitz", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Foxtrot", exact: true })).toBeVisible();

    const types = (await readJsonLd(page)).map(entry => entry["@type"]);
    expect(types).toContain("Article");
    expect(types).toContain("BreadcrumbList");
});

test("@smoke meldevordruck page offers the blank PDFs", async ({ page }) => {
    await page.goto("/meldevordruck/");

    await expect(page).toHaveTitle(/Meldevordruck/);
    await expect(page.locator("a[href$='assets/meldevordruck.pdf']")).toBeVisible();
    await expect(page.locator("a[href$='assets/nachrichtenvordruck4fach.pdf']")).toBeVisible();
    await expect(page.locator("img[src$='assets/meldevordruck.png']")).toHaveAttribute("alt", /Meldevordruck/);
});

test("@smoke funksprueche page explains the template format", async ({ page }) => {
    await page.goto("/funksprueche/");

    await expect(page).toHaveTitle(/Funksprüche/);
    await expect(page.getByRole("heading", { name: /Buchstabieraufgaben einbauen/ })).toBeVisible();
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute(
        "href",
        "https://sprechfunk-uebung.de/funksprueche/"
    );
});

test("@smoke legal pages are reachable as own URLs", async ({ page }) => {
    await page.goto("/impressum/");
    await expect(page.getByRole("heading", { name: "Impressum" })).toBeVisible();
    await expect(page.getByText("Angaben gemäß § 5 DDG")).toBeVisible();

    await page.goto("/datenschutz/");
    await expect(page.getByRole("heading", { name: "Datenschutzerklärung" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Reichweitenmessung \(GoatCounter\)/ })).toBeVisible();
});

test("@smoke anleitung page is crawlable without the app bundle", async ({ page }) => {
    await page.goto("/anleitung/");

    await expect(page).toHaveTitle(/Anleitung/);
    await expect(page.getByRole("heading", { name: /Sprechfunkübung erstellen und durchführen/ })).toBeVisible();
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute(
        "href",
        "https://sprechfunk-uebung.de/anleitung/"
    );

    const types = (await readJsonLd(page)).map(entry => entry["@type"]);
    expect(types).toContain("HowTo");
    expect(types).toContain("BreadcrumbList");
});

test("@smoke faq page exposes FAQPage schema matching the visible questions", async ({ page }) => {
    await page.goto("/faq/");

    await expect(page).toHaveTitle(/FAQ/);
    await expect(page.getByRole("heading", { name: "Für wen ist die Anwendung gedacht?" })).toBeVisible();

    const faq = (await readJsonLd(page)).find(entry => entry["@type"] === "FAQPage");
    expect(faq.mainEntity.length).toBeGreaterThan(5);
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toContain("Für wen ist die Anwendung gedacht?");
});

test("@smoke @routing route #/generator keeps generator area visible", async ({ page }) => {
    await page.goto("/#/generator");

    await expect(page.locator("#mainAppArea")).toBeVisible();
    await expect(page.locator("#teilnehmerArea")).toBeHidden();
    await expect(page.locator("#uebungsleitungArea")).toBeHidden();
    await expect(page.locator("#adminArea")).toBeHidden();
});

test("@routing @teilnehmer route #/teilnehmer without params shows invalid link message", async ({ page }) => {
    await page.goto("/#/teilnehmer");

    await expect(page.locator("#teilnehmerArea")).toBeVisible();
    await expect(page.locator("#mainAppArea")).toBeHidden();
    await expect(page.locator("#teilnehmerJoinForm")).toBeVisible();
    await expect(page.locator("#joinUebungCode")).toBeVisible();
    await expect(page.locator("#joinTeilnehmerCode")).toBeVisible();
});

test("@routing @teilnehmer route #/teilnehmer with code params prefills join form", async ({ page }) => {
    await page.goto("/#/teilnehmer?uc=k7m4q2&tc=a1b2");

    await expect(page.locator("#joinUebungCode")).toHaveValue("K7M4Q2");
    await expect(page.locator("#joinTeilnehmerCode")).toHaveValue("A1B2");
});

test("@routing @uebungsleitung route #/uebungsleitung without id still switches app mode", async ({ page }) => {
    await page.goto("/#/uebungsleitung");

    await expect(page.locator("#uebungsleitungArea")).toBeVisible();
    await expect(page.locator("#mainAppArea")).toBeHidden();
    await expect(page.locator("#teilnehmerArea")).toBeHidden();
});

test("@routing @admin route #/admin switches to admin area and shows table ui", async ({ page }) => {
    await page.goto("/#/admin");

    await expect(page.locator("#adminArea")).toBeVisible();
    await expect(page.locator("#mainAppArea")).toBeHidden();
    await expect(page.locator("#adminSearchInput")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Name der Übung" })).toBeVisible();
});

test("@routing hash navigation switches between generator and teilnehmer mode", async ({ page }) => {
    await page.goto("/#/generator");
    await expect(page.locator("#mainAppArea")).toBeVisible();

    await page.evaluate(() => {
        window.location.hash = "#/teilnehmer";
    });
    await expect(page.locator("#teilnehmerArea")).toBeVisible();
    await expect(page.locator("#teilnehmerJoinForm")).toBeVisible();
    await expect(page.locator("#joinUebungCode")).toBeVisible();
    await expect(page.locator("#joinTeilnehmerCode")).toBeVisible();

    await page.evaluate(() => {
        window.location.hash = "#/generator";
    });
    await expect(page.locator("#mainAppArea")).toBeVisible();
});

test("@routing hash navigation switches between generator and admin mode", async ({ page }) => {
    await page.goto("/#/generator");
    await expect(page.locator("#mainAppArea")).toBeVisible();

    await page.evaluate(() => {
        window.location.hash = "#/admin";
    });
    await expect(page.locator("#adminArea")).toBeVisible();
    await expect(page.locator("#mainAppArea")).toBeHidden();
});

test("@routing sets html title per module route", async ({ page }) => {
    await page.goto("/#/generator");
    await expect(page).toHaveTitle("Sprechfunkuebung - Generator");

    await page.goto("/#/admin");
    await expect(page).toHaveTitle("Sprechfunkuebung - Admin");

    await page.goto("/#/uebungsleitung/u1");
    await expect(page).toHaveTitle("Sprechfunkuebung - Uebungsleitung");

    await page.goto("/#/teilnehmer/u1/A1B2");
    await expect(page).toHaveTitle("Sprechfunkuebung - Teilnehmer");
});

test("@teilnehmer join form resolves short codes and opens participant view", async ({ page }) => {
    await page.goto("/#/teilnehmer");

    await page.locator("#joinUebungCode").fill("k7m4q2");
    await page.locator("#joinTeilnehmerCode").fill("a1b2");
    await page.locator("#joinSubmitBtn").click();

    await expect(page).toHaveURL(/#\/teilnehmer\/u1\/A1B2$/);
    await expect(page.locator("#teilnehmerContent")).toContainText("Heros Oldenburg 16/11");
});

test("@admin admin route renders seeded data", async ({ page }) => {
    await page.goto("/#/admin");

    await expect(page.locator("#adminArea")).toBeVisible();
    await expect(page.locator("#adminUebungslisteBody")).toContainText("Mock Übung");
    await expect(page.locator("#infoGesamtUebungen")).toContainText("12");
});

test("@admin admin search filters seeded table rows", async ({ page }) => {
    await page.goto("/#/admin");
    const search = page.locator("#adminSearchInput");

    await search.fill("Seed Übung 2");
    await expect(page.locator("#adminUebungslisteBody tr:visible")).toHaveCount(1);
    await expect(page.locator("#adminUebungslisteBody tr:visible")).toContainText("Seed Übung 2");
});

test("@admin admin pagination next loads second page from seed", async ({ page }) => {
    await page.goto("/#/admin");

    await expect(page.locator("#adminUebungslisteBody")).toContainText("Mock Übung");
    await page.getByRole("button", { name: "Nächste →" }).click();
    await expect(page.locator("#adminUebungslisteBody")).toContainText("Seed Übung 11");
});

test("@admin admin previous returns to first page after next", async ({ page }) => {
    await page.goto("/#/admin");

    await page.getByRole("button", { name: "Nächste →" }).click();
    await expect(page.locator("#adminUebungslisteBody")).toContainText("Seed Übung 11");

    await page.getByRole("button", { name: "← Vorherige" }).click();
    await expect(page.locator("#adminUebungslisteBody")).toContainText("Mock Übung");
});

test("@admin admin delete removes seeded exercise row", async ({ page }) => {
    await page.goto("/#/admin");

    page.once("dialog", dialog => dialog.accept());
    const targetRow = page.locator("#adminUebungslisteBody tr", { hasText: "Mock Übung" }).first();
    await targetRow.locator("button[data-action='delete']").click();
    await expect(page.locator("#adminUebungslisteBody")).not.toContainText("Mock Übung");
});

test("@uebungsleitung uebungsleitung route renders seeded data and can mark anmelden", async ({ page }) => {
    await page.goto("/#/uebungsleitung/u1");

    await expect(page.locator("#uebungsleitungArea")).toBeVisible();
    await expect(page.locator("#uebungsleitungMeta")).toContainText("Mock Übung");

    const row = page.locator("#uebungsleitungTeilnehmer tr", { hasText: "Heros Oldenburg 16/11" });
    await row.locator("button[data-action='anmelden']").click();
    await expect(row.locator(".badge.bg-success")).toBeVisible();
});

test("@uebungsleitung uebungsleitung filters by sender, empfaenger and nachricht text", async ({ page }) => {
    await page.goto("/#/uebungsleitung/u1");

    await page.locator("#senderFilterSelect").selectOption("Heros Oldenburg 17/12");
    await expect(page.locator("#uebungsleitungNachrichten tbody tr")).toHaveCount(1);
    await expect(page.locator("#uebungsleitungNachrichten tbody tr")).toContainText("Verstanden und wiederhole");

    await page.locator("#senderFilterSelect").selectOption("");
    await page.locator("#empfaengerFilterSelect").selectOption("Heros Oldenburg 17/12");
    await expect(page.locator("#uebungsleitungNachrichten tbody tr")).toHaveCount(2);

    await page.locator("#nachrichtenTextFilterInput").fill("Meldepunkt");
    await expect(page.locator("#uebungsleitungNachrichten tbody tr")).toHaveCount(1);
    await expect(page.locator("#uebungsleitungNachrichten tbody tr")).toContainText("Meldepunkt erreicht.");
});

test("@teilnehmer teilnehmer route renders seeded messages and toggles status chip", async ({ page }) => {
    await page.goto("/#/teilnehmer/u1/A1B2");

    await expect(page.locator("#teilnehmerArea")).toBeVisible();
    await expect(page.locator("#teilnehmerContent")).toContainText("Heros Oldenburg 16/11");
    await expect(page.locator("#teilnehmerNachrichtenBody")).toContainText("Lage unverändert.");

    const firstRow = page.locator("#teilnehmerNachrichtenBody tr").first();
    await firstRow.locator(".btn-toggle-uebertragen-chip").click();
    await expect(firstRow).toHaveClass(/status-ok-row/);
});

test("@teilnehmer @uebungsleitung teilnehmer status reaches the uebungsleitung live", async ({ context }) => {
    const leitung = await context.newPage();
    await leitung.goto("/#/uebungsleitung/u1");
    await expect(leitung.locator("#uebungsleitungTeilnehmer")).toContainText("keine Meldung");
    await expect(leitung.locator("#nachrichtenProgressLabel")).toHaveText("0 / 3");

    const teilnehmer = await context.newPage();
    await teilnehmer.goto("/#/teilnehmer/u1/A1B2");
    await teilnehmer.locator("#teilnehmerNachrichtenBody tr").first()
        .locator(".btn-toggle-uebertragen-chip").click();

    // Die Übungsleitung sieht die Selbstmeldung, ohne selbst etwas anzuklicken.
    const zeile = leitung.locator("#uebungsleitungTeilnehmer tbody tr").filter({ hasText: "16/11" });
    await expect(zeile).toContainText("1", { timeout: 10000 });
    await expect(leitung.locator("#nachrichtenProgressLabel")).toContainText("1 / 3");
    await expect(leitung.locator("#nachrichtenProgressLabel")).toContainText("1 nur gemeldet");
    await expect(leitung.locator("#uebungsleitungNachrichten")).toContainText("gemeldet");
    await expect(leitung.locator("#uebungsleitungLiveSyncBadge")).toContainText("live");
});

test("@teilnehmer @uebungsleitung leitung confirmation reaches the teilnehmer live", async ({ context }) => {
    const teilnehmer = await context.newPage();
    await teilnehmer.goto("/#/teilnehmer/u1/A1B2");
    await expect(teilnehmer.locator("#teilnehmerLiveSyncBadge")).toContainText("live");

    const leitung = await context.newPage();
    await leitung.goto("/#/uebungsleitung/u1");
    await leitung.locator("#uebungsleitungNachrichten button[data-action='abgesetzt'][data-nr='1']").click();

    const zeile = teilnehmer.locator("#teilnehmerNachrichtenBody tr").first();
    await expect(zeile).toContainText("bestätigt", { timeout: 10000 });
});

test("@teilnehmer teilnehmer keyboard shortcuts work in modal", async ({ page }) => {
    await page.goto("/#/teilnehmer/u1/A1B2");

    await page.locator("[data-doc-view='meldevordruck']").click();
    await expect(page.locator("#teilnehmerDocModal")).toHaveClass(/show/);
    await expect(page.locator("#teilnehmerDocPage")).toContainText("Seite 1 / 2");

    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#teilnehmerDocPage")).toContainText("Seite 2 / 2");

    await page.keyboard.press("Space");
    const transmittedRow = page.locator("#teilnehmerNachrichtenBody tr", { hasText: "Meldepunkt erreicht." });
    await expect(transmittedRow).toHaveClass(/status-ok-row/);

    await page.locator("#toggle-hide-transmitted-modal").check();
    await expect(page.locator("#toggle-hide-transmitted-modal")).toBeChecked();

    await page.keyboard.press("KeyN");
    await expect(page.locator("[data-doc-view='nachrichtenvordruck']")).toHaveClass(/active/);

    await page.keyboard.press("KeyM");
    await expect(page.locator("[data-doc-view='meldevordruck']")).toHaveClass(/active/);

    await page.keyboard.press("Escape");
    await expect(page.locator("#teilnehmerDocModal")).not.toHaveClass(/show/);
});

// Zaehlt die nicht-weissen Pixel eines Canvas. Damit pruefen die folgenden Tests,
// dass wirklich gezeichnet wurde - ein leeres Canvas ist sonst nicht von einem
// erfolgreich gerenderten zu unterscheiden.
const countPaintedPixels = async (page: Page, selector: string) => {
    return page.locator(selector).evaluate(el => {
        const canvas = el as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) {
            return 0;
        }
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0;
        for (let i = 0; i < data.length; i += 4) {
            const isWhite = data[i]! > 240 && data[i + 1]! > 240 && data[i + 2]! > 240;
            if (data[i + 3]! > 0 && !isWhite) {
                painted++;
            }
        }
        return painted;
    });
};

test("@teilnehmer @pdf doc preview renders pdf content onto the canvas", async ({ page }) => {
    await page.goto("/#/teilnehmer/u1/A1B2");

    await page.locator("[data-doc-view='meldevordruck']").click();
    await expect(page.locator("#teilnehmerDocModal")).toHaveClass(/show/);

    const canvas = page.locator("#teilnehmerPdfCanvas");
    await expect(canvas).toBeVisible();

    // pdf.js rendert asynchron in den Canvas - deshalb pollen statt einmal messen.
    await expect.poll(
        () => countPaintedPixels(page, "#teilnehmerPdfCanvas"),
        { message: "pdf.js hat nichts in den Vorschau-Canvas gezeichnet" }
    ).toBeGreaterThan(100);
});

test("@generator multi-select dropdown selects, searches and removes templates via mouse", async ({ page }) => {
    await page.goto("/");

    // Die uebrigen Tests setzen die Vorlagen per selectOption direkt am nativen
    // <select>. Hier laeuft alles ueber das Multi-Select-Widget, damit
    // Bundling- und Verdrahtungsregressionen auffallen.
    const container = page.locator(".multiselect").first();
    await expect(container).toBeVisible();

    const chips = container.locator(".multiselect-chip");
    const dropdown = container.locator(".multiselect-dropdown");
    const search = container.locator(".multiselect-search");
    const selectedValues = () => page.locator("#funkspruchVorlage").evaluate(el =>
        Array.from((el as HTMLSelectElement).selectedOptions).map(o => o.value)
    );

    // Standardmaessig sind alle Vorlagen vorausgewaehlt - ohne feste Anzahl
    // pruefen, damit neue Vorlagen den Test nicht brechen.
    const before = await chips.count();
    expect(before).toBeGreaterThan(0);
    expect(await selectedValues()).toContain("thwleer");

    await search.click();
    await expect(dropdown).toBeVisible();

    // Klick auf eine bereits gewaehlte Option nimmt sie aus der Auswahl, das
    // Dropdown bleibt fuer weitere Klicks offen.
    await container.locator(".multiselect-option", { hasText: "Funksprüche THW Leer" }).first().click();
    await expect(chips).toHaveCount(before - 1);
    expect(await selectedValues()).not.toContain("thwleer");
    await expect(dropdown).toBeVisible();

    // Zu, damit die folgende Sequenz beim geschlossenen Dropdown startet - so wie
    // ein Nutzer, der nur einen Chip loswerden will.
    await page.keyboard.press("Escape");
    await expect(dropdown).toBeHidden();

    // Chip-Entfernen muss ebenfalls auf das native <select> durchschlagen.
    const remaining = await selectedValues();
    await chips.first().locator(".multiselect-chip-remove").click();
    await expect(chips).toHaveCount(before - 2);
    expect((await selectedValues()).length).toBe(remaining.length - 1);

    // Der Klick auf das x darf das Dropdown nicht mit aufziehen - sonst wuerde
    // der naechste Mausklick es schliessen statt oeffnen.
    await expect(dropdown).toBeHidden();

    // Genau diese Sequenz war unter select2 kaputt: nach dem Entfernen liess sich
    // das Dropdown per Maus nicht mehr oeffnen und damit nichts mehr auswaehlen.
    await search.click();
    await expect(dropdown).toBeVisible();

    // Die Suche filtert die Liste auf den Treffer herunter.
    await search.fill("THW Leer");
    await expect(container.locator(".multiselect-option")).toHaveCount(1);

    await container.locator(".multiselect-option").first().click();
    await expect(chips).toHaveCount(before - 1);
    expect(await selectedValues()).toContain("thwleer");
});

test("@generator @chart statistics tab renders the distribution chart", async ({ page }) => {
    await page.goto("/");

    await setParticipants(page, ["Heros E2E 11/1", "Heros E2E 11/2"]);
    await page.locator("#spruecheProTeilnehmer").fill("5");
    await page.selectOption("#funkspruchVorlage", ["thwleer"]);
    await page.locator("#startUebungBtn").click();

    await expect(page.locator("#uebung-links")).toBeVisible();
    await page.locator("#tab-stats-btn").click();

    const chart = page.locator("#distributionChart");
    await expect(chart).toBeVisible();

    // Chart.js zeichnet animiert - erst nach der Animation stehen alle Pixel.
    await expect.poll(
        () => countPaintedPixels(page, "#distributionChart"),
        { message: "Chart.js hat das Verteilungsdiagramm nicht gezeichnet" }
    ).toBeGreaterThan(100);
});

test("@generator @pdf zip download contains generated pdfs", async ({ page }) => {
    await page.goto("/");

    await setParticipants(page, ["Heros E2E 11/1", "Heros E2E 11/2"]);
    await page.locator("#spruecheProTeilnehmer").fill("3");
    await page.selectOption("#funkspruchVorlage", ["thwleer"]);
    await page.locator("#startUebungBtn").click();

    await expect(page.locator("#uebung-links")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#zipAllPdfsBtn").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
    }
    const zip = Buffer.concat(chunks);

    // ZIP-Signatur "PK\x03\x04" und mindestens ein enthaltener PDF-Dateiname.
    expect(zip.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    expect(zip.toString("latin1")).toContain(".pdf");
});
