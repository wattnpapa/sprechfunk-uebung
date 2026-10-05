import type { EffektiverNachrichtenStatus } from "../services/liveStatusMerge";
import { formatNatoDate } from "../utils/date";
import { formatUhrzeit, istOffen, schaetzeEnde, statusKey } from "./lagebild";
import { formatHHMM } from "./markup";
import type { FlattenedNachricht, HeatmapBin, TeilnehmerTimeline, TimelineEvent } from "./nachrichtenTypen";

/**
 * Laufende Auswertung des Nachrichtenplans für die Übungsleitung: Fortschritt,
 * ETA, Tempo, Funklast, Heatmap und Timeline. Alles reine Funktionen über dem
 * Plan und dem effektiven Status (Leitung + Selbstmeldungen).
 */

export type EffektiverStatus = Record<string, EffektiverNachrichtenStatus>;

export interface SentNachricht {
    sender: string;
    empfaenger: string[];
    ts: number;
    /** Zeit von Hand nachgetragen – zählt nicht fürs Tempo. */
    nachgetragen?: boolean;
}

const HEATMAP_BIN_MS = 5 * 60 * 1000;

function statusVon(effektiv: EffektiverStatus, n: FlattenedNachricht): EffektiverNachrichtenStatus | undefined {
    return effektiv[statusKey(n.sender, n.nr)];
}

/** „Alle“ steht für jeden Teilnehmer; sonst jeder Empfänger einmal. */
function empfaengerVon(n: { empfaenger: string[] }, alleTeilnehmer: string[]): string[] {
    return n.empfaenger.includes("Alle") ? alleTeilnehmer : Array.from(new Set(n.empfaenger));
}

/** Erledigt (Teilnehmer oder Leitung) und davon nur vom Teilnehmer gemeldet. */
export function zaehleErledigt(nachrichten: FlattenedNachricht[], effektiv: EffektiverStatus): { done: number; nurGemeldet: number } {
    let done = 0;
    let nurGemeldet = 0;
    nachrichten.forEach(n => {
        const status = statusVon(effektiv, n);
        if (!status?.erledigtUm) {
            return;
        }
        done++;
        if (!status.abgesetztUm) {
            nurGemeldet++;
        }
    });
    return { done, nurGemeldet };
}

/** Im X-Zeit-Modus mit Basis: Ende laut Zeitplan, solange noch etwas offen ist. */
function planEndeLabel(nachrichten: FlattenedNachricht[], offen: number, planBasisMs: number | null): string | null {
    const slots = nachrichten.map(n => n.xZeitSlot).filter((s): s is number => s !== undefined);
    if (planBasisMs === null || !slots.length || offen <= 0) {
        return null;
    }
    return `Ende laut Plan: ${formatUhrzeit(planBasisMs + Math.max(...slots) * 60000)} (noch ${offen} offen)`;
}

