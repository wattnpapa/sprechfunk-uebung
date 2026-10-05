import type { FunkUebung } from "../models/FunkUebung";
import type { Nachricht } from "../types/Nachricht";
import {
    enthaeltBuchstabierAufgabe,
    entferneBuchstabierAufgaben,
    erzeugeBuchstabierAufgabe
} from "../utils/buchstabieren";
import { shuffle, type Rng } from "../utils/random";

/**
 * Ersetzt in Nachrichten ohne Aufgabe so lange Sprüche, bis `benoetigt`
 * Aufgaben ergänzt sind: zuerst durch unbenutzte Ersatzsprüche, sonst durch
 * Großschreiben eines Wortes im vorhandenen Spruch.
 */
function ergaenzeBuchstabierAufgaben(
    ohneAufgabe: Nachricht[],
    ersatzSprueche: string[],
    benoetigtAnfang: number,
    globalVergeben: Set<string>
): void {
    let benoetigt = benoetigtAnfang;
    for (const nachricht of ohneAufgabe) {
        if (benoetigt === 0) {
            break;
        }

        const ersatz = ersatzSprueche.pop();
        const neu = ersatz || erzeugeBuchstabierAufgabe(nachricht.nachricht);
        if (neu) {
            nachricht.nachricht = neu;
            globalVergeben.add(neu);
            benoetigt--;
        }
    }
}

function balanciereTeilnehmer(
    uebung: FunkUebung,
    nachrichten: Nachricht[],
    globalVergeben: Set<string>,
    rng: Rng
): void {
    const ziel = Math.max(0, Math.min(uebung.buchstabierenAn, nachrichten.length));

    const mitAufgabe: Nachricht[] = [];
    const ohneAufgabe: Nachricht[] = [];
    nachrichten.forEach(nachricht => {
        (enthaeltBuchstabierAufgabe(nachricht.nachricht) ? mitAufgabe : ohneAufgabe).push(nachricht);
    });

    if (mitAufgabe.length > ziel) {
        // Zufällige Auswahl, damit die verbleibenden Aufgaben über die Übung verteilt bleiben.
        const ueberzaehlig = shuffle(mitAufgabe, rng).slice(ziel);
        ueberzaehlig.forEach(nachricht => {
            nachricht.nachricht = entferneBuchstabierAufgaben(nachricht.nachricht);
        });
        return;
    }

    if (mitAufgabe.length < ziel) {
        const ersatzSprueche = shuffle(
            uebung.funksprueche.filter(spruch =>
                enthaeltBuchstabierAufgabe(spruch) && !globalVergeben.has(spruch)
            ),
            rng
        );
        ergaenzeBuchstabierAufgaben(shuffle(ohneAufgabe, rng), ersatzSprueche, ziel - mitAufgabe.length, globalVergeben);
    }
}

/**
 * Bringt die Anzahl der Buchstabier-Aufgaben pro Teilnehmer auf den eingestellten
 * Zielwert `uebung.buchstabierenAn`.
 *
 * Die Vorlagen enthalten von Haus aus sehr unterschiedlich viele großgeschriebene
 * Wörter, deshalb reicht reines Auswählen nicht aus:
 * - Zu viele Aufgaben: überzählige Sprüche werden in Normalschreibweise überführt.
 * - Zu wenige Aufgaben: bevorzugt wird ein noch gar nicht vergebener Spruch mit
 *   Großschreibung eingesetzt; ist keiner mehr übrig, wird im vorhandenen Spruch ein
 *   Wort großgeschrieben. Beides hält die Sprüche über alle Teilnehmer hinweg eindeutig.
 *
 * Die Anmeldungsnachricht bleibt außen vor.
 */
export function balanciereBuchstabierAufgaben(
    uebung: FunkUebung,
    nachrichtenVerteilung: Record<string, Nachricht[]>,
    rng: Rng
): void {
    const start = uebung.anmeldungAktiv ? 1 : 0;

    // Verhindert, dass ein nachträglich eingesetzter Buchstabier-Spruch
    // bei mehreren Teilnehmern landet.
    const globalVergeben = new Set<string>();
    Object.values(nachrichtenVerteilung).forEach(liste =>
        liste.forEach(n => globalVergeben.add(n.nachricht))
    );

    uebung.teilnehmerListe.forEach(teilnehmer => {
        const nachrichten = (nachrichtenVerteilung[teilnehmer] || []).slice(start);
        balanciereTeilnehmer(uebung, nachrichten, globalVergeben, rng);
    });
}

/**
 * Nachrichten, deren Inhalt die Gegenstelle zum Mitschreiben zwingt und die
 * deshalb unabhängig vom eingestellten Anteil immer Spruch sind.
 */
function istZwingendSpruch(nachricht: Nachricht): boolean {
    return (nachricht.loesungsbuchstaben?.length ?? 0) > 0
        || (nachricht.staerken?.length ?? 0) > 0
        || enthaeltBuchstabierAufgabe(nachricht.nachricht);
}

/**
 * Vermerkt je Nachricht, ob sie als Spruch oder als Durchsage abzusetzen ist.
 *
 * Zwingend Spruch sind Nachrichten mit mitschreibpflichtigem Inhalt:
 * Lösungsbuchstaben, Stärkemeldungen und Buchstabier-Aufgaben gehen
 * verloren, wenn die Gegenstelle sie nicht in den Vordruck aufnimmt. Die
 * An-/Abmeldung ist formlos und damit Durchsage. Alle übrigen Nachrichten
 * verteilt `spruchAnteilProzent`.
 *
 * Die Empfängerzahl spielt bewusst keine Rolle – auch eine Nachricht an
 * alle oder an mehrere kann ein Spruch sein.
 */
