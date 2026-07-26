import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppView } from "../../src/core/AppView";

const makeDocument = () => {
    const listeners: Record<string, Array<(event: { target: unknown }) => void>> = {
        click: [],
        change: [],
        submit: []
    };

    const modalHandlers: Array<() => void> = [];
    const howtoModal = {
        addEventListener: vi.fn((_event: string, cb: () => void) => { modalHandlers.push(cb); })
    };

    const howtoContent = {
        innerHTML: ""
    };

    const elements = new Map<string, { style: { display: string } }>();
    const makeArea = () => ({ style: { display: "none" } });
    elements.set("mainAppArea", makeArea());
    elements.set("adminArea", makeArea());
    elements.set("uebungsleitungArea", makeArea());
    elements.set("teilnehmerArea", makeArea());
    elements.set("seoIntroArea", makeArea());

    const doc = {
        addEventListener: (event: string, cb: (event: { target: unknown }) => void) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(cb);
        },
        getElementById: (id: string) => {
            if (id === "howtoContent") return howtoContent;
            if (id === "howtoModal") return howtoModal;
            if (elements.has(id)) return elements.get(id) ?? null;
            return null;
        }
    };

    return { document: doc, listeners, howtoContent, modalHandlers, elements };
};

describe("AppView", () => {
    beforeEach(() => {
        const { document, listeners, howtoContent, modalHandlers, elements } = makeDocument();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = document;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).fetch = vi.fn().mockResolvedValue({
            text: async () => "# Hello"
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any)._test = { listeners, howtoContent, modalHandlers, elements };
    });

    // Die Vorlagenauswahl haengt seit dem select2-Ausbau in GeneratorView.render();
    // AppView darf dafuer nichts mehr am DOM anfassen.
    it("registers no global listeners for the template picker", () => {
        const view = new AppView();
        const getElementById = vi.spyOn((globalThis as any).document, "getElementById");

        view.initGlobalListeners();

        expect(getElementById).not.toHaveBeenCalled();
        getElementById.mockRestore();
    });

    it("loads howto modal content", async () => {
        const view = new AppView();
        view.initModals();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { howtoContent, modalHandlers } = (globalThis as any)._test;
        // loadHowTo laedt marked dynamisch nach, der Handler ist deshalb async.
        await modalHandlers[0]?.();
        expect(howtoContent.innerHTML).toContain("<h1");
    });

    it("handles howto load errors", async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error("fail"));
        const err = vi.spyOn(console, "error").mockImplementation(() => {});
        const view = new AppView();
        view.initModals();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { howtoContent, modalHandlers } = (globalThis as any)._test;
        modalHandlers[0]?.();
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
        expect(howtoContent.innerHTML).toContain("Fehler");
        err.mockRestore();
    });

    it("does nothing when howto container is missing", () => {
        const view = new AppView();
        const oldGet = (globalThis as any).document.getElementById;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document.getElementById = (id: string) => {
            if (id === "howtoContent") {
                return null;
            }
            return oldGet(id);
        };
        view.initModals();
    });

    it("applies app mode visibility", () => {
        const view = new AppView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { elements } = (globalThis as any)._test;

        view.applyAppMode("generator");
        expect(elements.get("mainAppArea")?.style.display).toBe("block");

        view.applyAppMode("admin");
        expect(elements.get("adminArea")?.style.display).toBe("block");

        view.applyAppMode("uebungsleitung");
        expect(elements.get("uebungsleitungArea")?.style.display).toBe("block");

        view.applyAppMode("teilnehmer");
        expect(elements.get("teilnehmerArea")?.style.display).toBe("block");
    });

    // Der Einstiegstext der Startseite darf nur in der Generator-Ansicht stehen,
    // sonst haengt er unter der Teilnehmer- oder Uebungsleitungsansicht.
    it("shows the intro section only in generator mode", () => {
        const view = new AppView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { elements } = (globalThis as any)._test;

        view.applyAppMode("generator");
        expect(elements.get("seoIntroArea")?.style.display).toBe("block");

        view.applyAppMode("teilnehmer");
        expect(elements.get("seoIntroArea")?.style.display).toBe("none");

        view.applyAppMode("uebungsleitung");
        expect(elements.get("seoIntroArea")?.style.display).toBe("none");

        view.applyAppMode("admin");
        expect(elements.get("seoIntroArea")?.style.display).toBe("none");
    });

    it("handles missing app mode containers safely", () => {
        const view = new AppView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document.getElementById = () => null;

        view.applyAppMode("generator");
        view.applyAppMode("admin");
        view.applyAppMode("uebungsleitung");
        view.applyAppMode("teilnehmer");
    });
});
