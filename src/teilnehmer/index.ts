import {loadTeilnehmerStorage, saveTeilnehmerStorage, clearTeilnehmerStorage} from "../services/storage";
import {FirebaseService} from "../services/FirebaseService";
import {store} from "../state/store";
import {router} from "../core/router";
import { uiFeedback } from "../core/UiFeedback";
import { LiveStatusService } from "../services/LiveStatusService";
import { mergeTeilnehmerLiveDoc } from "../services/liveStatusMerge";
import type { TeilnehmerLiveDoc } from "../types/LiveStatus";
import { TeilnehmerXZeitSteuerung } from "./xZeitSteuerung";
import type { TeilnehmerEventHandler } from "./teilnehmerEvents";
import { sanitizeCode } from "./teilnehmerFormat";
import { ZustellVerfolgung, zustellSchluessel } from "./zustellung";
import { resetErlaubt, resetRueckfrage, veroeffentlicheReset } from "./zuruecksetzen";

export { resetRueckfrage } from "./zuruecksetzen";

/** So oft gleicht die Ansicht ab, ob Markierungen beim Server angekommen sind. */
const ZUSTELL_PRUEF_MS = 1000;

function istOffline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine === false;
}


/** Übungs- und Teilnehmercode aus `?uc=…&tc=…` hinter dem Hash. */
export function codesAusHash(hash: string): { uebungCode: string; teilnehmerCode: string } {
    const query = hash.includes("?") ? hash.split("?")[1] ?? "" : "";
    const params = new URLSearchParams(query);
    return {
        uebungCode: sanitizeCode(params.get("uc") || ""),
        teilnehmerCode: sanitizeCode(params.get("tc") || "")
    };
}

/** Fehlermeldung für unbrauchbare Codes, null wenn das Format stimmt. */
export function pruefeCodeFormat(uebungCode: string, teilnehmerCode: string): string | null {
    if (!uebungCode || !teilnehmerCode) {
        return "Bitte beide Codes eingeben.";
    }
    if (uebungCode.length !== 6 || teilnehmerCode.length !== 4) {
        return "Codeformat ungültig. Übungscode: 6 Zeichen, Teilnehmercode: 4 Zeichen.";
    }
    return null;
}

/**
 * Meldung für „nicht gefunden“. Enthält die Eingabe O, 0, I oder 1, wird
 * das Zeichen benannt: in neuen Codes kommt es nicht vor (field-user P3,
 * 2026-10-05). Abgelehnt wird es nicht – ältere Codes dürfen es enthalten.
 */
export function nichtGefundenMeldung(uebungCode: string, teilnehmerCode: string): string {
    const kopf = "Kombination aus Übungscode und Teilnehmercode wurde nicht gefunden.";
    const fremd = Array.from(new Set(`${uebungCode}${teilnehmerCode}`.match(/[O0I1]/g) ?? []));
    if (fremd.length === 0) {
        return `${kopf} Prüfe beide Codes – schau bei Q, D, G, J und 6 genau hin.`;
    }
    const zeichen = fremd.map(z => `„${z}“`).join(", ");
    return `${kopf} Deine Eingabe enthält ${zeichen}. Diese Zeichen kommen in Codes nicht vor – meist ist Q oder D (statt O/0) bzw. J oder L (statt I/1) gemeint.`;
}

export class TeilnehmerController extends TeilnehmerXZeitSteuerung {
    private zustellTimer: ReturnType<typeof setInterval> | null = null;
    private letzterSyncZustand: string | null = null;

    public async init() {
        const {params} = router.parseHash();
        this.uebungId = params[0] ?? null;
        this.teilnehmerId = params[1] ?? null;

        if (!document.getElementById("teilnehmerContent")) {
            return;
        }
        if (!this.uebungId || !this.teilnehmerId) {
            await this.zeigeZugang();
            return;
        }
        if (!(await this.ladeUebungUndTeilnehmer(this.uebungId, this.teilnehmerId))) {
            return;
        }
        this.starteAnsicht();
    }

