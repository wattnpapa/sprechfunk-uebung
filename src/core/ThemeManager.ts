import { uiFeedback } from "./UiFeedback";
import { featureFlags } from "../services/featureFlags";

export type Theme = "dark" | "light" | "startrek";

/**
 * Farbe der Browser-Adressleiste je Theme, gleich dem Kopfbalken
 * (--kopf-fond). Muss mit THEME_FARBEN in scripts/lib/theme-init.mjs
 * übereinstimmen, das Inline-Skript setzt sie schon vor dem ersten Bild
 * (tests/core/ThemeFarben.test.ts).
 */
export const THEME_FARBEN: Record<Theme, string> = {
    light: "#12275e",
    dark: "#0e1526",
    startrek: "#000000"
};

const istTheme = (wert: string | null): wert is Theme =>
    wert === "dark" || wert === "light" || wert === "startrek";

export class ThemeManager {
    private toggleBtns: HTMLElement[];

    constructor() {
        const desktop = document.getElementById("themeToggle");
        const mobile = document.getElementById("themeToggleMobile");
        this.toggleBtns = [desktop, mobile].filter((el): el is HTMLElement => el !== null);
    }

    public init(): void {
        const storedTheme = localStorage.getItem("theme");
        this.applyTheme(istTheme(storedTheme) ? storedTheme : this.getSystemTheme());
        this.bindEvents();
    }

    private getSystemTheme(): "dark" | "light" {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    private applyTheme(theme: Theme): void {
        document.body.setAttribute("data-theme", theme);
        const label = theme === "dark"
            ? "☀️ Light Mode"
            : theme === "startrek"
                ? "🖖 Star Trek Theme"
                : "🌙 Dark Mode";
        this.toggleBtns.forEach(btn => {
            btn.textContent = label;
        });
        document.querySelector?.("meta[name=\"theme-color\"]")?.setAttribute("content", THEME_FARBEN[theme]);
    }

    private bindEvents(): void {
        this.toggleBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const current = document.body.getAttribute("data-theme");
                const next = current === "dark" ? "light" : "dark";
                localStorage.setItem("theme", next);
                this.applyTheme(next);
            });

            btn.addEventListener("dblclick", () => {
                if (!featureFlags.isEnabled("enableStartrekTheme")) {
                    return;
                }
                localStorage.setItem("theme", "startrek");
                this.applyTheme("startrek");
                uiFeedback.info("Star Trek Theme aktiviert.");
            });
        });

        // Der Systemwechsel greift nur, solange niemand selbst gewählt hat.
        // Vorher überschrieb er auch eine bewusste Wahl – mitten in einer
        // Abendübung sprang die Anzeige von dunkel auf hell (THW-Review
        // 2026-10-04, B5).
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
            if (istTheme(localStorage.getItem("theme"))) {
                return;
            }
            this.applyTheme(e.matches ? "dark" : "light");
        });
    }
}
