import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { MAX_FEHLER_TOASTS, UiFeedback } from "../../src/core/UiFeedback";

// THW-Review 2026-10-04 (offline P2-3, error-recovery P2-1): Fehlermeldungen
// verschwanden nach 2,5 s – wer gerade funkt, verpasst sie.
describe("UiFeedback – Fehler bleiben stehen", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        const dom = new JSDOM("<body></body>");
        vi.stubGlobal("document", dom.window.document);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("blendet Fehler nicht automatisch aus und lässt sie wegtippen", () => {
        new UiFeedback().error("ZIP konnte nicht erstellt werden.");
        vi.advanceTimersByTime(60_000);

        const toast = document.querySelector<HTMLElement>(".app-toast.is-error");
        expect(toast).not.toBeNull();
        expect(toast?.getAttribute("role")).toBe("alert");
        expect(toast?.textContent).toContain("ZIP konnte nicht erstellt werden.");

        const knopf = toast?.querySelector<HTMLButtonElement>(".app-toast-schliessen");
        expect(knopf?.getAttribute("aria-label")).toBe("Meldung schließen");
        knopf?.click();
        vi.advanceTimersByTime(300);
        expect(document.querySelector(".app-toast.is-error")).toBeNull();
    });

    it("Erfolgsmeldungen verschwinden weiter von selbst", () => {
        new UiFeedback().success("Gespeichert.");
        vi.advanceTimersByTime(3_000);
        expect(document.querySelector(".app-toast")).toBeNull();
    });
});

// THW-Review 2026-10-05 (error-recovery P2-1, offline P3-2, workflow W9):
// Fehler-Toasts stapelten sich, überlebten die Korrektur und verdeckten das
// Formular; eine Ursache erzeugte zwei Meldungen.
describe("UiFeedback – kein Stapel aus Altmeldungen", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        const dom = new JSDOM("<body></body>");
        vi.stubGlobal("document", dom.window.document);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    const fehlerTexte = () => Array.from(document.querySelectorAll(".app-toast.is-error"))
        .map(t => t.getAttribute("data-meldung"));

    it("ersetzt eine gleichlautende Meldung statt sie doppelt zu zeigen", () => {
        const ui = new UiFeedback();
        ui.error("ZIP konnte nicht erstellt werden.");
        ui.error("ZIP konnte nicht erstellt werden.");
        expect(fehlerTexte()).toEqual(["ZIP konnte nicht erstellt werden."]);
    });

    it("zeigt höchstens MAX_FEHLER_TOASTS Fehler, die ältesten weichen", () => {
        const ui = new UiFeedback();
        ["A", "B", "C", "D"].forEach(t => ui.error(t));
        expect(fehlerTexte()).toEqual(["A", "B", "C", "D"].slice(-MAX_FEHLER_TOASTS));
    });

    it("schliesseFehler räumt alle Fehler ab, ein Erfolg ebenso", () => {
        const ui = new UiFeedback();
        ui.error("A");
        ui.schliesseFehler();
        expect(fehlerTexte()).toEqual([]);
        ui.error("B");
        ui.success("Gespeichert.");
        expect(fehlerTexte()).toEqual([]);
    });

    it("unterdrückt Folgemeldungen derselben Ursache für kurze Zeit", () => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const ui = new UiFeedback();
        ui.error("Druckteil fehlt.", { folgefehlerUnterdrueckenMs: 2000 });
        ui.error("ZIP konnte nicht erstellt werden.");
        expect(fehlerTexte()).toEqual(["Druckteil fehlt."]);
        vi.advanceTimersByTime(2500);
        ui.error("Später etwas anderes.");
        expect(fehlerTexte()).toEqual(["Druckteil fehlt.", "Später etwas anderes."]);
    });
});
