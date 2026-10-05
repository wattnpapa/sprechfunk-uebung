import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { abonniereRoutenwechsel, brauchtDruckteil } from "../../src/core/routenStart";
import type { Route } from "../../src/core/router";

// THW-Review 2026-10-05, offline P3-4: Die erste Route lief doppelt (sofortiger
// subscribe-Aufruf plus DOMContentLoaded), jede Ansicht band ihre Klicks
// zweimal – ein Klick auf „Debrief PDF“ erzeugte zwei Downloads.
describe("abonniereRoutenwechsel", () => {
    const quelle = () => {
        const listener: Array<(r: Route) => void> = [];
        return {
            listener,
            subscribe(l: (r: Route) => void) {
                listener.push(l);
                l({ mode: "generator", params: [] }); // wie router.subscribe: sofort
                return () => undefined;
            }
        };
    };

    it("ignoriert den sofortigen Aufruf und meldet spätere Wechsel", () => {
        const q = quelle();
        const handler = vi.fn();
        abonniereRoutenwechsel(q, handler);
        expect(handler).not.toHaveBeenCalled();
        q.listener[0]!({ mode: "uebungsleitung", params: ["u1"] });
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({ mode: "uebungsleitung", params: ["u1"] });
    });

    it("app.ts startet die erste Route nur einmal (DOMContentLoaded)", () => {
        const app = readFileSync(path.resolve(__dirname, "..", "..", "src", "app.ts"), "utf8");
        expect(app).not.toMatch(/router\.subscribe\(/);
        expect(app).toContain("abonniereRoutenwechsel(router");
        expect(app.match(/^\s*handleRoute\(\);/gm)).toHaveLength(1);
    });
});

// error-recovery P3-4: `#/uebungsleitung/` ohne ID zeigte ein leeres Gerüst.
describe("Übungsleitung ohne ID", () => {
    it("app.ts startet die Ansicht auch ohne ID, die Meldung kommt aus ladeUebung", async () => {
        const app = readFileSync(path.resolve(__dirname, "..", "..", "src", "app.ts"), "utf8");
        const zweig = app.slice(app.indexOf("if (mode === \"uebungsleitung\")"), app.indexOf("if (mode === \"teilnehmer\")"));
        expect(zweig).toMatch(/\}\n\s*\/\/[^\n]*\n(\s*\/\/[^\n]*\n)*\s*initUebungsleitung\(db\);/);

        const { ladeUebung } = await import("../../src/uebungsleitung/teilnehmerStand");
        const ergebnis = await ladeUebung({} as never, null);
        expect("fehler" in ergebnis && ergebnis.fehler).toMatch(/fehlt die Übungs-ID/);
    });
});

// Offline P1-1: Im Generator wurde der Druckteil nie vorgeladen.
describe("brauchtDruckteil", () => {
    it.each([
        ["teilnehmer", [], true],
        ["uebungsleitung", ["u1"], true],
        ["generator", ["u1"], true],
        ["generator", [], false],
        ["admin", [], false]
    ] as const)("%s %o → %s", (mode, params, erwartet) => {
        expect(brauchtDruckteil(mode, [...params])).toBe(erwartet);
    });
});
