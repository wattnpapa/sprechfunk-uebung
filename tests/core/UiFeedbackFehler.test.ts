import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { UiFeedback } from "../../src/core/UiFeedback";

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
