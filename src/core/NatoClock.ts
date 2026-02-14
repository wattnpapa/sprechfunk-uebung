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