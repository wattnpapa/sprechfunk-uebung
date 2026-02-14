import { loadUebungsleitungStorage, saveUebungsleitungStorage } from "../services/storage";
import { UebungsleitungView } from "./UebungsleitungView";
import { FirebaseService } from "../services/FirebaseService";
import { store } from "../state/store";
import { router } from "../core/router";
import { UebungsleitungStorage } from "../types/Storage";
import type { Firestore } from "firebase/firestore";
import {FunkUebung} from "../models/FunkUebung";
import { uiFeedback } from "../core/UiFeedback";
import { debounce } from "../utils/debounce";
import { formatNatoDate } from "../utils/date";
import pdfGenerator from "../services/pdfGenerator";

interface FlattenedNachricht {
    nr: number;
    sender: string;
    empfaenger: string[];
    text: string;
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

    constructor(db: Firestore) {
        this.view = new UebungsleitungView();
        this.firebaseService = new FirebaseService(db);
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
            () => this.resetData()
        );

        this.view.bindTeilnehmerEvents(
            name => this.markAngemeldet(name),
            (name, val) => this.updateLoesungswort(name, val),
            (name, idx, val) => this.updateStaerke(name, idx, val),
            (name, val) => this.updateNotiz(name, val),
            () => this.toggleStaerkeDetails(),
            name => this.downloadTeilnehmerDebrief(name)
        );

        this.view.bindNachrichtenEvents(
            (sender, nr) => this.markNachrichtAbgesetzt(sender, nr),
            (sender, nr) => this.resetNachricht(sender, nr),
            (sender, nr, val) => this.updateNachrichtNotiz(sender, nr, val),
            val => {
                this.senderFilter = val; this.renderNachrichten(); 
            },
            val => {
                this.empfaengerFilter = val; this.renderNachrichten(); 
            },
            val => {
                this.hideAbgesetzt = val; this.renderNachrichten(); 
            },
            val => {
                this.textFilter = val; this.debouncedRenderNachrichten();
            }
        );
    }

    private renderTeilnehmer() {
        if (!this.uebung || !this.storage) {
            return;
        }
        this.view.renderTeilnehmerListe(
            this.uebung, 
            this.storage.teilnehmer, 
            this.showStaerkeDetails
        );
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
                    text: msg.nachricht
                });
            });
        });
        nachrichten.sort((a, b) => a.nr - b.nr);

        // Calculate Progress
        let done = 0;
        const storage = this.storage;
        if (!storage) {
            return;
        }
        nachrichten.forEach(n => {
            const key = `${n.sender}__${n.nr}`;
            if (storage.nachrichten[key]?.abgesetztUm) {
                done++;
            }
        });
        const etaLabel = this.calculateEtaLabel(nachrichten);
        this.view.updateProgress(nachrichten.length, done, etaLabel);
        const sentNachrichten = this.collectSentNachrichten(nachrichten);
        const heatmapBins = this.buildHeatmapBins(sentNachrichten);
        this.view.updateOperationalStats(
            this.calculateTempoLabel(sentNachrichten),
            this.calculateLoadLabel(sentNachrichten),
            this.calculateHeatmapLabel(heatmapBins)
        );

        this.view.renderNachrichtenListe(
            nachrichten,
            storage.nachrichten,
            this.hideAbgesetzt,
            this.senderFilter,
            this.empfaengerFilter,
            this.textFilter
        );
        this.view.updateHeatmap(heatmapBins);
        this.view.updateTeilnehmerTimeline(this.buildTeilnehmerTimeline(nachrichten));

        if (shouldRestoreTextFilterFocus) {
            const input = document.getElementById("nachrichtenTextFilterInput") as HTMLInputElement | null;
            if (input) {
                input.focus({ preventScroll: true });
                const pos = Math.min(caretPos ?? input.value.length, input.value.length);
                input.setSelectionRange(pos, pos);
            }
        }
    }

    private calculateEtaLabel(nachrichten: FlattenedNachricht[]): string {
        if (!this.storage || nachrichten.length === 0) {
            return "ETA: –";
        }

        const sentTimestamps = nachrichten
            .map(n => {
                const key = `${n.sender}__${n.nr}`;
                return this.storage?.nachrichten[key]?.abgesetztUm ?? "";
            })
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

    private collectSentNachrichten(nachrichten: FlattenedNachricht[]): SentNachricht[] {
        if (!this.storage) {
            return [];
        }

        return nachrichten
            .map(n => {
                const key = `${n.sender}__${n.nr}`;
                const iso = this.storage?.nachrichten[key]?.abgesetztUm ?? "";
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

    private buildTeilnehmerTimeline(nachrichten: FlattenedNachricht[]): { teilnehmer: string; events: TimelineEvent[] }[] {
        if (!this.storage || !this.uebung) {
            return [];
        }

        const participants = this.uebung.teilnehmerListe ?? [];
        const timeline = new Map<string, TimelineEvent[]>();
        participants.forEach(name => timeline.set(name, []));

        nachrichten.forEach(n => {
            const key = `${n.sender}__${n.nr}`;
            const ts = Date.parse(this.storage?.nachrichten[key]?.abgesetztUm ?? "");
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

    private markAngemeldet(name: string) {
        if (!this.storage) {
            return;
        }
        this.storage.teilnehmer[name] = this.storage.teilnehmer[name] || {};
        this.storage.teilnehmer[name].angemeldetUm = new Date().toISOString();
        this.save();
        this.renderTeilnehmer();
    }

    private updateLoesungswort(name: string, val: string) {
        if (!this.storage) {
            return;
        }
        this.storage.teilnehmer[name] = this.storage.teilnehmer[name] || {};
        this.storage.teilnehmer[name].loesungswortGesendet = val;
        this.save();
    }

    private updateStaerke(name: string, idx: number, val: string) {
        if (!this.storage) {
            return;
        }
        this.storage.teilnehmer[name] = this.storage.teilnehmer[name] || {};
        this.storage.teilnehmer[name].teilstaerken = this.storage.teilnehmer[name].teilstaerken || [];
        this.storage.teilnehmer[name].teilstaerken[idx] = val;
        this.save();
    }

    private updateNotiz(name: string, val: string) {
        if (!this.storage) {
            return;
        }
        this.storage.teilnehmer[name] = this.storage.teilnehmer[name] || {};
        this.storage.teilnehmer[name].notizen = val;
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
        const key = `${sender}__${nr}`;
        this.storage.nachrichten[key] = this.storage.nachrichten[key] || {};
        this.storage.nachrichten[key].abgesetztUm = new Date().toISOString();
        this.save();
        this.renderNachrichten();
    }

    private resetNachricht(sender: string, nr: number) {
        if (!this.storage) {
            return;
        }
        const key = `${sender}__${nr}`;
        if (this.storage.nachrichten[key]) {
            delete this.storage.nachrichten[key].abgesetztUm;
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
        this.storage.nachrichten[key] = this.storage.nachrichten[key] || {};
        this.storage.nachrichten[key].notiz = val;
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

    private resetData() {
        if (!uiFeedback.confirm("Wirklich alle lokalen Daten zurücksetzen?")) {
            return;
        }
        if (this.uebungId) {
            localStorage.removeItem(`sprechfunk:uebungsleitung:${this.uebungId}`);
            window.location.reload();
        }
    }

    private save() {
        if (this.storage) {
            saveUebungsleitungStorage(this.storage);
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
