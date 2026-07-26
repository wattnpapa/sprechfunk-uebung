import { AppMode } from "./appModes";
import { marked } from "marked";

export class AppView {

    // Die Vorlagenauswahl wird nicht mehr hier initialisiert: ihr <select>
    // entsteht erst beim Rendern der Generator-Ansicht, deshalb haengt das
    // Multi-Select-Widget direkt in GeneratorView.render().
    public initGlobalListeners(): void {
        // Aktuell keine globalen Listener noetig.
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
