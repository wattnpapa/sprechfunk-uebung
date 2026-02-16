import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = {
    track: vi.fn(),
    ffEnabled: vi.fn()
};

vi.mock("../../src/services/analytics", () => ({
    analytics: {
        track: mocks.track
    }
}));

vi.mock("../../src/services/featureFlags", () => ({
    featureFlags: {
        isEnabled: mocks.ffEnabled
    }
}));

describe("errorMonitoring", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mocks.track.mockReset();
        mocks.ffEnabled.mockReset();
        mocks.ffEnabled.mockReturnValue(true);
    });

    it("tracks window errors once per unique key", async () => {
        const listeners: Record<string, ((event: unknown) => void)[]> = {};
        vi.stubGlobal("window", {
            location: { hash: "#/generator" },
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

        const calls = mocks.track.mock.calls.filter(c => c[0] === "app_error");
        expect(calls).toHaveLength(1);
        expect(calls[0]?.[1]).toMatchObject({
            kind: "window_error",
            message: "Boom",
            source: "bundle.js",
            mode: "generator",
            app_version: "dev"
        });
    });
});

