import { loadUebungsleitungStorage, saveUebungsleitungStorage } from "../services/storage";
import { UebungsleitungView } from "./UebungsleitungView";
import { FirebaseService } from "../services/FirebaseService";
import { store } from "../state/store";
import { router } from "../core/router";
import type { UebungsleitungStorage } from "../types/Storage";
import type { Firestore } from "firebase/firestore";
import type { FunkUebung } from "../models/FunkUebung";
import { debounce } from "../utils/debounce";
import { captureFieldFocus, restoreFieldFocus } from "../utils/focus";
import { LiveStatusService } from "../services/LiveStatusService";
import {
    buildEffektiveNachrichtenStatus,
    mergeLeitungLiveDoc,
    mergeLeitungPublicLiveDoc,
    toLeitungLiveDoc,
    toLeitungPublicLiveDoc
} from "../services/liveStatusMerge";
import type { TeilnehmerLiveDoc } from "../types/LiveStatus";
import { parseHHMMtoMs } from "../utils/xzeit";
import { lageJeTeilnehmer } from "./lagebild";
import { buildAnmeldungen, buildFortschritt, ladeUebung } from "./teilnehmerStand";
import type { FlattenedNachricht } from "./nachrichtenTypen";
import {
    buildHeatmapBins,
    buildTeilnehmerTimeline,
    calculateEtaLabel,
    calculateHeatmapLabel,
    calculateLoadLabel,
    calculateTempoLabel,
    collectSentNachrichten,
    zaehleErledigt,
    type EffektiverStatus
} from "./auswertung";
import { buildFaelligkeit, buildPlan, buildSollUhrzeiten, naechsteFuerLage } from "./nachrichtenplan";
import { buildCockpitAnzeige } from "./cockpit";
import { LeitungAktionen } from "./aktionen";
import { buildDebriefStorage, downloadTeilnehmerDebrief, exportTeilnehmerUebersicht, exportUebungsleitungPdf } from "./export";
import { fuehreResetAus, resetBestaetigen } from "./zuruecksetzen";

export { RUECKNAHME_SPERRE_MS } from "./aktionen";

export class UebungsleitungController {
    private view: UebungsleitungView;
    private firebaseService: FirebaseService;
    private uebungId: string | null = null;
    private uebung: FunkUebung | null = null;
    private storage: UebungsleitungStorage | null = null;

    // State for filters
    private hideAbgesetzt = false;
    private senderFilter = "";
    private empfaengerFilter = "";
    private textFilter = "";
    private showStaerkeDetails = false;
    private debouncedRenderNachrichten = debounce(() => this.renderNachrichten(), 140);
    /**
     * Tippen schreibt sofort in den lokalen Zustand, damit ein Live-Update den
     * Text nicht zurücksetzt; nur das Speichern/Veröffentlichen wird gebündelt.
     */
    private debouncedSave = debounce(() => this.save(), 220);
    private db: Firestore;
    private liveStatus: LiveStatusService | null = null;
    /** Zuletzt empfangene Selbstmeldungen der Teilnehmer. */
    private teilnehmerLiveDocs: TeilnehmerLiveDoc[] = [];
    private disposeListener: (() => void) | null = null;
    private cockpitInterval: ReturnType<typeof setInterval> | null = null;
    /** Minute des letzten Plan-Renderns – die Fälligkeit ändert sich minütlich. */
    private letzteFaelligkeitsMinute = -1;
    /** Bedienhandlungen an Teilnehmern und Nachrichten; lesen den Zustand dieses Controllers. */
    private aktionen = new LeitungAktionen({
        storage: () => this.storage,
        uebung: () => this.uebung,
        effektiverStatus: () => this.buildEffektivenStatus(),
        save: () => this.save(),
        debouncedSave: () => this.debouncedSave(),
        renderTeilnehmer: () => this.renderTeilnehmer(),
        renderNachrichten: () => this.renderNachrichten(),
        zeigeRueckgaengig: (meldung, onUndo) => this.view.zeigeRueckgaengig(meldung, onUndo)
    });

