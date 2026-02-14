import { AppMode } from "./appModes";
import { Converter } from "showdown";
import $ from "./select2-setup";

export class AppView {
    
    public initGlobalListeners(): void {
        // Global Button Tracking
        document.addEventListener("click", event => {
            const targetEl = event.target as HTMLElement | null;
            if (targetEl && targetEl.closest("button")) {
                const button = (targetEl.closest("button") as HTMLButtonElement);
                const label = button.innerText.trim() || button.getAttribute("aria-label") || "Unbekannter Button";
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (typeof (window as any).gtag === "function") {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (window as any).gtag("event", "button_click", {
                        "event_category": "Interaktion",
                        "event_label": label
                    });
                }
            }
        });

        // Specific Button Tracking
        const startBtn = document.querySelector("button[onclick=\"app.startUebung()\"]");
        if (startBtn) {
            startBtn.addEventListener("click", function () {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (typeof (window as any).gtag === "function") {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (window as any).gtag("event", "Übung_generieren", {
                        "event_category": "Button Click",
                        "event_label": "Übung generieren Button geklickt"
                    });
                }
            });
        }

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
                        if (!modalContent) {
                            return;
                        }
                        const converter = new Converter();
                        modalContent.innerHTML = converter.makeHtml(data);
                    })
                    .catch(error => {
                        console.error("Fehler beim Laden der Anleitung:", error);
                        if (modalContent) {
                            modalContent.innerHTML = "Es gab einen Fehler beim Laden der Anleitung.";
                        }
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
