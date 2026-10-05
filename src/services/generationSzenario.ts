import type { FunkUebung } from "../models/FunkUebung";
import type { Nachricht } from "../types/Nachricht";
import { randomInt, shuffle, type Rng } from "../utils/random";
import {
    szenarioMaxTeilnehmer,
    type Szenario,
    type SzenarioEmpfaenger
} from "../types/Szenario";

const ANMELDUNG_TEXT = "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.";

/** Rollen eines Handlungsstrangs bzw. eines Rahmenspruchs. */
interface Rollen {
    ich: string;
    partner: string;
    gegenstelle: string;
}

interface StrangInstanz extends Rollen {
    sprueche: Szenario["straenge"][number]["sprueche"];
}

interface Ereignis {
    sender: string;
    empfaenger: string[];
    text: string;
}

interface SzenarioSpruch {
    empfaenger: SzenarioEmpfaenger;
    text: string;
}

function pruefeTeilnehmerzahl(anzahl: number, szenario: Szenario): void {
    const minTeilnehmer = Math.max(2, szenario.minTeilnehmer);
    const maxTeilnehmer = szenarioMaxTeilnehmer(szenario);
    if (anzahl < minTeilnehmer || anzahl > maxTeilnehmer) {
        throw new Error(
            `Szenario "${szenario.titel}" ist für ${minTeilnehmer} bis ${maxTeilnehmer} ` +
            `Teilnehmer ausgelegt, die Übung hat ${anzahl}.`
        );
    }
}

function aufloesenEmpfaenger(
    empfaenger: SzenarioEmpfaenger,
    sender: string,
    rollen: Rollen,
    teilnehmer: string[]
): string[] {
    switch (empfaenger) {
        case "gegenstelle":
            // Bei zwei Teilnehmern kann die Gegenstelle der Partner und
            // damit der Sender selbst sein — dann empfängt der Inhaber.
            return [rollen.gegenstelle !== sender ? rollen.gegenstelle : rollen.ich];
        case "alle":
            return teilnehmer.filter(t => t !== sender);
        case "ich":
            return [rollen.ich];
        case "partner":
            return [rollen.partner];
    }
}

function aufloesenText(text: string, rollen: Rollen): string {
    return text
        .replace(/\{\{ich\}\}/g, rollen.ich)
        .replace(/\{\{partner\}\}/g, rollen.partner)
        .replace(/\{\{gegenstelle\}\}/g, rollen.gegenstelle);
}

function ereignis(spruch: SzenarioSpruch, sender: string, rollen: Rollen, teilnehmer: string[]): Ereignis {
    return {
        sender,
        empfaenger: aufloesenEmpfaenger(spruch.empfaenger, sender, rollen, teilnehmer),
        text: aufloesenText(spruch.text, rollen)
    };
}

/** Rahmenspruch: Absender ist zugleich ich, Partner und Gegenstelle. */
function rahmenEreignis(spruch: SzenarioSpruch, sender: string, teilnehmer: string[]): Ereignis {
    return ereignis(spruch, sender, { ich: sender, partner: sender, gegenstelle: sender }, teilnehmer);
}

/**
 * Stränge seeded mischen und reihum an die Teilnehmer vergeben; die
 * Teilnehmer-Reihenfolge wird ebenfalls gemischt, damit nicht immer
 * die ersten Namen der Liste die meisten Stränge bekommen. Mit der
 * Übungsleitung wird nicht kommuniziert — Meldungen eines Strangs
 * empfängt eine je Strang fest zugeloste Gegenstelle (anderer
 * Teilnehmer), bevorzugt jemand Drittes neben dem Partner.
 */
function bildeInstanzen(
    szenario: Szenario,
    teilnehmer: string[],
    rotation: string[],
    rng: Rng
): StrangInstanz[] {
    const anzahl = teilnehmer.length;
    return shuffle(szenario.straenge, rng).map((strang, index) => {
        const ich = rotation[index % anzahl] as string;
        const andere = teilnehmer.filter(t => t !== ich);
        const partner = andere[randomInt(andere.length, rng)] ?? ich;
        const dritte = andere.filter(t => t !== partner);
        const gegenstelle = dritte.length > 0
            ? dritte[randomInt(dritte.length, rng)] ?? partner
            : partner;
        return { ich, partner, gegenstelle, sprueche: strang.sprueche };
    });
}

