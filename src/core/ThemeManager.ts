export class ThemeManager {
    private toggleBtns: HTMLElement[];

    constructor() {
        const desktop = document.getElementById("themeToggle");
        const mobile = document.getElementById("themeToggleMobile");
        this.toggleBtns = [desktop, mobile].filter((el): el is HTMLElement => el !== null);
    }

    public init(): void {
        const storedTheme = localStorage.getItem("theme");
        
        if (storedTheme === "dark" || storedTheme === "light" || storedTheme === "startrek") {
            this.applyTheme(storedTheme);
        } else {
            this.applyTheme(this.getSystemTheme());
        }

        this.bindEvents();
    }

    private getSystemTheme(): "dark" | "light" {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    private applyTheme(theme: "dark" | "light" | "startrek"): void {
        document.body.setAttribute("data-theme", theme);
        const label = theme === "dark"
            ? "☀️ Light Mode"
            : theme === "startrek"
                ? "🖖 Star Trek Theme"
                : "🌙 Dark Mode";
        this.toggleBtns.forEach(btn => {
            btn.textContent = label;
        });
    }

    private bindEvents(): void {
        this.toggleBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const current = document.body.getAttribute("data-theme") as "dark" | "light" | "startrek";
                const next = current === "dark" ? "light" : "dark";
                localStorage.setItem("theme", next);
                this.applyTheme(next);
            });

            btn.addEventListener("dblclick", () => {
                localStorage.setItem("theme", "startrek");
                this.applyTheme("startrek");
            });
        });

        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
            const storedTheme = localStorage.getItem("theme");
            if (!storedTheme || storedTheme === "light" || storedTheme === "dark") {
                this.applyTheme(e.matches ? "dark" : "light");
            }
        });
    }
}
