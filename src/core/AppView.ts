import { AppMode } from "./appModes";
import { marked } from "marked";
import $ from "./select2-setup";

export class AppView {

    public initGlobalListeners(): void {
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
                        modalContent.innerHTML = marked(data) as string;
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
        const areas: Record<AppMode, HTMLElement | null> = {
            generator: document.getElementById("mainAppArea"),
            admin: document.getElementById("adminArea"),
            uebungsleitung: document.getElementById("uebungsleitungArea"),
            teilnehmer: document.getElementById("teilnehmerArea")
        };

        Object.values(areas).forEach(el => {
            if (el) {
                el.style.display = "none";
            }
        });

        const active = areas[mode];
        if (active) {
            active.style.display = "block";
        }
    }
}
