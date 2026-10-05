import { Uebung } from "../types/Uebung";
import { TeilnehmerStatus } from "../types/Storage";
import type { TeilnehmerFortschritt } from "../services/liveStatusMerge";
import type { AnmeldeZustand } from "./lagebild";
import {
    anmeldungFuer,
    buildCodeByTeilnehmer,
    findeNachzuegler,
    renderAnmeldeCell,
    renderBeuebteStelleRow,
    renderFortschrittCell,
    renderLoesungswortCell,
    renderNotizUndDebriefCells,
    renderStaerkeCell,
    renderTeilnehmerName,
    renderTeilnehmerTabelle,
    sortiereTeilnehmer,
    type TeilnehmerTabellenKontext
} from "./teilnehmerMarkup";

export { STILL_SEIT_MINUTEN } from "./teilnehmerMarkup";

type TeilnehmerCallbacks = {
    onAnmelden: (name: string) => void;
    onAnmeldungZuruecknehmen?: (name: string) => void;
    onLoesungswort: (name: string, val: string) => void;
    onStaerke: (name: string, idx: number, val: string) => void;
    onNotiz: (name: string, val: string) => void;
    onToggleDetails: () => void;
    onDownloadDebrief: (name: string) => void;
};

/** Zusatzangaben zur Teilnehmertabelle, die nicht im Übungsdokument stehen. */
export interface TeilnehmerZusatz {
    /** Fortschritt je Teilnehmer aus Live-Meldungen und Bestätigungen der Leitung. */
    fortschritt?: Record<string, TeilnehmerFortschritt>;
    /** Anmeldung je Teilnehmer – aus Tabelle, Anmelde-Funkspruch oder Selbstmeldung. */
    anmeldung?: Record<string, AnmeldeZustand>;
    /** Bezugszeit für „vor N min“ – für Tests einstellbar. */
    jetztMs?: number;
}

/** Was je Zeile der Teilnehmertabelle unterschiedlich ist. */
interface TeilnehmerZeile {
    name: string;
    status: TeilnehmerStatus | undefined;
    fortschritt: TeilnehmerFortschritt | undefined;
    istNachzuegler: boolean;
    anmeldung: AnmeldeZustand | undefined;
}

export class UebungsleitungTeilnehmerView {
    /**
     * Zuletzt gezeigter Meldungsstand je Teilnehmer. Die Tabelle wird bei jedem
     * Firestore-Snapshot vollständig neu geschrieben; ohne diesen Merker wäre
     * nicht erkennbar, welche Zeile sich tatsächlich geändert hat — und ein
     * Übergang überlebte das Neu-Rendern ohnehin nicht.
     */
    private letzterStand = new Map<string, number>();

    /** Zuletzt gezeigte Balkenlänge in Prozent, Startwert des Übergangs. */
    private letzterProzent = new Map<string, number>();

    public render(
        uebung: Uebung,
        teilnehmerStatus: Record<string, TeilnehmerStatus>,
        showStaerkeDetails: boolean,
        zusatz: TeilnehmerZusatz = {}
    ): void {
        const container = document.getElementById("uebungsleitungTeilnehmer");
        if (!container) {
            return;
        }

        const teilnehmerListe = uebung.teilnehmerListe || [];
        if (!teilnehmerListe.length) {
            container.innerHTML = "<em>Keine Teilnehmer vorhanden.</em>";
            return;
        }

        const fortschritt = zusatz.fortschritt ?? {};
        const kontext = this.buildKontext(uebung, showStaerkeDetails, zusatz);
        // Nachzügler: alle, die spürbar hinter dem Median der Gruppe liegen.
        const beuebteStelle = uebung.fuehrungsstelle?.beuebteStelle;
        const nachzuegler = findeNachzuegler(teilnehmerListe.filter(n => n !== beuebteStelle), fortschritt);
        const rows = sortiereTeilnehmer(teilnehmerListe, beuebteStelle).map(name => name === beuebteStelle
            ? renderBeuebteStelleRow(kontext, name)
            : this.renderTeilnehmerRow(kontext, {
                name,
                status: teilnehmerStatus[name],
                fortschritt: fortschritt[name],
                istNachzuegler: nachzuegler.has(name),
                anmeldung: zusatz.anmeldung?.[name]
            })
        ).join("");

        container.innerHTML = renderTeilnehmerTabelle(kontext, rows);

        container.querySelectorAll<HTMLTextAreaElement>("textarea.auto-grow").forEach(el => {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
        });

        this.merkeStand(teilnehmerListe, fortschritt);
        this.starteBalkenUebergang(container);
    }

