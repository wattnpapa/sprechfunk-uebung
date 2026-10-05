import type { Uebung } from "../types/Uebung";

/**
 * Stellen, für die es eigene Unterlagen gibt. Die beübte Stelle einer
 * Führungsstellen-Übung bekommt nur `Ausgangslage_beuebte_Stelle.pdf`; ein
 * Teilnehmerordner mit leerer Übersicht und Deckblättern ohne Vordrucke
 * verwirrte beim Sortieren der Ausdrucke (THW-Review 2026-10-05, workflow W8).
 */
export function teilnehmerMitUnterlagen(uebung: Pick<Uebung, "teilnehmerListe" | "fuehrungsstelle">): string[] {
    const beuebt = uebung.fuehrungsstelle?.beuebteStelle;
    return (uebung.teilnehmerListe ?? []).filter(teilnehmer => teilnehmer !== beuebt);
}

/** Gehört dieser Teilnehmer in Teilnehmerordner und Sammeldrucke? */
export function hatEigeneUnterlagen(uebung: Pick<Uebung, "fuehrungsstelle">, teilnehmer: string): boolean {
    return uebung.fuehrungsstelle?.beuebteStelle !== teilnehmer;
}
