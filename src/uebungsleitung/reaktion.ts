/**
 * Führungsstellen-Übung: Reaktion der beübten Stelle je Einspielung
 * (erfolgt / abweichend / ausgeblieben) und die Summe für Lagezeile und
 * Auswertung (THW-Review 2026-10-05, command P2-1, workflow W4).
 *
 * Bewertet werden nur Einspielungen mit Erwartung, die schon abgesetzt sind –
 * vorher kann die beübte Stelle nicht reagiert haben.
 */
import type { NachrichtenStatus, ReaktionBewertung, UebungsleitungStorage } from "../types/Storage";
import type { EffektiverStatus } from "./auswertung";
import { statusKey } from "./lagebild";

export const REAKTIONEN: { wert: ReaktionBewertung; label: string }[] = [
    { wert: "erfolgt", label: "erfolgt" },
    { wert: "abweichend", label: "abweichend" },
    { wert: "ausgeblieben", label: "ausgeblieben" }
];

const REAKTION_LANG: Record<ReaktionBewertung, string> = {
    erfolgt: "wie erwartet erfolgt",
    abweichend: "abweichend",
    ausgeblieben: "ausgeblieben"
};

export interface ReaktionsBilanz {
    erfolgt: number;
    abweichend: number;
    ausgeblieben: number;
    /** Abgesetzt, aber noch nicht bewertet. */
    ausstehend: number;
    /** Ältester Absetzzeitpunkt unter den ausstehenden (ISO). */
    aeltesteAusstehendSeit?: string;
}

interface BewertbareZeile {
    sender: string;
    nr: number;
    erwartung?: string;
}

export function reaktionsBilanz(nachrichten: BewertbareZeile[], effektiv: EffektiverStatus): ReaktionsBilanz {
    const bilanz: ReaktionsBilanz = { erfolgt: 0, abweichend: 0, ausgeblieben: 0, ausstehend: 0 };
    nachrichten.forEach(n => {
        const status = effektiv[statusKey(n.sender, n.nr)];
        if (!n.erwartung || !status?.abgesetztUm) {
            return;
        }
        if (status.reaktion) {
            bilanz[status.reaktion]++;
            return;
        }
        bilanz.ausstehend++;
        if (!bilanz.aeltesteAusstehendSeit || status.abgesetztUm < bilanz.aeltesteAusstehendSeit) {
            bilanz.aeltesteAusstehendSeit = status.abgesetztUm;
        }
    });
    return bilanz;
}

/** „12 erfolgt · 1 abweichend · 2 ausgeblieben · 3 ausstehend“ – leere Posten entfallen. */
export function reaktionsBilanzText(bilanz: ReaktionsBilanz): string {
    const teile = [
        bilanz.erfolgt ? `${bilanz.erfolgt} erfolgt` : "",
        bilanz.abweichend ? `${bilanz.abweichend} abweichend` : "",
        bilanz.ausgeblieben ? `${bilanz.ausgeblieben} ausgeblieben` : "",
        bilanz.ausstehend ? `${bilanz.ausstehend} ausstehend` : ""
    ].filter(Boolean);
    return teile.length ? teile.join(" · ") : "noch nichts eingespielt";
}

/** Text, der in Ausdrucken vor der Notiz einer Zeile steht. */
function auswertungsVermerk(status: NachrichtenStatus): string {
    const teile: string[] = [];
    if (status.ausgelassen && !status.abgesetztUm) {
        teile.push("Bewusst ausgelassen (nicht eingespielt).");
    }
    if (status.reaktion) {
        teile.push(`Reaktion der beübten Stelle: ${REAKTION_LANG[status.reaktion]}.`);
    }
    if (status.zeitVomTeilnehmer && status.abgesetztUm) {
        teile.push("Zeit aus der Meldung des Teilnehmers übernommen.");
    }
    return teile.join(" ");
}

/**
 * Stand für Übungsleitungs-PDF und Debrief: Ausgelassen, Reaktion und die
 * Herkunft der Zeit stehen als Vermerk vor der Notiz der Zeile – so zeigen
 * beide Ausdrucke sie, ohne dass sich ihr Layout ändert.
 */
export function mitAuswertungsVermerken<T extends NachrichtenStatus>(nachrichten: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.entries(nachrichten).map(([key, status]) => {
        const vermerk = auswertungsVermerk(status);
        if (!vermerk) {
            return [key, status];
        }
        const notiz = status.notiz ? `${vermerk} ${status.notiz}` : vermerk;
        return [key, { ...status, notiz }];
    }));
}

/**
 * Summe der Reaktionen als Notiz der beübten Stelle (Seite 1 des
 * Übungsleitungs-PDF), vor einer eigenen Notiz der Leitung.
 */
export function mitReaktionsBilanz(
    storage: UebungsleitungStorage,
    beuebteStelle: string | undefined,
    bilanz: ReaktionsBilanz
): UebungsleitungStorage {
    if (!beuebteStelle) {
        return storage;
    }
    const eintrag = storage.teilnehmer[beuebteStelle] ?? {};
    const summe = `Reaktionen: ${reaktionsBilanzText(bilanz)}.`;
    const notizen = eintrag.notizen ? `${summe} ${eintrag.notizen}` : summe;
    return { ...storage, teilnehmer: { ...storage.teilnehmer, [beuebteStelle]: { ...eintrag, notizen } } };
}
