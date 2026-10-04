import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AppView } from "../../src/core/AppView";

// THW-Review 2026-10-04 (new-user P2-5, stress-test P2-4, workflow F9):
// „Übung erstellen“ war in allen Rollen als aktuelle Seite markiert.
describe("AppView – Hauptnavigation je Rolle", () => {
    const setup = (schmal: boolean) => {
        const dom = new JSDOM(`
            <nav class="site-nav"><details class="site-nav-details" open>
                <summary class="site-nav-summary">Menü</summary>
                <ul class="site-nav-list">
                    <li><a class="nav-link active" href="./" aria-current="page" data-testid="nav-start">Übung erstellen</a></li>
                </ul>
            </details></nav>
            <div id="mainAppArea"></div><div id="adminArea"></div>
            <div id="uebungsleitungArea"></div><div id="teilnehmerArea"></div><div id="seoIntroArea"></div>`);
        Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: schmal }) });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        return dom.window.document;
    };

    afterEach(() => vi.unstubAllGlobals());

    const start = (doc: Document) => doc.querySelector<HTMLElement>("[data-testid='nav-start']")!;
    const details = (doc: Document) => doc.querySelector<HTMLDetailsElement>(".site-nav-details")!;

    it.each(["teilnehmer", "uebungsleitung", "admin"] as const)("markiert in %s keinen Reiter als aktuell", mode => {
        const doc = setup(false);
        new AppView().applyAppMode(mode);
        expect(start(doc).classList.contains("active")).toBe(false);
        expect(start(doc).hasAttribute("aria-current")).toBe(false);
    });

    it("markiert „Übung erstellen“ im Generator", () => {
        const doc = setup(false);
        const view = new AppView();
        view.applyAppMode("teilnehmer");
        view.applyAppMode("generator");
        expect(start(doc).classList.contains("active")).toBe(true);
        expect(start(doc).getAttribute("aria-current")).toBe("page");
    });

    it("klappt die Navigation in den Übungsrollen auf dem Smartphone ein und danach wieder auf", () => {
        const doc = setup(true);
        const view = new AppView();
        view.applyAppMode("teilnehmer");
        expect(details(doc).open).toBe(false);
        view.applyAppMode("generator");
        expect(details(doc).open).toBe(true);
    });

    it("lässt die Navigation am Desktop offen (dort gibt es keinen Umschalter)", () => {
        const doc = setup(false);
        new AppView().applyAppMode("uebungsleitung");
        expect(details(doc).open).toBe(true);
    });

    it("öffnet keine Navigation, die der Nutzer selbst zugeklappt hat", () => {
        const doc = setup(true);
        details(doc).open = false;
        new AppView().applyAppMode("generator");
        expect(details(doc).open).toBe(false);
    });

    it("nimmt den Ladehinweis für Teilnehmer-/Leitungs-Links ab, sobald die Route gilt", () => {
        const doc = setup(false);
        doc.documentElement.classList.add("app-route-laedt");
        new AppView().applyAppMode("teilnehmer");
        expect(doc.documentElement.classList.contains("app-route-laedt")).toBe(false);
    });
});

// offline P2-2: Bei langsamem Netz zeigte ein Teilnehmer-Link sekundenlang
// das Generator-Formular. Das Inline-Skript in index.html markiert solche
// Links, bevor irgendetwas gezeichnet wird.
describe("index.html – Ladehinweis vor dem Bundle", () => {
    const html = readFileSync(path.resolve(__dirname, "..", "..", "src", "index.html"), "utf8");
    const skript = /<p id="appLadehinweis"[^>]*>[^<]*<\/p>\s*<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";

    const markiert = (hash: string) => {
        const dom = new JSDOM(`<html><body><script>${skript}</script></body></html>`, {
            url: `https://sprechfunk-uebung.de/${hash}`,
            runScripts: "dangerously"
        });
        return dom.window.document.documentElement.classList.contains("app-route-laedt");
    };

    it("steht im HTML", () => {
        expect(skript).toContain("app-route-laedt");
    });

    it.each(["#/teilnehmer/u1/T1", "#/teilnehmer?uc=AB&tc=CD", "#/uebungsleitung/u1", "#/admin", "#teilnehmer/u1/T1"])(
        "markiert %s", hash => expect(markiert(hash)).toBe(true));

    it.each(["", "#/generator", "#kopfdaten", "#teilnehmer", "#/teilnehmerX"])(
        "lässt %s in Ruhe", hash => expect(markiert(hash)).toBe(false));
});
