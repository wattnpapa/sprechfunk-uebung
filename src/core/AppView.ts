import { AppMode } from "./appModes";

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
            const loadHowTo = async () => {
                try {
                    // marked (41 kB) laedt erst mit der Anleitung statt beim Start.
                    const [{ marked }, response] = await Promise.all([
                        import("marked"),
                        fetch("howto.md")
                    ]);
                    modalContent.innerHTML = marked(await response.text()) as string;
                } catch (error) {
                    console.error("Fehler beim Laden der Anleitung:", error);
                    modalContent.innerHTML = "Es gab einen Fehler beim Laden der Anleitung.";
                }
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

        // Style-Writes nur bei tatsaechlicher Aenderung: Beim ersten Aufruf nach
        // dem Laden steht die Generator-Ansicht bereits richtig (statisches
        // HTML). Ein wirkungsloses Neusetzen von style.display wuerde den
        // Elementen trotzdem einen spaeten Repaint verpassen, der als neuer
        // LCP-Kandidat zaehlt und den Lighthouse-LCP nach hinten schiebt.
        const setDisplay = (el: HTMLElement | null, display: string) => {
            if (el && el.style.display !== display) {
                el.style.display = display;
            }
        };

        Object.entries(areas).forEach(([areaMode, el]) => {
            setDisplay(el, areaMode === mode ? "block" : "none");
        });

        // Der Einstiegstext der Startseite gehoert nur zur Generator-Ansicht;
        // in Teilnehmer-, Uebungsleitungs- und Admin-Ansicht wuerde er stoeren.
        setDisplay(document.getElementById("seoIntroArea"), mode === "generator" ? "block" : "none");

        this.setzeNavigationsZustand(mode);
    }

    /**
     * Die Hauptnavigation steht statisch im HTML der Startseite, dort ist
     * „Übung erstellen“ als aktuelle Seite markiert. In Teilnehmer-,
     * Übungsleitungs- und Admin-Ansicht stimmte das nicht und lud dazu ein,
     * die eigene Ansicht zu verlassen (THW-Review 2026-10-04). Außerdem wird
     * die Navigation in den Übungsrollen auf dem Smartphone eingeklappt: dort
     * zählt der erste Funkspruch, nicht die Website-Navigation.
     */
    private setzeNavigationsZustand(mode: AppMode): void {
        if (typeof document.querySelector !== "function") {
            return;
        }
        const startLink = document.querySelector<HTMLElement>("[data-testid=\"nav-start\"]");
        if (startLink) {
            const aktiv = mode === "generator";
            startLink.classList.toggle("active", aktiv);
            if (aktiv) {
                startLink.setAttribute("aria-current", "page");
            } else {
                startLink.removeAttribute("aria-current");
            }
        }

        const details = document.querySelector<HTMLDetailsElement>(".site-nav-details");
        if (!details) {
            return;
        }
        const schmal = typeof window.matchMedia === "function"
            && window.matchMedia("(max-width: 767.98px)").matches;
        const uebungsRolle = mode === "teilnehmer" || mode === "uebungsleitung";
        if (schmal && uebungsRolle) {
            details.open = false;
            details.dataset["eingeklappt"] = "rolle";
        } else if (details.dataset["eingeklappt"] === "rolle") {
            // Nur wieder aufklappen, was hier eingeklappt wurde.
            details.open = true;
            delete details.dataset["eingeklappt"];
        }
    }
}
