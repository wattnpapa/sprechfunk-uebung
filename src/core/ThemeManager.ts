export class ThemeManager {
    private toggleBtn: HTMLElement | null;

    constructor() {
        this.toggleBtn = document.getElementById("themeToggle");
    }

    public init(): void {
        const storedTheme = localStorage.getItem("theme");
        
        if (storedTheme === "dark" || storedTheme === "light") {
            this.applyTheme(storedTheme);
        } else {
            this.applyTheme(this.getSystemTheme());
        }

        this.bindEvents();
    }

    private getSystemTheme(): "dark" | "light" {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    private applyTheme(theme: "dark" | "light"): void {
        document.body.setAttribute("data-theme", theme);
        if (this.toggleBtn) {
            this.toggleBtn.textContent = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
        }
    }

    private bindEvents(): void {
        this.toggleBtn?.addEventListener("click", () => {
            const current = document.body.getAttribute("data-theme") as "dark" | "light";
            const next = current === "dark" ? "light" : "dark";
            localStorage.setItem("theme", next);
            this.applyTheme(next);
        });

        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
            if (!localStorage.getItem("theme")) {
                this.applyTheme(e.matches ? "dark" : "light");
            }
        });
    }
}