export function markiereNachrichtenArt(uebung: FunkUebung, rng: Rng): void {
    if (!uebung.nachrichtenArtAktiv) {
        return;
    }

    const anteil = Math.min(100, Math.max(0, uebung.spruchAnteilProzent ?? 50));

    Object.values(uebung.nachrichten).forEach(nachrichtenListe => {
        const frei: Nachricht[] = [];

        nachrichtenListe.forEach(nachricht => {
            if (istZwingendSpruch(nachricht)) {
                nachricht.art = "spruch";
                return;
            }
            nachricht.art = "durchsage";
            const istAnmeldung = uebung.anmeldungAktiv && nachricht.id === 1;
            if (!istAnmeldung) {
                frei.push(nachricht);
            }
        });

        // Pro Teilnehmer aufteilen statt je Nachricht zu würfeln, damit der
        // eingestellte Anteil auch bei wenigen Nachrichten eingehalten wird.
        const zielSprueche = Math.round((frei.length * anteil) / 100);
        shuffle(frei, rng)
            .slice(0, zielSprueche)
            .forEach(nachricht => {
                nachricht.art = "spruch";
            });
    });
}

function setzeAnmeldungAufSlotNull(uebung: FunkUebung): void {
    for (const msgs of Object.values(uebung.nachrichten)) {
        const anmeldung = msgs.find(m => m.id === 1);
        if (anmeldung) {
            anmeldung.xZeitSlot = 0;
        }
    }
}

function sammleSlotNachrichten(uebung: FunkUebung): Nachricht[] {
    if (uebung.anmeldungAktiv) {
        setzeAnmeldungAufSlotNull(uebung);
    }
    const pool: Nachricht[] = [];
    for (const msgs of Object.values(uebung.nachrichten)) {
        for (const m of msgs) {
            if (uebung.anmeldungAktiv && m.id === 1) {
                continue;
            }
            pool.push(m);
        }
    }
    return pool;
}

/** Vergibt im X-Zeit-Modus jeder Nachricht ihre Minute. */
export function assignXZeitSlots(uebung: FunkUebung): void {
    if (uebung.spielModus !== "xZeit") {
        return;
    }

    const intervall = uebung.xZeitIntervallMinuten ?? 3;
    const startOffset = uebung.xZeitStartOffsetMinuten ?? 0;

    const pool = sammleSlotNachrichten(uebung);
    // Im Szenario-Modus bestimmt die globale Erzählreihenfolge die Slots,
    // im Zufallsmodus wie bisher die Runden-Reihenfolge über die ids.
    pool.sort((a, b) => (a.szenarioNr ?? a.id) - (b.szenarioNr ?? b.id));

    pool.forEach((m, globalIndex) => {
        m.xZeitSlot = startOffset + (globalIndex + 1) * intervall;
    });
}

function traegerNachrichtenFuer(uebung: FunkUebung, empfaenger: string): Nachricht[] {
    const nachrichtenFuerEmpfaenger: Nachricht[] = [];
    Object.entries(uebung.nachrichten).forEach(([absender, nachrichtenListe]) => {
        if (absender === empfaenger) {
            return;
        }
        nachrichtenListe.forEach(nachricht => {
            if (nachricht.empfaenger.includes(empfaenger) && nachricht.empfaenger.length === 1) {
                nachrichtenFuerEmpfaenger.push(nachricht);
            }
        });
    });
    nachrichtenFuerEmpfaenger.sort((a, b) => a.id - b.id);
    return nachrichtenFuerEmpfaenger;
}

function verteileLoesungswort(uebung: FunkUebung, empfaenger: string, loesungswort: string, rng: Rng): void {
    const buchstabenMitIndex = loesungswort
        .split("")
        .map((buchstabe, index) => `${index + 1}${buchstabe}`);

    const nachrichtenFuerEmpfaenger = traegerNachrichtenFuer(uebung, empfaenger);
    if (nachrichtenFuerEmpfaenger.length === 0) {
        return;
    }
    const ersteHaelfte = nachrichtenFuerEmpfaenger.slice(0, Math.ceil(nachrichtenFuerEmpfaenger.length / 2));

    shuffle(buchstabenMitIndex, rng).forEach((buchstabeMitIndex, i) => {
        const zielNachricht = i < ersteHaelfte.length
            ? ersteHaelfte[i]
            : nachrichtenFuerEmpfaenger[i % nachrichtenFuerEmpfaenger.length];

        if (!zielNachricht) {
            return;
        }
        zielNachricht.nachricht += ` ${buchstabeMitIndex}`;
        if (!zielNachricht.loesungsbuchstaben) {
            zielNachricht.loesungsbuchstaben = [];
        }
        zielNachricht.loesungsbuchstaben.push(buchstabeMitIndex);
    });
}

/** Hängt die Lösungsbuchstaben mit Index an einzeln adressierte Nachrichten an. */
export function verteileLoesungswoerterMitIndex(uebung: FunkUebung, rng: Rng): void {
    if (!uebung.loesungswoerter) {
        return;
    }

    Object.entries(uebung.loesungswoerter).forEach(([empfaenger, loesungswort]) => {
        if (loesungswort && loesungswort.length > 0) {
            verteileLoesungswort(uebung, empfaenger, loesungswort, rng);
        }
    });
}
