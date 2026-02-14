import { expect, test } from "@playwright/test";

test("loads main app shell", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sprechfunk Übungsgenerator" })).toBeVisible();
    await expect(page.locator("#mainAppArea")).toBeVisible();
});
