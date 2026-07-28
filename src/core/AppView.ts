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

        // Gleiches gilt fuer das Nutzenversprechen im Kopfbalken: Es richtet sich
        // an Erstbesucher, nicht an Teilnehmer einer laufenden Uebung. Der leere
        // Wert stellt die Darstellung aus dem Stylesheet wieder her, damit die
        // Zweitzeile auf schmalen Geraeten ausgeblendet bleibt.
        setDisplay(document.getElementById("appHeaderClaim"), mode === "generator" ? "" : "none");
    }
}
