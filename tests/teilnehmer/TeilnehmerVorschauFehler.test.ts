import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { TeilnehmerView } from "../../src/teilnehmer/TeilnehmerView";

// B1 (THW-Review 2026-10-04): Schlägt pdf.js fehl, darf das Vordruck-Fenster
// nicht leer bleiben. In Node lässt sich pdf.js nicht laden – genau dieser
// Fehlerpfad wird hier geprüft.
describe("TeilnehmerView – Vordruck-Vorschau ohne pdf.js", () => {
    beforeEach(() => {
        const dom = new JSDOM("<div id=\"teilnehmerContent\"></div>");
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            cb(0);
            return 1;
        });
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        let zaehler = 0;
        vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:test-${++zaehler}`);
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    const renderBase = () => {
        const view = new TeilnehmerView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderHeader({ name: "Ü", datum: new Date(), rufgruppe: "RG", leitung: "L" } as any, "Alpha");
        return view;
    };

    it("zeigt eine Meldung mit Ausweg statt eines leeren Rahmens", async () => {
        const view = renderBase();
        await view.renderPdfPage(new Blob(["%PDF"]), 2, 3);

        const hinweis = document.getElementById("teilnehmerPdfFehler");
        expect(hinweis).not.toBeNull();
        expect(hinweis?.getAttribute("role")).toBe("alert");
        expect(hinweis?.textContent).toContain("Vorschau lässt sich hier nicht anzeigen");
        const link = hinweis?.querySelector<HTMLAnchorElement>("[data-testid='vordruck-pdf-oeffnen']");
        expect(link?.getAttribute("href")).toBe("blob:test-1");
        expect(document.getElementById("teilnehmerPdfCanvas")?.classList.contains("d-none")).toBe(true);
        // Seitenanzeige und Blättern funktionieren trotzdem.
        expect(document.getElementById("teilnehmerDocPage")?.textContent).toBe("Seite 2 / 3");
    });

    it("ersetzt die Meldung beim nächsten Versuch und gibt die alte URL frei", async () => {
        const view = renderBase();
        await view.renderPdfPage(new Blob(["%PDF"]), 1, 3);
        await view.renderPdfPage(new Blob(["%PDF"]), 2, 3);

        expect(document.querySelectorAll("#teilnehmerPdfFehler")).toHaveLength(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-1");
        const link = document.querySelector<HTMLAnchorElement>("[data-testid='vordruck-pdf-oeffnen']");
        expect(link?.getAttribute("href")).toBe("blob:test-2");
    });
});