    constructor(db: Firestore) {
        this.view = new UebungsleitungView();
        this.firebaseService = new FirebaseService(db);
        this.db = db;
    }

    public async init() {
        const geladen = await ladeUebung(this.firebaseService, router.parseHash().params[0] ?? null);
        this.uebungId = geladen.uebungId ?? null;
        if ("fehler" in geladen) {
            this.view.showLadefehler(geladen.fehler, geladen.uebungId);
            return;
        }
        const { uebung, uebungId } = geladen;
        this.uebung = uebung;

        store.setState({ aktuelleUebung: uebung, aktuelleUebungId: uebungId });
        this.storage = loadUebungsleitungStorage(uebungId);
        this.updateFooterInfo();

        // Initial Render
        this.view.renderMeta(uebung, uebungId);
        this.renderTeilnehmer();
        this.renderNachrichten();

        this.bindEvents();
        this.startLiveSync();
        this.view.setResetModus(Boolean(this.liveStatus?.enabled));
        this.initCockpit();
    }

    private bindEvents(): void {
        const aktionen = this.aktionen;
        this.view.bindMetaEvents(
            () => this.exportPdf(),
            () => this.resetData(),
            () => this.exportTeilnehmerUebersicht()
        );

        this.view.bindTeilnehmerEvents({
            onAnmelden: name => aktionen.markAngemeldet(name),
            onAnmeldungZuruecknehmen: name => aktionen.anmeldungZuruecknehmen(name),
            onLoesungswort: (name, val) => aktionen.updateLoesungswort(name, val),
            onStaerke: (name, idx, val) => aktionen.updateStaerke(name, idx, val),
            onNotiz: (name, val) => aktionen.updateNotiz(name, val),
            onToggleDetails: () => this.toggleStaerkeDetails(),
            onDownloadDebrief: name => this.downloadTeilnehmerDebrief(name)
        });

        this.view.bindNachrichtenEvents({
            onAbgesetzt: (sender, nr) => aktionen.markNachrichtAbgesetzt(sender, nr),
            onReset: (sender, nr) => aktionen.resetNachricht(sender, nr),
            onZeitNachtragen: (sender, nr, hhmm) => aktionen.zeitNachtragen(sender, nr, hhmm),
            onNotiz: (sender, nr, val) => aktionen.persistNachrichtNotiz(sender, nr, val),
            onFilterSender: val => {
                this.senderFilter = val; this.renderNachrichten();
            },
            onFilterEmpfaenger: val => {
                this.empfaengerFilter = val; this.renderNachrichten();
            },
            onToggleHide: val => this.setHideAbgesetzt(val),
            onFilterText: val => {
                this.textFilter = val; this.debouncedRenderNachrichten();
            }
        });

        this.view.bindLageEvents({
            onGemeldeteBestaetigen: () => aktionen.gemeldeteBestaetigen(),
            onToggleHide: val => this.setHideAbgesetzt(val)
        });
    }

    private setHideAbgesetzt(val: boolean): void {
        this.hideAbgesetzt = val;
        this.renderNachrichten();
    }

