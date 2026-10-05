import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
    HINWEIS_ID,
    WIEDER_ONLINE_TEXT,
    formatStand,
    initOfflineStandHinweis,
    offlineStandText,
    setzeOfflineStandHinweisZurueck
} from "../../src/core/OfflineStandHinweis";
import { OFFLINE_STAND_EREIGNIS } from "../../src/services/uebungOfflineKopie";

// THW-Review 2026-10-05, offline P1-2: Eine Übung aus der Offline-Kopie muss
// als „letzter bekannter Stand“ erkennbar sein.
describe("OfflineStandHinweis", () => {
    let dom: JSDOM;

    beforeEach(() => {
        dom = new JSDOM("<body><main id=\"appMain\"><div id=\"inhalt\"></div></main></body>", { url: "https://sprechfunk-uebung.de/" });
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        setzeOfflineStandHinweisZurueck();
        initOfflineStandHinweis();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const melde = (iso: string) => dom.window.dispatchEvent(new dom.window.CustomEvent(OFFLINE_STAND_EREIGNIS, {
        detail: { uebungId: "u1", standIso: iso }
    }));

    it("zeigt den Stand oben im Inhalt, nur einmal", () => {
        const stand = new Date(2026, 9, 5, 21, 7);
        melde(stand.toISOString());
        melde(stand.toISOString());
        const hinweise = document.querySelectorAll(`#${HINWEIS_ID}`);
        expect(hinweise).toHaveLength(1);
        expect(document.getElementById("appMain")?.firstElementChild?.id).toBe(HINWEIS_ID);
        expect(hinweise[0]?.textContent).toBe(offlineStandText(stand));
        expect(offlineStandText(stand)).toContain("Ohne Verbindung");
        expect(formatStand(stand)).toBe("05.10.2026, 21:07 Uhr");
    });

    it("bietet nach Netzrückkehr das Neuladen an, ein Routenwechsel räumt ab", () => {
        melde(new Date().toISOString());
        dom.window.dispatchEvent(new dom.window.Event("online"));
        const hinweis = document.getElementById(HINWEIS_ID);
        expect(hinweis?.textContent).toContain(WIEDER_ONLINE_TEXT);
        expect(hinweis?.querySelector("button")?.textContent).toBe("Jetzt neu laden");
        dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange"));
        expect(document.getElementById(HINWEIS_ID)).toBeNull();
    });

    it("ignoriert Ereignisse ohne gültigen Zeitpunkt", () => {
        melde("kaputt");
        expect(document.getElementById(HINWEIS_ID)).toBeNull();
    });
});