function hochrechnungLabel(nachrichten: FlattenedNachricht[], effektiv: EffektiverStatus, offen: number): string {
    const zeitstempel = nachrichten
        .map(n => statusVon(effektiv, n))
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

/**
 * Ende der Übung. Im X-Zeit-Modus mit Basis ist der Zeitplan die bessere
 * Grundlage; sonst eine Hochrechnung, aber erst ab einer Mindeststichprobe
 * (THW-Review command P2-1).
 *
 * @param planBasisMs X-Zeit-Basis – nur im X-Zeit-Modus, sonst `null`.
 */
export function calculateEtaLabel(
    nachrichten: FlattenedNachricht[],
    effektiv: EffektiverStatus,
    planBasisMs: number | null
): string {
    if (nachrichten.length === 0) {
        return "ETA: –";
    }
    const offen = nachrichten.filter(n => istOffen(statusVon(effektiv, n))).length;
    return planEndeLabel(nachrichten, offen, planBasisMs) ?? hochrechnungLabel(nachrichten, effektiv, offen);
}

export function collectSentNachrichten(nachrichten: FlattenedNachricht[], effektiv: EffektiverStatus): SentNachricht[] {
    return nachrichten
        .map(n => {
            const status = statusVon(effektiv, n);
            return {
                sender: n.sender,
                empfaenger: n.empfaenger,
                ts: Date.parse(status?.erledigtUm ?? ""),
                ...(status?.nachgetragen && !status.gemeldetUm ? { nachgetragen: true } : {})
            };
        })
        .filter(n => Number.isFinite(n.ts))
        .sort((a, b) => a.ts - b.ts);
}

export function calculateTempoLabel(sentNachrichten: SentNachricht[]): string {
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
    return `Tempo: ${perMinute.toFixed(1).replace(".", ",")} Sprüche/min`;
}

function getTopEntry(values: Map<string, number>): { name: string; count: number } | null {
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

function zaehle(map: Map<string, number>, name: string): void {
    map.set(name, (map.get(name) ?? 0) + 1);
}

export function calculateLoadLabel(sentNachrichten: SentNachricht[], alleTeilnehmer: string[]): string {
    if (!sentNachrichten.length) {
        return "Funklast: –";
    }

    const senderCounts = new Map<string, number>();
    const receiverCounts = new Map<string, number>();
    sentNachrichten.forEach(n => {
        zaehle(senderCounts, n.sender);
        empfaengerVon(n, alleTeilnehmer).forEach(target => zaehle(receiverCounts, target));
    });

    const topSender = getTopEntry(senderCounts);
    const topReceiver = getTopEntry(receiverCounts);
    if (!topSender && !topReceiver) {
        return "Funklast: –";
    }
    // Klartext statt „S“/„E“ (THW-Review 2026-10-05, new-user P3-4).
    const senderText = topSender ? `sendet am meisten ${topSender.name} (${topSender.count})` : "sendet am meisten –";
    const receiverText = topReceiver ? `empfängt am meisten ${topReceiver.name} (${topReceiver.count})` : "empfängt am meisten –";
    return `Funklast: ${senderText} | ${receiverText}`;
}

export function calculateHeatmapLabel(bins: HeatmapBin[]): string {
    if (!bins.length) {
        return "Sprüche je 5 min: –";
    }
    const lastBins = bins
        .slice(-6)
        .map(bin => `ab ${formatHHMM(bin.bucket)}: ${bin.count}`);
    return `Sprüche je 5 min: ${lastBins.join(" | ")}`;
}

export function buildHeatmapBins(sentNachrichten: SentNachricht[]): HeatmapBin[] {
    if (!sentNachrichten.length) {
        return [];
    }

    const counts = new Map<number, number>();
    sentNachrichten.forEach(n => {
        const bucket = Math.floor(n.ts / HEATMAP_BIN_MS) * HEATMAP_BIN_MS;
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    });

    const sortedBuckets = Array.from(counts.keys()).sort((a, b) => a - b);
    const first = sortedBuckets[0];
    const last = sortedBuckets[sortedBuckets.length - 1];
    if (first === undefined || last === undefined) {
        return [];
    }

    const fullBins: HeatmapBin[] = [];
    for (let bucket = first; bucket <= last; bucket += HEATMAP_BIN_MS) {
        fullBins.push({ bucket, count: counts.get(bucket) ?? 0 });
    }

    return fullBins.slice(-24);
}

export function buildTeilnehmerTimeline(
    nachrichten: FlattenedNachricht[],
    effektiv: EffektiverStatus,
    participants: string[]
): TeilnehmerTimeline[] {
    const timeline = new Map<string, TimelineEvent[]>();
    participants.forEach(name => timeline.set(name, []));
    const eintragen = (name: string, event: TimelineEvent) => {
        const liste = timeline.get(name) ?? [];
        liste.push(event);
        timeline.set(name, liste);
    };

    nachrichten.forEach(n => {
        const ts = Date.parse(statusVon(effektiv, n)?.erledigtUm ?? "");
        if (!Number.isFinite(ts)) {
            return;
        }
        eintragen(n.sender, { ts, type: "S", nr: n.nr });
        empfaengerVon(n, participants).forEach(target => eintragen(target, { ts, type: "E", nr: n.nr }));
    });

    return Array.from(timeline.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([teilnehmer, events]) => ({
            teilnehmer,
            events: events.slice(-20)
        }));
}
