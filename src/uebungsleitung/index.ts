import { loadUebungsleitungStorage, saveUebungsleitungStorage } from "../services/storage";
import { UebungsleitungView } from "./UebungsleitungView";
import { FirebaseService } from "../services/FirebaseService";
import { store } from "../state/store";
import { router } from "../core/router";
import { NachrichtenStatus, TeilnehmerStatus, UebungsleitungStorage } from "../types/Storage";
import type { Firestore } from "firebase/firestore";
import {FunkUebung} from "../models/FunkUebung";
import { uiFeedback } from "../core/UiFeedback";
import { debounce } from "../utils/debounce";
import { captureFieldFocus, restoreFieldFocus } from "../utils/focus";
import { formatNatoDate } from "../utils/date";
import { ladePdfGenerator } from "../services/pdfGeneratorLazy";
import { LiveStatusService } from "../services/LiveStatusService";
import {
    buildEffektiveNachrichtenStatus,
    buildTeilnehmerFortschritt,
    mergeLeitungLiveDoc,
    mergeLeitungPublicLiveDoc,
    toLeitungLiveDoc,
    toLeitungPublicLiveDoc,
    type EffektiverNachrichtenStatus,
    type TeilnehmerFortschritt
} from "../services/liveStatusMerge";
import type { TeilnehmerLiveDoc } from "../types/LiveStatus";
import type { NachrichtArt } from "../types/Nachricht";
import { berechneSollFortschritt, fruehesteBasis, parseHHMMtoMs } from "../utils/xzeit";
import {
    anmeldeNachrichtKey,
    anmeldeZustand,
    berechneFaelligkeit,
    faelligFensterMs,
    formatUhrzeit,
    lageJeTeilnehmer,
    naechsteOffene,
    schaetzeEnde,
    sortiereNachrichtenplan,
    statusKey,
    uhrzeitZuIso,
    vergibPlanNummern,
    type AnmeldeZustand,
    type Faelligkeit
} from "./lagebild";

interface FlattenedNachricht {
    nr: number;
    sender: string;
    empfaenger: string[];
    text: string;
    xZeitSlot?: number;
    art?: NachrichtArt;
    szenarioNr?: number;
    planNr?: number;
}

interface SentNachricht {
    sender: string;
    empfaenger: string[];
    ts: number;
    /** Zeit von Hand nachgetragen – zählt nicht fürs Tempo. */
    nachgetragen?: boolean;
}

interface TimelineEvent {
    ts: number;
    type: "S" | "E";
    nr: number;
}

/**
 * Nach „als abgesetzt markieren“ bleibt die Rücknahme dieser Zeile so lange
 * gesperrt – ein Doppeltipp darf die Markierung nicht still wieder aufheben.
 */
export const RUECKNAHME_SPERRE_MS = 1500;

