import { Uebung } from "../types/Uebung";
import { TeilnehmerStorage } from "../types/Storage";
import { Nachricht } from "../types/Nachricht";
import type { LiveSyncState } from "../types/LiveStatus";
import { formatCountdown } from "../utils/xzeit";
import { CODE_ZEICHEN_HINWEIS, joinFormHtml, kopfHtml } from "./kopfMarkup";
import { xZeitBadgeClass, xZeitBadgeLabel } from "./nachrichtenMarkup";
import { buildFokusZustand, fokusSignatur, renderFokusHtml } from "./fokusKarte";
import { setzeVordruckStatus, togglePdfModal, VordruckVorschau } from "./vordruckVorschau";
import { bindTeilnehmerEvents, type DocMode, type StatusAktion, type TeilnehmerEventHandler } from "./teilnehmerEvents";
import {
    GEGENAKTION_SPERRE_MS,
    KONTEXT_SPERRE_MS,
    RESET_TEXTE,
    STATUS_SPERRE_MS,
    setzeChecked,
    setzeSichtbar,
    syncAnzeige,
    type NachrichtenOptionen,
    type ZustellInfo
} from "./ansichtHelfer";
import { formatUhrzeit, sanitizeCode } from "./teilnehmerFormat";
import { RueckgaengigHinweis } from "./rueckgaengigHinweis";
import { TeilnehmerListe } from "./listenAnsicht";
import { bindeCodeSprung, rueckstandText, syncLeistenText } from "./ansichtTexte";

export { teilnehmerTitel } from "./teilnehmerFormat";
export { RUECKGAENGIG_MS, STATUS_SPERRE_MS, type NachrichtenOptionen } from "./ansichtHelfer";
export type { DocMode, TeilnehmerEventHandler } from "./teilnehmerEvents";

/**
 * Ziel fürs Scrollen nach dem Laden: die Fokus-Karte, sonst der nächste
 * offene Spruch – außer er ist ohnehin der erste der Liste.
 */
function scrollZiel(): HTMLElement | null {
    const fokus = document.getElementById("teilnehmerFokusCard");
    if (fokus && !fokus.classList.contains("d-none")) {
        return fokus.querySelector("[data-fokus-uebertragen]") ? fokus : null;
    }
    const zeile = document.querySelector<HTMLElement>("#teilnehmerNachrichtenBody tr.ist-naechster");
    if (!zeile || zeile === zeile.parentElement?.firstElementChild) {
        return null;
    }
    return zeile;
}

export class TeilnehmerView {
    /** Merker, um die Fokus-Karte nur bei Zustandswechseln neu zu rendern. */
    private lastFokusSignature = "";
    /** Zeitpunkt des letzten Statuswechsels je Nachricht (Tippsperre). */
    private letzteAenderung = new Map<number, number>();
    private readonly liste = new TeilnehmerListe();
    private fokusSperrTimer: ReturnType<typeof setTimeout> | null = null;
    /**
     * Zeitpunkt des letzten Statuswechsels überhaupt. Fokus-Karte und
     * Vordruck wechseln danach auf den nächsten Spruch — ein zweiter Tipp
     * dort träfe sonst einen anderen Spruch.
     */
    private letzteKontextAenderung = 0;
    private readonly rueckgaengig = new RueckgaengigHinweis();
    private readonly vorschau = new VordruckVorschau();

    /**
     * true, wenn für diese Nachricht gerade die Tippsperre läuft. Die
     * Gegenaktion „Zurücknehmen“ ist länger gesperrt als ein erneutes
     * Absetzen: ein träger zweiter Tipp soll nie zurücknehmen.
     */
    public istGesperrt(id: number, jetzt = Date.now(), aktion: StatusAktion = "absetzen"): boolean {
        const zuletzt = this.letzteAenderung.get(id);
        const dauer = aktion === "zuruecknehmen" ? GEGENAKTION_SPERRE_MS : STATUS_SPERRE_MS;
        return zuletzt !== undefined && jetzt - zuletzt < dauer;
    }

    /** true, solange nach irgendeinem Statuswechsel die Kontextsperre läuft. */
    public istKontextGesperrt(jetzt = Date.now()): boolean {
        return jetzt - this.letzteKontextAenderung < KONTEXT_SPERRE_MS;
    }

