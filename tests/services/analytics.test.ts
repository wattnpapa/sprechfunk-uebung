import { beforeEach, describe, expect, it, vi } from "vitest";
import { analytics } from "../../src/services/analytics";

describe("analytics service", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        const addEventListener = vi.fn();
        vi.stubGlobal("window", {
            location: {
                hostname: "example.com",
                search: "",
                hash: "#/generator"
            },
            localStorage: {
                getItem: vi.fn(() => "granted"),
                setItem: vi.fn()
            },
            dataLayer: [],
            gtag: vi.fn(),
            addEventListener
        });
        vi.stubGlobal("document", {
            head: {
                appendChild: vi.fn()
            },
            createElement: vi.fn(() => ({
                async: false,
                src: ""
            })),
            title: "Test Title"
        });
    });

    it("initializes GA script and config", () => {
        analytics.init("G-TEST123");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((document as any).head.appendChild).toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((window as any).gtag).toBeTypeOf("function");
    });

    it("does not initialize on localhost unless forced", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).location.hostname = "localhost";
        analytics.init("G-TEST123");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((document as any).head.appendChild).not.toHaveBeenCalled();
    });

    it("tracks page and event with sanitized params", () => {
        analytics.init("G-TEST123");
        const gtagSpy = vi.spyOn(window, "gtag");

        analytics.trackPage("#/admin", "Admin");
        analytics.track("ui_click", {
            label: "x".repeat(300),
            enabled: true,
            count: 2,
            ignored: undefined
        });

        expect(gtagSpy).toHaveBeenCalledWith("event", "page_view", expect.objectContaining({
            page_path: "#/admin",
            page_title: "Admin"
        }));
        expect(gtagSpy).toHaveBeenCalledWith("event", "ui_click", expect.objectContaining({
            enabled: true,
            count: 2
        }));
    });

    it("respects consent toggle", () => {
        analytics.init("G-TEST123");
        const gtagSpy = vi.spyOn(window, "gtag");
        analytics.setConsent(false);
        analytics.track("ui_click", { label: "x" });
        const before = gtagSpy.mock.calls.length;

        analytics.setConsent(true);
        analytics.track("ui_click", { label: "x" });
        const after = gtagSpy.mock.calls.length;
        expect(after).toBeGreaterThan(before);
    });
});
