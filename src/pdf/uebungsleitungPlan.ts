import type { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import { formatNatoDate } from "../utils/date";
import {
    formatFuehrungsstellenZeit,
    meldeartLabel,
    uebermittlungsWegLabel
} from "../utils/fuehrungsstelle";
import { sortiereNachrichtenplan, statusKey, vergibPlanNummern } from "../uebungsleitung/lagebild";

/**
 * Zeilen des Übungsleitungs-PDFs, getrennt vom Zeichnen und damit einzeln
 * testbar. Klassisch und Szenario: Plan wie am Bildschirm; Führungsstelle:
 * eigenes Layout mit X-Zeit und Erwartung (THW-Review 2026-10-05, workflow
 * W4, W9).
 */

/** Stand der Übungsleitung je Nachricht bzw. Teilnehmer, so weit das PDF ihn braucht. */
export interface PlanStand {
    teilnehmer?: Record<string, { angemeldetUm?: string; notizen?: string; loesungswortGesendet?: string; teilstaerken?: string[] } | undefined>;
    nachrichten?: Record<string, { abgesetztUm?: string; notiz?: string } | undefined>;
}

interface PdfPlanEintrag {
    nr: number;
    sender: string;
    nachricht: Nachricht;
    xZeitSlot?: number;
    szenarioNr?: number;
}

/**
 * Alle Nachrichten in derselben Reihenfolge und mit derselben fortlaufenden
 * Nummer wie der Nachrichtenplan am Bildschirm (uebungsleitung/nachrichtenplan.ts).
 * Vorher nummerierte das PDF je Absender (1, 1, 1, 2 …), der Bildschirm
 * fortlaufend – wer auf Papier mitschrieb, musste beim Nachtragen umrechnen.
 */
export function pdfPlan(uebung: Pick<Uebung, "nachrichten">): (PdfPlanEintrag & { planNr: number })[] {
    const eintraege = Object.entries(uebung.nachrichten ?? {}).flatMap(([sender, liste]) =>
        (Array.isArray(liste) ? liste : []).map((nachricht, index): PdfPlanEintrag => ({
            // Statuskeys hängen an der id; der Index ist nur Fallback für Altbestände.
            nr: typeof nachricht.id === "number" ? nachricht.id : index + 1,
            sender,
            nachricht,
            ...(nachricht.xZeitSlot !== undefined ? { xZeitSlot: nachricht.xZeitSlot } : {}),
            ...(nachricht.szenarioNr !== undefined ? { szenarioNr: nachricht.szenarioNr } : {})
        }))
    );
    return vergibPlanNummern(sortiereNachrichtenplan(eintraege));
}

function zeitUndNotiz(stand: PlanStand | null, sender: string, nr: number): { zeit: string; notiz: string } {
    const status = stand?.nachrichten?.[statusKey(sender, nr)];
    return {
        zeit: status?.abgesetztUm ? formatNatoDate(status.abgesetztUm) : "",
        notiz: status?.notiz ?? ""
    };
}

/** Klassischer Plan: Nr (fortlaufend, darunter Abs.-Nr.), Empfänger, Sender, Nachricht, Zeit. */
export function klassischePlanZeilen(uebung: Pick<Uebung, "nachrichten">, stand: PlanStand | null): { zeilen: string[][]; absNr: number[] } {
    const plan = pdfPlan(uebung);
    return {
        zeilen: plan.map(e => {
            const { zeit, notiz } = zeitUndNotiz(stand, e.sender, e.nr);
            return [
                `${e.planNr}\nAbs.-Nr. ${e.nr}`,
                (e.nachricht.empfaenger ?? []).join("\n"),
                e.sender,
                e.nachricht.nachricht + (notiz ? `\n\nAnmerkung:\n${notiz}` : ""),
                zeit
            ];
        }),
        absNr: plan.map(e => e.nr)
    };
}

export const FS_PLAN_KOPF = ["Nr", "X-Zeit", "Von", "Weg · Meldeart", "Einspielung", "Erwartete Reaktion der beübten Stelle", "Eingespielt (Uhrzeit)", "Reaktion (Ist) / Notiz"];

/**
 * Führungsstellen-Übung: Die Übungsleitung spielt ein und bewertet die
 * Reaktion der beübten Stelle. Statt Lösungswort und Stärke braucht sie
 * X-Zeit, Weg, Erwartung und Platz für das, was tatsächlich kam.
 */
export function fuehrungsstellenPlanZeilen(uebung: Pick<Uebung, "nachrichten" | "fuehrungsstelle">, stand: PlanStand | null): string[][] {
    const beginn = uebung.fuehrungsstelle?.beginn;
    return pdfPlan(uebung).map(e => {
        const { zeit, notiz } = zeitUndNotiz(stand, e.sender, e.nr);
        const n = e.nachricht;
        const weg = [uebermittlungsWegLabel(n.weg), meldeartLabel(n.meldeart)].filter(Boolean).join(" · ");
        const text = (n.betreff ? `Betreff: ${n.betreff}\n` : "") + String(n.nachricht ?? "").replace(/\\n/g, "\n");
        return [
            String(e.planNr),
            formatFuehrungsstellenZeit(n.xZeitSlot ?? 0, beginn),
            `${e.sender}\n→ ${(n.empfaenger ?? []).join(", ")}`,
            weg,
            text,
            n.erwartung ?? "",
            zeit,
            notiz
        ];
    });
}

export const FS_TEILNEHMER_KOPF = ["Stelle", "Rolle", "Anmeldung", "Bemerkungen"];

/** Rolle einer Stelle in der Führungsstellen-Übung. */
export function fuehrungsstellenRolle(uebung: Pick<Uebung, "fuehrungsstelle">, teilnehmer: string): string {
    const fs = uebung.fuehrungsstelle;
    if (!fs) {
        return "";
    }
    if (fs.beuebteStelle === teilnehmer) {
        return "beübte Stelle (ohne Zugang)";
    }
    if (fs.uebergeordnet === teilnehmer) {
        return "übergeordnete Stelle (Einspieler)";
    }
    return fs.unterstellt.includes(teilnehmer) ? "Einsatzabschnitt (Einspieler)" : "";
}

/**
 * Breite (mm) für die Lösungswort-Spalten, damit das Soll-Wort nicht mitten
 * im Wort umbricht (THW-Review 2026-10-05, analog-first P3-5). Mindestens
 * `minimal`, höchstens `maximal`; `textBreite` misst in der Tabellenschrift.
 */
export function loesungswortSpaltenBreite(
    woerter: string[],
    textBreite: (text: string) => number,
    minimal: number,
    maximal: number
): number {
    const zellenAbstand = 4.5; // cellPadding 2 mm je Seite plus Linien
    const breitestes = woerter.reduce((max, wort) => Math.max(max, textBreite(wort)), 0);
    return Math.min(Math.max(minimal, breitestes + zellenAbstand), maximal);
}
