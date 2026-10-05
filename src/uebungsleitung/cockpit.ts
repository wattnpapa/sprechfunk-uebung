import type { FunkUebung } from "../models/FunkUebung";
import type { TeilnehmerLiveDoc } from "../types/LiveStatus";
import { berechneSollFortschritt, fruehesteBasis, parseHHMMtoMs } from "../utils/xzeit";
import type { CockpitAnzeige } from "./UebungsleitungView";
import type { EffektiverStatus } from "./auswertung";
import { statusKey } from "./lagebild";

export interface BasisVorschlag {
    basis: string;
    quelle: "plan" | "teilnehmer";
}

/** Vorschlag für die Basis: geplanter Beginn aus dem Generator, sonst früheste Teilnehmer-Basis. */
export function basisVorschlag(uebung: FunkUebung | null, docs: TeilnehmerLiveDoc[]): BasisVorschlag | null {
    const beginn = uebung?.fuehrungsstelle?.beginn;
    if (beginn && parseHHMMtoMs(beginn) !== null) {
        return { basis: beginn, quelle: "plan" };
    }
    const abgeleitet = fruehesteBasis(docs.map(doc => doc.xZeitBasis));
    return abgeleitet ? { basis: abgeleitet, quelle: "teilnehmer" } : null;
}

/** Rollen, die mit einer anderen Basis laufen als der verbindlichen. */
export function abweichendeBasen(docs: TeilnehmerLiveDoc[], basis: string | null): string[] {
    return docs
        .filter(doc => doc.xZeitBasis && doc.xZeitBasis !== basis)
        .map(doc => `${doc.teilnehmer} (${doc.xZeitBasis})`)
        .sort();
}

function basisHinweis(basis: string | null, vorschlag: BasisVorschlag | null): string {
    if (basis) {
        return `Basis ${basis} von der Übungsleitung gesetzt – gilt für alle Teilnehmer.`;
    }
    if (vorschlag?.quelle === "plan") {
        return `Geplanter Übungsbeginn laut Generator: ${vorschlag.basis}. Erst mit „Übernehmen“ verbindlich.`;
    }
    if (vorschlag?.quelle === "teilnehmer") {
        return `Ein Rollenspieler hat selbst ${vorschlag.basis} gesetzt – nicht übernommen.`;
    }
    return "Noch keine verbindliche X-Zeit-Basis – setze sie hier, die Teilnehmer übernehmen sie.";
}

function formatUhrzeitMitSekunden(now: Date): string {
    return [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map(v => String(v).padStart(2, "0"))
        .join(":");
}

function zaehleIst(uebung: FunkUebung, effektiv: EffektiverStatus): number {
    return Object.entries(uebung.nachrichten ?? {})
        .reduce((summe, [sender, msgs]) => summe + msgs.filter(msg => effektiv[statusKey(sender, msg.id)]?.erledigtUm).length, 0);
}

/**
 * Inhalt der Cockpit-Kacheln. Nur die Basis der Leitung ist verbindlich;
 * Basen einzelner Rollenspieler werden nie stillschweigend übernommen
 * (THW-Review workflow F2).
 */
export function buildCockpitAnzeige(daten: {
    uebung: FunkUebung;
    effektiv: EffektiverStatus;
    basis: string | null;
    docs: TeilnehmerLiveDoc[];
    now: Date;
}): CockpitAnzeige {
    const { uebung, effektiv, basis, docs, now } = daten;
    const alleNachrichten = Object.values(uebung.nachrichten ?? {}).flat();
    const basisMs = basis ? parseHHMMtoMs(basis, now) : null;
    const vorschlag = basisVorschlag(uebung, docs);
    return {
        uhrzeit: formatUhrzeitMitSekunden(now),
        laufzeitMs: basisMs !== null ? now.getTime() - basisMs : null,
        ist: zaehleIst(uebung, effektiv),
        gesamt: alleNachrichten.length,
        soll: basisMs !== null ? berechneSollFortschritt(alleNachrichten, basisMs, now.getTime()) : null,
        basisHinweis: basisHinweis(basis, vorschlag),
        vorschlag: vorschlag && vorschlag.basis !== basis ? vorschlag.basis : null,
        abweichungen: abweichendeBasen(docs, basis)
    };
}
