/**
 * Erkennt gesetzte Status, die vor dem letzten Generieren entstanden sind.
 * Wer eine verteilte Übung überschreibt, bekommt neue Texte unter denselben
 * Nummern – alte Haken passen dann nicht mehr. Die Leitung sieht das an einem
 * festen Hinweis, auch auf einem zweiten Gerät (THW-Review 2026-10-05,
 * destructive-action P2-1, workflow W3).
 */
import type { TeilnehmerStatus } from "../types/Storage";
import type { EffektiverStatus } from "./auswertung";

/** Uhren verschiedener Geräte gehen nie ganz gleich – so viel Spielraum. */
const UHR_TOLERANZ_MS = 2 * 60000;

function vor(iso: string | undefined, grenzeMs: number): boolean {
    const ts = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(ts) && ts < grenzeMs;
}

/**
 * Anzahl gesetzter Status (abgesetzt, gemeldet, ausgelassen, angemeldet),
 * die älter sind als die aktuelle Fassung der Übung (`createDate`).
 */
export function zaehleVeralteteStatus(
    fassungVom: Date | string | undefined,
    effektiv: EffektiverStatus,
    teilnehmer: Record<string, TeilnehmerStatus>
): number {
    const fassungMs = fassungVom instanceof Date ? fassungVom.getTime() : Date.parse(fassungVom ?? "");
    if (!Number.isFinite(fassungMs)) {
        return 0;
    }
    const grenze = fassungMs - UHR_TOLERANZ_MS;
    const nachrichten = Object.values(effektiv).filter(s =>
        vor(s.abgesetztUm, grenze) || vor(s.gemeldetUm, grenze) || (s.ausgelassen && vor(s.statusGeaendertUm, grenze)));
    const anmeldungen = Object.values(teilnehmer).filter(t => vor(t.angemeldetUm, grenze));
    return nachrichten.length + anmeldungen.length;
}
