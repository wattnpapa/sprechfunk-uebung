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
        const context = this.buildContext();
        const key = `${base.kind}:${base.source}:${base.line}:${base.col}:${base.message}`;
        if (this.recentKeys.has(key)) {
            return;
        }
        this.remember(key);

        analytics.track("app_error", {
            ...base,
            route_hash: context.routeHash,
            app_version: context.appVersion,
            mode: context.mode
        });

        this.captureSentry(base, originalError, context);
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

    private buildContext(): { routeHash: string; mode: string; appVersion: string } {
        return {
            routeHash: typeof window !== "undefined" ? window.location?.hash || "#/" : "#/",
            mode: this.options?.getMode() || "unknown",
            appVersion: this.options?.getVersion() || "dev"
        };
    }

    private captureSentry(
        base: { kind: "window_error" | "unhandled_rejection"; message: string; source: string; line: number; col: number },
        originalError: unknown,
        context: { routeHash: string; mode: string; appVersion: string }
    ): void {
        if (typeof window === "undefined" || typeof window.Sentry?.captureException !== "function") {
            return;
        }
        window.Sentry.captureException(originalError ?? new Error(base.message), {
            tags: { mode: context.mode, appVersion: context.appVersion, kind: base.kind },
            extra: {
                source: base.source,
                line: base.line,
                col: base.col,
                routeHash: context.routeHash
            }
        });
    }
}

export const errorMonitoring = new ErrorMonitoringService();
