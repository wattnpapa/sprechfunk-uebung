import { Uebung } from "../types/Uebung";
import { TeilnehmerStorage } from "../types/Storage";
import { Nachricht } from "../types/Nachricht";
import type { LiveSyncState } from "../types/LiveStatus";
import { formatCountdown } from "../utils/xzeit";
import { joinFormHtml, kopfHtml } from "./kopfMarkup";
import {
    filtereNachrichten,
    naechsteFaelligkeitMs,
    nachrichtZeileHtml,
    xZeitBadgeClass,
    xZeitBadgeLabel
} from "./nachrichtenMarkup";
import { buildFokusZustand, fokusSignatur, renderFokusHtml } from "./fokusKarte";
import { setzeVordruckStatus, togglePdfModal, VordruckVorschau } from "./vordruckVorschau";
import { bindTeilnehmerEvents, type DocMode, type TeilnehmerEventHandler } from "./teilnehmerEvents";
import {
    ABGANG_MS,
    LIVE_SYNC_LABELS,
    RESET_TEXTE,
    STATUS_SPERRE_MS,
    setzeChecked,
    setzeSichtbar,
    suchtext,
    zeilenKontext,
    type NachrichtenOptionen
} from "./ansichtHelfer";
import { sanitizeCode } from "./teilnehmerFormat";
import { RueckgaengigHinweis } from "./rueckgaengigHinweis";

export { teilnehmerTitel } from "./teilnehmerFormat";
export { RUECKGAENGIG_MS, STATUS_SPERRE_MS, type NachrichtenOptionen } from "./ansichtHelfer";
export type { DocMode, TeilnehmerEventHandler } from "./teilnehmerEvents";

export class TeilnehmerView {
    /** Merker, um die Fokus-Karte nur bei Zustandswechseln neu zu rendern. */
    private lastFokusSignature = "";
    /** Zeitpunkt des letzten Statuswechsels je Nachricht (Tippsperre). */
    private letzteAenderung = new Map<number, number>();
    /**
     * Zeitpunkt des letzten Statuswechsels überhaupt. Fokus-Karte und
     * Vordruck wechseln danach auf den nächsten Spruch — ein zweiter Tipp
     * dort träfe sonst einen anderen Spruch.
     */
    private letzteKontextAenderung = 0;
    private readonly rueckgaengig = new RueckgaengigHinweis();
    private readonly vorschau = new VordruckVorschau();

    /** true, wenn für diese Nachricht gerade die Tippsperre läuft. */
    public istGesperrt(id: number, jetzt = Date.now()): boolean {
        const zuletzt = this.letzteAenderung.get(id);
        return zuletzt !== undefined && jetzt - zuletzt < STATUS_SPERRE_MS;
    }

    /** true, solange nach irgendeinem Statuswechsel die Kontextsperre läuft. */
    public istKontextGesperrt(jetzt = Date.now()): boolean {
        return jetzt - this.letzteKontextAenderung < STATUS_SPERRE_MS;
    }

    /**
     * Merkt einen Statuswechsel für die Tippsperre. `kontext` sperrt zusätzlich
     * Fokus-Karte und Vordruck, die danach auf einen anderen Spruch springen;
     * in der Liste bleibt jeder Spruch an seinem Platz, dort genügt die Sperre
     * je Nachricht.
     */
    public merkeAenderung(id: number, kontext = true, jetzt = Date.now()): void {
        this.letzteAenderung.set(id, jetzt);
        if (kontext) {
            this.letzteKontextAenderung = jetzt;
        }
    }

    /** Sperrt Fokus-Karte und Vordruck, ohne eine bestimmte Nachricht zu sperren. */
    public merkeKontextAenderung(jetzt = Date.now()): void {
        this.letzteKontextAenderung = jetzt;
    }

