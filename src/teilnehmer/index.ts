import {loadTeilnehmerStorage, saveTeilnehmerStorage, clearTeilnehmerStorage} from "../services/storage";
import {FirebaseService} from "../services/FirebaseService";
import {store} from "../state/store";
import {router} from "../core/router";
import {TeilnehmerStorage} from "../types/Storage";
import { uiFeedback } from "../core/UiFeedback";
import { LiveStatusService } from "../services/LiveStatusService";
import { mergeTeilnehmerLiveDoc, toTeilnehmerLiveDoc } from "../services/liveStatusMerge";
import type { TeilnehmerLiveDoc } from "../types/LiveStatus";
import { TeilnehmerXZeitSteuerung } from "./xZeitSteuerung";
import type { TeilnehmerEventHandler } from "./teilnehmerEvents";
import { sanitizeCode } from "./teilnehmerFormat";


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

/** Rückfrage vor dem Zurücksetzen, mit Anzahl und echter Reichweite. */
export function resetRueckfrage(anzahl: number, live: boolean): string {
    const kopf = `Wirklich alle ${anzahl} als abgesetzt markierten Funksprüche wieder auf „offen“ setzen?`;
    return live
        ? `${kopf}\n\nDas gilt auch für die Übungsleitung und deine anderen Geräte: Dort erscheinen die Sprüche danach ebenfalls als offen. Eine eigene X-Zeit wird gelöscht. Das lässt sich nicht rückgängig machen.\n\nEinen einzelnen falsch markierten Spruch korrigierst du besser mit „Zurücknehmen“ in seiner Zeile.`
        : `${kopf}\n\nDas betrifft nur dieses Gerät. Eine eigene X-Zeit wird gelöscht. Das lässt sich nicht rückgängig machen.`;
}

/**
 * Zurückgesetzter Stand fürs Remote-Dokument: Zurücksetz-Marker mit
 * aktuellem Zeitstempel, denn ein bloß leeres Dokument würde vom
 * Last-Write-Wins-Merge nicht gewinnen.
 */
function zurueckgesetzterStand(storage: TeilnehmerStorage, now: string): TeilnehmerStorage {
    const nachrichten = Object.keys(storage.nachrichten).reduce<TeilnehmerStorage["nachrichten"]>(
        (acc, key) => {
            acc[key] = { uebertragen: false, geaendertUm: now };
            return acc;
        },
        {}
    );
    const cleared: TeilnehmerStorage = { ...storage, nachrichten, lastUpdated: now, xZeitBasisGeaendertUm: now };
    delete cleared.xZeitBasis;
    return cleared;
}

export class TeilnehmerController extends TeilnehmerXZeitSteuerung {
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

    /** Lädt Übung und Funkrufname; bei Fehlern steht danach die Fehlerseite. */
    private async ladeUebungUndTeilnehmer(uebungId: string, teilnehmerId: string): Promise<boolean> {
        try {
            this.uebung = await this.firebaseService.getUebung(uebungId);
        } catch {
            this.zeigeFehlerseite("Die Übung konnte nicht geladen werden. Prüfe die Internetverbindung und lade die Seite neu – oder gib die Codes erneut ein.");
            return false;
        }
        if (!this.uebung) {
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

        live.onStateChange(state => this.view.updateLiveSyncState(state));
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
        let result: Awaited<ReturnType<FirebaseService["resolveTeilnehmerJoinCodes"]>>;
        try {
            result = await this.firebaseService.resolveTeilnehmerJoinCodes(uebungCode, teilnehmerCode);
        } catch {
            this.view.showJoinError("Die Codes konnten gerade nicht geprüft werden. Prüfe die Internetverbindung und versuch es erneut.");
            return;
        }
        if (!result) {
            this.view.showJoinError("Kombination aus Übungscode und Teilnehmercode wurde nicht gefunden. Prüfe beide Codes (0 und O, 1 und I werden leicht verwechselt).");
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
        const anzahl = Object.values(this.storage?.nachrichten ?? {}).filter(e => e?.uebertragen).length;
        if (!uiFeedback.confirm(resetRueckfrage(anzahl, !!this.liveStatus?.enabled))) {
            return;
        }
        void this.performReset();
    }

    /**
     * Setzt lokal und – falls aktiv – auch remote zurück. Remote werden dazu
     * Zurücksetz-Marker mit aktuellem Zeitstempel geschrieben; ein bloß leeres
     * Dokument würde vom Last-Write-Wins-Merge nicht gewinnen.
     */
    private async performReset(): Promise<void> {
        if (!this.uebungId || !this.teilnehmerName) {
            return;
        }
        if (this.liveStatus?.enabled && this.storage && this.teilnehmerId) {
            const cleared = zurueckgesetzterStand(this.storage, new Date().toISOString());
            this.liveStatus.publishTeilnehmerStatus(toTeilnehmerLiveDoc(cleared, this.teilnehmerId));
            await this.liveStatus.flush();
        }
        clearTeilnehmerStorage(this.uebungId, this.teilnehmerName);
        this.revokeDocUrl();
        window.location.reload();
    }
}
