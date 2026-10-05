import { RUECKGAENGIG_MS } from "./ansichtHelfer";

/** Wo die Leiste in der Liste steht. */
export type LeistenPosition = "oben" | "unten";

/**
 * Die Leiste kommt auf die Bildschirmhälfte, in der nicht getippt wurde.
 * So liegt sie nie über dem Knopf, den der Finger eben traf, und auch nicht
 * über der nächsten Karte darunter (glove-touch P1-1, 2026-10-05).
 */
export function leistenPosition(tippY: number | null, hoehe: number): LeistenPosition {
    if (tippY === null || hoehe <= 0) {
        return "oben";
    }
    return tippY < hoehe / 2 ? "unten" : "oben";
}

function vordruckOffen(): boolean {
    return !!document.getElementById("teilnehmerDocModal")?.classList.contains("show");
}

/**
 * Hinweis mit „Rückgängig“ nach einem Statuswechsel. Er bleibt einige
 * Sekunden stehen.
 *
 * - Im Vordruck-Fenster steht er als eigene Zeile zwischen Vordruck und
 *   Knopfleiste, nicht darüber: „Weiter“ bleibt „Weiter“.
 * - In der Liste schwebt er auf der Bildschirmhälfte, in der nicht getippt
 *   wurde.
 *
 * Weil er so nie unter dem Finger auftaucht, braucht „Rückgängig“ keine
 * Tippsperre mehr und wirkt sofort (error-recovery P3-1, 2026-10-05).
 */
export class RueckgaengigHinweis {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private aktion: (() => void) | null = null;
    private letzterTippY: number | null = null;

    public zeige(text: string, onUndo: () => void): void {
        this.versteckeElemente();
        const imVordruck = vordruckOffen();
        const box = document.getElementById(imVordruck ? "teilnehmerDocRueckgaengig" : "teilnehmerRueckgaengig");
        const textEl = document.getElementById(imVordruck ? "teilnehmerDocRueckgaengigText" : "teilnehmerRueckgaengigText");
        if (!box || !textEl) {
            return;
        }
        textEl.textContent = text;
        if (!imVordruck) {
            const hoehe = typeof window !== "undefined" ? window.innerHeight || 0 : 0;
            box.dataset["position"] = leistenPosition(this.letzterTippY, hoehe);
        }
        box.hidden = false;
        this.aktion = onUndo;
        if (this.timer !== null) {
            clearTimeout(this.timer);
        }
        this.timer = globalThis.setTimeout(() => this.verstecke(), RUECKGAENGIG_MS);
    }

    public verstecke(): void {
        this.versteckeElemente();
        this.aktion = null;
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private versteckeElemente(): void {
        for (const id of ["teilnehmerRueckgaengig", "teilnehmerDocRueckgaengig"]) {
            const box = document.getElementById(id);
            if (box) {
                box.hidden = true;
            }
        }
    }

    private loese(): void {
        const aktion = this.aktion;
        this.verstecke();
        aktion?.();
    }

    public bind(): void {
        document.getElementById("btn-teilnehmer-rueckgaengig")?.addEventListener("click", () => this.loese());
        document.getElementById("btn-doc-rueckgaengig")?.addEventListener("click", () => this.loese());
        // Wo zuletzt getippt wurde, entscheidet über die Lage der Leiste.
        document.addEventListener("pointerdown", e => {
            this.letzterTippY = (e as PointerEvent).clientY ?? null;
        }, true);
    }
}
