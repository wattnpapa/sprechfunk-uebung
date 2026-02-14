import { expect, test } from "@playwright/test";

test("loads main app shell", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sprechfunk Übungsgenerator" })).toBeVisible();
    await expect(page.locator("#mainAppArea")).toBeVisible();
});

test("double click on theme toggle enables startrek theme", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator("#themeToggle");
    await btn.dblclick();
    await expect(page.locator("body")).toHaveAttribute("data-theme", "startrek");
});

test("generator loesungswort option toggles central input", async ({ page }) => {
    await page.goto("/");
    const centralRadio = page.locator("#zentralLoesungswort");
    const centralInput = page.locator("#zentralLoesungswortContainer");
    await centralRadio.check();
    await expect(centralInput).toBeVisible();
});
