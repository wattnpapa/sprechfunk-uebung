import { describe, expect, it, vi } from "vitest";

const setupWindow = () => {
    let handler: (() => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = {
        location: { hash: "" },
        addEventListener: (event: string, cb: () => void) => {
            if (event === "hashchange") {
                handler = cb;
            }
        }
    };

    return {
        triggerHashChange: () => handler?.()
    };
};

describe("router", () => {
    it("parses hash and notifies subscribers", async () => {
        const { triggerHashChange } = setupWindow();
        const { router } = await import("../../src/core/router");

        // parse
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.location.hash = "#/admin/abc";
        const parsed = router.parseHash();
        expect(parsed).toEqual({ mode: "admin", params: ["abc"] });

        const listener = vi.fn();
        const unsubscribe = router.subscribe(listener);
        expect(listener).toHaveBeenCalledWith({ mode: "admin", params: ["abc"] });

        // change
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.location.hash = "#/teilnehmer/xyz";
        triggerHashChange();
        expect(listener).toHaveBeenLastCalledWith({ mode: "teilnehmer", params: ["xyz"] });

        unsubscribe();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.location.hash = "#/generator";
        triggerHashChange();
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("navigate updates hash", async () => {
        setupWindow();
        const { router } = await import("../../src/core/router");

        router.navigate("uebungsleitung", "id1");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).window.location.hash).toBe("#/uebungsleitung/id1");

        router.navigate("generator");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).window.location.hash).toBe("#/generator");
    });

    it("defaults to generator on empty hash", async () => {
        setupWindow();
        const { router } = await import("../../src/core/router");
        const parsed = router.parseHash();
        expect(parsed).toEqual({ mode: "generator", params: [] });
    });
});
