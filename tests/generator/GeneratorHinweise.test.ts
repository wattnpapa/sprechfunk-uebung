import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { GENERATOR_VIEW_MARKUP } from "../../src/generator/viewMarkup";
import { GeneratorHinweise } from "../../src/generator/GeneratorHinweise";

describe("GeneratorHinweise", () => {
    let dom: JSDOM;

    beforeEach(() => {
        dom = new JSDOM(`<div id="mainAppArea">${GENERATOR_VIEW_MARKUP}</div>`);
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
        vi.stubGlobal("AbortController", dom.window.AbortController);
        const body = dom.window.document.getElementById("teilnehmer-container");
        if (body) {
            body.innerHTML = `<table><tbody id="teilnehmer-body">
                <tr><td><input class="teilnehmer-input" data-index="0"></td></tr>
                <tr><td><input class="teilnehmer-input" data-index="1"></td></tr>
            </tbody></table>`;
        }
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    const $ = (id: string) => document.getElementById(id) as HTMLElement;

    it("markiert Felder mit Text und entfernt die Markierung wieder", () => {
        const hinweise = new GeneratorHinweise();
        hinweise.zeigeFeldFehler([
            { feld: "leitung", text: "Leitung fehlt" },
            { feld: "teilnehmer-1", text: "Doppelt" },
            { feld: "prozentAnAlle", text: "0 bis 100" },
            { feld: "funkspruchVorlage", text: "Vorlage fehlt" },
            { feld: "gibtEsNicht", text: "x" }
        ]);
        expect($("leitung").classList.contains("is-invalid")).toBe(true);
        expect($("leitung-fehler").textContent).toBe("Leitung fehlt");
        expect(document.querySelector("[data-index='1']")?.getAttribute("aria-describedby")).toBe("teilnehmer-1-fehler");
        // Bei Eingabegruppen steht die Meldung unter der ganzen Gruppe.
        expect($("prozentAnAlle").closest(".input-group")?.nextElementSibling?.id).toBe("prozentAnAlle-fehler");
        expect($("funkspruchVorlage-fehler")).not.toBeNull();
        expect(document.activeElement?.id).toBe("leitung");

        hinweise.entferneFeldFehler();
        expect(document.querySelectorAll(".is-invalid")).toHaveLength(0);
        expect(document.querySelectorAll(".generator-feldfehler")).toHaveLength(0);
    });

    it("meldet Formularänderungen und löscht die Markierung des bearbeiteten Felds", () => {
        const hinweise = new GeneratorHinweise();
        const onAenderung = vi.fn();
        hinweise.bindFormularAenderung(onAenderung);
        hinweise.zeigeFeldFehler([{ feld: "leitung", text: "fehlt" }]);

        $("leitung").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
        expect(onAenderung).toHaveBeenCalledTimes(1);
        expect($("leitung").classList.contains("is-invalid")).toBe(false);
        expect(document.getElementById("leitung-fehler")).toBeNull();

        // Klicks zählen nur auf Knöpfen.
        $("leitung").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
        expect(onAenderung).toHaveBeenCalledTimes(1);
        $("addTeilnehmerBtn").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
        expect(onAenderung).toHaveBeenCalledTimes(2);
    });

    it("zeigt Fehlerkasten, Beschäftigt-Zustand und den Modus einer gespeicherten Übung", () => {
        const hinweise = new GeneratorHinweise();
        hinweise.zeigeFehlerBox("Keine Verbindung");
        expect($("generatorFehler").hidden).toBe(false);
        expect($("generatorFehler").textContent).toBe("Keine Verbindung");
        hinweise.zeigeFehlerBox(null);
        expect($("generatorFehler").hidden).toBe(true);

        hinweise.setzeBeschaeftigt(true);
        expect(($("startUebungBtn") as HTMLButtonElement).disabled).toBe(true);
        hinweise.setzeBeschaeftigt(false);
        expect(($("startUebungBtn") as HTMLButtonElement).disabled).toBe(false);

        hinweise.zeigeModus({ gespeichert: true, uebungCode: "K7M4Q2" });
        expect($("startUebungBtn").textContent).toContain("Als neue Übung generieren");
        expect($("ueberschreibenBtn").hidden).toBe(false);
        expect($("generatorActionHinweis").textContent).toContain("K7M4Q2");
        hinweise.zeigeModus({ gespeichert: false });
        expect($("ueberschreibenBtn").hidden).toBe(true);
        expect($("startUebungBtn").textContent).toContain("Übung generieren");
    });

    it("kennzeichnet ein veraltetes Ergebnis", () => {
        const hinweise = new GeneratorHinweise();
        hinweise.markiereErgebnisVeraltet(true);
        expect($("generatorErgebnisVeraltet").hidden).toBe(false);
        expect($("output-container").classList.contains("is-veraltet")).toBe(true);
        hinweise.markiereErgebnisVeraltet(false);
        expect($("generatorErgebnisVeraltet").hidden).toBe(true);
    });

    it("zeigt den Entwurf mit Verwerfen-Knopf", () => {
        const hinweise = new GeneratorHinweise();
        const verwerfen = vi.fn();
        hinweise.zeigeEntwurfHinweis(new Date(2026, 9, 4, 14, 3), verwerfen);
        expect($("generatorEntwurfHinweis").hidden).toBe(false);
        expect($("generatorEntwurfText").textContent).toContain("14:03");
        $("generatorEntwurfVerwerfen").click();
        expect(verwerfen).toHaveBeenCalled();
        hinweise.zeigeEntwurfHinweis(null);
        expect($("generatorEntwurfHinweis").hidden).toBe(true);
    });

    it("bietet nach dem Entfernen kurz Rückgängig an", () => {
        vi.useFakeTimers();
        const hinweise = new GeneratorHinweise();
        const rueckgaengig = vi.fn();
        hinweise.zeigeEntferntHinweis("Heros 21/11", rueckgaengig);
        expect($("teilnehmerEntferntText").textContent).toBe("„Heros 21/11“ entfernt.");
        $("teilnehmerEntferntRueckgaengig").click();
        expect(rueckgaengig).toHaveBeenCalled();
        expect($("teilnehmerEntferntHinweis").hidden).toBe(true);

        hinweise.zeigeEntferntHinweis("");
        expect($("teilnehmerEntferntText").textContent).toBe("Leere Zeile entfernt.");
        vi.advanceTimersByTime(10001);
        expect($("teilnehmerEntferntHinweis").hidden).toBe(true);
    });

    it("füllt Statusleiste, Dauer, Hinweis zur beübten Stelle und bindet Zusatzaktionen", () => {
        const hinweise = new GeneratorHinweise();
        hinweise.aktualisiereStatusleiste({ teilnehmer: 3, nachrichten: "ca. 30", loesungswoerter: "Keine", dauer: "–" });
        expect($("statusTeilnehmerCount").textContent).toBe("3");
        expect($("statusNachrichtenCount").textContent).toBe("ca. 30");
        hinweise.setzeDauer("180 Min (Drehbuch)");
        expect($("statusDauerEstimate").textContent).toBe("180 Min (Drehbuch)");
        hinweise.zeigeBeuebteStelle("Heros 10");
        expect($("beuebteStelleHinweis").textContent).toContain("Heros 10");
        hinweise.zeigeBeuebteStelle(null);
        expect($("beuebteStelleHinweis").textContent).toBe("");

        const onUeberschreiben = vi.fn();
        const onBlattBeuebteStelle = vi.fn();
        hinweise.bindAktionen({ onUeberschreiben, onBlattBeuebteStelle });
        $("ueberschreibenBtn").click();
        $("beuebteStelleBlattBtn").click();
        expect(onUeberschreiben).toHaveBeenCalled();
        expect(onBlattBeuebteStelle).toHaveBeenCalled();
    });

    it("tut ohne DOM nichts", () => {
        vi.stubGlobal("document", undefined);
        const hinweise = new GeneratorHinweise();
        expect(() => {
            hinweise.zeigeFehlerBox("x");
            hinweise.entferneFeldFehler();
            hinweise.bindFormularAenderung(() => {});
            hinweise.zeigeEntferntHinweis("x");
        }).not.toThrow();
    });
});