/**
 * Verzahnung: Multimenge der Strang-Indizes mischen — das ergibt eine
 * gleichverteilte globale Reihenfolge, in der jeder Strang seine
 * interne Spruch-Reihenfolge behält.
 */
function verzahneStraenge(instanzen: StrangInstanz[], teilnehmer: string[], rng: Rng): Ereignis[] {
    const ereignisse: Ereignis[] = [];
    const folge = shuffle(
        instanzen.flatMap((instanz, index) => instanz.sprueche.map(() => index)),
        rng
    );
    const zeiger = instanzen.map(() => 0);
    folge.forEach(index => {
        const instanz = instanzen[index];
        if (!instanz) {
            return;
        }
        const spruch = instanz.sprueche[zeiger[index] ?? 0];
        zeiger[index] = (zeiger[index] ?? 0) + 1;
        if (!spruch) {
            return;
        }
        const sender = spruch.absender === "partner" ? instanz.partner : instanz.ich;
        ereignisse.push(ereignis(spruch, sender, instanz, teilnehmer));
    });
    return ereignisse;
}

function baueVerteilung(uebung: FunkUebung, ereignisse: Ereignis[]): Record<string, Nachricht[]> {
    const teilnehmer = uebung.teilnehmerListe;
    const verteilung: Record<string, Nachricht[]> = {};
    const zaehler: Record<string, number> = {};
    let szenarioNr = 1;
    teilnehmer.forEach(t => {
        verteilung[t] = [];
        zaehler[t] = 1;
    });
    if (uebung.anmeldungAktiv) {
        teilnehmer.forEach(t => {
            verteilung[t]?.push({
                id: 1,
                nachricht: ANMELDUNG_TEXT,
                empfaenger: [uebung.leitung],
                szenarioNr: szenarioNr++
            });
            zaehler[t] = 2;
        });
    }
    ereignisse.forEach(e => {
        const naechsteId = zaehler[e.sender] ?? 1;
        zaehler[e.sender] = naechsteId + 1;
        verteilung[e.sender]?.push({
            id: naechsteId,
            nachricht: e.text,
            empfaenger: e.empfaenger,
            szenarioNr: szenarioNr++
        });
    });
    return verteilung;
}

/**
 * Erzeugt die Nachrichten aus einem Szenario-Drehbuch statt aus dem
 * Zufallspool.
 *
 * Skalierung auf die variable Teilnehmerzahl: Die Handlungsstränge des
 * Szenarios werden (seeded) gemischt und reihum an die Teilnehmer
 * vergeben — bei wenigen Teilnehmern übernimmt jeder mehrere Stränge,
 * höchstens gibt es so viele Teilnehmer wie Stränge. Je Strang wird ein
 * Partner zugelost. Die Stränge laufen anschließend zeitlich verzahnt
 * (seeded gemischte globale Reihenfolge, die die Reihenfolge innerhalb
 * jedes Strangs bewahrt) — wie parallele Einsatzstellen derselben Lage.
 *
 * `id` bleibt wie im Zufallsmodus die lückenlose Sende-Reihenfolge je
 * Absender (Anmeldung = 1); zusätzlich erhält jede Nachricht mit
 * `szenarioNr` die global eindeutige Erzählposition, nach der die
 * senderübergreifenden Ansichten sortieren.
 */
export function verteileNachrichtenNachSzenario(
    uebung: FunkUebung,
    szenario: Szenario,
    rng: Rng
): Record<string, Nachricht[]> {
    const teilnehmer = uebung.teilnehmerListe;
    const anzahl = teilnehmer.length;
    pruefeTeilnehmerzahl(anzahl, szenario);

    const rotation = shuffle(teilnehmer, rng);
    const instanzen = bildeInstanzen(szenario, teilnehmer, rotation, rng);

    // Rahmensprüche: Absender rotieren über die gemischte Teilnehmerfolge.
    const einleitung = szenario.einleitung.map((spruch, index) =>
        rahmenEreignis(spruch, rotation[index % anzahl] as string, teilnehmer)
    );
    const straenge = verzahneStraenge(instanzen, teilnehmer, rng);
    const abschluss = szenario.abschluss.map((spruch, index) =>
        rahmenEreignis(spruch, rotation[(szenario.einleitung.length + index) % anzahl] as string, teilnehmer)
    );

    return baueVerteilung(uebung, [...einleitung, ...straenge, ...abschluss]);
}
