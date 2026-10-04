import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// glove-touch P2-3 / stress-test P1-3 (THW-Review 2026-10-04): Die fixierte
// Kopfzeile lag mit z-index 5000 über allen Bootstrap-Dialogen und verdeckte
// auf dem Smartphone Titel und Schließen-Knopf des Vordruck-Fensters.
describe("Kopfzeile und Dialoge", () => {
    const css = readFileSync(path.resolve(__dirname, "..", "..", "src", "styles", "main.css"), "utf8");

    it("liegt unter Bootstraps Modal-Hintergrund (1050)", () => {
        const block = css.slice(css.indexOf(".app-header {"), css.indexOf("}", css.indexOf(".app-header {")));
        const zIndex = Number(/z-index:\s*(\d+)/.exec(block)?.[1]);
        expect(zIndex).toBeGreaterThan(0);
        expect(zIndex).toBeLessThan(1050);
    });

    it("der Ansichtsrahmen sperrt Dialoge nicht in einen eigenen Stapelkontext", () => {
        const start = css.indexOf(".app-view-shell {");
        const block = css.slice(start, css.indexOf("}", start));
        expect(block).not.toMatch(/isolation:\s*isolate|z-index|transform/);
    });
});