/** Wartezeit auf die Serverbestätigung beim Zurücksetzen für alle. */
const RESET_BESTAETIGUNG_MS = 10000;

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
    /** Zeilen, deren Rücknahme nach dem Markieren kurz gesperrt ist (Key → bis). */
    private ruecknahmeGesperrtBis = new Map<string, number>();
    /** Minute des letzten Plan-Renderns – die Fälligkeit ändert sich minütlich. */
    private letzteFaelligkeitsMinute = -1;

    constructor(db: Firestore) {
        this.view = new UebungsleitungView();
        this.firebaseService = new FirebaseService(db);
        this.db = db;
    }

    public async init() {
        const { params } = router.parseHash();
        this.uebungId = params[0] ?? null;

        if (!this.uebungId) {
            this.view.showLadefehler("Im Link fehlt die Übungs-ID. Öffne die Übungsleitung über den Link aus dem Generator oder über die Liste der gespeicherten Übungen.");
            return;
        }

        try {
            this.uebung = await this.firebaseService.getUebung(this.uebungId);
        } catch (error) {
            console.error("Übung konnte nicht geladen werden", error);
            this.view.showLadefehler(
                "Die Übung konnte nicht geladen werden – vermutlich gibt es gerade keine Verbindung. Prüfe das Netz und lade die Seite neu. Der ausgedruckte Nachrichtenplan bleibt die Rückfallebene.",
                this.uebungId
            );
            return;
        }
        if (!this.uebung) {
            this.view.showLadefehler(
                "Übung nicht gefunden. Prüfe den Link – vielleicht ist er abgeschnitten, vertippt oder die Übung wurde gelöscht.",
                this.uebungId
            );
            return;
        }

        store.setState({ aktuelleUebung: this.uebung, aktuelleUebungId: this.uebungId });
        this.storage = loadUebungsleitungStorage(this.uebungId);
        this.updateFooterInfo();

        // Initial Render
        this.view.renderMeta(this.uebung, this.uebungId);
        this.renderTeilnehmer();
        this.renderNachrichten();

        // Bind Events
        this.view.bindMetaEvents(
            () => this.exportPdf(),
            () => this.resetData(),
            () => this.exportTeilnehmerUebersicht()
        );

        this.view.bindTeilnehmerEvents({
            onAnmelden: name => this.markAngemeldet(name),
            onAnmeldungZuruecknehmen: name => this.anmeldungZuruecknehmen(name),
            onLoesungswort: (name, val) => this.updateLoesungswort(name, val),
            onStaerke: (name, idx, val) => this.updateStaerke(name, idx, val),
            onNotiz: (name, val) => this.updateNotiz(name, val),
            onToggleDetails: () => this.toggleStaerkeDetails(),
            onDownloadDebrief: name => this.downloadTeilnehmerDebrief(name)
        });

        this.view.bindNachrichtenEvents({
            onAbgesetzt: (sender, nr) => this.markNachrichtAbgesetzt(sender, nr),
            onReset: (sender, nr) => this.resetNachricht(sender, nr),
            onZeitNachtragen: (sender, nr, hhmm) => this.zeitNachtragen(sender, nr, hhmm),
            onNotiz: (sender, nr, val) => this.updateNachrichtNotiz(sender, nr, val),
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
            onGemeldeteBestaetigen: () => this.gemeldeteBestaetigen(),
            onToggleHide: val => this.setHideAbgesetzt(val)
        });

        this.startLiveSync();
        this.view.setResetModus(Boolean(this.liveStatus?.enabled));
        this.initCockpit();
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
        this.view.bindCockpitEvents(
            value => this.setCockpitBasis(value),
            () => {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2, "0");
                const mm = String(now.getMinutes()).padStart(2, "0");
                const value = `${hh}:${mm}`;
                this.view.setCockpitBasisInputValue(value);
                this.setCockpitBasis(value);
            },
            value => {
                this.view.setCockpitBasisInputValue(value);
                this.setCockpitBasis(value);
            },
            () => this.view.scrollZuPlanZustand("ueberfaellig")
        );
        this.updateCockpit();
        this.cockpitInterval = setInterval(() => this.tickCockpit(), 1000);
        // Eigener Aufräum-Hook: der Listener aus startLiveSync fehlt, wenn der
        // Live-Sync deaktiviert ist – der Ticker darf trotzdem nicht weiterlaufen.
        window.addEventListener("hashchange", () => {
            if (this.cockpitInterval !== null) {
                clearInterval(this.cockpitInterval);
                this.cockpitInterval = null;
            }
        }, { once: true });
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

    /** Vorschlag für die Basis: geplanter Beginn aus dem Generator, sonst früheste Teilnehmer-Basis. */
    private basisVorschlag(): { basis: string; quelle: "plan" | "teilnehmer" } | null {
        const beginn = this.uebung?.fuehrungsstelle?.beginn;
        if (beginn && parseHHMMtoMs(beginn) !== null) {
            return { basis: beginn, quelle: "plan" };
        }
        const abgeleitet = fruehesteBasis(this.teilnehmerLiveDocs.map(doc => doc.xZeitBasis));
        return abgeleitet ? { basis: abgeleitet, quelle: "teilnehmer" } : null;
    }

    /** Rollen, die mit einer anderen Basis laufen als der verbindlichen. */
    private abweichendeBasen(basis: string | null): string[] {
        return this.teilnehmerLiveDocs
            .filter(doc => doc.xZeitBasis && doc.xZeitBasis !== basis)
            .map(doc => `${doc.teilnehmer} (${doc.xZeitBasis})`)
            .sort();
    }

    private updateCockpit(): void {
        if (!this.uebung) {
            return;
        }
        const now = new Date();
        const uhrzeit = [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map(v => String(v).padStart(2, "0"))
            .join(":");

        const alleNachrichten = Object.values(this.uebung.nachrichten ?? {}).flat();
        const effektiv = this.buildEffektivenStatus();
        let ist = 0;
        Object.entries(this.uebung.nachrichten ?? {}).forEach(([sender, msgs]) => {
            msgs.forEach(msg => {
                if (effektiv[statusKey(sender, msg.id)]?.erledigtUm) {
                    ist++;
                }
            });
        });

        const basis = this.effektiveXZeitBasis();
        const basisMs = basis ? parseHHMMtoMs(basis, now) : null;
        const laufzeitMs = basisMs !== null ? now.getTime() - basisMs : null;
        const soll = basisMs !== null
            ? berechneSollFortschritt(alleNachrichten, basisMs, now.getTime())
            : null;

        const vorschlag = this.basisVorschlag();
        let basisHinweis = "Noch keine verbindliche X-Zeit-Basis – setze sie hier, die Teilnehmer übernehmen sie.";
        if (basis) {
            basisHinweis = `Basis ${basis} von der Übungsleitung gesetzt – gilt für alle Teilnehmer.`;
        } else if (vorschlag?.quelle === "plan") {
            basisHinweis = `Geplanter Übungsbeginn laut Generator: ${vorschlag.basis}. Erst mit „Übernehmen“ verbindlich.`;
        } else if (vorschlag?.quelle === "teilnehmer") {
            basisHinweis = `Ein Rollenspieler hat selbst ${vorschlag.basis} gesetzt – nicht übernommen.`;
        }
        const vorschlagAnbieten = vorschlag && vorschlag.basis !== basis ? vorschlag.basis : null;

        this.view.updateCockpit({
            uhrzeit,
            laufzeitMs,
            ist,
            gesamt: alleNachrichten.length,
            soll,
            basisHinweis,
            vorschlag: vorschlagAnbieten,
            abweichungen: this.abweichendeBasen(basis)
        });
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
            if (!remote || !this.storage) {
                return;
            }
            const vorher = this.storage.xZeitBasis;
            const { merged, changed } = mergeLeitungPublicLiveDoc(this.storage, remote);
            if (!changed) {
                return;
            }
            this.storage = merged;
            saveUebungsleitungStorage(this.storage);
            if (this.storage.xZeitBasis !== vorher) {
                this.view.setCockpitBasisInputValue(this.storage.xZeitBasis ?? "");
                this.updateCockpit();
            }
            this.renderTeilnehmer();
            this.renderNachrichten();
        });

        live.subscribeLeitungInternal(remote => {
            if (!remote || !this.storage) {
                return;
            }
            const { merged, changed } = mergeLeitungLiveDoc(this.storage, remote);
            if (!changed) {
                return;
            }
            this.storage = merged;
            saveUebungsleitungStorage(this.storage);
            this.renderTeilnehmer();
            this.renderNachrichten();
        });

        this.publishLeitungStatus();

        const onHashChange = () => this.dispose();
        window.addEventListener("hashchange", onHashChange, { once: true });
        this.disposeListener = () => window.removeEventListener("hashchange", onHashChange);
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
        if (this.cockpitInterval !== null) {
            clearInterval(this.cockpitInterval);
            this.cockpitInterval = null;
        }
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
        this.view.renderTeilnehmerListe(
            this.uebung,
            this.storage.teilnehmer,
            this.showStaerkeDetails,
            this.buildFortschritt(),
            { anmeldung: this.buildAnmeldungen() }
        );
        restoreFieldFocus(focusSnapshot);
    }

    /** Fortschritt je Teilnehmer aus Live-Meldungen und Bestätigungen der Leitung. */
    private buildFortschritt(): Record<string, TeilnehmerFortschritt> {
        if (!this.uebung) {
            return {};
        }
        const nachrichtenProTeilnehmer = Object.entries(this.uebung.nachrichten ?? {})
            .reduce<Record<string, number>>((acc, [sender, msgs]) => {
                acc[sender] = msgs.length;
                return acc;
            }, {});
        return buildTeilnehmerFortschritt(
            this.uebung.teilnehmerListe ?? [],
            nachrichtenProTeilnehmer,
            this.teilnehmerLiveDocs,
            this.storage?.nachrichten ?? {}
        );
    }

    /** Anmeldung je Teilnehmer – aus Tabelle, Anmelde-Funkspruch oder Selbstmeldung. */
    private buildAnmeldungen(): Record<string, AnmeldeZustand> {
        if (!this.uebung || !this.storage) {
            return {};
        }
        const effektiv = this.buildEffektivenStatus();
        return (this.uebung.teilnehmerListe ?? []).reduce<Record<string, AnmeldeZustand>>((acc, name) => {
            const key = anmeldeNachrichtKey(this.uebung as FunkUebung, name);
            acc[name] = anmeldeZustand(this.storage?.teilnehmer[name], key ? effektiv[key] : undefined);
            return acc;
        }, {});
    }

    /**
     * Bestätigungen der Leitung und Selbstmeldungen der Teilnehmer zusammengeführt.
     * Grundlage für Fortschritt, ETA, Tempo, Funklast, Heatmap und Timeline.
     */
    private buildEffektivenStatus(): Record<string, EffektiverNachrichtenStatus> {
        return buildEffektiveNachrichtenStatus(this.storage?.nachrichten ?? {}, this.teilnehmerLiveDocs);
    }

    /** Alle Nachrichten als Plan: stabil sortiert und fortlaufend nummeriert. */
    private buildPlan(): FlattenedNachricht[] {
        if (!this.uebung) {
            return [];
        }
        const nachrichten: FlattenedNachricht[] = [];
        Object.entries(this.uebung.nachrichten ?? {}).forEach(([sender, msgs]) => {
            msgs.forEach(msg => {
                nachrichten.push({
                    nr: msg.id,
                    sender,
                    empfaenger: msg.empfaenger,
                    text: msg.nachricht,
                    ...(msg.xZeitSlot !== undefined ? { xZeitSlot: msg.xZeitSlot } : {}),
                    ...(msg.art !== undefined ? { art: msg.art } : {}),
                    ...(msg.szenarioNr !== undefined ? { szenarioNr: msg.szenarioNr } : {}),
                    ...(msg.weg !== undefined ? { weg: msg.weg } : {}),
                    ...(msg.meldeart !== undefined ? { meldeart: msg.meldeart } : {}),
                    ...(msg.betreff !== undefined ? { betreff: msg.betreff } : {}),
                    ...(msg.erwartung !== undefined ? { erwartung: msg.erwartung } : {})
                });
            });
        });
        return vergibPlanNummern(sortiereNachrichtenplan(nachrichten));
    }

    /** Fälligkeit je offener Zeile – nur im X-Zeit-Modus mit verbindlicher Basis. */
    private buildFaelligkeit(
        nachrichten: FlattenedNachricht[],
        effektiv: Record<string, EffektiverNachrichtenStatus>,
        now: Date
    ): Record<string, Faelligkeit> {
        const basis = this.effektiveXZeitBasis();
        if (this.uebung?.spielModus !== "xZeit" || !basis) {
            return {};
        }
        const basisMs = parseHHMMtoMs(basis, now);
        if (basisMs === null) {
            return {};
        }
        const fenster = faelligFensterMs(this.uebung.xZeitIntervallMinuten);
        return nachrichten.reduce<Record<string, Faelligkeit>>((acc, n) => {
            const key = statusKey(n.sender, n.nr);
            if (n.xZeitSlot === undefined || effektiv[key]?.erledigtUm) {
                return acc;
            }
            acc[key] = berechneFaelligkeit(n.xZeitSlot, basisMs, now.getTime(), fenster);
            return acc;
        }, {});
    }

    /** Soll-Uhrzeit je Zeile, sobald eine verbindliche Basis gesetzt ist. */
    private buildSollUhrzeiten(nachrichten: FlattenedNachricht[], now: Date): Record<string, string> {
        const basis = this.effektiveXZeitBasis();
        const basisMs = basis ? parseHHMMtoMs(basis, now) : null;
        if (this.uebung?.spielModus !== "xZeit" || basisMs === null) {
            return {};
        }
        return nachrichten.reduce<Record<string, string>>((acc, n) => {
            if (n.xZeitSlot !== undefined) {
                acc[statusKey(n.sender, n.nr)] = formatUhrzeit(basisMs + n.xZeitSlot * 60000);
            }
            return acc;
        }, {});
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

        const nachrichten = this.buildPlan();

        // Fortschritt zählt jede Nachricht, die Teilnehmer oder Leitung markiert hat.
        const effektiv = this.buildEffektivenStatus();
        let done = 0;
        let nurGemeldet = 0;
        nachrichten.forEach(n => {
            const status = effektiv[statusKey(n.sender, n.nr)];
            if (!status?.erledigtUm) {
                return;
            }
            done++;
            if (!status.abgesetztUm) {
                nurGemeldet++;
            }
        });

        const etaLabel = this.calculateEtaLabel(nachrichten, effektiv);
        this.view.updateProgress(nachrichten.length, done, etaLabel, nurGemeldet);
        const sentNachrichten = this.collectSentNachrichten(nachrichten, effektiv);
        const heatmapBins = this.buildHeatmapBins(sentNachrichten);
        this.view.updateOperationalStats(
            this.calculateTempoLabel(sentNachrichten),
            this.calculateLoadLabel(sentNachrichten),
            this.calculateHeatmapLabel(heatmapBins)
        );

        const faelligkeit = this.buildFaelligkeit(nachrichten, effektiv, now);
        const nowMs = now.getTime();
        const gesperrt = new Set<string>();
        this.ruecknahmeGesperrtBis.forEach((bis, key) => {
            if (bis > nowMs) {
                gesperrt.add(key);
            } else {
                this.ruecknahmeGesperrtBis.delete(key);
            }
        });

        this.view.renderNachrichtenListe({
            nachrichten,
            nachrichtenStatus: effektiv,
            hideAbgesetzt: this.hideAbgesetzt,
            senderFilter: this.senderFilter,
            empfaengerFilter: this.empfaengerFilter,
            textFilter: this.textFilter,
            faelligkeit,
            sollUhrzeit: this.buildSollUhrzeiten(nachrichten, now),
            ruecknahmeGesperrt: gesperrt
        });
        this.view.renderLage({
            teilnehmer: lageJeTeilnehmer(nachrichten, effektiv),
            naechste: naechsteOffene(nachrichten, effektiv, 3).map(n => {
                const key = statusKey(n.sender, n.nr);
                const f = faelligkeit[key];
                return {
                    planNr: n.planNr ?? n.nr,
                    sender: n.sender,
                    empfaenger: n.empfaenger,
                    ...(f ? { faelligkeit: f } : {})
                };
            }),
            zuBestaetigen: nurGemeldet,
            hideAbgesetzt: this.hideAbgesetzt,
            ueberfaellig: Object.values(faelligkeit).filter(f => f.zustand === "ueberfaellig").length
        });
        this.view.updateHeatmap(heatmapBins);
        this.view.updateTeilnehmerTimeline(this.buildTeilnehmerTimeline(nachrichten, effektiv));

        restoreFieldFocus(focusSnapshot);
    }

    /**
     * Ende der Übung. Im X-Zeit-Modus mit Basis ist der Zeitplan die bessere
     * Grundlage; sonst eine Hochrechnung, aber erst ab einer Mindeststichprobe
     * (THW-Review command P2-1).
     */
    private calculateEtaLabel(
        nachrichten: FlattenedNachricht[],
        effektiv: Record<string, EffektiverNachrichtenStatus> = this.buildEffektivenStatus()
    ): string {
        if (!this.storage || nachrichten.length === 0) {
            return "ETA: –";
        }

        const offen = nachrichten.filter(n => !effektiv[statusKey(n.sender, n.nr)]?.erledigtUm).length;
        const basis = this.effektiveXZeitBasis();
        const basisMs = basis ? parseHHMMtoMs(basis) : null;
        const slots = nachrichten.map(n => n.xZeitSlot).filter((s): s is number => s !== undefined);
        if (this.uebung?.spielModus === "xZeit" && basisMs !== null && slots.length && offen > 0) {
            return `Ende laut Plan: ${formatUhrzeit(basisMs + Math.max(...slots) * 60000)} (noch ${offen} offen)`;
        }

        const zeitstempel = nachrichten
            .map(n => effektiv[statusKey(n.sender, n.nr)])
            .filter(s => s?.erledigtUm && !(s.nachgetragen && !s.gemeldetUm))
            .map(s => Date.parse(s?.erledigtUm ?? ""));
        const eta = schaetzeEnde(zeitstempel, nachrichten.length, offen);
        if (eta.etaMs === null) {
            return eta.stichprobe > 0 ? "ETA: – (zu wenig Daten)" : "ETA: –";
        }
        if (eta.grund === "fertig") {
            return `ETA: ${formatNatoDate(eta.etaMs)} (Rest: 0 min)`;
        }
        return `ETA: ${formatNatoDate(eta.etaMs)} (Rest: ${eta.restMinuten} min, aus ${eta.stichprobe} Nachrichten)`;
    }

    private collectSentNachrichten(
        nachrichten: FlattenedNachricht[],
        effektiv: Record<string, EffektiverNachrichtenStatus> = this.buildEffektivenStatus()
    ): SentNachricht[] {
        if (!this.storage) {
            return [];
        }

        return nachrichten
            .map(n => {
                const status = effektiv[statusKey(n.sender, n.nr)];
                const iso = status?.erledigtUm ?? "";
                return {
                    sender: n.sender,
                    empfaenger: n.empfaenger,
                    ts: Date.parse(iso),
                    ...(status?.nachgetragen && !status.gemeldetUm ? { nachgetragen: true } : {})
                };
            })
            .filter(n => Number.isFinite(n.ts))
            .sort((a, b) => a.ts - b.ts);
    }

    private calculateTempoLabel(sentNachrichten: SentNachricht[]): string {
        const echtzeit = sentNachrichten.filter(n => !n.nachgetragen);
        if (echtzeit.length < 3) {
            return "Tempo: –";
        }

        const sample = echtzeit.slice(-6);
        const first = sample[0];
        const last = sample[sample.length - 1];
        if (!first || !last) {
            return "Tempo: –";
        }

        const avgIntervalMs = (last.ts - first.ts) / (sample.length - 1);
        if (avgIntervalMs <= 0) {
            return "Tempo: –";
        }

        const perMinute = 60000 / avgIntervalMs;
        return `Tempo: ${perMinute.toFixed(1).replace(".", ",")} N/min`;
    }

    private calculateLoadLabel(sentNachrichten: SentNachricht[]): string {
        if (!sentNachrichten.length) {
            return "Funklast: –";
        }

        const senderCounts = new Map<string, number>();
        const receiverCounts = new Map<string, number>();
        const allTeilnehmer = this.uebung?.teilnehmerListe ?? [];

        sentNachrichten.forEach(n => {
            senderCounts.set(n.sender, (senderCounts.get(n.sender) ?? 0) + 1);

            const targets = n.empfaenger.includes("Alle")
                ? allTeilnehmer
                : Array.from(new Set(n.empfaenger));
            targets.forEach(target => {
                receiverCounts.set(target, (receiverCounts.get(target) ?? 0) + 1);
            });
        });

        const topSender = this.getTopEntry(senderCounts);
        const topReceiver = this.getTopEntry(receiverCounts);
        if (!topSender && !topReceiver) {
            return "Funklast: –";
        }
        const senderText = topSender ? `S ${topSender.name} (${topSender.count})` : "S –";
        const receiverText = topReceiver ? `E ${topReceiver.name} (${topReceiver.count})` : "E –";
        return `Funklast: ${senderText} | ${receiverText}`;
    }

    private calculateHeatmapLabel(bins: { bucket: number; count: number }[]): string {
        if (!bins.length) {
            return "Heatmap 5m: –";
        }

        const lastBins = bins
            .slice(-6)
            .map(bin => `${this.formatClock(bin.bucket)}=${bin.count}`);

        return `Heatmap 5m: ${lastBins.join(" | ")}`;
    }

    private buildHeatmapBins(sentNachrichten: SentNachricht[]): { bucket: number; count: number }[] {
        if (!sentNachrichten.length) {
            return [];
        }

        const binMs = 5 * 60 * 1000;
        const counts = new Map<number, number>();
        sentNachrichten.forEach(n => {
            const bucket = Math.floor(n.ts / binMs) * binMs;
            counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
        });

        const sortedBuckets = Array.from(counts.keys()).sort((a, b) => a - b);
        const first = sortedBuckets[0];
        const last = sortedBuckets[sortedBuckets.length - 1];
        if (first === undefined || last === undefined) {
            return [];
        }

        const fullBins: { bucket: number; count: number }[] = [];
        for (let bucket = first; bucket <= last; bucket += binMs) {
            fullBins.push({ bucket, count: counts.get(bucket) ?? 0 });
        }

        return fullBins.slice(-24);
    }

    private buildTeilnehmerTimeline(
        nachrichten: FlattenedNachricht[],
        effektiv: Record<string, EffektiverNachrichtenStatus> = this.buildEffektivenStatus()
    ): { teilnehmer: string; events: TimelineEvent[] }[] {
        if (!this.storage || !this.uebung) {
            return [];
        }

        const participants = this.uebung.teilnehmerListe ?? [];
        const timeline = new Map<string, TimelineEvent[]>();
        participants.forEach(name => timeline.set(name, []));

        nachrichten.forEach(n => {
            const ts = Date.parse(effektiv[statusKey(n.sender, n.nr)]?.erledigtUm ?? "");
            if (!Number.isFinite(ts)) {
                return;
            }

            if (!timeline.has(n.sender)) {
                timeline.set(n.sender, []);
            }
            timeline.get(n.sender)?.push({ ts, type: "S", nr: n.nr });

            const targets = n.empfaenger.includes("Alle")
                ? participants
                : Array.from(new Set(n.empfaenger));
            targets.forEach(target => {
                if (!timeline.has(target)) {
                    timeline.set(target, []);
                }
                timeline.get(target)?.push({ ts, type: "E", nr: n.nr });
            });
        });

        return Array.from(timeline.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([teilnehmer, events]) => ({
                teilnehmer,
                events: events.slice(-20)
            }));
    }

    private getTopEntry(values: Map<string, number>): { name: string; count: number } | null {
        let topName = "";
        let topCount = 0;
        values.forEach((count, name) => {
            if (count > topCount || (count === topCount && name.localeCompare(topName) < 0)) {
                topCount = count;
                topName = name;
            }
        });

        return topName ? { name: topName, count: topCount } : null;
    }

    private formatClock(ts: number): string {
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    }

    // --- Actions ---

    /** Holt den Teilnehmer-Eintrag und stempelt ihn für den Live-Sync-Merge. */
    private touchTeilnehmer(name: string): TeilnehmerStatus | null {
        if (!this.storage) {
            return null;
        }
        const entry = this.storage.teilnehmer[name] || {};
        entry.geaendertUm = new Date().toISOString();
        this.storage.teilnehmer[name] = entry;
        return entry;
    }

    private anmeldeKey(name: string): string | null {
        return this.uebung ? anmeldeNachrichtKey(this.uebung, name) : null;
    }

    /**
     * „Anmeldung erhalten“ und der Anmelde-Funkspruch sind ein Vorgang: Wer
     * angemeldet wird, dessen Anmelde-Funkspruch gilt als abgesetzt.
     */
    private markAngemeldet(name: string) {
        const entry = this.touchTeilnehmer(name);
        if (!entry || !this.storage) {
            return;
        }
        const jetzt = new Date().toISOString();
        entry.angemeldetUm = jetzt;
        const key = this.anmeldeKey(name);
        if (key && !this.storage.nachrichten[key]?.abgesetztUm) {
            const status = this.storage.nachrichten[key] || {};
            status.abgesetztUm = jetzt;
            status.statusGeaendertUm = jetzt;
            delete status.nachgetragen;
            this.storage.nachrichten[key] = status;
            this.sperreRuecknahme(key);
        }
        this.save();
        this.renderTeilnehmer();
        this.renderNachrichten();
    }

    /**
     * Nimmt eine versehentlich gesetzte Anmeldung zurück – samt der Bestätigung
     * des Anmelde-Funkspruchs – und bietet ein Rückgängig an.
     */
    private anmeldungZuruecknehmen(name: string) {
        if (!this.storage) {
            return;
        }
        const key = this.anmeldeKey(name);
        const vorherTeilnehmer: TeilnehmerStatus = { ...(this.storage.teilnehmer[name] ?? {}) };
        const vorherNachricht: NachrichtenStatus | undefined = key && this.storage.nachrichten[key]
            ? { ...this.storage.nachrichten[key] }
            : undefined;
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        delete entry.angemeldetUm;
        if (key) {
            this.loescheAbgesetzt(key);
        }
        this.save();
        this.renderTeilnehmer();
        this.renderNachrichten();
        this.view.zeigeRueckgaengig(`Anmeldung von ${name} zurückgenommen.`, () => {
            if (!this.storage) {
                return;
            }
            const jetzt = new Date().toISOString();
            this.storage.teilnehmer[name] = { ...vorherTeilnehmer, geaendertUm: jetzt };
            if (key && vorherNachricht) {
                this.storage.nachrichten[key] = { ...vorherNachricht, statusGeaendertUm: jetzt };
            }
            this.save();
            this.renderTeilnehmer();
            this.renderNachrichten();
        });
    }

    private updateLoesungswort(name: string, val: string) {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.loesungswortGesendet = val;
        this.debouncedSave();
    }

    private updateStaerke(name: string, idx: number, val: string) {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.teilstaerken = entry.teilstaerken || [];
        entry.teilstaerken[idx] = val;
        this.debouncedSave();
    }

    private updateNotiz(name: string, val: string) {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.notizen = val;
        this.debouncedSave();
    }

    private toggleStaerkeDetails() {
        this.showStaerkeDetails = !this.showStaerkeDetails;
        this.renderTeilnehmer();
    }

    /**
     * Debrief-Daten: neben den Bestätigungen der Leitung auch die
     * Selbstmeldungen der Teilnehmer (`gemeldetUm`) und die Anmeldung aus dem
     * Anmelde-Funkspruch – getrennt ausgewiesen (THW-Review workflow F3).
     */
    private buildDebriefStorage(): UebungsleitungStorage | null {
        if (!this.storage) {
            return null;
        }
        const anmeldungen = this.buildAnmeldungen();
        const teilnehmer: Record<string, TeilnehmerStatus> = { ...this.storage.teilnehmer };
        Object.entries(anmeldungen).forEach(([name, zustand]) => {
            if (zustand.angemeldetUm) {
                teilnehmer[name] = { ...(teilnehmer[name] ?? {}), angemeldetUm: zustand.angemeldetUm };
            }
        });
        return { ...this.storage, teilnehmer, nachrichten: this.buildEffektivenStatus() };
    }

    private async downloadTeilnehmerDebrief(name: string) {
        const debriefStorage = this.buildDebriefStorage();
        if (!this.uebung || !debriefStorage) {
            return;
        }
        try {
            const pdfGenerator = await ladePdfGenerator();
            const blob = await pdfGenerator.generateTeilnehmerDebriefPdfBlob(this.uebung, debriefStorage, name);
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Debrief_${pdfGenerator.sanitizeFileName(name)}_${pdfGenerator.sanitizeFileName(this.uebung.name)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            uiFeedback.success(`Debriefing PDF für ${name} erstellt.`);
        } catch {
            uiFeedback.error(`Debriefing PDF für ${name} konnte nicht erstellt werden.`);
        }
    }

    private sperreRuecknahme(key: string): void {
        this.ruecknahmeGesperrtBis.set(key, Date.now() + RUECKNAHME_SPERRE_MS);
        // Nach Ablauf neu zeichnen, damit „zurücknehmen“ erscheint.
        setTimeout(() => this.renderNachrichten(), RUECKNAHME_SPERRE_MS + 50);
    }

    private istRuecknahmeGesperrt(key: string): boolean {
        return (this.ruecknahmeGesperrtBis.get(key) ?? 0) > Date.now();
    }

    private markNachrichtAbgesetzt(sender: string, nr: number) {
        if (!this.storage) {
            return;
        }
        const key = statusKey(sender, nr);
        const entry = this.storage.nachrichten[key] || {};
        if (entry.abgesetztUm) {
            // Doppelklick: schon abgesetzt, nichts umschalten.
            return;
        }
        const now = new Date().toISOString();
        entry.abgesetztUm = now;
        entry.statusGeaendertUm = now;
        delete entry.nachgetragen;
        this.storage.nachrichten[key] = entry;
        this.sperreRuecknahme(key);
        if (key === this.anmeldeKey(sender) && !this.storage.teilnehmer[sender]?.angemeldetUm) {
            const teilnehmer = this.touchTeilnehmer(sender);
            if (teilnehmer) {
                teilnehmer.angemeldetUm = now;
            }
            this.renderTeilnehmer();
        }
        this.save();
        this.renderNachrichten();
    }

    private loescheAbgesetzt(key: string): void {
        const entry = this.storage?.nachrichten[key];
        if (entry) {
            delete entry.abgesetztUm;
            delete entry.nachgetragen;
            // Zeitstempel bleibt gesetzt, damit das Zurücksetzen den Merge gewinnt.
            entry.statusGeaendertUm = new Date().toISOString();
        }
    }

    /**
     * Nimmt „abgesetzt“ zurück. Gesperrt direkt nach dem Markieren; danach mit
     * Rückgängig, das den ursprünglichen Zeitpunkt wiederherstellt.
     */
    private resetNachricht(sender: string, nr: number) {
        if (!this.storage) {
            return;
        }
        const key = statusKey(sender, nr);
        if (this.istRuecknahmeGesperrt(key)) {
            return;
        }
        const vorher: NachrichtenStatus | undefined = this.storage.nachrichten[key]
            ? { ...this.storage.nachrichten[key] }
            : undefined;
        this.loescheAbgesetzt(key);
        const istAnmeldung = key === this.anmeldeKey(sender);
        const vorherAngemeldet = this.storage.teilnehmer[sender]?.angemeldetUm;
        if (istAnmeldung && vorherAngemeldet) {
            const teilnehmer = this.touchTeilnehmer(sender);
            if (teilnehmer) {
                delete teilnehmer.angemeldetUm;
            }
            this.renderTeilnehmer();
        }
        this.save();
        this.renderNachrichten();
        if (!vorher?.abgesetztUm) {
            return;
        }
        this.view.zeigeRueckgaengig(`„Abgesetzt“ für ${sender} Nr. ${nr} zurückgenommen.`, () => {
            if (!this.storage) {
                return;
            }
            const jetzt = new Date().toISOString();
            this.storage.nachrichten[key] = { ...this.storage.nachrichten[key], ...vorher, statusGeaendertUm: jetzt };
            if (istAnmeldung && vorherAngemeldet) {
                const teilnehmer = this.touchTeilnehmer(sender);
                if (teilnehmer) {
                    teilnehmer.angemeldetUm = vorherAngemeldet;
                }
                this.renderTeilnehmer();
            }
            this.save();
            this.renderNachrichten();
        });
    }

    /**
     * Papier-Nachtrag: setzt bzw. korrigiert die Absetzzeit von Hand (HH:MM).
     * Solche Zeiten sind gekennzeichnet und zählen nicht fürs Tempo.
     */
    private zeitNachtragen(sender: string, nr: number, hhmm: string) {
        if (!this.storage) {
            return;
        }
        const key = statusKey(sender, nr);
        const entry = this.storage.nachrichten[key] || {};
        const iso = uhrzeitZuIso(hhmm, entry.abgesetztUm);
        if (!iso) {
            uiFeedback.error("Bitte die Uhrzeit als HH:MM eintragen, z. B. 19:05.");
            return;
        }
        entry.abgesetztUm = iso;
        entry.nachgetragen = true;
        entry.statusGeaendertUm = new Date().toISOString();
        this.storage.nachrichten[key] = entry;
        if (key === this.anmeldeKey(sender) && !this.storage.teilnehmer[sender]?.angemeldetUm) {
            const teilnehmer = this.touchTeilnehmer(sender);
            if (teilnehmer) {
                teilnehmer.angemeldetUm = iso;
            }
            this.renderTeilnehmer();
        }
        this.save();
        this.renderNachrichten();
    }

    /**
     * Übernimmt alle vom Teilnehmer gemeldeten, noch unbestätigten Nachrichten
     * mit dem Zeitpunkt der Teilnehmer-Meldung.
     */
    private gemeldeteBestaetigen() {
        if (!this.storage) {
            return;
        }
        const jetzt = new Date().toISOString();
        let anzahl = 0;
        Object.entries(this.buildEffektivenStatus()).forEach(([key, status]) => {
            if (!status.gemeldetUm || status.abgesetztUm || !this.storage) {
                return;
            }
            const entry = this.storage.nachrichten[key] || {};
            entry.abgesetztUm = status.gemeldetUm;
            entry.statusGeaendertUm = jetzt;
            this.storage.nachrichten[key] = entry;
            anzahl++;
        });
        if (!anzahl) {
            return;
        }
        this.save();
        this.renderTeilnehmer();
        this.renderNachrichten();
        uiFeedback.success(`${anzahl} gemeldete Nachricht${anzahl === 1 ? "" : "en"} bestätigt.`);
    }

    private updateNachrichtNotiz(sender: string, nr: number, val: string) {
        this.persistNachrichtNotiz(sender, nr, val);
    }

    private persistNachrichtNotiz(sender: string, nr: number, val: string) {
        if (!this.storage) {
            return;
        }
        const key = `${sender}__${nr}`;
        const entry = this.storage.nachrichten[key] || {};
        entry.notiz = val;
        entry.notizGeaendertUm = new Date().toISOString();
        this.storage.nachrichten[key] = entry;
        this.debouncedSave();
    }

    private async exportPdf() {
        if (!this.uebung || !this.storage) {
            return;
        }

        try {
            const { jsPDF } = await import("jspdf");
            const { Uebungsleitung } = await import("../pdf/Uebungsleitung");

            const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            const pdfDoc = new Uebungsleitung(this.uebung, pdf, this.storage);
            pdfDoc.draw();

            const filename = `Uebungsleitung_${this.uebung.name}_${this.uebung.id}.pdf`.replace(/\s+/g, "_");
            pdf.save(filename);
        } catch (err) {
            console.error(err);
            uiFeedback.error("Fehler beim PDF Export");
        }
    }

    private async exportTeilnehmerUebersicht() {
        if (!this.uebung) {
            return;
        }

        try {
            const pdfGenerator = await ladePdfGenerator();
            await pdfGenerator.generateAllTeilnehmerUebersichtPrint(this.uebung);
            uiFeedback.success("PDF mit allen Teilnehmer-Übersichten erstellt.");
        } catch (err) {
            console.error(err);
            uiFeedback.error("Fehler beim PDF Export");
        }
    }

    /** Was beim Zurücksetzen verloren geht – für eine konkrete Rückfrage. */
    private zaehleVerlust(): { abgesetzt: number; notizen: number; anmeldungen: number } {
        const nachrichten = Object.values(this.storage?.nachrichten ?? {});
        const teilnehmer = Object.values(this.storage?.teilnehmer ?? {});
        return {
            abgesetzt: nachrichten.filter(n => n.abgesetztUm).length,
            notizen: nachrichten.filter(n => n.notiz).length + teilnehmer.filter(t => t.notizen).length,
            anmeldungen: teilnehmer.filter(t => t.angemeldetUm).length
        };
    }

    private resetData() {
        const live = Boolean(this.liveStatus?.enabled);
        const zustand = this.liveStatus?.getState();
        if (live && (zustand === "offline" || zustand === "fehler")) {
            uiFeedback.error("Zurücksetzen für alle braucht eine Verbindung. Gerade ist keine da – es wurde nichts gelöscht.");
            return;
        }
        const verlust = this.zaehleVerlust();
        const umfang = `${verlust.abgesetzt} abgesetzte Nachrichten, ${verlust.notizen} Notizen und ${verlust.anmeldungen} Anmeldungen`;
        const message = live
            ? `Übungsstand für ALLE zurücksetzen?\n\nGelöscht werden ${umfang} – auf allen Leitungs-Arbeitsplätzen und bei allen Teilnehmern. Das lässt sich nicht rückgängig machen.\n\nTipp: Vorher „Übungsleitung als PDF“ sichern.`
            : `Daten der Übungsleitung auf diesem Gerät löschen?\n\nGelöscht werden ${umfang}. Das lässt sich nicht rückgängig machen.`;
        if (!uiFeedback.confirm(message)) {
            return;
        }
        void this.performReset();
    }

    /**
     * Setzt lokal und – falls aktiv – auch remote zurück. Remote werden dazu
     * Zurücksetz-Marker mit aktuellem Zeitstempel geschrieben; ein leeres Dokument
     * würde vom Last-Write-Wins-Merge nicht gewinnen. Ohne Bestätigung des
     * Servers wird lokal nichts gelöscht und nicht neu geladen.
     */
    private async performReset(): Promise<void> {
        if (!this.uebungId) {
            return;
        }
        if (this.liveStatus?.enabled && this.storage) {
            const now = new Date().toISOString();
            const nachrichten = Object.keys(this.storage.nachrichten).reduce<UebungsleitungStorage["nachrichten"]>(
                (acc, key) => {
                    acc[key] = { statusGeaendertUm: now, notiz: "", notizGeaendertUm: now };
                    return acc;
                },
                {}
            );
            const teilnehmer = Object.keys(this.storage.teilnehmer).reduce<UebungsleitungStorage["teilnehmer"]>(
                (acc, key) => {
                    acc[key] = { geaendertUm: now };
                    return acc;
                },
                {}
            );
            const cleared: UebungsleitungStorage = {
                ...this.storage,
                lastUpdated: now,
                nachrichten,
                teilnehmer
            };
            this.liveStatus.publishLeitungPublic(toLeitungPublicLiveDoc(cleared));
            this.liveStatus.publishLeitungInternal(toLeitungLiveDoc(cleared));
            const bestaetigt = await this.liveStatus.flush(RESET_BESTAETIGUNG_MS);
            if (!bestaetigt) {
                uiFeedback.error("Der Server hat das Zurücksetzen nicht bestätigt. Es wird nachgereicht, sobald wieder Verbindung besteht – lade die Seite bis dahin nicht neu.");
                return;
            }
        }
        localStorage.removeItem(`sprechfunk:uebungsleitung:${this.uebungId}`);
        window.location.reload();
    }

    private save() {
        if (this.storage) {
            saveUebungsleitungStorage(this.storage);
            this.publishLeitungStatus();
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
