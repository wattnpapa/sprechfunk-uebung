/**
 * Rückfragen beim Setzen der X-Zeit-Basis. Die Basis gilt für alle
 * Leitungs-Arbeitsplätze und Teilnehmer; wer sie während der Übung ändert,
 * verschiebt alle Fälligkeiten (THW-Review 2026-10-05, destructive-action
 * P1-1). Ein geplanter Beginn, der schon weit zurückliegt, macht sofort fast
 * alles überfällig (workflow W1).
 */
import { parseHHMMtoMs } from "../utils/xzeit";

/** Ab so vielen Minuten Abstand zur Uhrzeit fragt „übernehmen“ nach. */
export const VORSCHLAG_RUECKFRAGE_AB_MIN = 10;

/** Minuten, die `basis` (HH:MM, heute) vor `now` liegt; negativ = Zukunft. */
export function minutenZurueck(basis: string, now: Date): number | null {
    const ms = parseHHMMtoMs(basis, now);
    return ms === null ? null : Math.floor((now.getTime() - ms) / 60000);
}

export function uhrzeitJetzt(now: Date): string {
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export interface BasisWechsel {
    alt: string | null;
    neu: string;
    /** Überfällige offene Nachrichten mit alter bzw. neuer Basis. */
    ueberfaelligVorher: number;
    ueberfaelligNachher: number;
}

/** Rückfrage, wenn eine schon gesetzte Basis ersetzt oder entfernt wird. */
export function basisWechselFrage(w: BasisWechsel): string {
    const neu = w.neu || "keine Basis";
    return [
        `X-Zeit-Basis für ALLE ändern: ${w.alt ?? "–"} → ${neu}?`,
        "",
        "Das verschiebt alle Soll-Zeiten – bei der Übungsleitung und bei allen Teilnehmern, mitten in der Übung.",
        `Überfällig jetzt: ${w.ueberfaelligVorher}, danach: ${w.ueberfaelligNachher}.`,
        "",
        "Du kannst es danach mit „Rückgängig“ zurückholen."
    ].join("\n");
}

/** Rückfrage, wenn der angebotene geplante Beginn weit zurückliegt. */
export function vergangenerBeginnFrage(vorschlag: string, minuten: number, ueberfaellig: number): string {
    return [
        `Der geplante Beginn ${vorschlag} liegt ${minuten} Minuten zurück.`,
        "",
        `Übernimmst du ihn, sind sofort ${ueberfaellig} Einspielungen überfällig – bei allen Rollen.`,
        "",
        `OK: trotzdem ${vorschlag} übernehmen.`,
        "Abbrechen: nicht übernehmen (danach kannst du stattdessen jetzt starten)."
    ].join("\n");
}

export function stattdessenJetztFrage(jetzt: string): string {
    return `Stattdessen jetzt starten (X-Zeit-Basis ${jetzt})?\n\nDie erste Einspielung ist dann ab sofort fällig.`;
}

/** Hinweis am Vorschlag-Knopf, wenn der Beginn schon verpasst ist. */
export function vorschlagLabel(vorschlag: string, now: Date): string {
    const minuten = minutenZurueck(vorschlag, now);
    return minuten !== null && minuten >= VORSCHLAG_RUECKFRAGE_AB_MIN
        ? `${vorschlag} übernehmen (liegt ${minuten} min zurück)`
        : `${vorschlag} übernehmen`;
}
