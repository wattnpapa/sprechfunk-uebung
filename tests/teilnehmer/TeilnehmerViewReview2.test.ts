import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { TeilnehmerView } from "../../src/teilnehmer/TeilnehmerView";
import type { TeilnehmerStorage } from "../../src/types/Storage";

const setupDom = () => {
    const dom = new JSDOM("<div id=\"teilnehmerContent\"></div>");
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    return dom;
};

const uebung = (spielModus?: string) =>
    ({ name: "Ü", datum: new Date(), rufgruppe: "RG", leitung: "L", ...(spielModus ? { spielModus } : {}) }) as never;

const liste = [
    { id: 1, empfaenger: ["B"], nachricht: "eins" },
    { id: 2, empfaenger: ["C"], nachricht: "zwei" },
    { id: 3, empfaenger: ["D"], nachricht: "drei" }
];

describe("TeilnehmerView – THW-Review 2026-10-05", () => {
    beforeEach(() => {
        setupDom();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("zeigt ohne Verbindung keinen Code-Fehler, sondern den Weg zum Papier", () => {
        const view = new TeilnehmerView();
        const erneut = vi.fn();
        view.renderVerbindungsFehler(erneut);
        const text = document.getElementById("teilnehmerContent")?.textContent ?? "";
        expect(text).toContain("Deine Codes sind in Ordnung");
        expect(text).toContain("auf diesem Gerät gespeichert");
        expect(text).toContain("ausgedruckten Vordrucken");
        expect(document.getElementById("teilnehmerJoinForm")).toBeNull();
        (document.getElementById("btn-teilnehmer-erneut") as HTMLButtonElement).click();
        expect(erneut).toHaveBeenCalledTimes(1);
    });

    it("nennt in der Fehlerseite nur Verwechslungen, die in Codes vorkommen können", () => {
        const view = new TeilnehmerView();
        view.renderZugangsFehler("Übung nicht gefunden.");
        const hinweis = document.getElementById("teilnehmerJoinHinweis")?.textContent ?? "";
        expect(hinweis).toContain("kein O");
        expect(hinweis).not.toContain("leicht verwechselt");
    });

    it("zeigt den mitlaufenden Offline-Hinweis mit Zahl und blendet ihn online aus", () => {
        const view = new TeilnehmerView();
        view.renderHeader(uebung(), "Alpha");
        const leiste = document.getElementById("teilnehmerSyncLeiste") as HTMLElement;
        expect(leiste.hidden).toBe(true);
        view.updateLiveSyncState("offline", { offen: 2, bestaetigtUm: "21:07" });
        expect(leiste.hidden).toBe(false);
        expect(leiste.textContent).toContain("2 Sprüche nur auf diesem Gerät");
        expect(document.getElementById("teilnehmerLiveSyncBadge")?.textContent).toBe("Keine Verbindung – 2 Sprüche nur hier");
        view.updateLiveSyncState("live", { offen: 0, bestaetigtUm: "21:09" });
        expect(leiste.hidden).toBe(true);
        expect(document.getElementById("teilnehmerLiveSyncBadge")?.textContent).toContain("alles gesendet 21:09");
    });

    it("scrollt nach dem Laden zum nächsten offenen Spruch, wenn er unter der Falz liegt", () => {
        const view = new TeilnehmerView();
        view.renderHeader(uebung(), "Alpha");
        const storage = { hideTransmitted: false, nachrichten: { 1: { uebertragen: true }, 2: { uebertragen: true } } } as unknown as TeilnehmerStorage;
        view.renderNachrichten(liste, storage);
        const zeile = document.querySelector("tr.ist-naechster") as HTMLElement;
        const scroll = vi.fn();
        zeile.scrollIntoView = scroll;
        vi.spyOn(zeile, "getBoundingClientRect").mockReturnValue({ bottom: 2000 } as DOMRect);
        view.scrolleZumNaechsten();
        expect(scroll).toHaveBeenCalledWith({ block: "center" });

        // Steht er schon im Bild, bleibt die Seite ruhig.
        scroll.mockClear();
        vi.spyOn(zeile, "getBoundingClientRect").mockReturnValue({ bottom: 100 } as DOMRect);
        view.scrolleZumNaechsten();
        expect(scroll).not.toHaveBeenCalled();
    });

    it("scrollt nicht, wenn der erste Spruch der nächste ist", () => {
        const view = new TeilnehmerView();
        view.renderHeader(uebung(), "Alpha");
        view.renderNachrichten(liste, { hideTransmitted: false, nachrichten: {} } as unknown as TeilnehmerStorage);
        const zeile = document.querySelector("tr.ist-naechster") as HTMLElement;
        const scroll = vi.fn();
        zeile.scrollIntoView = scroll;
        view.scrolleZumNaechsten();
        expect(scroll).not.toHaveBeenCalled();
    });

    it("stellt bei X-Zeit Karte und Fokus vor die Liste und klappt das eigene Zeitfeld ein", () => {
        const view = new TeilnehmerView();
        view.renderHeader(uebung("xZeit"), "Alpha");
        const inhalt = document.getElementById("teilnehmerContent") as HTMLElement;
        const html = inhalt.innerHTML;
        expect(html.indexOf("teilnehmerFokusCard")).toBeLessThan(html.indexOf("data-doc-view=\"table\""));
        const eigene = document.getElementById("xZeitEigene") as HTMLDetailsElement;
        expect(eigene.open).toBe(false);
        expect(eigene.contains(document.getElementById("btn-xzeit-jetzt"))).toBe(true);
        expect(eigene.contains(document.getElementById("xZeitBasisInput"))).toBe(true);

        view.setXZeitBasisInputValue("19:30");
        expect(document.getElementById("btn-xzeit-jetzt")?.textContent).toBe("Neu starten");
        view.setXZeitBasisInputValue("");
        expect(document.getElementById("btn-xzeit-jetzt")?.textContent).toBe("Jetzt starten");
    });

    it("legt die Rückgängig-Leiste auf die Hälfte, in der nicht getippt wurde", () => {
        const view = new TeilnehmerView();
        view.renderHeader(uebung(), "Alpha");
        view.bindEvents({
            onToggleUebertragen: vi.fn(), onToggleHide: vi.fn(), onReset: vi.fn(), onDocViewChange: vi.fn(),
            onDocPrev: vi.fn(), onDocNext: vi.fn(), onDocClose: vi.fn(), onDocToggleCurrent: vi.fn(),
            onDownloadZip: vi.fn(), onSearch: vi.fn()
        });
        const box = document.getElementById("teilnehmerRueckgaengig") as HTMLElement;
        const tippe = (y: number) => {
            const e = new window.Event("pointerdown");
            Object.defineProperty(e, "clientY", { value: y });
            document.body.dispatchEvent(e);
        };
        tippe(50);
        view.zeigeRueckgaengig("x", vi.fn());
        expect(box.dataset["position"]).toBe("unten");
        tippe(window.innerHeight - 10);
        view.zeigeRueckgaengig("y", vi.fn());
        expect(box.dataset["position"]).toBe("oben");
        view.versteckeRueckgaengig();
        expect(box.hidden).toBe(true);
    });
});