    /** Ohne vollständigen Link: Code-Formular, vorbelegt aus dem Hash. */
    private async zeigeZugang(): Promise<void> {
        const prefilledCodes = codesAusHash(window.location.hash || "");
        this.view.renderJoinForm(prefilledCodes.uebungCode, prefilledCodes.teilnehmerCode);
        this.bindJoinFormAfterError();
        // Kommt ein unvollständiger Code an (Schnellzugang mit 5 Zeichen),
        // gleich sagen, was fehlt (error-recovery P3-3, 2026-10-05).
        const formatFehler = pruefeCodeFormat(prefilledCodes.uebungCode, prefilledCodes.teilnehmerCode);
        if ((prefilledCodes.uebungCode || prefilledCodes.teilnehmerCode) && formatFehler) {
            this.view.showJoinError(formatFehler);
        }
        // Geteilter Link mit beiden Codes: direkt öffnen statt noch einmal
        // „Zugang öffnen“ tippen zu lassen. Ersetzt den Verlaufseintrag,
        // sonst führte „Zurück“ wieder auf den Link und gleich wieder vor.
        if (this.sindVollstaendigeCodes(prefilledCodes.uebungCode, prefilledCodes.teilnehmerCode)) {
            await this.resolveJoinAndNavigate(prefilledCodes.uebungCode, prefilledCodes.teilnehmerCode, true);
        }
    }

    private zeigeFehlerseite(meldung: string, uebungCode?: string): void {
        if (uebungCode === undefined) {
            this.view.renderZugangsFehler(meldung);
        } else {
            this.view.renderZugangsFehler(meldung, uebungCode);
        }
        this.bindJoinFormAfterError();
    }

    /**
     * Ohne Verbindung liegt es nicht an den Codes: eigener Hinweis ohne
     * Code-Formular, mit „Erneut versuchen“ (offline-resilience P1-2).
     */
    private zeigeVerbindungsFehler(): void {
        this.view.renderVerbindungsFehler(() => {
            void this.init();
        });
    }

    /** Lädt Übung und Funkrufname; bei Fehlern steht danach die Fehlerseite. */
    private async ladeUebungUndTeilnehmer(uebungId: string, teilnehmerId: string): Promise<boolean> {
        try {
            this.uebung = await this.firebaseService.getUebung(uebungId);
        } catch {
            this.zeigeVerbindungsFehler();
            return false;
        }
        if (!this.uebung) {
            // Offline liefert Firestore aus dem leeren Cache „gibt es nicht“.
            if (istOffline()) {
                this.zeigeVerbindungsFehler();
                return false;
            }
            this.zeigeFehlerseite("Übung nicht gefunden. Vielleicht ist der Link unvollständig oder die Übung wurde gelöscht.");
            return false;
        }

        store.setState({aktuelleUebung: this.uebung, aktuelleUebungId: uebungId});

        this.teilnehmerName = this.uebung.teilnehmerIds ? (this.uebung.teilnehmerIds[teilnehmerId] ?? null) : null;
        if (!this.teilnehmerName) {
            this.zeigeFehlerseite(
                "Teilnehmer nicht in dieser Übung gefunden. Der Teilnehmercode im Link passt nicht zu dieser Übung.",
                this.uebung.uebungCode ?? ""
            );
            return false;
        }
        return true;
    }

