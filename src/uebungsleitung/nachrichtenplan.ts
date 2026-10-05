import type { FunkUebung } from "../models/FunkUebung";
import type { Nachricht } from "../types/Nachricht";
import type { LageAnzeige } from "./UebungsleitungView";
import type { EffektiverStatus } from "./auswertung";
import {
    berechneFaelligkeit,
    faelligFensterMs,
    formatUhrzeit,
    istOffen,
    sortiereNachrichtenplan,
    statusKey,
    vergibPlanNummern,
    type Faelligkeit
} from "./lagebild";
import type { FlattenedNachricht } from "./nachrichtenTypen";

/** Optionale Felder, die eine Plan-Zeile von der Nachricht übernimmt, sofern gesetzt. */
const OPTIONALE_FELDER = ["xZeitSlot", "art", "szenarioNr", "weg", "meldeart", "betreff", "erwartung"] as const;

function zuPlanZeile(sender: string, msg: Nachricht): FlattenedNachricht {
    const zeile: FlattenedNachricht = {
        nr: msg.id,
        sender,
        empfaenger: msg.empfaenger,
        text: msg.nachricht
    };
    OPTIONALE_FELDER.forEach(feld => {
        if (msg[feld] !== undefined) {
            (zeile as unknown as Record<string, unknown>)[feld] = msg[feld];
        }
    });
    return zeile;
}

/** Alle Nachrichten als Plan: stabil sortiert und fortlaufend nummeriert. */
export function buildPlan(uebung: FunkUebung): FlattenedNachricht[] {
    const nachrichten = Object.entries(uebung.nachrichten ?? {})
        .flatMap(([sender, msgs]) => msgs.map(msg => zuPlanZeile(sender, msg)));
    return vergibPlanNummern(sortiereNachrichtenplan(nachrichten));
}

/** Fälligkeit je offener Zeile – nur im X-Zeit-Modus mit verbindlicher Basis. */
export function buildFaelligkeit(
    nachrichten: FlattenedNachricht[],
    effektiv: EffektiverStatus,
    basisMs: number,
    zeit: { intervallMinuten: number | undefined; jetztMs: number }
): Record<string, Faelligkeit> {
    const fenster = faelligFensterMs(zeit.intervallMinuten);
    return nachrichten.reduce<Record<string, Faelligkeit>>((acc, n) => {
        const key = statusKey(n.sender, n.nr);
        if (n.xZeitSlot === undefined || !istOffen(effektiv[key])) {
            return acc;
        }
        acc[key] = berechneFaelligkeit(n.xZeitSlot, basisMs, zeit.jetztMs, fenster);
        return acc;
    }, {});
}

/** Soll-Uhrzeit je Zeile, sobald eine verbindliche Basis gesetzt ist. */
export function buildSollUhrzeiten(nachrichten: FlattenedNachricht[], basisMs: number): Record<string, string> {
    return nachrichten.reduce<Record<string, string>>((acc, n) => {
        if (n.xZeitSlot !== undefined) {
            acc[statusKey(n.sender, n.nr)] = formatUhrzeit(basisMs + n.xZeitSlot * 60000);
        }
        return acc;
    }, {});
}

/** Wie viele offene Zeilen überfällig bzw. gerade fällig sind. */
export function zaehleFaelligkeit(faelligkeit: Record<string, Faelligkeit>): { ueberfaellig: number; faellig: number } {
    const werte = Object.values(faelligkeit);
    return {
        ueberfaellig: werte.filter(f => f.zustand === "ueberfaellig").length,
        faellig: werte.filter(f => f.zustand === "faellig").length
    };
}

/**
 * Auswahl für „Als Nächstes“: Bei Rückstand nur die älteste überfällige Zeile,
 * daneben was gerade fällig ist und was danach kommt – wer nach einer
 * Unterbrechung auf den aktuellen Takt springt, sieht beides
 * (THW-Review 2026-10-05, command P2-2). Ohne Zeitplan die ersten offenen.
 */
export function waehleNaechste<T extends { sender: string; nr: number }>(
    offene: T[],
    faelligkeit: Record<string, Faelligkeit>,
    anzahl: number
): T[] {
    const zustand = (n: T) => faelligkeit[statusKey(n.sender, n.nr)]?.zustand;
    const ersteUeberfaellige = offene.find(n => zustand(n) === "ueberfaellig");
    if (!ersteUeberfaellige) {
        return offene.slice(0, anzahl);
    }
    const rest = offene.filter(n => zustand(n) !== "ueberfaellig");
    return [ersteUeberfaellige, ...rest].slice(0, anzahl);
}

/** Die nächsten drei offenen Zeilen für die Lage-Kachel, mit Fälligkeit. */
export function naechsteFuerLage(
    nachrichten: FlattenedNachricht[],
    effektiv: EffektiverStatus,
    faelligkeit: Record<string, Faelligkeit>
): LageAnzeige["naechste"] {
    const offene = nachrichten.filter(n => istOffen(effektiv[statusKey(n.sender, n.nr)]));
    return waehleNaechste(offene, faelligkeit, 3).map(n => {
        const f = faelligkeit[statusKey(n.sender, n.nr)];
        return {
            planNr: n.planNr ?? n.nr,
            absNr: n.nr,
            sender: n.sender,
            empfaenger: n.empfaenger,
            ...(f ? { faelligkeit: f } : {})
        };
    });
}