    private buildKontext(uebung: Uebung, showStaerkeDetails: boolean, zusatz: TeilnehmerZusatz): TeilnehmerTabellenKontext {
        const loesungswoerter = uebung.loesungswoerter || {};
        const staerken = uebung.loesungsStaerken || {};
        return {
            uebung,
            showLoesungswort: Object.keys(loesungswoerter).length > 0,
            showStaerke: Object.keys(staerken).length > 0,
            showStaerkeDetails,
            loesungswoerter,
            staerken,
            codeByTeilnehmer: buildCodeByTeilnehmer(uebung.teilnehmerIds),
            jetztMs: zusatz.jetztMs ?? Date.now()
        };
    }

    /** Schreibt den eben gezeigten Stand fort — Grundlage des nächsten Vergleichs. */
    private merkeStand(teilnehmerListe: string[], fortschritt: Record<string, TeilnehmerFortschritt>): void {
        teilnehmerListe.forEach(name => {
            const eintrag = fortschritt[name];
            this.letzterStand.set(name, eintrag?.erledigt ?? 0);
            if (eintrag && (eintrag.online || eintrag.erledigt > 0)) {
                const gesamt = eintrag.gesamt;
                this.letzterProzent.set(name, gesamt > 0 ? Math.round((eintrag.erledigt / gesamt) * 100) : 0);
            }
        });
    }

    /**
     * Setzt die Zielbreite im nächsten Frame. Der Balken ist mit dem alten Wert
     * im Markup entstanden; erst der Wechsel danach löst den Übergang aus.
     */
    private starteBalkenUebergang(container: HTMLElement): void {
        const balken = container.querySelectorAll<HTMLElement>(".progress-bar[data-fortschritt]");
        if (!balken.length) {
            return;
        }
        const anwenden = () => balken.forEach(el => {
            el.style.transform = `scaleX(${Number(el.dataset["fortschritt"]) / 100})`;
        });
        if (typeof globalThis.requestAnimationFrame === "function") {
            globalThis.requestAnimationFrame(anwenden);
        } else {
            anwenden();
        }
    }

    public bindEvents(callbacks: TeilnehmerCallbacks): void {
        const container = document.getElementById("uebungsleitungTeilnehmer");
        if (!container) {
            return;
        }

        container.addEventListener("click", e => {
            const target = e.target as HTMLElement;
            if (this.handleCopyLink(target)) {
                return;
            }
            this.handleAnmelden(target, callbacks.onAnmelden);
            this.handleAnmeldungZuruecknehmen(target, callbacks.onAnmeldungZuruecknehmen);
            this.handleToggleDetails(target, callbacks.onToggleDetails);
            this.handleDownloadDebrief(target, callbacks.onDownloadDebrief);
        });

        container.addEventListener("change", e => {
            this.handleTeilnehmerChange(e.target as HTMLInputElement, callbacks);
        });

        container.addEventListener("input", e => {
            const target = e.target as HTMLElement;
            if (target.tagName === "TEXTAREA" && target.classList.contains("auto-grow")) {
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
            }
            // Bereits beim Tippen übernehmen: ein Live-Update kann die Zeile neu
            // aufbauen, bevor `change` (erst beim Verlassen) je feuern würde.
            this.handleTeilnehmerChange(e.target as HTMLInputElement, callbacks);
        });
    }

