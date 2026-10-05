import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { THEME_LABEL } from "../../src/core/ThemeManager";
import { HEATMAP_MAX_DECKKRAFT, heatmapBalken } from "../../src/core/chart";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reines JS-Hilfsmodul ohne Typdeklarationen, absichtlich .mjs
import { THEME_LABEL as THEME_LABEL_SKRIPT, setzeFruehesThema, setzeThemeSchalter, themeSchalterSkript } from "../../scripts/lib/theme-init.mjs";

// THW-Review 2026-10-05, Night-Visibility: Warnhinweise mit Bootstraps
// text-*-emphasis waren im Dark Mode dunkel auf dunkel (Befund 1), Schalter
// außerhalb der Teilnehmeransicht kaum sichtbar (2), die Heatmap eine grelle
// Fläche (3), Inhaltsseiten ohne Umschalter (5), der Knopf vor dem Bundle
// falsch beschriftet (6), deaktivierte Knöpfe zu blass (7).

const root = path.resolve(__dirname, "..", "..");
const css = readFileSync(path.join(root, "src", "styles", "main.css"), "utf8");

const block = (selektor: string) => {
    const start = css.indexOf(`${selektor} {`);
    expect(start, selektor).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf("\n}", start));
};

const variablen = (text: string) => {
    const werte: Record<string, string> = {};
    for (const [, name, wert] of text.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
        werte[name!] = wert!.trim();
    }
    return werte;
};

const hell = variablen(block(":root"));
const dunkel = { ...hell, ...variablen(block("[data-theme=\"dark\"]")) };
const bruecke = variablen(block(":root,\n[data-theme]"));

const aufloesen = (wert: string, theme: Record<string, string>, tiefe = 0): string => {
    const verweis = /^var\((--[\w-]+)\)$/.exec(wert);
    if (!verweis || tiefe > 5) {
        return wert;
    }
    return aufloesen(theme[verweis[1]!] ?? bruecke[verweis[1]!] ?? "", theme, tiefe + 1);
};

const leuchtdichte = (hex: string) => {
    const kanal = (i: number) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * kanal(1) + 0.7152 * kanal(3) + 0.0722 * kanal(5);
};

