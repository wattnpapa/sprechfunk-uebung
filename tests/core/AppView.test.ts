import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/core/select2-setup", () => ({
    default: (arg: unknown) => {
        if (arg === (globalThis as any).document) {
            return { ready: (cb: () => void) => cb() };
        }
        return { select2: vi.fn() };
    }
}));

import { AppView } from "../../src/core/AppView";

const makeDocument = () => {
    const listeners: Record<string, Array<(event: { target: unknown }) => void>> = {
        click: []
    };

    const modalHandlers: Array<() => void> = [];
    const howtoModal = {
        addEventListener: vi.fn((_event: string, cb: () => void) => { modalHandlers.push(cb); })
    };

    const howtoContent = {
        innerHTML: ""
    };

    const selectEl = {};
    const elements = new Map<string, { style: { display: string } }>();
    const makeArea = () => ({ style: { display: "none" } });
    elements.set("mainAppArea", makeArea());
    elements.set("adminArea", makeArea());
    elements.set("uebungsleitungArea", makeArea());
    elements.set("teilnehmerArea", makeArea());

    const doc = {
        addEventListener: (event: string, cb: (event: { target: unknown }) => void) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(cb);
        },
        getElementById: (id: string) => {
            if (id === "howtoContent") return howtoContent;
            if (id === "howtoModal") return howtoModal;
            if (id === "funkspruchVorlage") return selectEl;
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
        (globalThis as any).window = {
            gtag: vi.fn(),
            $: vi.fn(() => ({ select2: vi.fn() })),
            jQuery: vi.fn()
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).fetch = vi.fn().mockResolvedValue({
            text: async () => "# Hello"
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any)._test = { listeners, howtoContent, modalHandlers, elements };
    });

    it("wires global click listeners and tracks events", () => {
        const view = new AppView();
        view.initGlobalListeners();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { listeners } = (globalThis as any)._test;

        const button = {
            innerText: "Start",
            getAttribute: () => null
        };
        const target = {
            closest: (sel: string) => (sel === "button" ? button : null)
        };

        listeners.click[0]?.({ target });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).window.gtag).toHaveBeenCalled();

        const startButton = {};
        const startTarget = {
            closest: (sel: string) => (sel === "#startUebungBtn" ? startButton : null)
        };
        listeners.click[1]?.({ target: startTarget });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).window.gtag).toHaveBeenCalled();
    });

    it("uses fallback labels and skips tracking when gtag missing", () => {
        const view = new AppView();
        view.initGlobalListeners();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { listeners } = (globalThis as any)._test;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.gtag = undefined;
        listeners.click[0]?.({ target: null });
        listeners.click[0]?.({
            target: {
                closest: (sel: string) => {
                    if (sel !== "button") {
                        return null;
                    }
                    return { innerText: "", getAttribute: () => "aria fallback" };
                }
            }
        });
        listeners.click[0]?.({
            target: {
                closest: (sel: string) => {
                    if (sel !== "button") {
                        return null;
                    }
                    return { innerText: "", getAttribute: () => "" };
                }
            }
        });
    });

    it("ignores invalid delegated click targets", () => {
        const view = new AppView();
        view.initGlobalListeners();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { listeners } = (globalThis as any)._test;

        listeners.click[1]?.({ target: null });
        listeners.click[1]?.({ target: { closest: () => null } });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).window.gtag).not.toHaveBeenCalledWith(
            "event",
            "Übung_generieren",
            expect.anything()
        );
    });

    it("does not track delegated event when gtag is unavailable", () => {
        const view = new AppView();
        view.initGlobalListeners();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { listeners } = (globalThis as any)._test;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.gtag = undefined;
        listeners.click[1]?.({ target: { closest: (sel: string) => (sel === "#startUebungBtn" ? {} : null) } });
    });

    it("does not initialize select2 when select is missing", () => {
        const view = new AppView();
        const oldGet = (globalThis as any).document.getElementById;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document.getElementById = (id: string) => {
            if (id === "funkspruchVorlage") {
                return null;
            }
            return oldGet(id);
        };
        view.initGlobalListeners();
    });

    it("does not initialize select2 when plugin is missing", () => {
        const view = new AppView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.$ = vi.fn(() => ({}));
        view.initGlobalListeners();
    });

    it("loads howto modal content", async () => {
        const view = new AppView();
        view.initModals();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { howtoContent, modalHandlers } = (globalThis as any)._test;
        modalHandlers[0]?.();
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
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
