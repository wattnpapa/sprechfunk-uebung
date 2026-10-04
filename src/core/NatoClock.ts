import { formatNatoDate } from "../utils/date";

export class NatoClock {
    private element: HTMLElement | null;

    constructor() {
        this.element = document.getElementById("natoTime");
    }

    public init(): void {
        if (!this.element) {
            return;
        }
        // Die Datum-Zeit-Gruppe stand ohne Erklärung im Kopf (THW-Review
        // 2026-10-04, new-user P3-1).
        this.element.title = "Aktuelle Uhrzeit als Datum-Zeit-Gruppe (Tag, Stunde, Minute, Monat, Jahr), wie im Sprechfunk üblich";
        this.update();
        setInterval(() => this.update(), 1000);
    }

    private update(): void {
        if (!this.element) {
            return;
        }
        this.element.textContent = formatNatoDate(new Date(), true);
    }
}