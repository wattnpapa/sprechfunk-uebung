import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// B1 (THW-Review 2026-10-04): Der moderne pdf.js-Build ruft
// Map.prototype.getOrInsertComputed auf, das ältere Browser (gemessen:
// Chromium 141) nicht kennen – die Vordruck-Vorschau blieb dort leer. Der
// Legacy-Build derselben Version bringt die Polyfills mit, auch im Worker.
describe("pdf.js wird als Legacy-Build ausgeliefert", () => {
    const root = path.resolve(__dirname, "../..");
    const rollup = readFileSync(path.join(root, "rollup.config.js"), "utf8");

    it("kopiert Hauptmodul und Worker aus legacy/build", () => {
        expect(rollup).toContain("node_modules/pdfjs-dist/legacy/build/pdf.min.mjs");
        expect(rollup).toContain("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
        expect(rollup).not.toMatch(/pdfjs-dist\/build\/pdf/);
    });

    it("der Legacy-Build enthält das Polyfill für getOrInsertComputed", () => {
        for (const datei of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
            const quelle = readFileSync(
                path.join(root, "node_modules/pdfjs-dist/legacy/build", datei),
                "utf8"
            );
            // core-js definiert die Methode auf Map.prototype, falls sie fehlt.
            expect(quelle).toMatch(/target:"Map",proto:!0[^}]*\}\s*,\s*\{\s*getOrInsertComputed/);
        }
    });
});
