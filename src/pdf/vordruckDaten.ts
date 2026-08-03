import type { FunkUebung } from "../models/FunkUebung";
import type { Nachricht } from "../types/Nachricht";
import { formatNatoDate } from "../utils/date";
import { VordruckDaten } from "../vordruck/VordruckDaten";

/**
 * Übersetzt Übung, Teilnehmer und Nachricht in `VordruckDaten`.
 *
 * Das ist die einzige Stelle, an der die Vordrucke die Begriffe der
 * Sprechfunkübung berühren – `src/vordruck/` bleibt dadurch frei davon und
 * lässt sich später als eigenständiges Paket herauslösen.
 */
export function vordruckDatenAusUebung(
    teilnehmer: string,
    uebung: FunkUebung,
    nachricht: Nachricht
): VordruckDaten {
    const daten = new VordruckDaten();

    daten.nummer = nachricht.xZeitSlot !== undefined
        ? `X+${nachricht.xZeitSlot}`
        : `${nachricht.id}`;

    // Legacy-Übungen speichern „Alle" statt der aufgelösten Empfängerliste.
    const empfaengerNamen = nachricht.empfaenger.includes("Alle")
        ? uebung.teilnehmerListe.filter(name => name !== teilnehmer)
        : nachricht.empfaenger;

    daten.empfaenger = empfaengerNamen;
    daten.anschriften = empfaengerNamen.map(funkrufname => {
        const stelle = uebung.teilnehmerStellen?.[funkrufname];
        return stelle && stelle.trim().length > 0 ? stelle : funkrufname;
    });

    daten.inhalt = nachricht.nachricht;
    daten.absender = teilnehmer;
    daten.verfasser = teilnehmer;
    if (nachricht.art) {
        daten.art = nachricht.art;
    }

    daten.titel = uebung.name;
    daten.hinweis = "Wörter in GROSSBUCHSTABEN müssen buchstabiert werden.";
    daten.fusszeile = `© Johannes Rudolph | Version ${uebung.buildVersion}`
        + ` | Übung ID: ${uebung.id}`
        + ` | Generiert: ${formatNatoDate(uebung.createDate, true)}`
        + " | Generator: https://sprechfunk-uebung.de/";

    return daten;
}
