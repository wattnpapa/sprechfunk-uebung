import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { GENERATOR_VIEW_MARKUP } from "../../src/generator/viewMarkup";
import { ladeZuletzt, merkeUebung, renderZuletzt, ZULETZT_MAX, ZULETZT_SCHLUESSEL } from "../../src/generator/GeneratorZuletzt";

/** Rückweg zur eigenen Übung auf der Startseite (THW-Review 2026-10-05, workflow W6, new-user P3-5). */
describe("Zuletzt in diesem Browser erstellt", () => {
    beforeEach(() => {
        const dom = new JSDOM(`<div id="mainAppArea">${GENERATOR_VIEW_MARKUP}</div>`, { url: "https://example.test/" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("localStorage", dom.window.localStorage);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const eintrag = (id: string, name = `Übung ${id}`) => ({ id, name, uebungCode: "K7M4Q2", erstelltAm: "2026-10-05T19:03:00.000Z" });

    it("merkt die neueste Übung zuerst, ohne Dubletten und begrenzt", () => {
        for (let i = 1; i <= ZULETZT_MAX + 2; i++) {
            merkeUebung(eintrag(`u${i}`));
        }
        merkeUebung(eintrag("u4", "umbenannt"));
        const liste = ladeZuletzt();
        expect(liste).toHaveLength(ZULETZT_MAX);
        expect(liste[0]).toMatchObject({ id: "u4", name: "umbenannt" });
        expect(liste.filter(e => e.id === "u4")).toHaveLength(1);
    });

    it("übersteht kaputte Daten", () => {
        localStorage.setItem(ZULETZT_SCHLUESSEL, "{kaputt");
        expect(ladeZuletzt()).toEqual([]);
        localStorage.setItem(ZULETZT_SCHLUESSEL, JSON.stringify([{ id: 3 }, eintrag("ok")]));
        expect(ladeZuletzt().map(e => e.id)).toEqual(["ok"]);
    });

    it("zeigt die Liste nur auf einer neuen Übung und verlinkt die Übungen", () => {
        const box = document.getElementById("generatorZuletzt") as HTMLElement;
        renderZuletzt(true);
        expect(box.hidden).toBe(true);

        merkeUebung(eintrag("abc", "<b>Dienstabend</b>"));
        renderZuletzt(true);
        expect(box.hidden).toBe(false);
        const link = box.querySelector("a") as HTMLAnchorElement;
        expect(link.getAttribute("href")).toBe("#/generator/abc");
        expect(link.textContent).toBe("<b>Dienstabend</b>");
        expect(box.querySelector("li")?.textContent).toContain("Übungscode K7M4Q2");

        renderZuletzt(false);
        expect(box.hidden).toBe(true);
    });
});