    /**
     * Cockpit-Kacheln (Uhrzeit, Laufzeit, X-Zeit, Plan-Status) – nur im
     * X-Zeit-Modus, weil nur dort ein Zeitplan über die Slots existiert.
     */
    private initCockpit(): void {
        if (this.uebung?.spielModus !== "xZeit") {
            return;
        }
        this.view.setCockpitVisible(true);
        if (this.storage?.xZeitBasis) {
            this.view.setCockpitBasisInputValue(this.storage.xZeitBasis);
        }
        const uebernehmen = (value: string) => {
            this.view.setCockpitBasisInputValue(value);
            this.setCockpitBasis(value);
        };
        this.view.bindCockpitEvents(
            value => this.setCockpitBasis(value),
            () => {
                const now = new Date();
                uebernehmen(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
            },
            uebernehmen,
            () => this.view.scrollZuPlanZustand("ueberfaellig")
        );
        this.updateCockpit();
        this.cockpitInterval = setInterval(() => this.tickCockpit(), 1000);
        // Eigener Aufräum-Hook: der Listener aus startLiveSync fehlt, wenn der
        // Live-Sync deaktiviert ist – der Ticker darf trotzdem nicht weiterlaufen.
        window.addEventListener("hashchange", () => this.stopCockpit(), { once: true });
    }

    private stopCockpit(): void {
        if (this.cockpitInterval !== null) {
            clearInterval(this.cockpitInterval);
            this.cockpitInterval = null;
        }
    }

    private tickCockpit(): void {
        this.updateCockpit();
        // Überfällig / jetzt fällig / später ändert sich nur minütlich.
        const minute = Math.floor(Date.now() / 60000);
        if (minute !== this.letzteFaelligkeitsMinute) {
            this.renderNachrichten();
        }
    }

    /**
     * Setzt die verbindliche X-Zeit-Basis. Sie geht über `leitung-public` an
     * alle Leitungs-Arbeitsplätze und Teilnehmer.
     */
    private setCockpitBasis(value: string): void {
        if (!this.storage) {
            return;
        }
        if (value) {
            this.storage.xZeitBasis = value;
        } else {
            delete this.storage.xZeitBasis;
        }
        this.storage.xZeitBasisGeaendertUm = new Date().toISOString();
        this.save();
        this.updateCockpit();
        this.renderNachrichten();
    }

    /**
     * Nur die Basis der Leitung ist verbindlich. Basen einzelner Rollenspieler
     * werden nie stillschweigend übernommen (THW-Review workflow F2).
     */
    private effektiveXZeitBasis(): string | null {
        return this.storage?.xZeitBasis || null;
    }

    /** Basis in Millisekunden – nur im X-Zeit-Modus, sonst `null`. */
    private planBasisMs(now?: Date): number | null {
        const basis = this.effektiveXZeitBasis();
        return this.uebung?.spielModus === "xZeit" && basis ? parseHHMMtoMs(basis, now) : null;
    }

    private updateCockpit(): void {
        if (!this.uebung) {
            return;
        }
        this.view.updateCockpit(buildCockpitAnzeige({
            uebung: this.uebung,
            effektiv: this.buildEffektivenStatus(),
            basis: this.effektiveXZeitBasis(),
            docs: this.teilnehmerLiveDocs,
            now: new Date()
        }));
    }

    /**
     * Abonniert die Status-Subcollection: Selbstmeldungen der Teilnehmer sowie
     * die eigenen Dokumente (für Gerätewechsel und mehrere Leitungs-Arbeitsplätze).
     */
    private startLiveSync(): void {
        if (!this.uebungId) {
            return;
        }

        const live = new LiveStatusService(this.db, this.uebungId);
        this.liveStatus = live;
        if (!live.enabled) {
            this.view.updateLiveSyncState("aus");
            return;
        }

        live.onStateChange(state => this.view.updateLiveSyncState(state, live.getOffeneAenderungen()));

        live.subscribeAlleTeilnehmer(docs => {
            this.teilnehmerLiveDocs = docs;
            this.renderTeilnehmer();
            this.renderNachrichten();
        });

        live.subscribeLeitungPublic(remote => {
            const vorher = this.storage?.xZeitBasis;
            if (!remote || !this.storage || !this.uebernehmeRemote(mergeLeitungPublicLiveDoc(this.storage, remote))) {
                return;
            }
            if (this.storage.xZeitBasis !== vorher) {
                this.view.setCockpitBasisInputValue(this.storage.xZeitBasis ?? "");
                this.updateCockpit();
            }
            this.renderTeilnehmer();
            this.renderNachrichten();
        });

        live.subscribeLeitungInternal(remote => {
            if (!remote || !this.storage || !this.uebernehmeRemote(mergeLeitungLiveDoc(this.storage, remote))) {
                return;
            }
            this.renderTeilnehmer();
            this.renderNachrichten();
        });

        this.publishLeitungStatus();

        const onHashChange = () => this.dispose();
        window.addEventListener("hashchange", onHashChange, { once: true });
        this.disposeListener = () => window.removeEventListener("hashchange", onHashChange);
    }

    /** Übernimmt einen zusammengeführten Stand, falls er sich geändert hat. */
    private uebernehmeRemote({ merged, changed }: { merged: UebungsleitungStorage; changed: boolean }): boolean {
        if (!changed) {
            return false;
        }
        this.storage = merged;
        saveUebungsleitungStorage(merged);
        return true;
    }

    private publishLeitungStatus(): void {
        if (!this.liveStatus?.enabled || !this.storage) {
            return;
        }
        this.liveStatus.publishLeitungPublic(toLeitungPublicLiveDoc(this.storage));
        this.liveStatus.publishLeitungInternal(toLeitungLiveDoc(this.storage));
    }

    public dispose(): void {
        // Noch ausstehende, gebündelte Eingaben (z. B. eine gerade getippte
        // Notiz) dürfen beim Verlassen der Seite nicht verloren gehen.
        this.save();
        this.stopCockpit();
        void this.liveStatus?.flush();
        this.liveStatus?.dispose();
        this.liveStatus = null;
        this.disposeListener?.();
        this.disposeListener = null;
    }

    private renderTeilnehmer() {
        if (!this.uebung || !this.storage) {
            return;
        }
        const focusSnapshot = captureFieldFocus();
        this.view.renderTeilnehmerListe(this.uebung, this.storage.teilnehmer, this.showStaerkeDetails, {
            fortschritt: buildFortschritt(this.uebung, this.storage, this.teilnehmerLiveDocs),
            anmeldung: buildAnmeldungen(this.uebung, this.storage, this.buildEffektivenStatus())
        });
        restoreFieldFocus(focusSnapshot);
    }

    /**
     * Bestätigungen der Leitung und Selbstmeldungen der Teilnehmer zusammengeführt.
     * Grundlage für Fortschritt, ETA, Tempo, Funklast, Heatmap und Timeline.
     */
    private buildEffektivenStatus(): EffektiverStatus {
        return buildEffektiveNachrichtenStatus(this.storage?.nachrichten ?? {}, this.teilnehmerLiveDocs);
    }

    private renderNachrichten() {
        if (!this.uebung || !this.storage) {
            return;
        }

        // Die Tabelle wird komplett neu gebaut – Fokus und Cursor eines gerade
        // bearbeiteten Feldes (Notiz, Suchfeld) müssen das überleben.
        const focusSnapshot = captureFieldFocus();
        const now = new Date();
        this.letzteFaelligkeitsMinute = Math.floor(now.getTime() / 60000);

        const nachrichten = buildPlan(this.uebung);
        // Fortschritt zählt jede Nachricht, die Teilnehmer oder Leitung markiert hat.
        const effektiv = this.buildEffektivenStatus();
        const { done, nurGemeldet } = zaehleErledigt(nachrichten, effektiv);
        this.view.updateProgress(nachrichten.length, done, this.calculateEtaLabel(nachrichten, effektiv), nurGemeldet);

        const basisMs = this.planBasisMs(now);
        const faelligkeit = basisMs === null
            ? {}
            : buildFaelligkeit(nachrichten, effektiv, basisMs, { intervallMinuten: this.uebung.xZeitIntervallMinuten, jetztMs: now.getTime() });

        this.view.renderNachrichtenListe({
            nachrichten,
            nachrichtenStatus: effektiv,
            hideAbgesetzt: this.hideAbgesetzt,
            senderFilter: this.senderFilter,
            empfaengerFilter: this.empfaengerFilter,
            textFilter: this.textFilter,
            faelligkeit,
            sollUhrzeit: basisMs === null ? {} : buildSollUhrzeiten(nachrichten, basisMs),
            ruecknahmeGesperrt: this.aktionen.gesperrteRuecknahmen(now.getTime())
        });
        this.view.renderLage({
            teilnehmer: lageJeTeilnehmer(nachrichten, effektiv),
            naechste: naechsteFuerLage(nachrichten, effektiv, faelligkeit),
            zuBestaetigen: nurGemeldet,
            hideAbgesetzt: this.hideAbgesetzt,
            ueberfaellig: Object.values(faelligkeit).filter(f => f.zustand === "ueberfaellig").length
        });
        // Heatmap und Timeline liegen in der eben neu gebauten Tabelle.
        this.renderAuswertung(nachrichten, effektiv);

        restoreFieldFocus(focusSnapshot);
    }

    /** Tempo, Funklast, Heatmap und Timeline aus den erledigten Nachrichten. */
    private renderAuswertung(nachrichten: FlattenedNachricht[], effektiv: EffektiverStatus): void {
        const teilnehmer = this.uebung?.teilnehmerListe ?? [];
        const sentNachrichten = collectSentNachrichten(nachrichten, effektiv);
        const heatmapBins = buildHeatmapBins(sentNachrichten);
        this.view.updateOperationalStats(
            calculateTempoLabel(sentNachrichten),
            calculateLoadLabel(sentNachrichten, teilnehmer),
            calculateHeatmapLabel(heatmapBins)
        );
        this.view.updateHeatmap(heatmapBins);
        this.view.updateTeilnehmerTimeline(buildTeilnehmerTimeline(nachrichten, effektiv, teilnehmer));
    }

    private calculateEtaLabel(
        nachrichten: FlattenedNachricht[],
        effektiv: EffektiverStatus = this.buildEffektivenStatus()
    ): string {
        if (!this.storage) {
            return "ETA: –";
        }
        return calculateEtaLabel(nachrichten, effektiv, this.planBasisMs());
    }

    private toggleStaerkeDetails() {
        this.showStaerkeDetails = !this.showStaerkeDetails;
        this.renderTeilnehmer();
    }

    private async downloadTeilnehmerDebrief(name: string) {
        if (!this.uebung || !this.storage) {
            return;
        }
        const debriefStorage = buildDebriefStorage(
            this.storage,
            buildAnmeldungen(this.uebung, this.storage, this.buildEffektivenStatus()),
            this.buildEffektivenStatus()
        );
        await downloadTeilnehmerDebrief(this.uebung, debriefStorage, name);
    }

    private async exportPdf() {
        if (this.uebung && this.storage) {
            await exportUebungsleitungPdf(this.uebung, this.storage);
        }
    }

    private async exportTeilnehmerUebersicht() {
        if (this.uebung) {
            await exportTeilnehmerUebersicht(this.uebung);
        }
    }

    private resetData() {
        if (!resetBestaetigen(this.liveStatus, this.storage)) {
            return;
        }
        if (this.uebungId) {
            void fuehreResetAus(this.liveStatus, this.storage, this.uebungId);
        }
    }

    private save() {
        if (this.storage) {
            saveUebungsleitungStorage(this.storage);
            this.publishLeitungStatus();
        }
    }

    private updateFooterInfo() {
        const idEl = document.getElementById("uebungsId");
        if (idEl && this.uebung) {
            idEl.textContent = this.uebung.id || "-";
        }
    }
}

export async function initUebungsleitung(db: Firestore): Promise<void> {
    const controller = new UebungsleitungController(db);
    await controller.init();

    // Make area visible
    const area = document.getElementById("uebungsleitungArea");
    if (area) {
        area.style.display = "block";
    }
}
