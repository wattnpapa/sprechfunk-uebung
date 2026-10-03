import type { FunkUebung } from "../models/FunkUebung";
import type { Nachricht } from "../types/Nachricht";
import { formatNatoDate } from "../utils/date";
import { VordruckDaten, type Uebermittlungsweg } from "bos-nachrichtenvordruck";
import type { UebermittlungsWeg as FuehrungsstellenWeg } from "../types/FuehrungsstellenUebung";

/** Weg einer Führungsstellen-Nachricht im Vokabular des Vordrucks. */
const WEG_ZU_VORDRUCK: Record<FuehrungsstellenWeg, Uebermittlungsweg> = {
    funk: "funk",
    drucker: "telefax",
    email: "dfue"
};

/**
 * Übersetzt Übung, Teilnehmer und Nachricht in `VordruckDaten`.
 *
 * Das ist die einzige Stelle, an der die Vordrucke die Begriffe der
 * Sprechfunkübung berühren – das Paket `bos-nachrichtenvordruck` bleibt
 * dadurch frei davon und lässt sich in anderen Projekten verwenden.
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

    // Ausdruck und E-Mail einer Führungsstellen-Übung tragen Betreff und Weg;
    // auf dem Vordruck steht der Betreff als erste Zeile.
    daten.inhalt = nachricht.betreff
        ? `Betreff: ${nachricht.betreff}\n${nachricht.nachricht}`
        : nachricht.nachricht;
    if (nachricht.weg) {
        daten.uebermittlungsweg = WEG_ZU_VORDRUCK[nachricht.weg];
    }
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
