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
    private errorHandlersBound = false;
    private recentErrorKeys = new Set<string>();
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
        this.bindGlobalErrorHandlers();
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

    private bindGlobalErrorHandlers(): void {
        if (this.errorHandlersBound) {
            return;
        }
        if (typeof window.addEventListener !== "function") {
            return;
        }

        window.addEventListener("error", event => {
            const filename = event.filename || "(unknown)";
            const line = event.lineno || 0;
            const col = event.colno || 0;
            const message = event.message || "UnknownError";
            const key = `error:${filename}:${line}:${col}:${message}`;
            if (this.recentErrorKeys.has(key)) {
                return;
            }
            this.rememberErrorKey(key);
            this.track("js_error", {
                kind: "window_error",
                message,
                source: filename,
                line,
                col
            });
        });

        window.addEventListener("unhandledrejection", event => {
            const reason = this.getReasonMessage(event.reason);
            const key = `rejection:${reason}`;
            if (this.recentErrorKeys.has(key)) {
                return;
            }
            this.rememberErrorKey(key);
            this.track("js_error", {
                kind: "unhandled_rejection",
                message: reason
            });
        });

        this.errorHandlersBound = true;
    }

    private rememberErrorKey(key: string): void {
        this.recentErrorKeys.add(key);
        if (this.recentErrorKeys.size > 200) {
            const first = this.recentErrorKeys.values().next().value;
            if (typeof first === "string") {
                this.recentErrorKeys.delete(first);
            }
        }
    }

    private getReasonMessage(reason: unknown): string {
        if (reason instanceof Error) {
            return reason.message || reason.name || "Error";
        }
        if (typeof reason === "string") {
            return reason;
        }
        try {
            return JSON.stringify(reason).slice(0, 120);
        } catch {
            return "UnknownRejection";
        }
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