    /** Erstes Rendern, Live-Sync und alle Bedienelemente. */
    private starteAnsicht(): void {
        if (!this.uebungId || !this.uebung || !this.teilnehmerName) {
            return;
        }
        this.storage = loadTeilnehmerStorage(this.uebungId, this.teilnehmerName);
        this.updateFooterInfo();
        this.waehleFokusStandard();

        // Initial Render
        this.view.renderHeader(this.uebung, this.teilnehmerName);
        this.renderNachrichten();
        this.view.setDocMode(this.docMode);

        this.startLiveSync();
        this.view.setResetUmfang(!!this.liveStatus?.enabled);

        // X-Zeit Ticker + Events
        if (this.uebung.spielModus === "xZeit") {
            this.bindeXZeit();
        }
        this.view.bindEvents(this.eventHandler());
        // Nach einer Unterbrechung steht der nächste offene Spruch im Bild.
        this.view.scrolleZumNaechsten();
    }

    private eventHandler(): TeilnehmerEventHandler {
        return {
            onToggleUebertragen: (id, checked) => this.toggleUebertragen(id, checked),
            onToggleHide: checked => this.toggleHide(checked),
            onReset: () => this.resetData(),
            onDocViewChange: mode => this.setDocMode(mode),
            onDocPrev: () => this.changeDocPage(-1),
            onDocNext: () => this.changeDocPage(1),
            onDocClose: () => this.setDocMode("table"),
            onDocToggleCurrent: () => this.toggleCurrentDocMessage(),
            onDownloadZip: () => this.downloadTeilnehmerZip(),
            onSearch: () => this.debouncedRenderNachrichten()
        };
    }

    /**
     * Startet den Live-Sync: eigener Status wird veröffentlicht, die Bestätigungen
     * der Übungsleitung werden abonniert. Der lokale Cache bleibt führend für die
     * Anzeige, damit die Übung auch ohne Netz weiterläuft.
     */
    private startLiveSync(): void {
        if (!this.uebungId || !this.teilnehmerId || !this.storage) {
            return;
        }

        const live = new LiveStatusService(this.db, this.uebungId);
        this.liveStatus = live;
        if (!live.enabled) {
            this.view.updateLiveSyncState("aus");
            return;
        }

        if (this.teilnehmerName) {
            this.zustellung = new ZustellVerfolgung(zustellSchluessel(this.uebungId, this.teilnehmerName));
        }
        live.onStateChange(() => this.gleicheZustellungAb());
        this.zustellTimer = setInterval(() => this.gleicheZustellungAb(), ZUSTELL_PRUEF_MS);
        live.subscribeEigenenStatus(this.teilnehmerId, remote => this.uebernehmeEigenenRemoteStand(remote));
        live.subscribeLeitungPublic(remote => {
            this.leitungBestaetigungen = remote?.nachrichten ?? {};
            this.uebernehmeXZeitDerLeitung(remote);
            this.renderNachrichten();
        });

        this.publishStatus();

        const onHashChange = () => this.dispose();
        window.addEventListener("hashchange", onHashChange, { once: true });
        this.disposeListener = () => window.removeEventListener("hashchange", onHashChange);
    }

    /**
     * Verbindungsanzeige mit Zahl offener Sprüche und Uhrzeit der letzten
     * Bestätigung; kommt etwas an, verlieren die Karten ihr „nur auf diesem
     * Gerät“. Ein Zustandswechsel ändert auch den Text der Karten.
     */
    private gleicheZustellungAb(): void {
        const live = this.liveStatus;
        if (!live?.enabled) {
            return;
        }
        const state = live.getState();
        const kartenGeaendert = this.zustellung?.pruefe(state, live.getOffeneAenderungen()) ?? false;
        this.view.updateLiveSyncState(state, this.zustellung?.info() ?? { offen: 0, bestaetigtUm: "" });
        const ersterAufruf = this.letzterSyncZustand === null;
        const zustandNeu = state !== this.letzterSyncZustand;
        this.letzterSyncZustand = state;
        if (!ersterAufruf && (kartenGeaendert || zustandNeu)) {
            this.renderNachrichten();
        }
    }

