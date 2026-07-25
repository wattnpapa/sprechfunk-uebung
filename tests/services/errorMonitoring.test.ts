import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = {
    captureException: vi.fn(),
    ffEnabled: vi.fn()
};

vi.mock("../../src/services/featureFlags", () => ({
    featureFlags: {
        isEnabled: mocks.ffEnabled
    }
}));

describe("errorMonitoring", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mocks.captureException.mockReset();
        mocks.ffEnabled.mockReset();
        mocks.ffEnabled.mockReturnValue(true);
    });

    it("reports window errors once per unique key", async () => {
        const listeners: Record<string, ((event: unknown) => void)[]> = {};
        vi.stubGlobal("window", {
            location: { hash: "#/generator" },
            Sentry: { captureException: mocks.captureException },
            addEventListener: vi.fn((event: string, cb: (event: unknown) => void) => {
                listeners[event] = listeners[event] || [];
                listeners[event].push(cb);
            })
        });

        const { errorMonitoring } = await import("../../src/services/errorMonitoring");
        errorMonitoring.init({
            getMode: () => "generator",
            getVersion: () => "dev"
        });

        const errEvt = { message: "Boom", filename: "bundle.js", lineno: 12, colno: 3, error: new Error("Boom") };
        listeners.error?.[0]?.(errEvt);
        listeners.error?.[0]?.(errEvt);

        expect(mocks.captureException).toHaveBeenCalledTimes(1);
        expect(mocks.captureException.mock.calls[0]?.[0]).toBe(errEvt.error);
        expect(mocks.captureException.mock.calls[0]?.[1]).toMatchObject({
            tags: { kind: "window_error", mode: "generator", appVersion: "dev" },
            extra: { source: "bundle.js", line: 12, col: 3, routeHash: "#/generator" }
        });
    });
});

