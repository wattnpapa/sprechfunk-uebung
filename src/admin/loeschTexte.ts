import type { Uebung } from "../types/Uebung";
import { LOESCH_VERZOEGERUNG_MS } from "./loeschPuffer";

/** Texte rund ums Löschen einer Übung in der Verwaltung. */

type UebungsEintrag = Pick<Uebung, "name" | "datum" | "rufgruppe" | "teilnehmerListe" | "uebungCode">;

export function uebungsName(uebung: Partial<UebungsEintrag> | undefined): string {
    return uebung?.name?.trim() || "ohne Namen";
}

/** Merkmale, an denen man die Übung in der Löschrückfrage erkennt. */
function loeschDetails(uebung: Partial<UebungsEintrag>): string[] {
    const datum = uebung.datum ? new Date(uebung.datum) : null;
    const istGueltig = !!datum && !Number.isNaN(datum.getTime());
    return [
        istGueltig ? `Datum ${datum.toLocaleDateString("de-DE")}` : "",
        uebung.rufgruppe ? `Rufgruppe ${uebung.rufgruppe}` : "",
        uebung.teilnehmerListe ? `${uebung.teilnehmerListe.length} Teilnehmer` : "",
        uebung.uebungCode ? `Übungscode ${uebung.uebungCode}` : ""
    ].filter(Boolean);
}

/**
 * Die Rückfrage nennt die Übung und die Folgen, statt nur „diese Übung“
 * (THW-Review destructive-action P1-1, error-recovery P2-6), und seit dem
 * verzögerten Löschen auch die Frist für „Rückgängig“.
 */
export function loeschRueckfrage(uebung: Partial<UebungsEintrag> | undefined): string {
    const zeilen = [`Übung „${uebungsName(uebung)}“ löschen?`];
    const details = uebung ? loeschDetails(uebung) : [];
    if (details.length > 0) {
        zeilen.push(details.join(" · "));
    }
    zeilen.push(
        "",
        "Alle Teilnehmer- und Leitungs-Links dieser Übung funktionieren danach nicht mehr. " +
        `Nach dem Bestätigen kannst du ${LOESCH_VERZOEGERUNG_MS / 1000} Sekunden lang „Rückgängig“ wählen; ` +
        "danach ist die Übung endgültig gelöscht."
    );
    return zeilen.join("\n");
}
