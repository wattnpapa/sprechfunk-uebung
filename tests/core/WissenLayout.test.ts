import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Beim THW-Review 2026-10-05 gefunden: Mit `grid-template-columns: 1fr` wuchs
// die Inhaltsspalte der Wissensseiten auf die Mindestbreite ihres breitesten
// Inhalts – auf 375 px war sie 518 px breit und rechts abgeschnitten.
describe("Wissensseiten-Layout", () => {
    const css = readFileSync(path.resolve(__dirname, "..", "..", "src", "styles", "main.css"), "utf8");

    it("die einspaltige Grundform darf schmaler als ihr Inhalt werden", () => {
        const start = css.indexOf(".wissen-layout {");
        const block = css.slice(start, css.indexOf("}", start));
        expect(block).toContain("grid-template-columns: minmax(0, 1fr);");
        expect(css).toMatch(/\n\.wissen-inhalt \{\s*min-width: 0;/);
    });
});
