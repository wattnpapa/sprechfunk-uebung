import { AppMode } from "./appModes";
import { Converter } from "showdown";
import $ from "./select2-setup";

export class AppView {
    
    public initGlobalListeners(): void {
        // Global button tracking
        document.addEventListener("click", event => {
            const targetEl = event.target as HTMLElement | null;
            if (!targetEl || typeof targetEl.closest !== "function") {
                return;
            }
            const button = targetEl.closest("button") as HTMLElement | null;
            if (!button) {
                return;
            }
            this.emitTracking("ui_click", this.getElementTrackingPayload(button));
        }, { capture: true });

        // Specific tracking for primary start action
        document.addEventListener("click", event => {
            const target = event.target as HTMLElement | null;
            if (!target || typeof target.closest !== "function") {
                return;
            }
            const startBtn = target.closest("#startUebungBtn") as HTMLElement | null;
            if (!startBtn) {
                return;
            }
            this.emitTracking("generator_start_button_click", this.getElementTrackingPayload(startBtn));
        }, { capture: true });

        document.addEventListener("change", event => {
            const el = event.target as HTMLElement | null;
            if (!el) {
                return;
            }
            if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
                return;
            }
            const payload = this.getElementTrackingPayload(el);
            if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
                payload["value"] = String(el.checked);
            } else {
                payload["value"] = "changed";
            }
            this.emitTracking("ui_change", payload);
        }, { capture: true });

        document.addEventListener("submit", event => {
            const form = event.target as HTMLFormElement | null;
            if (!form) {
                return;
            }
            this.emitTracking("ui_submit", {
                form_id: form.id || "(none)",
                form_class: form.className || "(none)"
            });
        });

        // Select2 Init
        $(document).ready(() => {
            const select = document.getElementById("funkspruchVorlage");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (select && (window as any).$(select).select2) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).$(select).select2({
                    placeholder: "Vorlagen auswählen...",
                    theme: "bootstrap-5",
                    width: "100%",
                    closeOnSelect: false
                });
            }
        });
    }

    private getElementTrackingPayload(element: HTMLElement): Record<string, string> {
        const el = element as Partial<HTMLElement> & Record<string, unknown>;
        const rawText = typeof el.textContent === "string" ? el.textContent : "";
        const text = rawText.trim().replace(/\s+/g, " ");
        const tagName = typeof el.tagName === "string" ? el.tagName.toLowerCase() : "(unknown)";
        const id = typeof el.id === "string" && el.id ? el.id : "(none)";
        const className = typeof el.className === "string" && el.className ? el.className : "(none)";
        return {
            tag: tagName,
            id,
            class_name: className,
            action: element.getAttribute?.("data-action") || "(none)",
            name: element.getAttribute?.("name") || "(none)",
            label: (element.getAttribute?.("aria-label") || text || "(empty)").slice(0, 80),
            click_key: this.getElementTrackingKey(element),
            route_hash: window.location?.hash || "#/"
        };
    }

    private getElementTrackingKey(element: HTMLElement): string {
        const id = element.id?.trim();
        if (id) {
            return `id:${id}`;
        }
        const analyticsId = element.getAttribute?.("data-analytics-id")?.trim();
        if (analyticsId) {
            return `analytics:${analyticsId}`;
        }
        const action = element.getAttribute?.("data-action")?.trim();
        if (action) {
            return `action:${action}`;
        }
        const path = this.getElementDomPath(element);
        const text = (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) || "(empty)";
        return `path:${path}|label:${text}`;
    }

    private getElementDomPath(element: HTMLElement): string {
        const parts: string[] = [];
        let current: HTMLElement | null = element;
        let guard = 0;
        while (current && guard < 6) {
            const tag = current.tagName?.toLowerCase() || "unknown";
            if (current.id) {
                parts.unshift(`${tag}#${current.id}`);
                break;
            }
            const parentEl = current.parentElement;
            if (!parentEl) {
                parts.unshift(tag);
                break;
            }
            const siblings = Array.from(parentEl.children).filter(
                child => (child as HTMLElement).tagName === current?.tagName
            );
            const index = Math.max(1, siblings.indexOf(current) + 1);
            parts.unshift(`${tag}:nth-of-type(${index})`);
            current = parentEl;
            guard++;
        }
        return parts.join(">");
    }

    private emitTracking(eventName: string, payload: Record<string, string>): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (window as any)?.gtag === "function") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).gtag("event", eventName, payload);
        }
    }

    public initModals(): void {
        const modalContent = document.getElementById("howtoContent");
        if (modalContent) {
            const loadHowTo = () => {
                fetch("howto.md")
                    .then(response => response.text())
                    .then(data => {
                        const converter = new Converter();
                        modalContent.innerHTML = converter.makeHtml(data);
                    })
                    .catch(error => {
                        console.error("Fehler beim Laden der Anleitung:", error);
                        modalContent.innerHTML = "Es gab einen Fehler beim Laden der Anleitung.";
                    });
            };
            const howtoModal = document.getElementById("howtoModal");
            howtoModal?.addEventListener("show.bs.modal", loadHowTo);
        }
    }

    public applyAppMode(mode: AppMode): void {
        const generator = document.getElementById("mainAppArea");
        const adminEl = document.getElementById("adminArea");
        const uebungsleitung = document.getElementById("uebungsleitungArea");
        const teilnehmer = document.getElementById("teilnehmerArea");
    
        if(generator) {
            generator.style.display = "none";
        }
        if(adminEl) {
            adminEl.style.display = "none";
        }
        if(uebungsleitung) {
            uebungsleitung.style.display = "none";
        }
        if(teilnehmer) {
            teilnehmer.style.display = "none";
        }
    
        switch (mode) {
            case "generator":
                if(generator) {
                    generator.style.display = "block";
                }
                break;
            case "admin":
                if(adminEl) {
                    adminEl.style.display = "block";
                }
                break;
            case "uebungsleitung":
                if(uebungsleitung) {
                    uebungsleitung.style.display = "block";
                }
                break;
            case "teilnehmer":
                if(teilnehmer) {
                    teilnehmer.style.display = "block";
                }
                break;
        }
    }
}
