import type { FunkUebung } from "../models/FunkUebung";
import type { Nachricht } from "../types/Nachricht";
import { randomInt, shuffle, type Rng } from "../utils/random";

interface Summe {
    fuehrer: number;
    unterfuehrer: number;
    helfer: number;
    gesamt: number;
}

interface Staerke {
    fuehrer: number;
    unterfuehrer: number;
    helfer: number;
}

interface Empfangen {
    absender: string;
    nachricht: Nachricht;
}

const STAERKE_REGEX = /(\d{1,3})\s*\/+\s*(\d{1,3})\s*\/+\s*(\d{1,3})(?:\s*\/+\s*(\d{1,3}))?/g;
const STAERKE_TEST = /(\d+)\s*\/+\s*(\d+)\s*\/+\s*(\d+)(?:\s*\/+\s*(\d+))?/;

function empfaengerImTeilnehmerkreis(uebung: FunkUebung, sender: string, nachricht: Nachricht): string[] {
    if (nachricht.empfaenger.includes("Alle")) {
        return uebung.teilnehmerListe.filter(t => t !== sender);
    }
    return nachricht.empfaenger.filter(e => e !== sender && uebung.teilnehmerListe.includes(e));
}

function addiere(summen: Record<string, Summe>, empfaengerListe: string[], staerke: Staerke): void {
    const { fuehrer, unterfuehrer, helfer } = staerke;
    const gesamt = fuehrer + unterfuehrer + helfer;
    empfaengerListe.forEach(empfaenger => {
        const summe = summen[empfaenger];
        if (summe) {
            summe.fuehrer += fuehrer;
            summe.unterfuehrer += unterfuehrer;
            summe.helfer += helfer;
            summe.gesamt += gesamt;
        }
    });
}

/**
 * Liest Stärkeangaben aus dem Nachrichtentext und hinterlegt sie an der
 * Nachricht. Liefert die gefundenen Stärken.
 */
function staerkenAusText(nachricht: Nachricht): Staerke[] {
    const treffer = Array.from(nachricht.nachricht.matchAll(STAERKE_REGEX));
    if (treffer.length === 0) {
        return [];
    }
    const staerken = nachricht.staerken ?? [];
    nachricht.staerken = staerken;
    const gefunden: Staerke[] = [];
    treffer.forEach(match => {
        const [, fuehrerStr, unterfuehrerStr, helferStr] = match;
        if (!fuehrerStr || !unterfuehrerStr || !helferStr) {
            return;
        }
        const staerke = {
            fuehrer: parseInt(fuehrerStr, 10),
            unterfuehrer: parseInt(unterfuehrerStr, 10),
            helfer: parseInt(helferStr, 10)
        };
        staerken.push(staerke);
        gefunden.push(staerke);
    });
    return gefunden;
}

function summiereStaerken(uebung: FunkUebung): Record<string, Summe> {
    const summen: Record<string, Summe> = {};
    uebung.teilnehmerListe.forEach(t => {
        summen[t] = { fuehrer: 0, unterfuehrer: 0, helfer: 0, gesamt: 0 };
    });

    Object.entries(uebung.nachrichten).forEach(([sender, nachrichtenListe]) => {
        nachrichtenListe.forEach(nachricht => {
            const empfaengerListe = empfaengerImTeilnehmerkreis(uebung, sender, nachricht);
            const staerken = nachricht.staerken && nachricht.staerken.length > 0
                ? nachricht.staerken
                : staerkenAusText(nachricht);
            staerken.forEach(staerke => addiere(summen, empfaengerListe, staerke));
        });
    });
    return summen;
}

function empfangeneNachrichten(uebung: FunkUebung, teilnehmer: string): Empfangen[] {
    const empfangen: Empfangen[] = [];
    Object.entries(uebung.nachrichten).forEach(([absender, nachrichtenListe]) => {
        nachrichtenListe.forEach(nachricht => {
            if (nachricht.empfaenger.includes(teilnehmer)) {
                empfangen.push({ absender, nachricht });
            }
        });
    });
    return empfangen;
}

function benoetigteStaerken(totalNachrichten: number, einzelnEmpfangene: Empfangen[]): number {
    const vorhandeneStaerken = einzelnEmpfangene.filter(e => STAERKE_TEST.test(e.nachricht.nachricht)).length;
    if (totalNachrichten >= 10) {
        const zielMindestanzahl = Math.max(2, Math.ceil(einzelnEmpfangene.length * 0.2));
        return Math.max(0, zielMindestanzahl - vorhandeneStaerken);
    }
    if (totalNachrichten > 0) {
        return Math.max(0, 1 - vorhandeneStaerken);
    }
    return 0;
}

/** Ergänzt für einen Teilnehmer ohne Stärkemeldung zufällige Stärken. */
function ergaenzeStaerkenFuer(uebung: FunkUebung, teilnehmer: string, rng: Rng): boolean {
    const empfangen = empfangeneNachrichten(uebung, teilnehmer);
    const einzelnEmpfangene = empfangen.filter(e => e.nachricht.empfaenger.length === 1);
    const anzahlStaerken = benoetigteStaerken(empfangen.length, einzelnEmpfangene);

    let auszuwaehlende: Empfangen[] = [];
    if (einzelnEmpfangene.length > 0 && anzahlStaerken > 0) {
        const ohneStaerke = einzelnEmpfangene.filter(e => !STAERKE_TEST.test(e.nachricht.nachricht));
        auszuwaehlende = shuffle(ohneStaerke, rng).slice(0, anzahlStaerken);
    }

    let hinzugefuegt = false;
    for (const eintrag of auszuwaehlende) {
        if (eintrag.nachricht.empfaenger && eintrag.nachricht.empfaenger.length > 0) {
            const fuehrer = randomInt(4, rng);
            const unterfuehrer = randomInt(9, rng);
            const helfer = randomInt(31, rng);
            const gesamt = fuehrer + unterfuehrer + helfer;
            eintrag.nachricht.nachricht += ` Aktuelle Stärke: ${fuehrer}/${unterfuehrer}/${helfer}/${gesamt}`;
            eintrag.nachricht.staerken = [{ fuehrer, unterfuehrer, helfer }];
            hinzugefuegt = true;
        }
    }
    return hinzugefuegt;
}

/**
 * Summiert je Teilnehmer die empfangenen Stärken (Soll-Stärke). Mit
 * `autoStaerkeErgaenzen` bekommen Teilnehmer ohne jede Stärkemeldung
 * zufällige Stärken angehängt; danach wird einmal neu gerechnet.
 */
export function berechneLoesungsStaerken(uebung: FunkUebung, rng: Rng): void {
    const summen = summiereStaerken(uebung);
    const loesungsStaerken: Record<string, string> = {};
    uebung.loesungsStaerken = loesungsStaerken;
    Object.entries(summen).forEach(([teilnehmer, werte]) => {
        loesungsStaerken[teilnehmer] = `${werte.fuehrer}/${werte.unterfuehrer}/${werte.helfer}/${werte.gesamt}`;
    });

    if (!uebung.autoStaerkeErgaenzen) {
        return;
    }
    let staerkenHinzugefuegt = false;
    for (const teilnehmer of uebung.teilnehmerListe) {
        if (loesungsStaerken[teilnehmer] === "0/0/0/0" && ergaenzeStaerkenFuer(uebung, teilnehmer, rng)) {
            staerkenHinzugefuegt = true;
        }
    }
    if (staerkenHinzugefuegt) {
        berechneLoesungsStaerken(uebung, rng);
    }
}
