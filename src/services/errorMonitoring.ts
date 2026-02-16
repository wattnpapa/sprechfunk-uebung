import { analytics } from "./analytics";
import { featureFlags } from "./featureFlags";

interface ErrorMonitoringOptions {
    getMode: () => string;
    getVersion: () => string;
}

declare global {
    interface Window {
        Sentry?: {
            captureException?: (error: unknown, context?: unknown) => void;
        };
    }
}

class ErrorMonitoringService {
    private initialized = false;
    private recentKeys = new Set<string>();
    private options: ErrorMonitoringOptions | null = null;

    public init(options: ErrorMonitoringOptions): void {
        if (this.initialized) {
            return;
        }
        if (typeof window === "undefined") {
            return;
        }
        if (!featureFlags.isEnabled("enableGlobalErrorMonitoring")) {
            return;
        }
        this.options = options;

        window.addEventListener("error", event => {
            const payload = {
                kind: "window_error" as const,
                message: event.message || "UnknownError",
                source: event.filename || "(unknown)",
                line: event.lineno || 0,
                col: event.colno || 0
            };
            this.record(payload, event.error);
        });

        window.addEventListener("unhandledrejection", event => {
            const message = this.stringifyReason(event.reason);
            const payload = {
                kind: "unhandled_rejection" as const,
                message,
                source: "(promise)",
                line: 0,
                col: 0
            };
            this.record(payload, event.reason);
        });

        this.initialized = true;
    }

    private record(
        base: { kind: "window_error" | "unhandled_rejection"; message: string; source: string; line: number; col: number },
        originalError: unknown
    ): void {
        const routeHash = typeof window !== "undefined" ? window.location?.hash || "#/" : "#/";
        const mode = this.options?.getMode() || "unknown";
        const appVersion = this.options?.getVersion() || "dev";
        const key = `${base.kind}:${base.source}:${base.line}:${base.col}:${base.message}`;
        if (this.recentKeys.has(key)) {
            return;
        }
        this.remember(key);

        analytics.track("app_error", {
            ...base,
            route_hash: routeHash,
            app_version: appVersion,
            mode
        });

        if (typeof window !== "undefined" && typeof window.Sentry?.captureException === "function") {
            window.Sentry.captureException(originalError ?? new Error(base.message), {
                tags: { mode, appVersion, kind: base.kind },
                extra: { source: base.source, line: base.line, col: base.col, routeHash }
            });
        }
    }

    private remember(key: string): void {
        this.recentKeys.add(key);
        if (this.recentKeys.size > 250) {
            const first = this.recentKeys.values().next().value;
            if (typeof first === "string") {
                this.recentKeys.delete(first);
            }
        }
    }

    private stringifyReason(reason: unknown): string {
        if (reason instanceof Error) {
            return reason.message || reason.name || "Error";
        }
        if (typeof reason === "string") {
            return reason;
        }
        try {
            return JSON.stringify(reason).slice(0, 200);
        } catch {
            return "UnknownRejection";
        }
    }
}

export const errorMonitoring = new ErrorMonitoringService();

