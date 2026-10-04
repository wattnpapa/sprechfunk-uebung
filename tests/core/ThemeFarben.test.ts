import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { THEME_FARBEN } from "../../src/core/ThemeManager";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reines JS-Hilfsmodul ohne Typdeklarationen, absichtlich .mjs
import { THEME_FARBEN as THEME_FARBEN_SKRIPT, fruehesThemaSkript, setzeFruehesThema } from "../../scripts/lib/theme-init.mjs";

// B5 (THW-Review 2026-10-04): Theme vor dem ersten Bild, gleiche Regel in App
// und Inhaltsseiten, Adressleiste passend zum Kopfbalken.
describe("Theme vor dem ersten Bild", () => {
    const root = path.resolve(__dirname, "..", "..");

    it("App und Inline-Skript nutzen dieselben Adressleisten-Farben", () => {
        expect(THEME_FARBEN_SKRIPT).toEqual(THEME_FARBEN);
    });

    it("die Farben entsprechen dem Kopfbalken (--kopf-fond) je Theme", () => {
        const css = readFileSync(path.join(root, "src", "styles", "main.css"), "utf8");
        const block = (selektor: string) => {
            const start = css.indexOf(`${selektor} {`);
            return css.slice(start, css.indexOf("\n}", start));
        };
        // Hell: --kopf-fond verweist auf --akzent.
        expect(block(":root")).toContain("--kopf-fond: var(--akzent);");
        expect(block(":root")).toContain(`--akzent: ${THEME_FARBEN.light};`);
        expect(block("[data-theme=\"dark\"]")).toContain(`--kopf-fond: ${THEME_FARBEN.dark};`);
        expect(block("[data-theme=\"startrek\"]")).toContain(`--kopf-fond: ${THEME_FARBEN.startrek};`);
    });

    const seite = (html: string, { gespeichert, systemDunkel }: { gespeichert?: string; systemDunkel: boolean }) => {
        const listener: Array<(e: { matches: boolean }) => void> = [];
        const dom = new JSDOM(html, {
            runScripts: "dangerously",
            beforeParse(window) {
                if (gespeichert) {
                    window.localStorage.setItem("theme", gespeichert);
                }
                Object.defineProperty(window, "matchMedia", {
                    value: () => ({
                        matches: systemDunkel,
                        addEventListener: (_t: string, cb: (e: { matches: boolean }) => void) => listener.push(cb)
                    })
                });
            },
            url: "https://sprechfunk-uebung.de/"
        });
        return { dom, listener };
    };

    const vorlage = setzeFruehesThema(`<!DOCTYPE html><html><head>
<meta name="theme-color" content="#0d6efd">
    <script>
        // Gleiche Theme-Auswahl wie in der App anwenden (statische Seiten laden kein Bundle).
        document.addEventListener("DOMContentLoaded", function () {
            var stored = localStorage.getItem("theme");
            if (stored) {
                document.body.setAttribute("data-theme", stored);
            }
        });
    </script>
</head><body data-theme="light"><p id="inhalt">x</p></body></html>`);

    it("ersetzt das alte DOMContentLoaded-Snippet und setzt das Skript als Erstes in <body>", () => {
        expect(vorlage).not.toContain("DOMContentLoaded");
        expect(vorlage).toMatch(/<body data-theme="light">\n<script>\(function\(\)\{/);
        expect(vorlage).toContain(`<meta name="theme-color" content="${THEME_FARBEN.light}">`);
        expect(fruehesThemaSkript()).not.toMatch(/=>|\blet\b|\bconst\b/); // ES5, läuft überall
    });

    it("ohne gespeicherte Wahl gilt das dunkle System-Theme – auch auf Inhaltsseiten", () => {
        const { dom } = seite(vorlage, { systemDunkel: true });
        expect(dom.window.document.body.getAttribute("data-theme")).toBe("dark");
        expect(dom.window.document.querySelector("meta[name=theme-color]")?.getAttribute("content"))
            .toBe(THEME_FARBEN.dark);
    });

    it("die eigene Wahl hat Vorrang vor dem System und überlebt dessen Wechsel", () => {
        const { dom, listener } = seite(vorlage, { gespeichert: "dark", systemDunkel: false });
        expect(dom.window.document.body.getAttribute("data-theme")).toBe("dark");
        listener.forEach(cb => cb({ matches: false }));
        expect(dom.window.document.body.getAttribute("data-theme")).toBe("dark");
    });

    it("ohne eigene Wahl folgt die Seite dem Systemwechsel", () => {
        const { dom, listener } = seite(vorlage, { systemDunkel: false });
        expect(dom.window.document.body.getAttribute("data-theme")).toBe("light");
        listener.forEach(cb => cb({ matches: true }));
        expect(dom.window.document.body.getAttribute("data-theme")).toBe("dark");
    });

    it("ein unbekannter gespeicherter Wert fällt auf das System zurück", () => {
        const { dom } = seite(vorlage, { gespeichert: "<script>", systemDunkel: true });
        expect(dom.window.document.body.getAttribute("data-theme")).toBe("dark");
    });

    it("Primärknopf im Dark Mode: weißer Text mit mindestens 4,5:1, auch im Hover (Befunde 7/9)", () => {
        const css = readFileSync(path.join(root, "src", "styles", "main.css"), "utf8");
        const start = css.indexOf("[data-theme=\"dark\"] .btn-primary {");
        expect(start).toBeGreaterThan(0);
        const block = css.slice(start, css.indexOf("}", start));
        const wert = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(block)?.[1] ?? "";
        const leuchtdichte = (hex: string) => {
            const kanal = (i: number) => {
                const c = parseInt(hex.slice(i, i + 2), 16) / 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * kanal(1) + 0.7152 * kanal(3) + 0.0722 * kanal(5);
        };
        const kontrastZuWeiss = (hex: string) => 1.05 / (leuchtdichte(hex) + 0.05);
        for (const name of ["--bs-btn-bg", "--bs-btn-hover-bg", "--bs-btn-active-bg"]) {
            expect(kontrastZuWeiss(wert(name)), name).toBeGreaterThanOrEqual(4.5);
        }
    });
});
