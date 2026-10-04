import type {Firestore} from "firebase/firestore";
import {loadTeilnehmerStorage, saveTeilnehmerStorage, clearTeilnehmerStorage} from "../services/storage";
import {TeilnehmerView} from "./TeilnehmerView";
import {FirebaseService} from "../services/FirebaseService";
import {store} from "../state/store";
import {router} from "../core/router";
import {Uebung} from "../types/Uebung";
import {TeilnehmerStorage} from "../types/Storage";
import { ladePdfGenerator } from "../services/pdfGeneratorLazy";
import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";
import { uiFeedback } from "../core/UiFeedback";
import { debounce } from "../utils/debounce";
import { LiveStatusService } from "../services/LiveStatusService";
import { mergeTeilnehmerLiveDoc, toTeilnehmerLiveDoc, uebernehmeLeitungsBasis } from "../services/liveStatusMerge";
import type { LeitungBestaetigung, LeitungPublicLiveDoc } from "../types/LiveStatus";

type DocMode = "table" | "meldevordruck" | "nachrichtenvordruck";

export class TeilnehmerController {
    private view: TeilnehmerView;
    private firebaseService: FirebaseService;
    private uebungId: string | null = null;
    private teilnehmerId: string | null = null;
    private uebung: Uebung | null = null;
    private teilnehmerName: string | null = null;
    private storage: TeilnehmerStorage | null = null;
    private docMode: DocMode = "table";
    private docPage = 1;
    private currentDocUrl: string | null = null;
    private docRenderToken = 0;
    private docPageByMode: Record<DocMode, number> = {
        table: 1,
        meldevordruck: 1,
        nachrichtenvordruck: 1
    };
    private docBlobInFlight = new Map<DocMode, Set<number>>();
    private docBlobCache = new Map<DocMode, Map<number, Blob>>();
    private preloadToken = 0;
    private debouncedRenderNachrichten = debounce(() => this.renderNachrichten(), 140);

    /**
     * Nachricht, die gerade abgesetzt wurde. Die Ansicht zeichnet dafür den
     * Absetzstrich; der Merker wird beim nächsten Rendern verbraucht.
     */
    private zuletztAbgesetzt: number | null = null;
    private xZeitInterval: ReturnType<typeof setInterval> | null = null;
    private db: Firestore;
    private liveStatus: LiveStatusService | null = null;
    /** Bestätigungen der Übungsleitung, Key = `${funkrufname}__${nachrichtenNr}`. */
    private leitungBestaetigungen: Record<string, LeitungBestaetigung> = {};
    /** Verbindliche X-Zeit-Basis der Übungsleitung, sobald sie eine gesetzt hat. */
    private leitungXZeitBasis: string | null = null;
    private disposeListener: (() => void) | null = null;

    constructor(db: Firestore) {
        this.view = new TeilnehmerView();
        this.firebaseService = new FirebaseService(db);
        this.db = db;
    }

