/**
 * Reine Rechenhelfer für das Lagebild der Übungsleitung: Plan-Nummern,
 * Soll-Zeiten und Fälligkeit im X-Zeit-Modus, ETA mit Mindeststichprobe,
 * Kopplung von Anmeldung und Anmelde-Funkspruch, Papier-Nachtrag.
 *
 * Bewusst ohne DOM und ohne Zustand, damit Controller und Ansicht dieselbe
 * Logik verwenden und sie einzeln getestet werden kann.
 */
import type { Uebung } from "../types/Uebung";
import type { NachrichtenStatus, TeilnehmerStatus } from "../types/Storage";
import type { EffektiverNachrichtenStatus } from "../services/liveStatusMerge";

export function statusKey(sender: string, nr: number): string {
    return `${sender}__${nr}`;
}

/**
 * Offen ist eine Zeile, die weder erledigt (Teilnehmer-Meldung oder
 * Bestätigung der Leitung) noch bewusst ausgelassen ist.
 */
export function istOffen(status: Pick<EffektiverNachrichtenStatus, "erledigtUm" | "ausgelassen"> | undefined): boolean {
    return !status?.erledigtUm && !status?.ausgelassen;
}

/** Minimale Sicht auf eine Plan-Zeile, die die Helfer hier brauchen. */
export interface PlanEintrag {
    nr: number;
    sender: string;
    xZeitSlot?: number;
    szenarioNr?: number;
}

/**
 * Stabile Reihenfolge des Nachrichtenplans: Liegen für alle Nachrichten
 * X-Zeit-Slots vor, zählt der Zeitplan; sonst die Erzählreihenfolge des
 * Szenarios bzw. die Rundenlogik über die Nachrichtennummern.
 */
export function sortiereNachrichtenplan<T extends PlanEintrag>(nachrichten: T[]): T[] {
    const alleMitSlot = nachrichten.length > 0 && nachrichten.every(n => n.xZeitSlot !== undefined);
    return nachrichten
        .map((n, position) => ({ n, position }))
        .sort((a, b) => {
            if (alleMitSlot) {
                const slot = (a.n.xZeitSlot as number) - (b.n.xZeitSlot as number);
                if (slot !== 0) {
                    return slot;
                }
            }
            return (a.n.szenarioNr ?? a.n.nr) - (b.n.szenarioNr ?? b.n.nr) || a.position - b.position;
        })
        .map(({ n }) => n);
}

/**
 * Fortlaufende, eindeutige Plan-Nummer je Zeile (1 … n) in Planreihenfolge.
 * Die Nummer je Absender bleibt daneben erhalten – sie steht auf den Vordrucken.
 */
export function vergibPlanNummern<T extends PlanEintrag>(sortiert: T[]): (T & { planNr: number })[] {
    return sortiert.map((n, index) => ({ ...n, planNr: index + 1 }));
}

// --- X-Zeit: Soll-Zeit und Fälligkeit -------------------------------------

export type PlanZustand = "ueberfaellig" | "faellig" | "spaeter";

export interface Faelligkeit {
    zustand: PlanZustand;
    sollMs: number;
    /** Ganze Minuten Abstand zur Soll-Zeit (immer ≥ 0). */
    minuten: number;
}

/**
 * Wie lange eine Nachricht nach ihrer Soll-Zeit als „jetzt fällig“ gilt, bevor
 * sie „überfällig“ ist: ein Intervall, mindestens zwei Minuten.
 */
export function faelligFensterMs(intervallMinuten?: number): number {
    return Math.max(2, intervallMinuten ?? 0) * 60000;
}

export function berechneFaelligkeit(
    xZeitSlot: number,
    basisMs: number,
    nowMs: number,
    fensterMs: number
): Faelligkeit {
    const sollMs = basisMs + xZeitSlot * 60000;
    const diff = nowMs - sollMs;
    const minuten = Math.floor(Math.abs(diff) / 60000);
    if (diff < 0) {
        return { zustand: "spaeter", sollMs, minuten };
    }
    if (diff < fensterMs) {
        return { zustand: "faellig", sollMs, minuten };
    }
    return { zustand: "ueberfaellig", sollMs, minuten };
}

