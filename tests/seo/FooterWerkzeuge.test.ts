import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error – reines JS-Modul ohne Typdeklaration, bewusst geteilt mit dem Build
import { renderFooter, renderWerkzeugleiste, WERKZEUGE } from "../../scripts/lib/navigation.mjs";

/**
 * Letzte Zeile des Footers: alle Werkzeuge desselben Autors, durch einen
 * Mittelpunkt getrennt. Kommt aus einer Quelle für alle Seiten und, über einen
 * Platzhalter im Postbuild, auch für die 404-Seite.
 */

const root = path.resolve(__dirname, "..", "..");

const ERWARTET = [
    ["erfassungsbogen.app", "https://erfassungsbogen.app/"],
    ["fmbauplaner.app", "https://fmbauplaner.app/"],
    ["nachrichtenvordruck.app", "https://nachrichtenvordruck.app/"],
    ["sprechfunk-uebung.de", "https://sprechfunk-uebung.de/"]
];

const leiste: string = renderWerkzeugleiste();

describe("Werkzeugleiste im Footer", () => {

    it("führt alle vier Werkzeuge in fester Reihenfolge, Linktext ist die Domain", () => {
        const links = [...leiste.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)]
            .map(treffer => [treffer[2], treffer[1]]);
        expect(links).toEqual(ERWARTET);
        for (const [text] of links) expect(text).toBe(text.toLowerCase());
        expect(WERKZEUGE).toHaveLength(ERWARTET.length);
    });

    it("ist eine benannte Navigation", () => {
        expect(leiste).toMatch(/^\s*<nav [^>]*aria-label="Weitere Werkzeuge"/);
    });

    it("setzt den Trenner als eigenes, verstecktes Element zwischen die Links", () => {
        const trenner = [...leiste.matchAll(/<span [^>]*aria-hidden="true"[^>]*>·<\/span>/g)];
        expect(trenner).toHaveLength(ERWARTET.length - 1);
        // Kein Mittelpunkt innerhalb eines Links.
        for (const anker of leiste.matchAll(/<a\s[^>]*>([^<]*)<\/a>/g)) {
            expect(anker[1]).not.toContain("·");
        }
        // Abwechselnd Link und Trenner, beginnend und endend mit einem Link.
        const folge = [...leiste.matchAll(/<(a|span)\s/g)].map(treffer => treffer[1]).join("");
        expect(folge).toBe("aspanaspanaspana");
    });

    it("öffnet fremde Werkzeuge im neuen Tab, das eigene nicht", () => {
        for (const anker of leiste.matchAll(/<a\s[^>]*>/g)) {
            const eigenes = anker[0].includes("https://sprechfunk-uebung.de/");
            if (eigenes) {
                expect(anker[0]).not.toContain("target=");
            } else {
                expect(anker[0]).toContain('target="_blank"');
                expect(anker[0]).toContain('rel="noopener noreferrer"');
            }
        }
    });

    it.each(["", "faq", "funksprueche/vorlage/thw-lehrte"])(
        "steht im Footer von /%s als letztes Element",
        slug => {
            const footer: string = renderFooter(slug);
            const innen = footer.replace(/\s*<\/div>\s*<\/footer>\s*$/, "");
            expect(innen.endsWith(leiste.trimEnd())).toBe(true);
            expect(footer.match(/aria-label="Weitere Werkzeuge"/g)).toHaveLength(1);
        }
    );

    it("hat in der 404-Seite einen Platzhalter, den der Postbuild ersetzt", () => {
        const html404 = readFileSync(path.join(root, "src", "404.html"), "utf8");
        const footer = html404.match(/<footer[\s\S]*?<\/footer>/)![0];
        expect(footer).toMatch(/<!-- FOOTER:WERKZEUGE -->\s*<\/footer>$/);
        const postbuild = readFileSync(path.join(root, "scripts", "postbuild-copy.mjs"), "utf8");
        expect(postbuild).toContain("<!-- FOOTER:WERKZEUGE -->");
        expect(postbuild).toContain("renderWerkzeugleiste()");
    });
});
