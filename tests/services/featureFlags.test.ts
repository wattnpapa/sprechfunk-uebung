import { beforeEach, describe, expect, it, vi } from "vitest";
import { featureFlags } from "../../src/services/featureFlags";

describe("featureFlags", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        featureFlags.resetForTests();
        vi.stubGlobal("window", {
            location: { search: "" },
            localStorage: {
                getItem: vi.fn(() => null)
            }
        });
    });

    it("uses defaults when no overrides exist", () => {
        featureFlags.init();
        expect(featureFlags.isEnabled("enableStartrekTheme")).toBe(true);
        expect(featureFlags.isEnabled("enableUiInteractionTracking")).toBe(true);
        expect(featureFlags.isEnabled("enableGlobalErrorMonitoring")).toBe(true);
    });

    it("reads query flag overrides", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).location.search = "?ff_disable=enableStartrekTheme&ff=enableGlobalErrorMonitoring";
        featureFlags.init();
        expect(featureFlags.isEnabled("enableStartrekTheme")).toBe(false);
        expect(featureFlags.isEnabled("enableGlobalErrorMonitoring")).toBe(true);
    });
});
