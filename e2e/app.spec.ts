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

test.beforeEach(async ({ page }) => {
    const seedData = makeSeedData();
    await page.addInitScript(seed => {
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
    await expect(page.locator("#funkspruchVorlage option")).toHaveCount(5);
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
    await expect(page.locator("#links-teilnehmer-container .generator-link-row[data-link-type='teilnehmer'] .generator-link-url code").first()).toContainText("#/teilnehmer");
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
    await expect(page.locator("#teilnehmerContent")).toContainText("Ungültiger Link.");

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