    public async init() {
        const {params} = router.parseHash();
        this.uebungId = params[0] ?? null;
        this.teilnehmerId = params[1] ?? null;
        const prefilledCodes = this.getPrefilledJoinCodesFromHash();

        const contentEl = document.getElementById("teilnehmerContent");
        if (!contentEl) {
            return;
        }

        if (!this.uebungId || !this.teilnehmerId) {
            this.view.renderJoinForm(prefilledCodes.uebungCode, prefilledCodes.teilnehmerCode);
            this.view.bindJoinForm((uebungCode, teilnehmerCode) => {
                void this.resolveJoinAndNavigate(uebungCode, teilnehmerCode);
            });
            // Geteilter Link mit beiden Codes: direkt öffnen statt noch einmal
            // „Zugang öffnen“ tippen zu lassen. Ersetzt den Verlaufseintrag,
            // sonst führte „Zurück“ wieder auf den Link und gleich wieder vor.
            if (this.sindVollstaendigeCodes(prefilledCodes.uebungCode, prefilledCodes.teilnehmerCode)) {
                await this.resolveJoinAndNavigate(prefilledCodes.uebungCode, prefilledCodes.teilnehmerCode, true);
            }
            return;
        }

        try {
            this.uebung = await this.firebaseService.getUebung(this.uebungId);
        } catch {
            this.view.renderZugangsFehler(
                "Die Übung konnte nicht geladen werden. Prüfe die Internetverbindung und lade die Seite neu – oder gib die Codes erneut ein."
            );
            this.bindJoinFormAfterError();
            return;
        }
        if (!this.uebung) {
            this.view.renderZugangsFehler(
                "Übung nicht gefunden. Vielleicht ist der Link unvollständig oder die Übung wurde gelöscht."
            );
            this.bindJoinFormAfterError();
            return;
        }

        store.setState({aktuelleUebung: this.uebung, aktuelleUebungId: this.uebungId});

        this.teilnehmerName = this.uebung.teilnehmerIds ? (this.uebung.teilnehmerIds[this.teilnehmerId] ?? null) : null;

        if (!this.teilnehmerName) {
            this.view.renderZugangsFehler(
                "Teilnehmer nicht in dieser Übung gefunden. Der Teilnehmercode im Link passt nicht zu dieser Übung.",
                this.uebung.uebungCode ?? ""
            );
            this.bindJoinFormAfterError();
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
            if (this.storage.xZeitBasis) {
                this.view.setXZeitBasisInputValue(this.storage.xZeitBasis);
            }
            this.view.bindXZeitEvents(
                (value) => this.setXZeitBasis(value),
                () => {
                    const now = new Date();
                    const hh = String(now.getHours()).padStart(2, "0");
                    const mm = String(now.getMinutes()).padStart(2, "0");
                    const value = `${hh}:${mm}`;
                    this.view.setXZeitBasisInputValue(value);
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

        // Bind Events
        this.view.bindEvents(
            (id, checked) => this.toggleUebertragen(id, checked),
            checked => this.toggleHide(checked),
            () => this.resetData(),
            mode => this.setDocMode(mode),
            () => this.changeDocPage(-1),
            () => this.changeDocPage(1),
            () => this.setDocMode("table"),
            () => this.toggleCurrentDocMessage(),
            () => this.downloadTeilnehmerZip(),
            () => this.debouncedRenderNachrichten()
        );
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

        live.subscribeEigenenStatus(this.teilnehmerId, remote => {
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
        });

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

    /** Meldet den aktuellen lokalen Stand an die Übungsleitung. */
    private publishStatus(): void {
        if (!this.liveStatus?.enabled || !this.storage || !this.teilnehmerId) {
            return;
        }
        this.liveStatus.publishTeilnehmerStatus(toTeilnehmerLiveDoc(this.storage, this.teilnehmerId));
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

    /**
     * Auf schmalen Geräten ist der Fokus-Modus Standard, solange der
     * Teilnehmer ihn nicht selbst umgeschaltet hat: ein Spruch, ein großer
     * Knopf. Gilt nur für X-Zeit-Übungen, denn nur dort gibt es Fälligkeiten.
     */
    private waehleFokusStandard(): void {
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

    private async resolveJoinAndNavigate(uebungCode: string, teilnehmerCode: string, ersetzen = false): Promise<void> {
        if (!uebungCode || !teilnehmerCode) {
            this.view.showJoinError("Bitte beide Codes eingeben.");
            return;
        }
        if (uebungCode.length !== 6 || teilnehmerCode.length !== 4) {
            this.view.showJoinError("Codeformat ungültig. Übungscode: 6 Zeichen, Teilnehmercode: 4 Zeichen.");
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

    private getPrefilledJoinCodesFromHash(): { uebungCode: string; teilnehmerCode: string } {
        const hash = window.location.hash || "";
        const query = hash.includes("?") ? hash.split("?")[1] ?? "" : "";
        const params = new URLSearchParams(query);
        const sanitize = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        return {
            uebungCode: sanitize(params.get("uc") || ""),
            teilnehmerCode: sanitize(params.get("tc") || "")
        };
    }

    /**
     * Die Übungsleitung setzt die X-Zeit-Basis verbindlich für alle; die
     * Teilnehmer übernehmen sie ohne eigenes Zutun (THW-Review workflow F2).
     */
    private uebernehmeXZeitDerLeitung(remote: LeitungPublicLiveDoc | null): void {
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
    private zeigeXZeitHerkunft(): void {
        if (typeof document === "undefined" || !this.storage || this.uebung?.spielModus !== "xZeit") {
            return;
        }
        const input = document.getElementById("xZeitBasisInput");
        if (!input) {
            return;
        }
        let hinweis = document.getElementById("xZeitBasisHerkunft");
        if (!hinweis) {
            hinweis = document.createElement("small");
            hinweis.id = "xZeitBasisHerkunft";
            hinweis.className = "text-body-secondary w-100";
            input.parentElement?.appendChild(hinweis);
        }
        const basis = this.storage.xZeitBasis;
        if (basis && this.storage.xZeitBasisQuelle === "leitung") {
            hinweis.textContent = `X-Zeit ${basis} – von der Übungsleitung gesetzt.`;
        } else if (basis && this.leitungXZeitBasis && basis !== this.leitungXZeitBasis) {
            hinweis.textContent = `Eigene Basis ${basis} – die Übungsleitung hat ${this.leitungXZeitBasis} festgelegt.`;
        } else if (!basis) {
            hinweis.textContent = "Warte auf die X-Zeit der Übungsleitung – oder starte erst, wenn sie „X-Zeit jetzt“ funkt.";
        } else {
            hinweis.textContent = "";
        }
    }

    private setXZeitBasis(value: string): void {
        if (!this.storage) {
            return;
        }
        // Eine eigene Basis neben der verbindlichen der Leitung nur als bewusste Abweichung.
        if (this.leitungXZeitBasis && value !== this.leitungXZeitBasis) {
            const ok = uiFeedback.confirm(
                `Die Übungsleitung hat die X-Zeit ${this.leitungXZeitBasis} für alle festgelegt. Willst du wirklich mit einer eigenen Basis (${value || "keine"}) weiterarbeiten?`
            );
            if (!ok) {
                this.view.setXZeitBasisInputValue(this.storage.xZeitBasis ?? "");
                return;
            }
        }
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
    private setFokusModus(aktiv: boolean): void {
        if (!this.storage) {
            return;
        }
        this.storage.fokusModus = aktiv;
        saveTeilnehmerStorage(this.storage);
        this.renderNachrichten();
    }

    private renderNachrichten() {
        if (!this.uebung || !this.storage || !this.teilnehmerName) {
            return;
        }
        const nachrichten = this.uebung.nachrichten[this.teilnehmerName] || [];
        // Einmalig: die Quittung gehört zum auslösenden Rendern, nicht zum
        // nächsten Tastendruck im Suchfeld.
        const zuletztAbgesetzt = this.zuletztAbgesetzt;
        this.zuletztAbgesetzt = null;
        this.view.renderNachrichten(nachrichten, this.storage, {
            showXZeit: this.uebung.spielModus === "xZeit",
            ...(this.storage.xZeitBasis ? { xZeitBasis: this.storage.xZeitBasis } : {}),
            bestaetigungen: this.getEigeneBestaetigungen(),
            ...(zuletztAbgesetzt !== null ? { zuletztAbgesetzt } : {})
        });
    }

    /** Bestätigungen der Leitung, umgeschlüsselt auf die eigene Nachrichten-ID. */
    private getEigeneBestaetigungen(): Record<string, LeitungBestaetigung> {
        if (!this.teilnehmerName) {
            return {};
        }
        const prefix = `${this.teilnehmerName}__`;
        return Object.entries(this.leitungBestaetigungen).reduce<Record<string, LeitungBestaetigung>>(
            (acc, [key, value]) => {
                if (key.startsWith(prefix) && value.abgesetztUm) {
                    acc[key.slice(prefix.length)] = value;
                }
                return acc;
            },
            {}
        );
    }

    private startXZeitTicker(): void {
        this.stopXZeitTicker();
        this.xZeitInterval = setInterval(() => {
            if (!this.uebung || !this.storage || !this.teilnehmerName || !this.storage.xZeitBasis) {
                return;
            }
            const nachrichten = this.uebung.nachrichten[this.teilnehmerName] || [];
            this.view.updateXZeitCountdown(nachrichten, this.storage, this.storage.xZeitBasis);
        }, 1000);
    }

    private stopXZeitTicker(): void {
        if (this.xZeitInterval !== null) {
            clearInterval(this.xZeitInterval);
            this.xZeitInterval = null;
        }
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

    /**
     * Setzt den Übertragungsstatus. Ein Zurücksetzen wird als `uebertragen: false`
     * gespeichert statt gelöscht, damit der Live-Sync es nicht durch ein älteres
     * Remote-Dokument wieder überschreibt.
     */
    private setUebertragen(id: number, uebertragen: boolean): void {
        if (!this.storage) {
            return;
        }
        // Nur das Absetzen bekommt eine Quittung; das Zurücknehmen ist eine
        // Korrektur und keine Meldung, die durchs Netz geht.
        this.zuletztAbgesetzt = uebertragen ? id : null;
        const now = new Date().toISOString();
        this.storage.nachrichten[id] = uebertragen
            ? { uebertragen: true, uebertragenUm: now, geaendertUm: now }
            : { uebertragen: false, geaendertUm: now };
        saveTeilnehmerStorage(this.storage);
        this.publishStatus();
    }

    private toggleUebertragen(id: number, checked: boolean) {
        if (!this.storage) {
            return;
        }
        const vorher = this.storage.nachrichten[id];
        this.setUebertragen(id, checked);
        this.renderNachrichten();
        this.bieteRueckgaengigAn(id, checked, vorher);
    }

    /**
     * Jeder Statuswechsel bekommt einige Sekunden lang ein „Rückgängig“.
     * Wichtig vor allem bei „Abgesetzte ausblenden“ und im Fokus-Modus: dort
     * verschwindet der Spruch nach dem Tipp aus dem Blick.
     */
    private bieteRueckgaengigAn(
        id: number,
        abgesetzt: boolean,
        vorher: TeilnehmerStorage["nachrichten"][string] | undefined
    ): void {
        const text = abgesetzt
            ? `Spruch ${id} als abgesetzt markiert.`
            : `Spruch ${id} wieder offen.`;
        this.view.zeigeRueckgaengig(text, () => this.stelleWiederHer(id, vorher));
    }

    /**
     * Stellt den Eintrag vor dem letzten Wechsel wieder her, samt der
     * ursprünglichen Absetzzeit. geaendertUm ist neu, damit der Live-Sync
     * die Wiederherstellung nicht durch den eben gesendeten Stand ersetzt.
     */
    private stelleWiederHer(id: number, vorher: TeilnehmerStorage["nachrichten"][string] | undefined): void {
        if (!this.storage) {
            return;
        }
        const now = new Date().toISOString();
        this.storage.nachrichten[id] = vorher?.uebertragen
            ? { uebertragen: true, uebertragenUm: vorher.uebertragenUm ?? now, geaendertUm: now }
            : { uebertragen: false, geaendertUm: now };
        saveTeilnehmerStorage(this.storage);
        this.publishStatus();
        this.renderNachrichten();
        if (this.docMode !== "table") {
            this.invalidateDocCache();
            void this.renderDocPage();
        }
    }

    private toggleHide(checked: boolean) {
        if (!this.storage) {
            return;
        }
        this.storage.hideTransmitted = checked;
        saveTeilnehmerStorage(this.storage);
        this.renderNachrichten();
        this.invalidateDocCache();
        if (this.docMode !== "table") {
            const total = this.getDocTotalPages();
            if (this.docPage > total) {
                this.docPage = total;
            }
            void this.renderDocPage();
        }
    }

    private resetData() {
        if (!this.uebungId || !this.teilnehmerName) {
            return;
        }
        const anzahl = Object.values(this.storage?.nachrichten ?? {}).filter(e => e?.uebertragen).length;
        const kopf = `Wirklich alle ${anzahl} als abgesetzt markierten Funksprüche wieder auf „offen“ setzen?`;
        const message = this.liveStatus?.enabled
            ? `${kopf}\n\nDas gilt auch für die Übungsleitung und deine anderen Geräte: Dort erscheinen die Sprüche danach ebenfalls als offen. Eine eigene X-Zeit wird gelöscht. Das lässt sich nicht rückgängig machen.\n\nEinen einzelnen falsch markierten Spruch korrigierst du besser mit „Zurücknehmen“ in seiner Zeile.`
            : `${kopf}\n\nDas betrifft nur dieses Gerät. Eine eigene X-Zeit wird gelöscht. Das lässt sich nicht rückgängig machen.`;
        if (!uiFeedback.confirm(message)) {
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
            const now = new Date().toISOString();
            const nachrichten = Object.keys(this.storage.nachrichten).reduce<TeilnehmerStorage["nachrichten"]>(
                (acc, key) => {
                    acc[key] = { uebertragen: false, geaendertUm: now };
                    return acc;
                },
                {}
            );
            const cleared: TeilnehmerStorage = {
                ...this.storage,
                nachrichten,
                lastUpdated: now,
                xZeitBasisGeaendertUm: now
            };
            delete cleared.xZeitBasis;
            this.liveStatus.publishTeilnehmerStatus(toTeilnehmerLiveDoc(cleared, this.teilnehmerId));
            await this.liveStatus.flush();
        }
        clearTeilnehmerStorage(this.uebungId, this.teilnehmerName);
        this.revokeDocUrl();
        window.location.reload();
    }

    /**
     * Das Vordruck-Fenster ist ein eigener Schritt im Verlauf: „Zurück“ am
     * Handy schließt es, statt die Teilnehmeransicht zu verlassen. Der
     * Eintrag hat dieselbe Adresse, der Hash-Router bemerkt ihn nicht.
     */
    private vordruckImVerlauf = false;
    private popstateGebunden = false;

    private merkeVordruckImVerlauf(oeffnen: boolean): void {
        const hist = typeof window !== "undefined" ? window.history : undefined;
        if (!hist || typeof hist.pushState !== "function") {
            return;
        }
        if (!this.popstateGebunden && typeof window.addEventListener === "function") {
            this.popstateGebunden = true;
            window.addEventListener("popstate", () => {
                if (this.vordruckImVerlauf) {
                    this.vordruckImVerlauf = false;
                    if (this.docMode !== "table") {
                        void this.setDocMode("table", true);
                    }
                }
            });
        }
        if (oeffnen && !this.vordruckImVerlauf) {
            hist.pushState({ teilnehmerVordruck: true }, "");
            this.vordruckImVerlauf = true;
        } else if (!oeffnen && this.vordruckImVerlauf) {
            this.vordruckImVerlauf = false;
            hist.back();
        }
    }

    private async setDocMode(mode: DocMode, ausVerlauf = false) {
        if (mode === "table" && this.docMode === "table") {
            return;
        }
        if (!ausVerlauf) {
            this.merkeVordruckImVerlauf(mode !== "table");
        }
        this.docPageByMode[this.docMode] = this.docPage;
        this.docMode = mode;
        this.docPage = this.docPageByMode[mode] || 1;
        this.view.setDocMode(mode);

        if (mode === "table") {
            return;
        }

        const total = this.getDocTotalPages();
        if (this.docPage > total) {
            this.docPage = total;
        }
        await this.renderDocPage();
        this.preloadPages(mode);
    }

    private getVisibleNachrichten(): Nachricht[] {
        if (!this.uebung || !this.storage || !this.teilnehmerName) {
            return [];
        }
        const all = this.uebung.nachrichten[this.teilnehmerName] || [];
        if (!this.storage.hideTransmitted) {
            return all;
        }
        return all.filter(n => !this.storage?.nachrichten[n.id]?.uebertragen);
    }

    private getDocTotalPages(): number {
        if (!this.uebung || !this.teilnehmerName) {
            return 1;
        }
        const visible = this.getVisibleNachrichten();
        return Math.max(1, visible.length);
    }

    private buildPreviewUebung(): FunkUebung | null {
        if (!this.uebung || !this.teilnehmerName) {
            return null;
        }
        const visible = this.getVisibleNachrichten();
        const preview = { ...this.uebung } as FunkUebung;
        preview.nachrichten = { ...this.uebung.nachrichten, [this.teilnehmerName]: visible };
        return preview;
    }

    private changeDocPage(step: number) {
        if (this.docMode === "table") {
            return;
        }
        const total = this.getDocTotalPages();
        if (!total) {
            return;
        }
        const next = this.docPage + step;
        if (next < 1 || next > total) {
            return;
        }
        this.docPage = next;
        void this.renderDocPage();
    }

    private async renderDocPage() {
        if (this.docMode === "table") {
            return;
        }
        if (!this.uebung || !this.teilnehmerName) {
            return;
        }
        const total = this.getDocTotalPages();
        const token = ++this.docRenderToken;
        const previewUebung = this.buildPreviewUebung();
        if (!previewUebung) {
            return;
        }

        const currentMsg = this.getVisibleNachrichten()[this.docPage - 1];
        const isTransmitted = !!currentMsg && !!this.storage?.nachrichten[currentMsg.id]?.uebertragen;
        this.view.setDocTransmitted(isTransmitted, !!currentMsg);

        const blob = await this.getDocBlob(previewUebung, this.docMode, this.docPage);

        if (token !== this.docRenderToken) {
            return;
        }

        this.revokeDocUrl();
        this.currentDocUrl = URL.createObjectURL(blob);
        await this.view.renderPdfPage(blob, this.docPage, total);
    }

    private toggleCurrentDocMessage() {
        const msg = this.getCurrentDocMessage();
        if (!msg || !this.storage) {
            return;
        }
        const vorher = this.storage.nachrichten[msg.id];
        const current = !!vorher?.uebertragen;
        this.setUebertragen(msg.id, !current);
        this.bieteRueckgaengigAn(msg.id, !current, vorher);
        this.renderNachrichten();
        this.invalidateDocCache();
        if (this.storage.hideTransmitted && !current) {
            const total = this.getDocTotalPages();
            if (this.docPage > total) {
                this.docPage = total;
            }
        }
        void this.renderDocPage();
    }

    private getCurrentDocMessage(): Nachricht | null {
        if (!this.storage || !this.teilnehmerName) {
            return null;
        }
        // Seite 1 ist Spruch 1 — früher stand hier "<= 1", wodurch sich der
        // erste Spruch im Vordruck nicht abhaken ließ.
        if (this.docMode === "table" || this.docPage < 1) {
            return null;
        }
        const visible = this.getVisibleNachrichten();
        return visible[this.docPage - 1] ?? null;
    }

    private async downloadTeilnehmerZip() {
        if (!this.uebung || !this.teilnehmerName) {
            return;
        }

        try {
            const pdfGenerator = await ladePdfGenerator();
            const zipBlob = await pdfGenerator.generateTeilnehmerPDFsAsZip(this.uebung as FunkUebung, this.teilnehmerName);
            const link = document.createElement("a");
            link.href = URL.createObjectURL(zipBlob);
            link.download = `${pdfGenerator.sanitizeFileName(this.teilnehmerName)}_${pdfGenerator.sanitizeFileName(this.uebung.name)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            uiFeedback.success("ZIP wurde heruntergeladen.");
        } catch {
            uiFeedback.error("ZIP konnte nicht erstellt werden.");
        }
    }

    private invalidateDocCache() {
        this.preloadToken += 1;
        this.docBlobInFlight.clear();
        this.docBlobCache.clear();
    }

    private preloadPages(mode: DocMode) {
        if (mode === "table") {
            return;
        }
        const previewUebung = this.buildPreviewUebung();
        if (!previewUebung || !this.teilnehmerName) {
            return;
        }
        const total = this.getDocTotalPages();
        const pages: number[] = [];
        if (this.docPage >= 1 && this.docPage <= total) {
            pages.push(this.docPage);
        }
        if (this.docPage + 1 <= total) {
            pages.push(this.docPage + 1);
        }
        if (this.docPage - 1 >= 1) {
            pages.push(this.docPage - 1);
        }
        for (let i = 1; i <= total; i++) {
            if (!pages.includes(i)) {
                pages.push(i);
            }
        }

        const token = ++this.preloadToken;
        const run = (index: number) => {
            if (token !== this.preloadToken) {
                return;
            }
            if (index >= pages.length) {
                return;
            }
            const page = pages[index];
            if (page === undefined) {
                setTimeout(() => run(index + 1), 0);
                return;
            }
            let inflight = this.docBlobInFlight.get(mode);
            if (!inflight) {
                inflight = new Set();
                this.docBlobInFlight.set(mode, inflight);
            }
            if (inflight.has(page)) {
                setTimeout(() => run(index + 1), 0);
                return;
            }
            inflight.add(page);
            const task = this.getDocBlob(previewUebung, mode, page);
            task.then(() => {
                inflight?.delete(page);
            }).finally(() => {
                setTimeout(() => run(index + 1), 0);
            });
        };

        setTimeout(() => run(0), 0);
    }

    private revokeDocUrl() {
        if (this.currentDocUrl) {
            URL.revokeObjectURL(this.currentDocUrl);
            this.currentDocUrl = null;
        }
    }

    private async getDocBlob(previewUebung: FunkUebung, mode: DocMode, page: number): Promise<Blob> {
        const modeCache = this.docBlobCache.get(mode) ?? new Map<number, Blob>();
        this.docBlobCache.set(mode, modeCache);
        const cached = modeCache.get(page);
        if (cached) {
            return cached;
        }
        const pdfGenerator = await ladePdfGenerator();
        const blob = mode === "meldevordruck"
            ? await pdfGenerator.generateMeldevordruckPageBlob({
                funkUebung: previewUebung,
                teilnehmer: this.teilnehmerName as string,
                page
            })
            : await pdfGenerator.generateNachrichtenvordruckPageBlob({
                funkUebung: previewUebung,
                teilnehmer: this.teilnehmerName as string,
                page
            });
        modeCache.set(page, blob);
        return blob;
    }
}