    /** true, solange die Liste nach dem Abgang einer Zeile gesperrt ist. */
    public istListeGesperrt(jetzt = Date.now()): boolean {
        return this.liste.istGesperrt(jetzt);
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
            `Prüfe die Codes und öffne den Zugang neu. ${CODE_ZEICHEN_HINWEIS} Klappt es nicht, frag die Übungsleitung nach deinen Codes.`);
        this.showJoinError(meldung);
    }

    /**
     * Die Übung ließ sich nicht laden, weil die Verbindung fehlt. Dann liegt
     * es nicht an den Codes – kein Code-Formular, sondern ein Hinweis auf die
     * gespeicherten Markierungen und die Papierunterlagen (offline P1-2,
     * 2026-10-05). Die Codes lassen sich trotzdem neu eingeben.
     */
    public renderVerbindungsFehler(onErneut: () => void): void {
        const container = document.getElementById("teilnehmerContent");
        if (!container) {
            return;
        }
        container.innerHTML = `
            <div class="card mb-4 teilnehmer-verbindungsfehler" data-testid="teilnehmer-verbindungsfehler">
                <div class="card-body">
                    <h3 class="h5">Keine Verbindung – die Übung kann gerade nicht geladen werden</h3>
                    <p>Deine Codes sind in Ordnung. Es fehlt die Internetverbindung.</p>
                    <p>Deine Markierungen sind auf diesem Gerät gespeichert. Arbeite mit den ausgedruckten Vordrucken weiter, bis wieder Netz da ist.</p>
                    <button type="button" class="btn btn-primary btn-lg teilnehmer-zugang-knopf" id="btn-teilnehmer-erneut">Erneut versuchen</button>
                </div>
            </div>`;
        document.getElementById("btn-teilnehmer-erneut")?.addEventListener("click", onErneut);
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
        bindeCodeSprung(uebungInput, teilnehmerInput);

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
    public updateLiveSyncState(state: LiveSyncState, info: ZustellInfo = { offen: 0, bestaetigtUm: "" }): void {
        const badge = document.getElementById("teilnehmerLiveSyncBadge");
        if (badge) {
            const label = syncAnzeige(state, info);
            badge.className = `badge ${label.css}`;
            badge.textContent = label.text;
            badge.setAttribute("title", label.title);
        }
        const leiste = document.getElementById("teilnehmerSyncLeiste");
        if (leiste) {
            const text = syncLeistenText(state, info);
            leiste.hidden = !text;
            leiste.textContent = text;
        }
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
        if (!document.getElementById("teilnehmerNachrichtenBody")) {
            return;
        }
        this.liste.render(nachrichten, storage, optionen);
        this.renderFokusBereich(nachrichten, storage, optionen.showXZeit ?? false, optionen.xZeitBasis);
    }

    /** Abgesetzte, die trotz „ausblenden“ gerade noch stehen. */
    public gehalteneIds(): number[] {
        return this.liste.gehalteneIds();
    }

    /**
     * Nach dem Laden zum nächsten offenen Spruch scrollen, wenn er unter der
     * Falz liegt (field-user P2, 2026-10-05). Der erste Spruch braucht das nicht.
     */
    public scrolleZumNaechsten(): void {
        const ziel = scrollZiel();
        if (!ziel || typeof ziel.scrollIntoView !== "function") {
            return;
        }
        const hoehe = window.innerHeight || 0;
        if (hoehe > 0 && ziel.getBoundingClientRect().bottom <= hoehe) {
            return;
        }
        ziel.scrollIntoView({ block: "center" });
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
        this.zeigeFokusSperre(card);
        if (zustand.kind === "warten") {
            const countdown = document.getElementById("fokusCountdown");
            if (countdown) {
                countdown.textContent = formatCountdown(zustand.countdownMs);
            }
        }
    }

    /**
     * Während der Kontextsperre ist der Knopf der Fokus-Karte sichtbar
     * gesperrt: ein Tipp darauf bewirkt nichts, und das soll man sehen.
     */
    private zeigeFokusSperre(card: HTMLElement): void {
        const rest = KONTEXT_SPERRE_MS - (Date.now() - this.letzteKontextAenderung);
        card.classList.toggle("ist-gesperrt", rest > 0);
        if (rest > 0 && this.fokusSperrTimer === null) {
            this.fokusSperrTimer = globalThis.setTimeout(() => {
                this.fokusSperrTimer = null;
                card.classList.remove("ist-gesperrt");
            }, rest);
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
            this.zeigeFokusSperre(e.currentTarget as HTMLElement);
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
            istGesperrt: (id, aktion) => this.istGesperrt(id, Date.now(), aktion),
            istListeGesperrt: () => this.istListeGesperrt(),
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
    public setDocTransmitted(isTransmitted: boolean, vorhanden = true, uebertragenUm?: string) {
        setzeVordruckStatus(isTransmitted, vorhanden, formatUhrzeit(uebertragenUm));
    }

    public setXZeitBasisInputValue(value: string): void {
        const input = document.getElementById("xZeitBasisInput") as HTMLInputElement | null;
        if (input) {
            input.value = value;
        }
        // Läuft die X-Zeit schon, ist „Jetzt starten“ ein Neustart.
        const jetzt = document.getElementById("btn-xzeit-jetzt");
        if (jetzt) {
            jetzt.textContent = value ? "Neu starten" : "Jetzt starten";
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
            const text = rueckstandText(nachrichten, storage, xZeitBasis);
            countdown.textContent = text.text;
            countdown.classList.toggle("ist-rueckstand", text.rueckstand);
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
