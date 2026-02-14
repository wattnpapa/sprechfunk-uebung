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
        container.appendChild(toast);
        globalThis.setTimeout(() => toast.classList.add("is-visible"), 10);
        globalThis.setTimeout(() => {
            toast.classList.remove("is-visible");
            globalThis.setTimeout(() => toast.remove(), 220);
        }, 2500);
    }
}

export const uiFeedback = new UiFeedback();
