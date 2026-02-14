import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeManager } from "../../src/core/ThemeManager";

const makeLocalStorage = () => {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); }
    };
};

const makeDocument = () => {
    const attrs = new Map<string, string>();
    const body = {
        setAttribute: (key: string, value: string) => { attrs.set(key, value); },
        getAttribute: (key: string) => attrs.get(key) ?? null
    };
    const toggleBtn = {
        textContent: "",
        addEventListener: vi.fn()
    };
    const toggleBtnMobile = {
        textContent: "",
        addEventListener: vi.fn()
    };

    const doc = {
        body,
        getElementById: (id: string) => {
            if (id === "themeToggle") {
                return toggleBtn;
            }
            if (id === "themeToggleMobile") {
                return toggleBtnMobile;
            }
            return null;
        }
    };

    return { document: doc, toggleBtn, toggleBtnMobile, attrs };
};

describe("ThemeManager", () => {
    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = makeLocalStorage();
    });

    it("applies stored theme on init", () => {
        const { document, toggleBtn, toggleBtnMobile, attrs } = makeDocument();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = document;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window = {
            matchMedia: vi.fn().mockReturnValue({
                matches: false,
                addEventListener: vi.fn()
            })
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage.setItem("theme", "dark");

        const manager = new ThemeManager();
        manager.init();

        expect(attrs.get("data-theme")).toBe("dark");
        expect(toggleBtn.textContent).toBe("☀️ Light Mode");
        expect(toggleBtnMobile.textContent).toBe("☀️ Light Mode");
    });

    it("falls back to system theme and toggles on click", () => {
        const { document, toggleBtn, attrs } = makeDocument();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = document;

        const matchMediaListeners: Array<(e: { matches: boolean }) => void> = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window = {
            matchMedia: vi.fn().mockReturnValue({
                matches: true,
                addEventListener: (_event: string, cb: (e: { matches: boolean }) => void) => {
                    matchMediaListeners.push(cb);
                }
            })
        };

        const manager = new ThemeManager();
        manager.init();

        expect(attrs.get("data-theme")).toBe("dark");

        const clickHandler = (toggleBtn.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls
            .find(call => call[0] === "click")?.[1];
        clickHandler?.();

        expect(attrs.get("data-theme")).toBe("light");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).localStorage.getItem("theme")).toBe("light");

        matchMediaListeners[0]?.({ matches: false });
        expect(attrs.get("data-theme")).toBe("light");
    });

    it("activates star trek on double click", () => {
        const { document, toggleBtn, attrs } = makeDocument();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = document;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window = {
            matchMedia: vi.fn().mockReturnValue({
                matches: false,
                addEventListener: vi.fn()
            })
        };

        const manager = new ThemeManager();
        manager.init();

        const dblClickHandler = (toggleBtn.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls
            .find(call => call[0] === "dblclick")?.[1];
        dblClickHandler?.();

        expect(attrs.get("data-theme")).toBe("startrek");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).localStorage.getItem("theme")).toBe("startrek");
    });

    it("toggle from startrek goes to dark and system change is ignored when startrek stored", () => {
        const { document, toggleBtn, attrs } = makeDocument();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = document;
        const matchMediaListeners: Array<(e: { matches: boolean }) => void> = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window = {
            matchMedia: vi.fn().mockReturnValue({
                matches: false,
                addEventListener: (_event: string, cb: (e: { matches: boolean }) => void) => {
                    matchMediaListeners.push(cb);
                }
            })
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage.setItem("theme", "startrek");

        const manager = new ThemeManager();
        manager.init();

        const clickHandler = (toggleBtn.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls
            .find(call => call[0] === "click")?.[1];
        clickHandler?.();
        expect(attrs.get("data-theme")).toBe("dark");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage.setItem("theme", "startrek");
        attrs.set("data-theme", "startrek");
        matchMediaListeners[0]?.({ matches: true });
        expect(attrs.get("data-theme")).toBe("startrek");
    });

    it("applies system change when no theme is stored", () => {
        const { document, attrs } = makeDocument();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = document;
        const matchMediaListeners: Array<(e: { matches: boolean }) => void> = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window = {
            matchMedia: vi.fn().mockReturnValue({
                matches: false,
                addEventListener: (_event: string, cb: (e: { matches: boolean }) => void) => {
                    matchMediaListeners.push(cb);
                }
            })
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage.removeItem("theme");

        const manager = new ThemeManager();
        manager.init();

        matchMediaListeners[0]?.({ matches: true });
        expect(attrs.get("data-theme")).toBe("dark");
    });
});
