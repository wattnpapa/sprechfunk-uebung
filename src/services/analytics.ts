type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

class AnalyticsService {
    private measurementId: string | null = null;
    private initialized = false;

    public init(measurementId: string | undefined): void {
        if (!measurementId || this.initialized) {
            return;
        }
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }

        const hostname = window.location?.hostname ?? "";
        const search = window.location?.search ?? "";
        const isLocal = ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
        const force = new URLSearchParams(search).get("ga") === "1";
        if (isLocal && !force) {
            return;
        }

        this.measurementId = measurementId;

        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag(...args: unknown[]) {
            window.dataLayer?.push(args);
        };
        window.gtag("js", new Date());
        window.gtag("config", measurementId, {
            anonymize_ip: true,
            send_page_view: false
        });
        this.initialized = true;
    }

    public trackPage(path: string, title?: string): void {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }
        if (!this.initialized || !this.measurementId || typeof window.gtag !== "function") {
            return;
        }
        window.gtag("event", "page_view", {
            page_path: path,
            page_title: title ?? document.title
        });
    }

    public track(eventName: string, params: AnalyticsParams = {}): void {
        if (typeof window === "undefined") {
            return;
        }
        if (!this.initialized || !this.measurementId || typeof window.gtag !== "function") {
            return;
        }
        window.gtag("event", eventName, this.sanitizeParams(params));
    }

    private sanitizeParams(params: AnalyticsParams): AnalyticsParams {
        const out: AnalyticsParams = {};
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null) {
                return;
            }
            if (typeof value === "string") {
                out[key] = value.slice(0, 120);
                return;
            }
            out[key] = value;
        });
        return out;
    }
}

export const analytics = new AnalyticsService();