    /** Stand anderer Geräte desselben Teilnehmers einmischen. */
    private uebernehmeEigenenRemoteStand(remote: TeilnehmerLiveDoc | null): void {
        if (!remote || !this.storage) {
            return;
        }
        const { merged, changed } = mergeTeilnehmerLiveDoc(this.storage, remote);
        if (!changed) {
            return;
        }
        this.storage = merged;
        saveTeilnehmerStorage(this.storage);
        if (this.storage.xZeitBasis) {
            this.view.setXZeitBasisInputValue(this.storage.xZeitBasis);
        }
        this.renderNachrichten();
        this.invalidateDocCache();
    }

    public dispose(): void {
        this.stopXZeitTicker();
        if (this.zustellTimer !== null) {
            clearInterval(this.zustellTimer);
            this.zustellTimer = null;
        }
        void this.liveStatus?.flush();
        this.liveStatus?.dispose();
        this.liveStatus = null;
        this.disposeListener?.();
        this.disposeListener = null;
    }

    private sindVollstaendigeCodes(uebungCode: string, teilnehmerCode: string): boolean {
        return uebungCode.length === 6 && teilnehmerCode.length === 4;
    }

    /** Nach einer Fehlerseite führt das Formular direkt weiter. */
    private bindJoinFormAfterError(): void {
        this.view.bindJoinForm((uebungCode, teilnehmerCode) => {
            void this.resolveJoinAndNavigate(uebungCode, teilnehmerCode);
        });
    }

    private async resolveJoinAndNavigate(uebungCode: string, teilnehmerCode: string, ersetzen = false): Promise<void> {
        const formatFehler = pruefeCodeFormat(uebungCode, teilnehmerCode);
        if (formatFehler) {
            this.view.showJoinError(formatFehler);
            return;
        }
        const keineVerbindung = "Die Codes konnten gerade nicht geprüft werden – es fehlt die Internetverbindung. Versuch es erneut, sobald wieder Netz da ist.";
        let result: Awaited<ReturnType<FirebaseService["resolveTeilnehmerJoinCodes"]>>;
        try {
            result = await this.firebaseService.resolveTeilnehmerJoinCodes(uebungCode, teilnehmerCode);
        } catch {
            this.view.showJoinError(keineVerbindung);
            return;
        }
        if (!result) {
            // Offline kommt aus dem leeren Cache „nichts gefunden“ (offline P3-1).
            this.view.showJoinError(istOffline() ? keineVerbindung : nichtGefundenMeldung(uebungCode, teilnehmerCode));
            return;
        }
        const ziel = `#/teilnehmer/${result.uebungId}/${result.teilnehmerId}`;
        if (ersetzen && typeof window.location.replace === "function") {
            window.location.replace(ziel);
            return;
        }
        window.location.hash = ziel;
    }

    private updateFooterInfo() {
        if (!this.uebung) {
            return;
        }
        const idEl = document.getElementById("uebungsId");
        if (idEl) {
            idEl.textContent = this.uebung.id || "-";
        }
    }

    private resetData() {
        if (!this.uebungId || !this.teilnehmerName) {
            return;
        }
        if (!resetErlaubt(this.liveStatus)) {
            return;
        }
        const anzahl = Object.values(this.storage?.nachrichten ?? {}).filter(e => e?.uebertragen).length;
        if (!uiFeedback.confirm(resetRueckfrage(anzahl, !!this.liveStatus?.enabled))) {
            return;
        }
        void this.performReset();
    }

    /**
     * Setzt lokal und – falls aktiv – auch remote zurück. Ohne Bestätigung
     * des Servers wird lokal nichts gelöscht und nicht neu geladen.
     */
    private async performReset(): Promise<void> {
        if (!this.uebungId || !this.teilnehmerName) {
            return;
        }
        if (!(await veroeffentlicheReset(this.liveStatus, this.storage, this.teilnehmerId))) {
            return;
        }
        clearTeilnehmerStorage(this.uebungId, this.teilnehmerName);
        this.zustellung?.leeren();
        this.revokeDocUrl();
        window.location.reload();
    }
}
