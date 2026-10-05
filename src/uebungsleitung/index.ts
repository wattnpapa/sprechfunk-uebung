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
import { LiveStatusService, type SyncInfo } from "../services/LiveStatusService";
import {
    buildEffektiveNachrichtenStatus,
    mergeLeitungLiveDoc,
    mergeLeitungPublicLiveDoc,
    toLeitungLiveDoc,
    toLeitungPublicLiveDoc
} from "../services/liveStatusMerge";
import type { TeilnehmerLiveDoc } from "../types/LiveStatus";
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
import { buildFaelligkeit, buildPlan, buildSollUhrzeiten } from "./nachrichtenplan";
import { LeitungAktionen, type AktionenHost } from "./aktionen";
import { PlanAktionen } from "./aktionenPlan";
import { CockpitSteuerung } from "./cockpitSteuerung";
import { buildAuswertungsStand, buildDebriefStorage, downloadTeilnehmerDebrief, exportTeilnehmerUebersicht, exportUebungsleitungPdf } from "./export";
import { fuehreResetAus, resetBestaetigen } from "./zuruecksetzen";
import { holeZurueckgesetzt, ladeAnsicht, speichereAnsicht } from "./ansicht";
import { reaktionsBilanz } from "./reaktion";
import { buildLageAnzeige } from "./lageAufbau";

export { RUECKNAHME_SPERRE_MS } from "./aktionen";

export class UebungsleitungController {
    private view: UebungsleitungView;
    private firebaseService: FirebaseService;
    private uebungId: string | null = null;
    private uebung: FunkUebung | null = null;
    private storage: UebungsleitungStorage | null = null;

    /** Ansicht je Gerät gemerkt (Ausblenden, Teilnehmertabelle eingeklappt). */
    private ansicht = ladeAnsicht();
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
    private syncInfo: SyncInfo | null = null;
    /** Zuletzt empfangene Selbstmeldungen der Teilnehmer. */
    private teilnehmerLiveDocs: TeilnehmerLiveDoc[] = [];
    private disposeListener: (() => void) | null = null;
    private disposed = false;
    private host: AktionenHost = {
        storage: () => this.storage,
        uebung: () => this.uebung,
        effektiverStatus: () => this.buildEffektivenStatus(),
        save: () => this.save(),
        debouncedSave: () => this.debouncedSave(),
        renderTeilnehmer: () => this.renderTeilnehmer(),
        renderNachrichten: () => this.renderNachrichten(),
        zeigeRueckgaengig: (meldung, onUndo) => this.view.zeigeRueckgaengig(meldung, onUndo),
        schliesseRueckgaengig: () => this.view.schliesseRueckgaengig()
    };
    /** Bedienhandlungen an Teilnehmern und Nachrichten; lesen den Zustand dieses Controllers. */
    private aktionen = new LeitungAktionen(this.host);
    private planAktionen = new PlanAktionen(this.host);
    private cockpit: CockpitSteuerung;

    constructor(db: Firestore) {
        this.view = new UebungsleitungView();
        this.firebaseService = new FirebaseService(db);
        this.db = db;
        this.cockpit = new CockpitSteuerung({
            storage: () => this.storage,
            uebung: () => this.uebung,
            effektiverStatus: () => this.buildEffektivenStatus(),
            teilnehmerDocs: () => this.teilnehmerLiveDocs,
            save: () => this.save(),
            renderNachrichten: () => this.renderNachrichten(),
            view: this.view
        });
    }

    public async init() {
        const geladen = await ladeUebung(this.firebaseService, router.parseHash().params[0] ?? null);
        this.uebungId = geladen.uebungId ?? null;
        if (this.disposed) {
            return;
        }
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
        this.view.setTeilnehmerEingeklappt(this.ansicht.teilnehmerEingeklappt);
        this.renderTeilnehmer();
        this.renderNachrichten();

        this.bindEvents();
        this.startLiveSync();
        this.view.setResetModus(Boolean(this.liveStatus?.enabled));
        this.cockpit.init();
        const zurueckgesetzt = holeZurueckgesetzt(uebungId);
        if (zurueckgesetzt) {
            this.view.zeigeZurueckgesetzt(zurueckgesetzt);
        }
    }

    private bindEvents(): void {
        const aktionen = this.aktionen;
        const plan = this.planAktionen;
        this.view.bindMetaEvents(
            () => this.exportPdf(),
            () => this.resetData(),
            () => this.exportTeilnehmerUebersicht()
        );
        this.view.bindTeilnehmerEinklappen(() => this.toggleTeilnehmerEingeklappt());

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
            onAuslassen: (sender, nr) => plan.auslassen(sender, nr),
            onWiederOeffnen: (sender, nr) => plan.wiederOeffnen(sender, nr),
            onReaktion: (sender, nr, wert) => plan.setzeReaktion(sender, nr, wert),
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
        this.ansicht = { ...this.ansicht, hideAbgesetzt: val };
        speichereAnsicht(this.ansicht);
        this.renderNachrichten();
    }

    private toggleTeilnehmerEingeklappt(): void {
        this.ansicht = { ...this.ansicht, teilnehmerEingeklappt: !this.ansicht.teilnehmerEingeklappt };
        speichereAnsicht(this.ansicht);
        this.view.setTeilnehmerEingeklappt(this.ansicht.teilnehmerEingeklappt);
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

        live.onSyncInfo(info => this.aufSyncInfo(info));

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
                this.cockpit.remoteBasisUebernommen();
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
    }