    public renderJoinForm(prefilledUebungCode = "", prefilledTeilnehmerCode = "", hinweis = ""): void {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }
        container.innerHTML = joinFormHtml(prefilledUebungCode, prefilledTeilnehmerCode, hinweis);
    }

    /**
     * Fehlerseite mit Ausweg: statt einer Sackgasse steht das Code-Formular
     * mit der Meldung darüber, vorbelegt mit dem, was schon bekannt ist.
     */
    public renderZugangsFehler(meldung: string, uebungCode = "", teilnehmerCode = ""): void {
        this.renderJoinForm(uebungCode, teilnehmerCode,
            "Prüfe die Codes und öffne den Zugang neu. Die Ziffer 0 und der Buchstabe O sowie 1 und I werden leicht verwechselt. Klappt es nicht, frag die Übungsleitung nach deinen Codes.");
        this.showJoinError(meldung);
    }

    public bindJoinForm(onSubmit: (uebungCode: string, teilnehmerCode: string) => void): void {
        const form = document.getElementById("teilnehmerJoinForm") as HTMLFormElement | null;
        if (!form) {
            return;
        }
        const uebungInput = document.getElementById("joinUebungCode") as HTMLInputElement | null;
        const teilnehmerInput = document.getElementById("joinTeilnehmerCode") as HTMLInputElement | null;

        for (const input of [uebungInput, teilnehmerInput]) {
            input?.addEventListener("input", () => {
                input.value = sanitizeCode(input.value);
            });
        }

        form.addEventListener("submit", event => {
            event.preventDefault();
            onSubmit(
                sanitizeCode(uebungInput?.value || ""),
                sanitizeCode(teilnehmerInput?.value || "")
            );
        });
    }

    public showJoinError(message: string): void {
        const errorEl = document.getElementById("teilnehmerJoinError");
        if (!errorEl) {
            return;
        }
        errorEl.textContent = message;
        errorEl.classList.remove("d-none");
    }

    public renderHeader(uebung: Uebung, teilnehmer: string) {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }
        // Das Vordruck-Fenster wird beim Öffnen an <body> gehängt (siehe
        // togglePdfModal). Ein Rest aus einer früheren Ansicht muss weg, sonst
        // gäbe es die IDs doppelt.
        document.querySelectorAll("body > #teilnehmerDocModal").forEach(el => el.remove());
        container.innerHTML = kopfHtml(uebung, teilnehmer);
    }

    /**
     * Aktualisiert die Sync-Anzeige im Kopfbereich.
     * Zeigt an, ob der Status gerade wirklich bei der Übungsleitung ankommt.
     */
    public updateLiveSyncState(state: LiveSyncState): void {
        const badge = document.getElementById("teilnehmerLiveSyncBadge");
        if (!badge) {
            return;
        }
        const label = LIVE_SYNC_LABELS[state];
        badge.className = `badge ${label.css}`;
        badge.textContent = label.text;
        badge.setAttribute("title", label.title);
    }

    /**
     * Beschriftet das Zurücksetzen nach seiner echten Reichweite: mit
     * Live-Verbindung wirkt es auch bei der Übungsleitung und auf anderen
     * Geräten, ohne nur auf diesem Gerät.
     */
    public setResetUmfang(live: boolean): void {
        const texte = live ? RESET_TEXTE.live : RESET_TEXTE.lokal;
        const label = document.getElementById("teilnehmerResetLabel");
        const hinweis = document.getElementById("teilnehmerResetHinweis");
        if (label) {
            label.textContent = texte.label;
        }
        if (hinweis) {
            hinweis.textContent = texte.hinweis;
        }
    }

    /**
     * Zeigt nach einem Statuswechsel einen Hinweis mit „Rückgängig“. Er
     * bleibt einige Sekunden stehen; ein Tipp innerhalb der Tippsperre wird
     * ignoriert, damit ein Doppeltipp ihn nicht gleich auslöst.
     */
    public zeigeRueckgaengig(text: string, onUndo: () => void): void {
        this.rueckgaengig.zeige(text, onUndo);
    }

    public versteckeRueckgaengig(): void {
        this.rueckgaengig.verstecke();
    }

    public renderNachrichten(nachrichten: Nachricht[], storage: TeilnehmerStorage, optionen: NachrichtenOptionen = {}) {
        const tbody = document.getElementById("teilnehmerNachrichtenBody");
        if (!tbody) {
            return;
        }
        this.syncAusblendSchalter(nachrichten, storage);

        const ctx = zeilenKontext(nachrichten, storage, optionen);
        const showXZeit = ctx.showXZeit;
        const rows = filtereNachrichten(nachrichten, ctx, suchtext()).map(n => nachrichtZeileHtml(n, ctx)).join("");

        const colspan = showXZeit ? "6" : "5";
        const leerZeile = `<tr><td colspan="${colspan}" class="text-center text-muted">Keine Nachrichten vorhanden.</td></tr>`;
        tbody.innerHTML = rows || leerZeile;

        this.raeumeAbgangsZeile(tbody, leerZeile);
        this.renderFokusBereich(nachrichten, storage, showXZeit, optionen.xZeitBasis);
    }

    /** Hält beide „Abgesetzte ausblenden“-Schalter und den Zähler synchron zum Speicher. */
    private syncAusblendSchalter(nachrichten: Nachricht[], storage: TeilnehmerStorage): void {
        setzeChecked("toggle-hide-transmitted", storage.hideTransmitted);
        setzeChecked("toggle-hide-transmitted-modal", storage.hideTransmitted);

        const ausgeblendetHinweis = document.getElementById("teilnehmerAusgeblendet");
        if (ausgeblendetHinweis) {
            const anzahl = storage.hideTransmitted
                ? nachrichten.filter(n => storage.nachrichten[n.id]?.uebertragen).length
                : 0;
            ausgeblendetHinweis.textContent = anzahl > 0 ? `(${anzahl} ausgeblendet)` : "";
        }
    }

    /**
     * Entfernt die abgehende Zeile, nachdem der Absetzstrich durch war. Der
     * Timer ist die Quelle der Wahrheit, nicht das animationend-Ereignis: bei
     * prefers-reduced-motion läuft keine Animation, die Zeile muss trotzdem
     * verschwinden.
     */
    private raeumeAbgangsZeile(tbody: HTMLElement, leerZeile: string): void {
        const zeile = tbody.querySelector<HTMLElement>("tr[data-abgang]");
        if (!zeile) {
            return;
        }
        globalThis.setTimeout(() => {
            if (!zeile.isConnected) {
                return;
            }
            const eigenesTbody = zeile.parentElement;
            zeile.remove();
            if (eigenesTbody && eigenesTbody.children.length === 0) {
                eigenesTbody.innerHTML = leerZeile;
            }
        }, ABGANG_MS);
    }

    /**
     * Fokus-Modus: blendet die Tabelle aus und zeigt nur die aktuell fällige
     * Meldung bzw. den Countdown bis zur nächsten. Künftige Meldungstexte
     * bleiben so bis zur Fälligkeit verborgen.
     */
    private renderFokusBereich(
        nachrichten: Nachricht[],
        storage: TeilnehmerStorage,
        showXZeit: boolean,
        xZeitBasis: string | undefined
    ): void {
        const card = document.getElementById("teilnehmerFokusCard");
        if (!card) {
            return;
        }
        const aktiv = showXZeit && !!storage.fokusModus;
        setzeChecked("toggle-fokus-modus", !!storage.fokusModus);

        card.classList.toggle("d-none", !aktiv);
        setzeSichtbar("teilnehmerTableView", !aktiv);
        setzeSichtbar("teilnehmerSearchInput", !aktiv);

        this.lastFokusSignature = "";
        if (aktiv) {
            this.updateFokusCard(nachrichten, storage, xZeitBasis);
        }
    }

    /** Aktualisiert die Fokus-Karte; rendert nur bei Zustandswechsel neu. */
    public updateFokusCard(
        nachrichten: Nachricht[],
        storage: TeilnehmerStorage,
        xZeitBasis: string | undefined
    ): void {
        const card = document.getElementById("teilnehmerFokusCard");
        if (!card || card.classList.contains("d-none")) {
            return;
        }
        const zustand = buildFokusZustand(nachrichten, storage, xZeitBasis);
        const signature = fokusSignatur(zustand);
        if (signature !== this.lastFokusSignature) {
            card.innerHTML = renderFokusHtml(zustand);
            this.lastFokusSignature = signature;
        }
        if (zustand.kind === "warten") {
            const countdown = document.getElementById("fokusCountdown");
            if (countdown) {
                countdown.textContent = formatCountdown(zustand.countdownMs);
            }
        }
    }

    public bindFokusEvents(
        onToggleFokus: (checked: boolean) => void,
        onUebertragen: (id: number) => void,
        onZuruecknehmen: (id: number) => void = () => undefined
    ): void {
        document.getElementById("toggle-fokus-modus")?.addEventListener("change", e => {
            onToggleFokus((e.target as HTMLInputElement).checked);
        });
        document.getElementById("teilnehmerFokusCard")?.addEventListener("click", e => {
            const ziel = e.target as HTMLElement;
            const btn = ziel.closest("[data-fokus-uebertragen]") as HTMLElement | null;
            const zurueck = ziel.closest("[data-fokus-zuruecknehmen]") as HTMLElement | null;
            if (!btn && !zurueck) {
                return;
            }
            // Nach dem Abhaken rückt die nächste fällige Meldung an dieselbe
            // Stelle: ein zweiter Tipp würde sonst sie gleich mit abhaken.
            if (this.istKontextGesperrt()) {
                return;
            }
            const id = Number(btn ? btn.dataset["fokusUebertragen"] : zurueck?.dataset["fokusZuruecknehmen"]);
            if (!Number.isFinite(id)) {
                return;
            }
            this.merkeAenderung(id);
            if (btn) {
                onUebertragen(id);
            } else {
                onZuruecknehmen(id);
            }
        });
    }

    public bindEvents(handler: TeilnehmerEventHandler) {
        if (!document.getElementById("teilnehmerContent")) {
            return;
        }
        bindTeilnehmerEvents(handler, {
            istGesperrt: id => this.istGesperrt(id),
            istKontextGesperrt: () => this.istKontextGesperrt(),
            merkeAenderung: (id, kontext) => this.merkeAenderung(id, kontext),
            merkeKontextAenderung: () => this.merkeKontextAenderung()
        });
        this.rueckgaengig.bind();
    }

    public setDocMode(mode: DocMode) {
        document.querySelectorAll<HTMLButtonElement>("[data-doc-view]").forEach(btn => {
            btn.classList.toggle("active", btn.dataset["docView"] === mode);
        });

        const showPdf = mode !== "table";
        document.getElementById("teilnehmerTableView")?.classList.toggle("d-none", showPdf);
        togglePdfModal(showPdf);
    }

    public async renderPdfPage(blob: Blob, page: number, totalPages: number) {
        await this.vorschau.renderPdfPage(blob, page, totalPages);
    }

    /**
     * Zustand des angezeigten Vordrucks: Statusanzeige und Touch-Knopf. Der
     * Knopf wechselt zwischen „Als abgesetzt markieren“ und „Zurücknehmen“;
     * ein Doppeltipp ist durch die Kontextsperre in bindEvents abgefangen.
     */
    public setDocTransmitted(isTransmitted: boolean, vorhanden = true) {
        setzeVordruckStatus(isTransmitted, vorhanden);
    }

    public setXZeitBasisInputValue(value: string): void {
        const input = document.getElementById("xZeitBasisInput") as HTMLInputElement | null;
        if (input) {
            input.value = value;
        }
    }

    public bindXZeitEvents(
        onBasisChange: (value: string) => void,
        onJetzt: () => void
    ): void {
        document.getElementById("xZeitBasisInput")?.addEventListener("change", e => {
            onBasisChange((e.target as HTMLInputElement).value);
        });
        document.getElementById("btn-xzeit-jetzt")?.addEventListener("click", onJetzt);
    }

    public updateXZeitCountdown(nachrichten: Nachricht[], storage: TeilnehmerStorage, xZeitBasis: string): void {
        const countdown = document.getElementById("xZeitCountdown");
        if (countdown) {
            const next = naechsteFaelligkeitMs(nachrichten, storage, xZeitBasis);
            countdown.textContent = next !== null
                ? `Nächste in ${formatCountdown(next)}`
                : "Keine ausstehenden Nachrichten";
        }

        this.updateFokusCard(nachrichten, storage, xZeitBasis);

        document.querySelectorAll<HTMLElement>("[data-xzeit-slot]").forEach(el => {
            const slot = Number(el.dataset["xzeitSlot"]);
            const nId = Number(el.dataset["nId"]);
            const transmitted = !!storage.nachrichten[nId]?.uebertragen;
            el.className = xZeitBadgeClass(slot, xZeitBasis, transmitted);
            el.textContent = xZeitBadgeLabel(slot, xZeitBasis, transmitted);
        });
    }
}
