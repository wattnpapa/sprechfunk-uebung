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

    it("parses route path correctly when hash includes query params", async () => {
        setupWindow();
        const { router } = await import("../../src/core/router");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.location.hash = "#/teilnehmer?uc=K7M4Q2&tc=A1B2";
        const parsed = router.parseHash();
        expect(parsed).toEqual({ mode: "teilnehmer", params: [] });
    });

    it("treats document anchors as anchors, not routes (B4)", async () => {
        vi.resetModules();
        const { triggerHashChange } = setupWindow();
        const { router, istRoutenHash } = await import("../../src/core/router");

        expect(istRoutenHash("#kopfdaten")).toBe(false);
        expect(istRoutenHash("#teilnehmer")).toBe(false);
        expect(istRoutenHash("#uebungsueberwachung-uebungsleitung")).toBe(false);
        expect(istRoutenHash("#/teilnehmer")).toBe(true);
        expect(istRoutenHash("#teilnehmer/abc/X1")).toBe(true);
        expect(istRoutenHash("")).toBe(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.location.hash = "#/teilnehmer/u1/T1";
        const listener = vi.fn();
        router.subscribe(listener);
        expect(listener).toHaveBeenLastCalledWith({ mode: "teilnehmer", params: ["u1", "T1"] });

        // Sprungmarke: keine Benachrichtigung, parseHash bleibt bei der letzten Route.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.location.hash = "#teilnehmer";
        triggerHashChange();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(router.parseHash()).toEqual({ mode: "teilnehmer", params: ["u1", "T1"] });

        // Echte Route: wird gemeldet.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.location.hash = "#/admin";
        triggerHashChange();
        expect(listener).toHaveBeenLastCalledWith({ mode: "admin", params: [] });
    });

    it("falls back to the generator for unknown modes", async () => {
        setupWindow();
        const { router } = await import("../../src/core/router");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window.location.hash = "#/gibtsnicht/1";
        expect(router.parseHash()).toEqual({ mode: "generator", params: [] });
    });
});
