import { AppMode } from "./appModes";
import { marked } from "marked";
import $ from "./select2-setup";

export class AppView {

    public initGlobalListeners(): void {
        // Select2 Init
        $(document).ready(() => {
            const select = document.getElementById("funkspruchVorlage");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const $select = select ? (window as any).$(select) : null;
            if ($select && $select.select2) {
                $select.select2({
                    placeholder: "Vorlagen auswählen...",
                    theme: "bootstrap-5",
                    width: "100%",
                    closeOnSelect: false
                });
                this.suppressDropdownToggleOnChipRemove($select);
            }
        });
    }

    // select2 4.1.0 haengt zwei Klick-Handler an dieselbe .select2-selection: einen
    // delegierten fuer das x eines Chips und einen direkten, der das Dropdown
    // umschaltet. Beim Entfernen laufen beide, das Dropdown geht also ungewollt auf -
    // und der naechste Mausklick schliesst es wieder, statt es zu oeffnen. Unser
    // Handler wird nach dem von select2 registriert, entfernt den Chip also
    // weiterhin, stoppt aber die Weitergabe an den Toggle-Handler.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private suppressDropdownToggleOnChipRemove($select: any): void {
        const $selection = $select.data?.("select2")?.$container?.find(".select2-selection");
        $selection?.on("click", ".select2-selection__choice__remove", (evt: Event) => {
            evt.stopPropagation();
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
