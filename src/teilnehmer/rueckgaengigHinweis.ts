import { RUECKGAENGIG_MS, STATUS_SPERRE_MS } from "./ansichtHelfer";

/**
 * Hinweis mit „Rückgängig“ nach einem Statuswechsel. Er bleibt einige
 * Sekunden stehen; ein Tipp innerhalb der Tippsperre wird ignoriert, damit
 * ein Doppeltipp ihn nicht gleich auslöst.
 */
export class RueckgaengigHinweis {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private seit = 0;
    private aktion: (() => void) | null = null;

    public zeige(text: string, onUndo: () => void): void {
        const box = document.getElementById("teilnehmerRueckgaengig");
        const textEl = document.getElementById("teilnehmerRueckgaengigText");
        if (!box || !textEl) {
            return;
        }
        textEl.textContent = text;
        box.hidden = false;
        this.aktion = onUndo;
        this.seit = Date.now();
        if (this.timer !== null) {
            clearTimeout(this.timer);
        }
        this.timer = globalThis.setTimeout(() => this.verstecke(), RUECKGAENGIG_MS);
    }

    public verstecke(): void {
        const box = document.getElementById("teilnehmerRueckgaengig");
        if (box) {
            box.hidden = true;
        }
        this.aktion = null;
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    public bind(): void {
        document.getElementById("btn-teilnehmer-rueckgaengig")?.addEventListener("click", () => {
            if (Date.now() - this.seit < STATUS_SPERRE_MS) {
                return;
            }
            const aktion = this.aktion;
            this.verstecke();
            aktion?.();
        });
    }
}
