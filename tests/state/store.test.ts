import { describe, expect, it, vi, beforeEach } from "vitest";

describe("store", () => {
    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
        };
    });

    it("setState updates and notifies", async () => {
        const { store } = await import("../../src/state/store");
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        store.setState({ mode: "admin" });
        expect(listener).toHaveBeenCalled();
        expect(store.getState().mode).toBe("admin");

        unsubscribe();
    });
});
