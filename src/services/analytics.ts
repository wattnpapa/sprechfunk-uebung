import type { AnalyticsEventMap, AnalyticsEventName, AnalyticsParams } from "./analyticsEvents";

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

class AnalyticsService {
    private measurementId: string | null = null;
    private initialized = false;
    private consentGranted = false;
    private readonly consentStorageKey = "ga_consent";

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
            this.consentGranted = this.readStoredConsent() === true;
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
        window.gtag("consent", "default", {
            analytics_storage: "denied",
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied"
        });
        window.gtag("config", measurementId, {
            anonymize_ip: true,
            send_page_view: false
        });
        const storedConsent = this.readStoredConsent();
        if (storedConsent !== null) {
            this.setConsent(storedConsent);
        }
        this.initialized = true;
    }

    public trackPage(path: string, title?: string): void {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }
        if (!this.initialized || !this.measurementId || typeof window.gtag !== "function" || !this.consentGranted) {
            return;
        }
        window.gtag("event", "page_view", {
            page_path: path,
            page_title: title ?? document.title
        });
    }

    public track<K extends AnalyticsEventName>(eventName: K, params: AnalyticsEventMap[K]): void;
    public track(eventName: string, params?: AnalyticsParams): void;
    public track(eventName: string, params: AnalyticsParams = {}): void {
        if (typeof window === "undefined") {
            return;
        }
        if (!this.initialized || !this.measurementId || typeof window.gtag !== "function" || !this.consentGranted) {
            return;
        }
        window.gtag("event", eventName, this.sanitizeParams(params));
    }

    public isConsentGranted(): boolean {
        const stored = this.readStoredConsent();
        if (stored !== null) {
            this.consentGranted = stored;
        }
        return this.consentGranted;
    }

    public setConsent(granted: boolean): void {
        this.consentGranted = granted;
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(this.consentStorageKey, granted ? "granted" : "denied");
            } catch {
                // ignore storage write errors
            }
        }
        if (!this.initialized || typeof window === "undefined" || typeof window.gtag !== "function") {
            return;
        }
        window.gtag("consent", "update", {
            analytics_storage: granted ? "granted" : "denied",
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied"
        });
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

    private readStoredConsent(): boolean | null {
        if (typeof window === "undefined") {
            return null;
        }
        try {
            const value = window.localStorage.getItem(this.consentStorageKey);
            if (value === "granted") {
                return true;
            }
            if (value === "denied") {
                return false;
            }
        } catch {
            return null;
        }
        return null;
    }
}

export const analytics = new AnalyticsService();
