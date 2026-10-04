import { afterEach, describe, expect, it, vi } from "vitest";
import { Chart, initChartTheme, themeFarben, wendeChartThemeAn } from "../../src/core/chart";

// Night-Visibility Befund 3 (THW-Review 2026-10-04): Diagramme liefen auf
// den Chart.js-Standardfarben und waren im Dark Mode kaum lesbar.
describe("core/chart – Theme-Farben", () => {
    const tokens = (werte: Record<string, string>) => {
        vi.stubGlobal("document", { body: {} });
        vi.stubGlobal("window", {
            getComputedStyle: () => ({ getPropertyValue: (name: string) => werte[name] ?? "" })
        });
    };

    afterEach(() => {
        vi.unstubAllGlobals();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (Chart.instances as any)["test"];
    });

    it("liest die Rollen-Token des aktuellen Themes", () => {
        tokens({ "--text": " #e7eaf0 ", "--text-2": "#aab3c4", "--linie-fein": "#262d3a" });
        const farben = themeFarben();
        expect(farben.text).toBe("#e7eaf0");
        expect(farben.text2).toBe("#aab3c4");
        expect(farben.linie).toBe("#262d3a");
        // Fehlende Token: helle Grundwerte statt leerer Farbe.
        expect(farben.akzent).toBe("#12275e");
    });

    it("liefert ohne DOM die hellen Grundwerte", () => {
        expect(themeFarben().text2).toBe("#5c6478");
    });

    it("setzt Text- und Rasterfarbe und zeichnet offene Diagramme neu", () => {
        tokens({ "--text-2": "#aab3c4", "--linie-fein": "#262d3a" });
        const update = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (Chart.instances as any)["test"] = { update };

        wendeChartThemeAn();

        expect(Chart.defaults.color).toBe("#aab3c4");
        expect(Chart.defaults.borderColor).toBe("#262d3a");
        expect(update).toHaveBeenCalledWith("none");
    });

    it("beobachtet den Theme-Wechsel am body", () => {
        tokens({ "--text-2": "#5c6478", "--linie-fein": "#d7dce7" });
        let rueckruf: (() => void) | null = null;
        const observe = vi.fn();
        vi.stubGlobal("MutationObserver", class {
            constructor(cb: () => void) {
                rueckruf = cb;
            }
            observe = observe;
        });

        initChartTheme();
        expect(observe).toHaveBeenCalledWith(expect.anything(), { attributeFilter: ["data-theme"] });

        tokens({ "--text-2": "#aab3c4", "--linie-fein": "#262d3a" });
        rueckruf!();
        expect(Chart.defaults.color).toBe("#aab3c4");
    });
});
