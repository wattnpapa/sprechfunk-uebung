import { saveTeilnehmerStorage } from "../services/storage";
import { TeilnehmerStorage } from "../types/Storage";
import { uiFeedback } from "../core/UiFeedback";
import { uebernehmeLeitungsBasis } from "../services/liveStatusMerge";
import type { LeitungPublicLiveDoc } from "../types/LiveStatus";
import { TeilnehmerVordruckSteuerung } from "./vordruckSteuerung";

/** Hinweistext, woher die X-Zeit-Basis stammt – Leitung oder eigene Abweichung. */
export function xZeitHerkunftText(storage: TeilnehmerStorage, leitungXZeitBasis: string | null): string {
    const basis = storage.xZeitBasis;
    if (!basis) {
        // Ein Satz, kein Widerspruch zur Fokus-Karte (field-user P2, 2026-10-05).
        return "Warte auf die X-Zeit der Übungsleitung – sie erscheint hier automatisch.";
    }
    if (storage.xZeitBasisQuelle === "leitung") {
        return `X-Zeit ${basis} – von der Übungsleitung gesetzt.`;
    }
    if (leitungXZeitBasis && basis !== leitungXZeitBasis) {
        return `Eigene Basis ${basis} – die Übungsleitung hat ${leitungXZeitBasis} festgelegt.`;
    }
    if (leitungXZeitBasis) {
        return `X-Zeit ${basis} – wie bei der Übungsleitung.`;
    }
    return `Eigene X-Zeit ${basis} – selbst gestartet.`;
}

/** Hinweis-Element unter dem X-Zeit-Feld; wird beim ersten Mal angelegt. */
function herkunftsHinweis(input: HTMLElement): HTMLElement {
    let hinweis = document.getElementById("xZeitBasisHerkunft");
    if (!hinweis) {
        hinweis = document.createElement("small");
        hinweis.id = "xZeitBasisHerkunft";
        hinweis.className = "text-body-secondary w-100";
        input.parentElement?.appendChild(hinweis);
    }
    return hinweis;
}

