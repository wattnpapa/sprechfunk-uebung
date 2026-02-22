import { AppMode } from "./appModes";
import { Converter } from "showdown";
import $ from "./select2-setup";
import { analytics } from "../services/analytics";
import { featureFlags } from "../services/featureFlags";
import { buildUiChangePayload, buildUiClickPayload } from "../services/analyticsPayloads";

export class AppView {
    
    public initGlobalListeners(): void {
        if (!featureFlags.isEnabled("enableUiInteractionTracking")) {
            return;
        }

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
            analytics.track("ui_click", buildUiClickPayload(button));
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
            analytics.track("generator_start_button_click", buildUiClickPayload(startBtn));
        }, { capture: true });

        document.addEventListener("change", event => {
            const el = event.target as HTMLElement | null;
            if (!el) {
                return;
            }
            if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
                return;
            }
            analytics.track("ui_change", buildUiChangePayload(el));
        }, { capture: true });

        document.addEventListener("submit", event => {
            const form = event.target as HTMLFormElement | null;
            if (!form) {
                return;
            }
            analytics.track("ui_submit", {
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
