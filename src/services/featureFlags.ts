export interface FeatureFlags {
    enableStartrekTheme: boolean;
    enableUiInteractionTracking: boolean;
    enableGlobalErrorMonitoring: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
    enableStartrekTheme: true,
    enableUiInteractionTracking: true,
    enableGlobalErrorMonitoring: true
};

const STORAGE_KEY = "featureFlags";

class FeatureFlagService {
    private flags: FeatureFlags = { ...DEFAULT_FLAGS };
    private initialized = false;

    public init(): void {
        if (this.initialized || typeof window === "undefined") {
            return;
        }

        this.flags = { ...DEFAULT_FLAGS, ...this.readStoredFlags(), ...this.readQueryFlags() };
        this.initialized = true;
    }

    public isEnabled(flag: keyof FeatureFlags): boolean {
        if (!this.initialized) {
            this.init();
        }
        return this.flags[flag];
    }

    public getAll(): FeatureFlags {
        if (!this.initialized) {
            this.init();
        }
        return { ...this.flags };
    }

    public resetForTests(): void {
        this.flags = { ...DEFAULT_FLAGS };
        this.initialized = false;
    }

    private readStoredFlags(): Partial<FeatureFlags> {
        if (typeof window === "undefined") {
            return {};
        }
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return {};
            }
            const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
            return this.sanitize(parsed);
        } catch {
            return {};
        }
    }

    private readQueryFlags(): Partial<FeatureFlags> {
        if (typeof window === "undefined") {
            return {};
        }
        const params = new URLSearchParams(window.location?.search ?? "");
        const enableList = params.get("ff");
        const disableList = params.get("ff_disable");
        const next: Partial<FeatureFlags> = {};

        const apply = (raw: string | null, value: boolean) => {
            if (!raw) {
                return;
            }
            raw.split(",").map(v => v.trim()).forEach(key => {
                if (key in DEFAULT_FLAGS) {
                    next[key as keyof FeatureFlags] = value;
                }
            });
        };

        apply(enableList, true);
        apply(disableList, false);
        return next;
    }

    private sanitize(value: Partial<FeatureFlags>): Partial<FeatureFlags> {
        const out: Partial<FeatureFlags> = {};
        (Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[]).forEach(key => {
            if (typeof value[key] === "boolean") {
                out[key] = value[key];
            }
        });
        return out;
    }
}

export const featureFlags = new FeatureFlagService();
