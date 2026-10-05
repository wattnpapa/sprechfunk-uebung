export interface FehlerOptionen {
    /**
     * Unterdrückt weitere Fehlermeldungen für diese Zeit (ms): eine Ursache,
     * eine Meldung. Der Druckteil meldet „konnte nicht geladen werden“, der
     * Aufrufer danach sein allgemeines „konnte nicht erstellt werden“ – das
     * zweite Kästchen sagt nichts Neues (THW-Review 2026-10-05, offline P3-2).
     */
    folgefehlerUnterdrueckenMs?: number;
}

type Variante = "success" | "error" | "info";

/** Höchstens so viele Fehlermeldungen stehen gleichzeitig; die älteste weicht. */
export const MAX_FEHLER_TOASTS = 2;

export class UiFeedback {
    private toastContainerId = "globalToastContainer";
    private unterdrueckenBis = 0;

    public info(message: string): void {
        this.showToast(message, "info");
    }

    /** Erfolg räumt stehende Fehler ab: die Aktion ist jetzt gelungen. */
    public success(message: string): void {
        this.schliesseFehler();
        this.showToast(message, "success");
    }

    public error(message: string, optionen: FehlerOptionen = {}): void {
        const jetzt = Date.now();
        if (jetzt < this.unterdrueckenBis) {
            console.warn("Folgemeldung unterdrückt:", message);
            return;
        }
        this.unterdrueckenBis = optionen.folgefehlerUnterdrueckenMs ? jetzt + optionen.folgefehlerUnterdrueckenMs : 0;
        this.showToast(message, "error");
    }

    /**
     * Schließt alle stehenden Fehlermeldungen – etwa beim nächsten Versuch,
     * damit nur der aktuelle Fehlerstand sichtbar bleibt (THW-Review
     * 2026-10-05, error-recovery P2-1).
     */
    public schliesseFehler(): void {
        if (typeof document === "undefined" || typeof document.getElementById !== "function") {
            return;
        }
        const container = document.getElementById(this.toastContainerId);
        if (typeof container?.querySelectorAll !== "function") {
            return;
        }
        container.querySelectorAll<HTMLElement>(".app-toast.is-error").forEach(toast => toast.remove());
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

    /**
     * Gleichlautende Fehler ersetzen die alte Meldung statt sich zu stapeln,
     * und mehr als MAX_FEHLER_TOASTS Fehler stehen nie übereinander – sonst
     * verdecken Altmeldungen das Formular (THW-Review 2026-10-05,
     * error-recovery P2-1, offline P3-2).
     */
    private raeumeFehlerAuf(container: HTMLElement, message: string): void {
        if (typeof container.querySelectorAll !== "function") {
            return;
        }
        const fehler = Array.from(container.querySelectorAll<HTMLElement>(".app-toast.is-error"));
        fehler.filter(toast => toast.getAttribute("data-meldung") === message).forEach(toast => toast.remove());
        const uebrig = fehler.filter(toast => toast.isConnected);
        uebrig.slice(0, Math.max(0, uebrig.length - (MAX_FEHLER_TOASTS - 1))).forEach(toast => toast.remove());
    }

    private showToast(message: string, variant: Variante): void {
        const container = this.ensureToastContainer();
        if (!container) {
            if (variant === "error" && typeof globalThis.alert === "function") {
                globalThis.alert(message);
            }
            return;
        }
        if (variant === "error") {
            this.raeumeFehlerAuf(container, message);
        }
        const toast = document.createElement("div");
        toast.className = `app-toast is-${variant}`;
        toast.setAttribute("data-meldung", message);
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
