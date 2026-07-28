import { loadUebungsleitungStorage, saveUebungsleitungStorage } from "../services/storage";
import { UebungsleitungView } from "./UebungsleitungView";
import { FirebaseService } from "../services/FirebaseService";
import { store } from "../state/store";
import { router } from "../core/router";
import { TeilnehmerStatus, UebungsleitungStorage } from "../types/Storage";
import type { Firestore } from "firebase/firestore";
import {FunkUebung} from "../models/FunkUebung";
import { uiFeedback } from "../core/UiFeedback";
import { debounce } from "../utils/debounce";
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

interface FlattenedNachricht {
    nr: number;
    sender: string;
    empfaenger: string[];
    text: string;
    xZeitSlot?: number;
}

interface SentNachricht {
    sender: string;
    empfaenger: string[];
    ts: number;
}

interface TimelineEvent {
    ts: number;
    type: "S" | "E";
    nr: number;
}

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
    private debouncedSaveNotiz = debounce((sender: string, nr: number, val: string) => {
        this.persistNachrichtNotiz(sender, nr, val);
    }, 220);
    private db: Firestore;
    private liveStatus: LiveStatusService | null = null;
    /** Zuletzt empfangene Selbstmeldungen der Teilnehmer. */
    private teilnehmerLiveDocs: TeilnehmerLiveDoc[] = [];
    private disposeListener: (() => void) | null = null;

    constructor(db: Firestore) {
        this.view = new UebungsleitungView();
        this.firebaseService = new FirebaseService(db);
        this.db = db;
    }

    public async init() {
        const { params } = router.parseHash();
        this.uebungId = params[0] ?? null;

        if (!this.uebungId) {
            // Error handling via View? Or simple alert/console for now.
            console.error("Keine Übungs-ID");
            return;
        }

        this.uebung = await this.firebaseService.getUebung(this.uebungId);
        if (!this.uebung) {
            console.error("Übung nicht gefunden");
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
            onLoesungswort: (name, val) => this.updateLoesungswort(name, val),
            onStaerke: (name, idx, val) => this.updateStaerke(name, idx, val),
            onNotiz: (name, val) => this.updateNotiz(name, val),
            onToggleDetails: () => this.toggleStaerkeDetails(),
            onDownloadDebrief: name => this.downloadTeilnehmerDebrief(name)
        });

        this.view.bindNachrichtenEvents({
            onAbgesetzt: (sender, nr) => this.markNachrichtAbgesetzt(sender, nr),
            onReset: (sender, nr) => this.resetNachricht(sender, nr),
            onNotiz: (sender, nr, val) => this.updateNachrichtNotiz(sender, nr, val),
            onFilterSender: val => {
                this.senderFilter = val; this.renderNachrichten(); 
            },
            onFilterEmpfaenger: val => {
                this.empfaengerFilter = val; this.renderNachrichten(); 
            },
            onToggleHide: val => {
                this.hideAbgesetzt = val; this.renderNachrichten(); 
            },
            onFilterText: val => {
                this.textFilter = val; this.debouncedRenderNachrichten();
            }
        });

        this.startLiveSync();
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

        live.onStateChange(state => this.view.updateLiveSyncState(state));

        live.subscribeAlleTeilnehmer(docs => {
            this.teilnehmerLiveDocs = docs;
            this.renderTeilnehmer();
            this.renderNachrichten();
        });

        live.subscribeLeitungPublic(remote => {
            if (!remote || !this.storage) {
                return;
            }
            const { merged, changed } = mergeLeitungPublicLiveDoc(this.storage, remote);
            if (!changed) {
                return;
            }
            this.storage = merged;
            saveUebungsleitungStorage(this.storage);
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
        this.view.renderTeilnehmerListe(
            this.uebung,
            this.storage.teilnehmer,
            this.showStaerkeDetails,
            this.buildFortschritt()
        );
    }

    /** Fortschritt je Teilnehmer aus den Live-Meldungen – Basis für Nachzügler-Erkennung. */
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
            this.teilnehmerLiveDocs
        );
    }

    /**
     * Bestätigungen der Leitung und Selbstmeldungen der Teilnehmer zusammengeführt.
     * Grundlage für Fortschritt, ETA, Tempo, Funklast, Heatmap und Timeline.
     */
    private buildEffektivenStatus(): Record<string, EffektiverNachrichtenStatus> {
        return buildEffektiveNachrichtenStatus(this.storage?.nachrichten ?? {}, this.teilnehmerLiveDocs);
    }

    private renderNachrichten() {
        if (!this.uebung || !this.storage) {
            return;
        }

        const activeEl = document.activeElement as HTMLInputElement | null;
        const shouldRestoreTextFilterFocus = activeEl?.id === "nachrichtenTextFilterInput";
        const caretPos = shouldRestoreTextFilterFocus ? (activeEl.selectionStart ?? this.textFilter.length) : null;
        
        // Build flat list
        const nachrichten: FlattenedNachricht[] = [];
        Object.entries(this.uebung.nachrichten).forEach(([sender, msgs]) => {
            msgs.forEach(msg => {
                nachrichten.push({
                    nr: msg.id,
                    sender,
                    empfaenger: msg.empfaenger,
                    text: msg.nachricht,
                    ...(msg.xZeitSlot !== undefined ? { xZeitSlot: msg.xZeitSlot } : {})
                });
            });
        });
        nachrichten.sort((a, b) => a.nr - b.nr);

        const storage = this.storage;
        if (!storage) {
            return;
        }

        // Fortschritt zählt jede Nachricht, die Teilnehmer oder Leitung markiert hat.
        const effektiv = this.buildEffektivenStatus();
        let done = 0;
        let nurGemeldet = 0;
        nachrichten.forEach(n => {
            const status = effektiv[`${n.sender}__${n.nr}`];
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

        this.view.renderNachrichtenListe({
            nachrichten,
            nachrichtenStatus: effektiv,
            hideAbgesetzt: this.hideAbgesetzt,
            senderFilter: this.senderFilter,
            empfaengerFilter: this.empfaengerFilter,
            textFilter: this.textFilter
        });
        this.view.updateHeatmap(heatmapBins);
        this.view.updateTeilnehmerTimeline(this.buildTeilnehmerTimeline(nachrichten, effektiv));

        if (shouldRestoreTextFilterFocus) {
            const input = document.getElementById("nachrichtenTextFilterInput") as HTMLInputElement | null;
            if (input) {
                input.focus({ preventScroll: true });
                const pos = Math.min(caretPos ?? input.value.length, input.value.length);
                input.setSelectionRange(pos, pos);
            }
        }
    }

    private calculateEtaLabel(
        nachrichten: FlattenedNachricht[],
        effektiv: Record<string, EffektiverNachrichtenStatus> = this.buildEffektivenStatus()
    ): string {
        if (!this.storage || nachrichten.length === 0) {
            return "ETA: –";
        }

        const sentTimestamps = nachrichten
            .map(n => effektiv[`${n.sender}__${n.nr}`]?.erledigtUm ?? "")
            .map(iso => Date.parse(iso))
            .filter(ts => Number.isFinite(ts))
            .sort((a, b) => a - b);

        if (sentTimestamps.length < 2) {
            return "ETA: –";
        }

        const first = sentTimestamps[0];
        const last = sentTimestamps[sentTimestamps.length - 1];
        if (first === undefined || last === undefined) {
            return "ETA: –";
        }
        const intervals = sentTimestamps.length - 1;
        const avgIntervalMs = (last - first) / intervals;
        if (avgIntervalMs <= 0) {
            return "ETA: –";
        }

        const remainingMessages = nachrichten.length - sentTimestamps.length;
        if (remainingMessages <= 0) {
            return `ETA: ${formatNatoDate(last)} (Rest: 0 min)`;
        }

        const remainingMs = Math.round(avgIntervalMs * remainingMessages);
        const remainingMinutes = Math.max(1, Math.round(remainingMs / 60000));
        const etaTs = last + remainingMs;
        return `ETA: ${formatNatoDate(etaTs)} (Rest: ${remainingMinutes} min)`;
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
                const iso = effektiv[`${n.sender}__${n.nr}`]?.erledigtUm ?? "";
                return {
                    sender: n.sender,
                    empfaenger: n.empfaenger,
                    ts: Date.parse(iso)
                };
            })
            .filter(n => Number.isFinite(n.ts))
            .sort((a, b) => a.ts - b.ts);
    }

    private calculateTempoLabel(sentNachrichten: SentNachricht[]): string {
        if (sentNachrichten.length < 2) {
            return "Tempo: –";
        }

        const sample = sentNachrichten.slice(-6);
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
            const ts = Date.parse(effektiv[`${n.sender}__${n.nr}`]?.erledigtUm ?? "");
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

    private markAngemeldet(name: string) {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.angemeldetUm = new Date().toISOString();
        this.save();
        this.renderTeilnehmer();
    }

    private updateLoesungswort(name: string, val: string) {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.loesungswortGesendet = val;
        this.save();
    }

    private updateStaerke(name: string, idx: number, val: string) {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.teilstaerken = entry.teilstaerken || [];
        entry.teilstaerken[idx] = val;
        this.save();
    }

    private updateNotiz(name: string, val: string) {
        const entry = this.touchTeilnehmer(name);
        if (!entry) {
            return;
        }
        entry.notizen = val;
        this.save();
    }

    private toggleStaerkeDetails() {
        this.showStaerkeDetails = !this.showStaerkeDetails;
        this.renderTeilnehmer();
    }

    private async downloadTeilnehmerDebrief(name: string) {
        if (!this.uebung || !this.storage) {
            return;
        }
        try {
            const pdfGenerator = await ladePdfGenerator();
            const blob = await pdfGenerator.generateTeilnehmerDebriefPdfBlob(this.uebung, this.storage, name);
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

    private markNachrichtAbgesetzt(sender: string, nr: number) {
        if (!this.storage) {
            return;
        }
        const now = new Date().toISOString();
        const key = `${sender}__${nr}`;
        const entry = this.storage.nachrichten[key] || {};
        entry.abgesetztUm = now;
        entry.statusGeaendertUm = now;
        this.storage.nachrichten[key] = entry;
        this.save();
        this.renderNachrichten();
    }

    private resetNachricht(sender: string, nr: number) {
        if (!this.storage) {
            return;
        }
        const key = `${sender}__${nr}`;
        const entry = this.storage.nachrichten[key];
        if (entry) {
            delete entry.abgesetztUm;
            // Zeitstempel bleibt gesetzt, damit das Zurücksetzen den Merge gewinnt.
            entry.statusGeaendertUm = new Date().toISOString();
        }
        this.save();
        this.renderNachrichten();
    }

    private updateNachrichtNotiz(sender: string, nr: number, val: string) {
        this.debouncedSaveNotiz(sender, nr, val);
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
        this.save();
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

    private resetData() {
        const message = this.liveStatus?.enabled
            ? "Wirklich alle Daten der Übungsleitung zurücksetzen? Das wirkt auch für Teilnehmer und weitere Leitungs-Arbeitsplätze."
            : "Wirklich alle lokalen Daten zurücksetzen?";
        if (!uiFeedback.confirm(message)) {
            return;
        }
        void this.performReset();
    }

    /**
     * Setzt lokal und – falls aktiv – auch remote zurück. Remote werden dazu
     * Zurücksetz-Marker mit aktuellem Zeitstempel geschrieben; ein leeres Dokument
     * würde vom Last-Write-Wins-Merge nicht gewinnen.
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
            await this.liveStatus.flush();
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