    /** Badge im Plan-Kopf und – bei Verbindungsverlust – Hinweis oben in der Lage. */
    private aufSyncInfo(info: SyncInfo): void {
        const zustandGewechselt = this.syncInfo?.state !== info.state;
        this.syncInfo = info;
        this.view.updateLiveSyncState(info.state, info.offeneAenderungen);
        if (zustandGewechselt) {
            this.renderNachrichten();
        }
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

    /** Beim Verlassen der Ansicht (oder wenn eine neue sie ersetzt). */
    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        // Noch ausstehende, gebündelte Eingaben (z. B. eine gerade getippte
        // Notiz) dürfen beim Verlassen der Seite nicht verloren gehen.
        this.save();
        this.cockpit.stop();
        this.view.dispose();
        void this.liveStatus?.flush();
        this.liveStatus?.dispose();
        this.liveStatus = null;
        this.disposeListener?.();
        this.disposeListener = null;
    }

    /** Räumt bei jedem Wechsel der Adresse auf – auch ohne Live-Sync. */
    public aufraeumenBeiHashWechsel(): void {
        const onHashChange = () => this.dispose();
        window.addEventListener("hashchange", onHashChange, { once: true });
        this.disposeListener = () => window.removeEventListener("hashchange", onHashChange);
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
        this.cockpit.merkeRenderMinute(now.getTime());

        const nachrichten = buildPlan(this.uebung);
        // Fortschritt zählt jede Nachricht, die Teilnehmer oder Leitung markiert hat.
        const effektiv = this.buildEffektivenStatus();
        const { done, nurGemeldet } = zaehleErledigt(nachrichten, effektiv);
        this.view.updateProgress(nachrichten.length, done, this.calculateEtaLabel(nachrichten, effektiv), nurGemeldet);

        const basisMs = this.cockpit.basisMs(now);
        const faelligkeit = basisMs === null
            ? {}
            : buildFaelligkeit(nachrichten, effektiv, basisMs, { intervallMinuten: this.uebung.xZeitIntervallMinuten, jetztMs: now.getTime() });

        this.view.renderNachrichtenListe({
            nachrichten,
            nachrichtenStatus: effektiv,
            hideAbgesetzt: this.ansicht.hideAbgesetzt,
            senderFilter: this.senderFilter,
            empfaengerFilter: this.empfaengerFilter,
            textFilter: this.textFilter,
            faelligkeit,
            sollUhrzeit: basisMs === null ? {} : buildSollUhrzeiten(nachrichten, basisMs),
            ruecknahmeGesperrt: this.aktionen.gesperrteRuecknahmen(now.getTime()),
            jetztMs: now.getTime()
        });
        this.view.renderLage(buildLageAnzeige({
            uebung: this.uebung,
            teilnehmerStatus: this.storage.teilnehmer,
            nachrichten,
            effektiv,
            faelligkeit,
            hideAbgesetzt: this.ansicht.hideAbgesetzt,
            syncInfo: this.syncInfo,
            jetztMs: now.getTime()
        }));
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
        return calculateEtaLabel(nachrichten, effektiv, this.cockpit.basisMs());
    }

    private toggleStaerkeDetails() {
        this.showStaerkeDetails = !this.showStaerkeDetails;
        this.renderTeilnehmer();
    }

    /**
     * Gemeinsamer Stand für Übungsleitungs-PDF und Debrief: dieselbe
     * Anmeldezeit, dieselben Vermerke (THW-Review 2026-10-05, analog P2-1).
     */
    private auswertungsStand(): UebungsleitungStorage | null {
        if (!this.uebung || !this.storage) {
            return null;
        }
        const effektiv = this.buildEffektivenStatus();
        return buildAuswertungsStand(
            this.uebung,
            this.storage,
            buildAnmeldungen(this.uebung, this.storage, effektiv),
            this.uebung.fuehrungsstelle ? reaktionsBilanz(buildPlan(this.uebung), effektiv) : null
        );
    }

    private async downloadTeilnehmerDebrief(name: string) {
        const stand = this.auswertungsStand();
        if (!this.uebung || !stand) {
            return;
        }
        await downloadTeilnehmerDebrief(this.uebung, buildDebriefStorage(stand, this.buildEffektivenStatus()), name);
    }

    private async exportPdf() {
        const stand = this.auswertungsStand();
        if (this.uebung && stand) {
            await exportUebungsleitungPdf(this.uebung, stand);
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

/** Die gerade angezeigte Übungsleitung – ein zweiter Aufruf für dieselbe Adresse baut nichts doppelt auf. */
let aktiv: { hash: string; controller: UebungsleitungController } | null = null;

export async function initUebungsleitung(db: Firestore): Promise<void> {
    const hash = typeof window !== "undefined" ? window.location?.hash ?? "" : "";
    if (aktiv && aktiv.hash === hash) {
        return;
    }
    aktiv?.controller.dispose();
    const controller = new UebungsleitungController(db);
    const eintrag = { hash, controller };
    aktiv = eintrag;
    controller.aufraeumenBeiHashWechsel();
    window.addEventListener("hashchange", () => {
        if (aktiv === eintrag) {
            aktiv = null;
        }
    }, { once: true });
    await controller.init();

    // Make area visible
    const area = document.getElementById("uebungsleitungArea");
    if (area) {
        area.style.display = "block";
    }
}