const kontrast = (a: string, b: string) => {
    expect(a, "Farbe a").toMatch(/^#[0-9a-f]{6}$/i);
    expect(b, "Farbe b").toMatch(/^#[0-9a-f]{6}$/i);
    const [l1, l2] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x);
    return (l1! + 0.05) / (l2! + 0.05);
};

const themes = { hell, dunkel } as const;

describe("Bootstrap-Emphasis-Farben folgen dem Theme (Befund 1)", () => {
    const farben = ["primary", "secondary", "success", "info", "warning", "danger", "light", "dark"];

    it.each(farben)("--bs-%s-text-emphasis ist auf ein Theme-Token gelegt", farbe => {
        expect(bruecke[`--bs-${farbe}-text-emphasis`]).toMatch(/^var\(--[\w-]+\)$/);
        expect(bruecke[`--bs-${farbe}-bg-subtle`]).toMatch(/^var\(--[\w-]+\)$/);
        expect(bruecke[`--bs-${farbe}-border-subtle`]).toMatch(/^var\(--[\w-]+\)$/);
    });

    it.each(Object.entries(themes))("Warn-, Gefahr- und Erfolgstext haben im Theme „%s“ mindestens 4,5:1", (_name, theme) => {
        for (const farbe of farben) {
            const text = aufloesen(bruecke[`--bs-${farbe}-text-emphasis`]!, theme);
            for (const grund of ["--flaeche", "--grund"]) {
                expect(kontrast(text, aufloesen(theme[grund]!, theme)), `${farbe} auf ${grund}`).toBeGreaterThanOrEqual(4.5);
            }
            const subtil = aufloesen(bruecke[`--bs-${farbe}-bg-subtle`]!, theme);
            expect(kontrast(text, subtil), `${farbe} auf ${farbe}-bg-subtle`).toBeGreaterThanOrEqual(4.5);
        }
    });
});

describe("Schalter, Checkboxen und deaktivierte Knöpfe", () => {
    it("die Dark-Mode-Kontur gilt für jede Checkbox und jeden Schalter (Befund 2)", () => {
        expect(css).toContain("[data-theme=\"dark\"] .form-check-input:not(:checked) {");
        expect(css).toContain("[data-theme=\"dark\"] .form-switch .form-check-input:not(:checked) {");
        expect(css).not.toContain("[data-theme=\"dark\"] .teilnehmer-schalter .form-check-input:not(:checked)");
        expect(kontrast(dunkel["--text-3"]!, dunkel["--flaeche"]!)).toBeGreaterThanOrEqual(3);
        expect(kontrast(dunkel["--text-3"]!, dunkel["--flaeche-2"]!)).toBeGreaterThanOrEqual(3);
    });

    it.each(Object.entries(themes))("deaktivierte Knöpfe bleiben im Theme „%s“ lesbar (Befund 7)", (_name, theme) => {
        const regel = block(".btn:disabled,\n.btn.disabled,\nfieldset:disabled .btn");
        expect(regel).toContain("opacity: 1;");
        expect(regel).toContain("color: var(--text-2);");
        expect(regel).toContain("background-color: var(--flaeche-2);");
        expect(kontrast(aufloesen(theme["--text-2"]!, theme), aufloesen(theme["--flaeche-2"]!, theme))).toBeGreaterThanOrEqual(4.5);
    });
});

describe("Heatmap aus dem Theme (Befund 3)", () => {
    it("Farbe aus --akzent, gedeckelte Deckkraft, keine feste Fremdfarbe mehr", () => {
        expect(block(".heatmap-balken")).toContain("background: var(--akzent);");
        const diagramme = readFileSync(path.join(root, "src", "uebungsleitung", "nachrichtenDiagramme.ts"), "utf8");
        expect(diagramme).not.toMatch(/rgba\(54,\s*162,\s*235/);
        expect(diagramme).toContain("heatmap-balken");
        expect(heatmapBalken(10, 10).deckkraft).toBeLessThanOrEqual(HEATMAP_MAX_DECKKRAFT);
        expect(heatmapBalken(0, 10)).toEqual({ hoehePx: 8, deckkraft: 0.16 });
        expect(heatmapBalken(5, 10).hoehePx).toBe(43);
        expect(heatmapBalken(3, 0).deckkraft).toBeLessThanOrEqual(HEATMAP_MAX_DECKKRAFT);
    });
});

describe("Umschalter vor dem Bundle und auf Inhaltsseiten (Befunde 5 und 6)", () => {
    it("App und Inline-Skript beschriften gleich", () => {
        expect(THEME_LABEL_SKRIPT).toEqual(THEME_LABEL);
        expect(themeSchalterSkript()).not.toMatch(/=>|\blet\b|\bconst\b/);
    });

    const kopf = `<header class="app-header">
    <div class="container app-header-grid">
        <div class="app-header-actions d-none d-md-flex">
            <a href="../" class="btn btn-primary">Zur Anwendung</a>
        </div>
    </div>
</header>`;

    it("setzt auf Inhaltsseiten Umschalter ein, in der App nicht", () => {
        const seite = setzeThemeSchalter(kopf);
        expect(seite.match(/data-theme-schalter/g)).toHaveLength(2);
        expect(setzeThemeSchalter(seite)).toBe(seite);
        const app = kopf.replace("</a>", "</a><button id=\"themeToggle\">x</button>");
        expect(setzeThemeSchalter(app)).toBe(app);
    });

    const lade = (gespeichert: string | null) => {
        const html = setzeFruehesThema(`<!DOCTYPE html><html><head><meta name="theme-color" content="#000000"></head><body data-theme="light">${kopf}<main></main></body></html>`);
        return new JSDOM(html, {
            runScripts: "dangerously",
            url: "https://sprechfunk-uebung.de/buchstabiertafel/",
            beforeParse(window) {
                if (gespeichert) {
                    window.localStorage.setItem("theme", gespeichert);
                }
                Object.defineProperty(window, "matchMedia", {
                    value: () => ({ matches: false, addEventListener: () => undefined })
                });
            }
        });
    };

    it("beschriftet den Knopf schon vor dem Bundle passend zum Theme", () => {
        const dom = lade("dark");
        const knoepfe = [...dom.window.document.querySelectorAll("[data-theme-schalter]")];
        expect(knoepfe).toHaveLength(2);
        knoepfe.forEach(k => expect(k.textContent).toBe(THEME_LABEL.dark));
    });

    it("der Umschalter der Inhaltsseite schaltet, speichert und beschriftet neu", async () => {
        const dom = lade(null);
        const doc = dom.window.document;
        (doc.querySelector("[data-theme-schalter]") as HTMLButtonElement).click();
        expect(doc.body.getAttribute("data-theme")).toBe("dark");
        expect(dom.window.localStorage.getItem("theme")).toBe("dark");
        expect(doc.querySelector("meta[name=theme-color]")?.getAttribute("content")).toBe("#0e1526");
        await new Promise(r => setTimeout(r, 0)); // MutationObserver
        expect(doc.querySelector("[data-theme-schalter]")?.textContent).toBe(THEME_LABEL.dark);
    });
});
