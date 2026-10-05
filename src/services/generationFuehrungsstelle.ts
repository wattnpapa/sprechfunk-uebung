import type { FunkUebung } from "../models/FunkUebung";
import type { Nachricht } from "../types/Nachricht";
import {
    fuehrungsstellenMaxAbschnitte,
    fuehrungsstellenTeilnehmerListe,
    fuehrungsstellenZeitachse,
    verteileStraenge,
    type FuehrungsstellenKonfiguration,
    type FuehrungsstellenUebung
} from "../types/FuehrungsstellenUebung";
import { ersetzeFuehrungsstellenPlatzhalter, strangAbschnittNamen } from "../utils/fuehrungsstelle";

/**
 * Prüft die Rollenbesetzung gegen das Drehbuch, normalisiert sie und legt
 * sie an der Übung ab.
 */
export function pruefeFuehrungsstellenKonfiguration(
    uebung: FunkUebung,
    drehbuch: FuehrungsstellenUebung
): FuehrungsstellenKonfiguration {
    const roh = uebung.fuehrungsstelle;
    if (!roh || roh.slug !== drehbuch.slug) {
        throw new Error("Die Rollenbesetzung fehlt oder gehört zu einem anderen Drehbuch.");
    }
    const konfiguration: FuehrungsstellenKonfiguration = {
        ...roh,
        beuebteStelle: roh.beuebteStelle.trim(),
        uebergeordnet: roh.uebergeordnet.trim(),
        unterstellt: roh.unterstellt.map(name => name.trim()).filter(name => name.length > 0)
    };
    pruefeAbschnittszahl(konfiguration, drehbuch);
    const alle = fuehrungsstellenTeilnehmerListe(konfiguration);
    if (alle.some(name => name.length === 0)) {
        throw new Error("Jede Stelle der Führungsstellen-Übung braucht einen Funkrufnamen.");
    }
    if (new Set(alle).size !== alle.length) {
        throw new Error("Die Funkrufnamen der Führungsstellen-Übung müssen eindeutig sein.");
    }
    const stellen = bereinigeStellen(roh.stellen, alle);
    if (stellen) {
        konfiguration.stellen = stellen;
    } else {
        delete konfiguration.stellen;
    }
    uebung.fuehrungsstelle = konfiguration;
    return konfiguration;
}

function pruefeAbschnittszahl(
    konfiguration: FuehrungsstellenKonfiguration,
    drehbuch: FuehrungsstellenUebung
): void {
    const min = Math.max(1, drehbuch.minAbschnitte);
    const max = fuehrungsstellenMaxAbschnitte(drehbuch);
    if (konfiguration.unterstellt.length < min || konfiguration.unterstellt.length > max) {
        throw new Error(
            `Das Drehbuch "${drehbuch.titel}" ist für ${min} bis ${max} Einsatzabschnitte ausgelegt, ` +
            `die Übung hat ${konfiguration.unterstellt.length}.`
        );
    }
}

/**
 * Stellennamen auf die Rollen der Übung eindampfen: getrimmt, ohne leere
 * Werte und ohne Reste umbenannter Funkrufnamen. Liefert undefined, wenn
 * nichts übrig bleibt, damit kein leeres Objekt gespeichert wird.
 */
function bereinigeStellen(
    roh: Record<string, string> | undefined,
    rollen: string[]
): Record<string, string> | undefined {
    if (!roh) {
        return undefined;
    }
    const stellen: Record<string, string> = {};
    Object.entries(roh).forEach(([name, stelle]) => {
        const funkrufname = name.trim();
        const stellenname = typeof stelle === "string" ? stelle.trim() : "";
        if (rollen.includes(funkrufname) && stellenname.length > 0) {
            stellen[funkrufname] = stellenname;
        }
    });
    return Object.keys(stellen).length > 0 ? stellen : undefined;
}

/**
 * Nachrichten des Drehbuchs in Sendereihenfolge auf die Rollen verteilen.
 * Fallen mehrere Stränge auf einen Abschnitt, kann er laut Drehbuch zwei
 * Nachrichten in derselben Minute haben; die spätere rückt dann um eine
 * Minute, damit die Fälligkeitsanzeige je Absender eindeutig bleibt.
 * `szenarioNr` folgt der entzerrten Zeitachse.
 */
export function verteileNachrichtenNachDrehbuch(
    drehbuch: FuehrungsstellenUebung,
    konfiguration: FuehrungsstellenKonfiguration
): Record<string, Nachricht[]> {
    const strangNamen = strangAbschnittNamen(drehbuch, konfiguration);
    const zuordnung = verteileStraenge(drehbuch.straenge.length, konfiguration.unterstellt.length);
    const letzteMinute: Record<string, number> = {};

    const geplant = fuehrungsstellenZeitachse(drehbuch).map(({ nachricht, strangIndex }, position) => {
        const sender = strangIndex === null
            ? konfiguration.uebergeordnet
            : konfiguration.unterstellt[zuordnung[strangIndex] ?? 0] ?? konfiguration.uebergeordnet;
        const eigenerAbschnitt = strangIndex === null ? undefined : sender;
        const ersetze = (text: string): string =>
            ersetzeFuehrungsstellenPlatzhalter(text, konfiguration, strangNamen, eigenerAbschnitt);

        let zeit = nachricht.zeit;
        const letzte = letzteMinute[sender];
        if (letzte !== undefined && zeit <= letzte) {
            zeit = letzte + 1;
        }
        letzteMinute[sender] = zeit;

        return {
            sender,
            zeit,
            position,
            nachricht: {
                empfaenger: [konfiguration.beuebteStelle],
                nachricht: ersetze(nachricht.text),
                weg: nachricht.weg,
                meldeart: nachricht.art,
                ...(nachricht.betreff ? { betreff: ersetze(nachricht.betreff) } : {}),
                erwartung: ersetze(nachricht.erwartung)
            }
        };
    });
    geplant.sort((a, b) => a.zeit - b.zeit || a.position - b.position);

    const verteilung: Record<string, Nachricht[]> = {};
    fuehrungsstellenTeilnehmerListe(konfiguration).forEach(name => {
        verteilung[name] = [];
    });
    geplant.forEach((eintrag, index) => {
        const liste = verteilung[eintrag.sender] ?? [];
        verteilung[eintrag.sender] = liste;
        liste.push({
            id: liste.length + 1,
            ...eintrag.nachricht,
            xZeitSlot: eintrag.zeit,
            szenarioNr: index + 1
        });
    });
    return verteilung;
}