export function formatUhrzeit(ms: number): string {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Text-Badge zum Zustand – erkennbar auch ohne Farbe. */
export function faelligkeitLabel(f: Faelligkeit): string {
    if (f.zustand === "ueberfaellig") {
        return `überfällig ${f.minuten} min`;
    }
    if (f.zustand === "faellig") {
        return "jetzt fällig";
    }
    return f.minuten < 1 ? "gleich" : `in ${f.minuten} min`;
}

// --- ETA ------------------------------------------------------------------

/** Unterhalb dieser Stichprobe ist eine Hochrechnung reine Spekulation. */
export const ETA_MIN_NACHRICHTEN = 5;
export const ETA_MIN_SPANNE_MS = 3 * 60000;

export interface EtaErgebnis {
    /** `null`, solange keine belastbare Schätzung möglich ist. */
    etaMs: number | null;
    restMinuten: number;
    stichprobe: number;
    grund?: "zu-wenig-daten" | "fertig";
}

/**
 * Schätzt das Übungsende aus dem bisherigen Tempo. Nachgetragene Zeiten
 * (Papier-Nachtrag) zählen nicht, weil sie kein Echtzeit-Tempo abbilden.
 */
export function schaetzeEnde(zeitstempelMs: number[], gesamt: number, offen: number): EtaErgebnis {
    const sortiert = zeitstempelMs.filter(Number.isFinite).sort((a, b) => a - b);
    const stichprobe = sortiert.length;
    const first = sortiert[0];
    const last = sortiert[stichprobe - 1];
    if (offen <= 0 && last !== undefined) {
        return { etaMs: last, restMinuten: 0, stichprobe, grund: "fertig" };
    }
    if (first === undefined || last === undefined || stichprobe < ETA_MIN_NACHRICHTEN
        || last - first < ETA_MIN_SPANNE_MS || gesamt <= 0) {
        return { etaMs: null, restMinuten: 0, stichprobe, grund: "zu-wenig-daten" };
    }
    const avgIntervalMs = (last - first) / (stichprobe - 1);
    const remainingMs = Math.round(avgIntervalMs * offen);
    return {
        etaMs: last + remainingMs,
        restMinuten: Math.max(1, Math.round(remainingMs / 60000)),
        stichprobe
    };
}

// --- Anmeldung ------------------------------------------------------------

/**
 * Schlüssel des Anmelde-Funkspruchs eines Teilnehmers („Ich melde mich in
 * Ihrem Sprechfunkverkehrskreis an“) – bei aktiver Anmeldephase immer die
 * Nachricht 1 des Teilnehmers. `null`, wenn die Übung keine Anmeldung hat.
 */
export function anmeldeNachrichtKey(uebung: Pick<Uebung, "anmeldungAktiv" | "nachrichten">, name: string): string | null {
    if (!uebung.anmeldungAktiv) {
        return null;
    }
    const hatNachricht1 = (uebung.nachrichten?.[name] ?? []).some(n => n.id === 1);
    return hatNachricht1 ? statusKey(name, 1) : null;
}

export interface AnmeldeZustand {
    angemeldetUm?: string;
    quelle?: "leitung" | "funkspruch" | "teilnehmer";
}

/**
 * Eine Wahrheit je Teilnehmer: angemeldet ist, wer über „Anmeldung erhalten“
 * erfasst wurde, wessen Anmelde-Funkspruch abgesetzt ist oder wer ihn selbst
 * als übertragen gemeldet hat. Es zählt der früheste Zeitpunkt – außer die
 * Leitung hat die Zeit des Anmelde-Funkspruchs von Hand eingetragen: Diese
 * Korrektur gilt dann überall (THW-Review 2026-10-05, analog P2-1).
 */
export function anmeldeZustand(
    teilnehmerStatus: TeilnehmerStatus | undefined,
    anmeldeStatus: EffektiverNachrichtenStatus | NachrichtenStatus | undefined
): AnmeldeZustand {
    const korrektur = anmeldeStatus?.nachgetragen ? anmeldeStatus.abgesetztUm : undefined;
    if (korrektur && Number.isFinite(Date.parse(korrektur))) {
        return { angemeldetUm: korrektur, quelle: "funkspruch" };
    }
    const kandidaten: { um: string | undefined; quelle: NonNullable<AnmeldeZustand["quelle"]> }[] = [
        { um: teilnehmerStatus?.angemeldetUm, quelle: "leitung" },
        { um: anmeldeStatus?.abgesetztUm, quelle: "funkspruch" },
        { um: (anmeldeStatus as EffektiverNachrichtenStatus | undefined)?.gemeldetUm, quelle: "teilnehmer" }
    ];
    const gueltig = kandidaten.filter((k): k is { um: string; quelle: NonNullable<AnmeldeZustand["quelle"]> } =>
        Boolean(k.um) && Number.isFinite(Date.parse(k.um ?? "")));
    if (!gueltig.length) {
        return {};
    }
    gueltig.sort((a, b) => Date.parse(a.um) - Date.parse(b.um));
    const erster = gueltig[0] as { um: string; quelle: NonNullable<AnmeldeZustand["quelle"]> };
    return { angemeldetUm: erster.um, quelle: erster.quelle };
}

// --- Papier-Nachtrag ------------------------------------------------------

export { uhrzeitZuIso } from "./nachtrag";

// --- Lage je Teilnehmer ---------------------------------------------------

export interface LageTeilnehmer {
    teilnehmer: string;
    offen: number;
    gesamt: number;
    /** Davon vom Teilnehmer gemeldet, aber von der Leitung noch nicht bestätigt. */
    nurGemeldet: number;
}

export function lageJeTeilnehmer(
    nachrichten: PlanEintrag[],
    effektiv: Record<string, EffektiverNachrichtenStatus>
): LageTeilnehmer[] {
    const lage = new Map<string, LageTeilnehmer>();
    nachrichten.forEach(n => {
        const eintrag = lage.get(n.sender) ?? { teilnehmer: n.sender, offen: 0, gesamt: 0, nurGemeldet: 0 };
        eintrag.gesamt++;
        const status = effektiv[statusKey(n.sender, n.nr)];
        if (istOffen(status)) {
            eintrag.offen++;
        } else if (status?.erledigtUm && !status.abgesetztUm) {
            eintrag.nurGemeldet++;
        }
        lage.set(n.sender, eintrag);
    });
    return Array.from(lage.values()).sort((a, b) => b.offen - a.offen || a.teilnehmer.localeCompare(b.teilnehmer));
}

/** Die nächsten offenen Zeilen in Planreihenfolge. */
export function naechsteOffene<T extends PlanEintrag>(
    sortiert: T[],
    effektiv: Record<string, EffektiverNachrichtenStatus>,
    anzahl: number
): T[] {
    return sortiert.filter(n => istOffen(effektiv[statusKey(n.sender, n.nr)])).slice(0, anzahl);
}