/** Aktuelle Uhrzeit als HH:MM. */
function jetztHHMM(): string {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

/** X-Zeit-Basis (Leitung oder eigen), Ticker und Fokus-Modus. */
export abstract class TeilnehmerXZeitSteuerung extends TeilnehmerVordruckSteuerung {
    /** Bindet Eingabefeld, „Jetzt starten“ und Fokus-Karte einer X-Zeit-Übung. */
    protected bindeXZeit(): void {
        if (!this.storage) {
            return;
        }
        if (this.storage.xZeitBasis) {
            this.view.setXZeitBasisInputValue(this.storage.xZeitBasis);
        }
        this.view.bindXZeitEvents(
            (value) => this.setXZeitBasis(value),
            () => {
                const value = jetztHHMM();
                if (value === this.storage?.xZeitBasis) {
                    return;
                }
                this.setXZeitBasis(value);
            }
        );
        if (this.storage.xZeitBasis) {
            this.startXZeitTicker();
        }
        this.zeigeXZeitHerkunft();
        this.view.bindFokusEvents(
            checked => this.setFokusModus(checked),
            id => this.toggleUebertragen(id, true),
            id => this.toggleUebertragen(id, false)
        );
    }

    /**
     * Auf schmalen Geräten ist der Fokus-Modus Standard, solange der
     * Teilnehmer ihn nicht selbst umgeschaltet hat: ein Spruch, ein großer
     * Knopf. Gilt nur für X-Zeit-Übungen, denn nur dort gibt es Fälligkeiten.
     */
    protected waehleFokusStandard(): void {
        if (!this.storage || this.uebung?.spielModus !== "xZeit" || this.storage.fokusModus !== undefined) {
            return;
        }
        const mm = typeof window !== "undefined" && typeof window.matchMedia === "function"
            ? window.matchMedia("(max-width: 576px)")
            : null;
        if (mm?.matches) {
            this.storage.fokusModus = true;
        }
    }

    /**
     * Die Übungsleitung setzt die X-Zeit-Basis verbindlich für alle; die
     * Teilnehmer übernehmen sie ohne eigenes Zutun (THW-Review workflow F2).
     */
    protected uebernehmeXZeitDerLeitung(remote: LeitungPublicLiveDoc | null): void {
        this.leitungXZeitBasis = remote?.xZeitBasis ?? null;
        if (!remote || !this.storage || this.uebung?.spielModus !== "xZeit") {
            this.zeigeXZeitHerkunft();
            return;
        }
        const { merged, changed } = uebernehmeLeitungsBasis(this.storage, remote);
        if (changed) {
            this.storage = merged;
            saveTeilnehmerStorage(this.storage);
            this.view.setXZeitBasisInputValue(this.storage.xZeitBasis ?? "");
            this.publishStatus();
            if (this.storage.xZeitBasis) {
                this.startXZeitTicker();
            } else {
                this.stopXZeitTicker();
            }
        }
        this.zeigeXZeitHerkunft();
    }

    /** Sichtbar machen, woher die Basis stammt – Leitung oder eigene Abweichung. */
    protected zeigeXZeitHerkunft(): void {
        if (typeof document === "undefined" || !this.storage || this.uebung?.spielModus !== "xZeit") {
            return;
        }
        const input = document.getElementById("xZeitBasisInput");
        if (!input) {
            return;
        }
        herkunftsHinweis(input).textContent = xZeitHerkunftText(this.storage, this.leitungXZeitBasis);
    }

    /**
     * Eine eigene Basis neben der verbindlichen der Leitung nur als bewusste
     * Abweichung. Ohne Leitungs-Basis fragt das Überschreiben einer schon
     * laufenden eigenen X-Zeit nach: ein zweiter Tipp auf „Jetzt starten“
     * verschob sonst still alle Fälligkeiten (glove-touch P2-3, 2026-10-05).
     */
    private bestaetigeAbweichung(value: string): boolean {
        if (this.leitungXZeitBasis) {
            if (value === this.leitungXZeitBasis) {
                return true;
            }
            return uiFeedback.confirm(
                `Die Übungsleitung hat die X-Zeit ${this.leitungXZeitBasis} für alle festgelegt. Willst du wirklich mit einer eigenen Basis (${value || "keine"}) weiterarbeiten?`
            );
        }
        const bisher = this.storage?.xZeitBasis;
        if (!bisher || bisher === value) {
            return true;
        }
        return uiFeedback.confirm(value
            ? `Die X-Zeit läuft seit ${bisher}. Neu starten setzt sie auf ${value} – alle Fälligkeiten verschieben sich. Wirklich neu starten?`
            : `Die X-Zeit ${bisher} löschen? Danach zeigt die Ansicht keine Fälligkeiten mehr.`);
    }

    protected setXZeitBasis(value: string): void {
        if (!this.storage) {
            return;
        }
        if (!this.bestaetigeAbweichung(value)) {
            this.view.setXZeitBasisInputValue(this.storage.xZeitBasis ?? "");
            return;
        }
        this.view.setXZeitBasisInputValue(value);
        if (value) {
            this.storage.xZeitBasis = value;
        } else {
            delete this.storage.xZeitBasis;
        }
        this.storage.xZeitBasisQuelle = value && value === this.leitungXZeitBasis ? "leitung" : "eigen";
        this.storage.xZeitBasisGeaendertUm = new Date().toISOString();
        saveTeilnehmerStorage(this.storage);
        this.publishStatus();
        this.renderNachrichten();
        this.startXZeitTicker();
        this.zeigeXZeitHerkunft();
    }

    /** Fokus-Modus ist eine reine Ansichtseinstellung dieses Geräts. */
    protected setFokusModus(aktiv: boolean): void {
        if (!this.storage) {
            return;
        }
        this.storage.fokusModus = aktiv;
        saveTeilnehmerStorage(this.storage);
        this.renderNachrichten();
    }
}
