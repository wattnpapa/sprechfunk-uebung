export class UiFeedback {
    private toastContainerId = "globalToastContainer";

    public info(message: string): void {
        this.showToast(message, "info");
    }

    public success(message: string): void {
        this.showToast(message, "success");
    }

    public error(message: string): void {
        this.showToast(message, "error");
    }

    public confirm(message: string): boolean {
        if (typeof globalThis.confirm === "function") {
            return globalThis.confirm(message);
        }
        return true;
    }

    private ensureToastContainer(): HTMLElement | null {
        if (typeof document === "undefined") {
            return null;
        }
        const doc = document as Document & { body?: HTMLElement };
        if (!doc || !doc.body || typeof doc.body.appendChild !== "function") {
            return null;
        }
        let container = doc.getElementById(this.toastContainerId);
        if (!container) {
            container = doc.createElement("div");
            container.id = this.toastContainerId;
            container.className = "app-toast-container";
            container.setAttribute("aria-live", "polite");
            container.setAttribute("aria-atomic", "true");
            doc.body.appendChild(container);
        }
        return container;
    }

    private showToast(message: string, variant: "success" | "error" | "info"): void {
        const container = this.ensureToastContainer();
        if (!container) {
            if (variant === "error" && typeof globalThis.alert === "function") {
                globalThis.alert(message);
            }
            return;
        }
        const toast = document.createElement("div");
        toast.className = `app-toast is-${variant}`;
        toast.textContent = message;
        const ausblenden = () => {
            toast.classList.remove("is-visible");
            globalThis.setTimeout(() => toast.remove(), 220);
        };
        if (variant === "error") {
            // Fehler bleiben stehen, bis sie weggetippt werden: wer gerade
            // funkt, verpasst eine Meldung, die nach 2,5 s verschwindet
            // (THW-Review 2026-10-04, offline P2-3, error-recovery P2-1).
            toast.setAttribute("role", "alert");
            const schliessen = document.createElement("button");
            schliessen.type = "button";
            schliessen.className = "app-toast-schliessen";
            schliessen.setAttribute("aria-label", "Meldung schließen");
            schliessen.textContent = "×";
            schliessen.addEventListener("click", ausblenden);
            toast.appendChild(schliessen);
        }
        container.appendChild(toast);
        globalThis.setTimeout(() => toast.classList.add("is-visible"), 10);
        if (variant !== "error") {
            globalThis.setTimeout(ausblenden, 2500);
        }
    }
}

export const uiFeedback = new UiFeedback();