    private renderTeilnehmerRow(kontext: TeilnehmerTabellenKontext, zeile: TeilnehmerZeile): string {
        const { name, status, fortschritt, istNachzuegler } = zeile;
        const zeilenKlassen = [
            "uebungsleitung-teilnehmer-zeile",
            istNachzuegler ? "table-warning" : "",
            this.hatNeueMeldung(name, fortschritt) ? "ist-gemeldet" : ""
        ].filter(Boolean).join(" ");
        // Der Balken startet auf dem zuletzt gezeigten Wert und bekommt den
        // neuen erst im nächsten Frame; so legt er die Strecke sichtbar zurück.
        const fortschrittHtml = renderFortschrittCell(fortschritt, istNachzuegler, kontext.jetztMs, this.letzterProzent.get(name));

        return `
          <tr class="${zeilenKlassen}"${istNachzuegler ? " data-nachzuegler=\"1\"" : ""}>
            <td>${renderTeilnehmerName(kontext, name)}</td>
            <td>${fortschrittHtml}</td>
            <td>${renderAnmeldeCell(name, anmeldungFuer(zeile.anmeldung, status))}</td>
            ${kontext.showLoesungswort ? renderLoesungswortCell(name, status, kontext.loesungswoerter) : ""}
            ${kontext.showStaerke ? renderStaerkeCell(kontext, name, status) : ""}
            ${renderNotizUndDebriefCells(name, status)}
          </tr>
        `;
    }

    /**
     * Wahr, sobald die Meldungszahl gegenüber der letzten Anzeige gestiegen ist.
     * Beim ersten Rendern ist nichts "neu" — sonst blitzte die ganze Tabelle
     * beim Öffnen auf und die Markierung verlöre ihren Wert.
     */
    private hatNeueMeldung(name: string, fortschritt?: TeilnehmerFortschritt): boolean {
        const vorher = this.letzterStand.get(name);
        return vorher !== undefined && (fortschritt?.erledigt ?? 0) > vorher;
    }

    private handleCopyLink(target: HTMLElement): boolean {
        const btnCopyLink = target.closest("button[data-action=\"copy-link\"]") as HTMLButtonElement | null;
        if (!btnCopyLink) {
            return false;
        }
        const link = btnCopyLink.dataset["link"] || "";
        const original = btnCopyLink.textContent || "Link kopieren";
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(link)
                .then(() => {
                    btnCopyLink.textContent = "Kopiert";
                    window.setTimeout(() => {
                        btnCopyLink.textContent = original;
                    }, 1200);
                })
                .catch(() => {
                    btnCopyLink.textContent = original;
                });
        }
        return true;
    }

    private handleAnmelden(target: HTMLElement, onAnmelden: (name: string) => void): void {
        const btn = target.closest("button[data-action=\"anmelden\"]") as HTMLElement | null;
        const teilnehmer = btn?.dataset["teilnehmer"];
        if (teilnehmer) {
            onAnmelden(teilnehmer);
        }
    }

    private handleAnmeldungZuruecknehmen(target: HTMLElement, onZuruecknehmen?: (name: string) => void): void {
        const btn = target.closest("button[data-action=\"anmeldung-zuruecknehmen\"]") as HTMLElement | null;
        const teilnehmer = btn?.dataset["teilnehmer"];
        if (teilnehmer && onZuruecknehmen) {
            onZuruecknehmen(teilnehmer);
        }
    }

    private handleToggleDetails(target: HTMLElement, onToggleDetails: () => void): void {
        const btn = target.closest("button[data-action=\"toggle-staerke-details\"]");
        if (btn) {
            onToggleDetails();
        }
    }

    private handleDownloadDebrief(target: HTMLElement, onDownloadDebrief: (name: string) => void): void {
        const btn = target.closest("button[data-action=\"download-debrief\"]") as HTMLElement | null;
        const teilnehmer = btn?.dataset["teilnehmer"];
        if (teilnehmer) {
            onDownloadDebrief(teilnehmer);
        }
    }

    private handleTeilnehmerChange(target: HTMLInputElement, callbacks: TeilnehmerCallbacks): void {
        const action = target.dataset["action"];
        const name = target.dataset["teilnehmer"];
        if (!action || !name) {
            return;
        }
        if (action === "loesungswort") {
            callbacks.onLoesungswort(name, target.value);
            return;
        }
        if (action === "staerke") {
            callbacks.onStaerke(name, Number(target.dataset["index"]), target.value);
            return;
        }
        if (action === "notiz") {
            callbacks.onNotiz(name, target.value);
        }
    }
}
