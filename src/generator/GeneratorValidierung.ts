/**
 * Eingabeprüfung des Generators als reine Funktionen. Jede Prüfung liefert
 * Fehler mit Feldbezug, damit die Ansicht das betroffene Feld markieren und
 * den Text daneben stehen lassen kann – ein Toast allein ist nach 2,5 s weg.
 *
 * `feld` ist die Element-ID im Generator-Formular; Teilnehmerzeilen heißen
 * `teilnehmer-<index>` (Index in der Liste, wie die Tabelle sie zeichnet),
 * die Vorlagenauswahl heißt `funkspruchVorlage`.
 */

import { SHORT_CODE_ALPHABET, TEILNEHMER_CODE_LENGTH, UEBUNG_CODE_LENGTH } from "../services/generationCodes";

export interface FeldFehler {
    feld: string;
    text: string;
}

/**
 * Obergrenze für „Funksprüche pro Teilnehmer“. 9999 froren den Tab im Test
 * ein (THW-Review error-recovery P2-2), 1000 liefen in unter einer Sekunde.
 * 200 reicht für mehrere Übungsabende und bleibt auf schwachen Geräten flüssig.
 */
export const MAX_SPRUECHE_PRO_TEILNEHMER = 200;

/** Sammeltext für doppelte Funkrufnamen; E2E-Tests und Nutzer kennen ihn. */
export const MELDUNG_DOPPELTE_NAMEN = "Teilnehmernamen müssen eindeutig sein.";
export const MELDUNG_KEIN_TEILNEHMER = "Bitte mindestens einen Teilnehmer mit Funkrufnamen angeben.";

/**
 * Vergleichsschlüssel für Funkrufnamen: Groß-/Kleinschreibung und
 * Leerraum zählen am Funkgerät nicht, „Heros Oldenburg 21/11“ und
 * „heros  oldenburg 21/11 “ sind derselbe Rufname.
 */
export function funkrufnameSchluessel(name: string): string {
    return name.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");
}

export interface TeilnehmerPruefung {
    /** Getrimmte, nicht leere Namen in Listenreihenfolge. */
    namen: string[];
    fehler: FeldFehler[];
    /** Kurzfassung für Toast und Fehlerkasten; leer, wenn alles passt. */
    meldung: string;
}

export function pruefeTeilnehmerListe(liste: readonly string[]): TeilnehmerPruefung {
    const eintraege = liste.map((roh, index) => ({ index, name: (roh ?? "").trim() }));
    const gefuellt = eintraege.filter(eintrag => eintrag.name.length > 0);
    if (gefuellt.length === 0) {
        return {
            namen: [],
            fehler: [{ feld: "teilnehmer-0", text: "Trag hier den Funkrufnamen des ersten Teilnehmers ein." }],
            meldung: MELDUNG_KEIN_TEILNEHMER
        };
    }

    const nachSchluessel = new Map<string, number[]>();
    gefuellt.forEach(eintrag => {
        const schluessel = funkrufnameSchluessel(eintrag.name);
        nachSchluessel.set(schluessel, [...(nachSchluessel.get(schluessel) ?? []), eintrag.index]);
    });

    const fehler: FeldFehler[] = [];
    nachSchluessel.forEach(indizes => {
        if (indizes.length < 2) {
            return;
        }
        indizes.forEach(index => {
            const andere = indizes.filter(i => i !== index).map(i => i + 1).join(", ");
            fehler.push({
                feld: `teilnehmer-${index}`,
                text: `Gleicher Funkrufname wie in Zeile ${andere} (Groß-/Kleinschreibung und Leerzeichen zählen nicht).`
            });
        });
    });
    fehler.sort((a, b) => Number(a.feld.split("-")[1]) - Number(b.feld.split("-")[1]));

    return {
        namen: gefuellt.map(eintrag => eintrag.name),
        fehler,
        meldung: fehler.length > 0 ? MELDUNG_DOPPELTE_NAMEN : ""
    };
}

export interface VerteilungsWerte {
    spruecheProTeilnehmer: number;
    spruecheAnAlle: number;
    spruecheAnMehrere: number;
    anmeldungAktiv: boolean;
    /** Rohwerte der Prozentfelder; fehlende Felder werden nicht geprüft. */
    prozent?: Partial<Record<"prozentAnAlle" | "prozentAnMehrere" | "prozentAnBuchstabieren" | "prozentSprueche", number | undefined>>;
}

export function pruefeVerteilung(werte: VerteilungsWerte): FeldFehler[] {
    const fehler: FeldFehler[] = [];
    const pro = werte.spruecheProTeilnehmer;
    if (!Number.isInteger(pro) || pro < 1) {
        fehler.push({ feld: "spruecheProTeilnehmer", text: "Bitte eine ganze Zahl ab 1 eintragen." });
    } else if (pro > MAX_SPRUECHE_PRO_TEILNEHMER) {
        fehler.push({
            feld: "spruecheProTeilnehmer",
            text: `Höchstens ${MAX_SPRUECHE_PRO_TEILNEHMER} Funksprüche pro Teilnehmer. ` +
                "Mehr lässt sich an einem Übungsabend nicht abarbeiten und blockiert den Browser lange."
        });
    }

    Object.entries(werte.prozent ?? {}).forEach(([feld, wert]) => {
        if (wert === undefined) {
            return;
        }
        if (!Number.isFinite(wert) || wert < 0 || wert > 100) {
            fehler.push({ feld, text: "Bitte einen Wert von 0 bis 100 eintragen." });
        }
    });

    if (fehler.length === 0) {
        const anmeldung = werte.anmeldungAktiv ? 1 : 0;
        const mindestens = anmeldung + werte.spruecheAnAlle + werte.spruecheAnMehrere;
        if (pro < mindestens) {
            fehler.push({
                feld: "spruecheProTeilnehmer",
                text: `Zu wenig: Anmeldung, „an Alle“ und „an Mehrere“ brauchen zusammen ${mindestens} Funksprüche pro Teilnehmer.`
            });
        }
    }
    return fehler;
}

export function pruefeKopfdaten(werte: { leitung: string }): FeldFehler[] {
    if ((werte.leitung ?? "").trim() === "") {
        return [{
            feld: "leitung",
            text: "Bitte den Funkrufnamen der Übungsleitung eintragen – an ihn gehen die Anmeldungen."
        }];
    }
    return [];
}

/**
 * Rollen der Führungsstellen-Übung: Jede Stelle braucht einen eigenen
 * Funkrufnamen. Die Abschnittsfelder heißen `abschnitt-<index>`.
 */
export function pruefeFuehrungsstellenRollen(rollen: {
    beuebteStelle: string;
    uebergeordnet: string;
    unterstellt: readonly string[];
}): FeldFehler[] {
    const felder: { feld: string; name: string }[] = [
        { feld: "fuehrungsstelleBeuebteStelle", name: rollen.beuebteStelle },
        { feld: "fuehrungsstelleUebergeordnet", name: rollen.uebergeordnet },
        ...rollen.unterstellt.map((name, index) => ({ feld: `abschnitt-${index}`, name }))
    ];
    const fehler: FeldFehler[] = [];
    const gesehen = new Map<string, string>();
    felder.forEach(({ feld, name }) => {
        const schluessel = funkrufnameSchluessel(name ?? "");
        if (schluessel === "") {
            fehler.push({
                feld,
                text: feld.startsWith("abschnitt-")
                    ? "Bitte einen Funkrufnamen eintragen oder die Zeile mit × entfernen."
                    : "Bitte einen Funkrufnamen eintragen."
            });
            return;
        }
        if (gesehen.has(schluessel)) {
            fehler.push({ feld, text: `Dieser Funkrufname ist schon vergeben („${gesehen.get(schluessel)}“).` });
            return;
        }
        gesehen.set(schluessel, (name ?? "").trim());
    });
    return fehler;
}

export function pruefeXZeit(werte: {
    aktiv: boolean;
    intervall?: number | undefined;
    startOffset?: number | undefined;
}): FeldFehler[] {
    if (!werte.aktiv) {
        return [];
    }
    const fehler: FeldFehler[] = [];
    if (werte.intervall !== undefined && (!Number.isInteger(werte.intervall) || werte.intervall < 1)) {
        fehler.push({ feld: "xZeitIntervallMinuten", text: "Bitte eine ganze Zahl ab 1 Minute eintragen." });
    }
    if (werte.startOffset !== undefined && (!Number.isInteger(werte.startOffset) || werte.startOffset < 0)) {
        fehler.push({ feld: "xZeitStartOffsetMinuten", text: "Bitte eine ganze Zahl ab 0 Minuten eintragen." });
    }
    return fehler;
}

const QUICKJOIN_FELDER = {
    uebung: "generatorQuickJoinUebungCode",
    teilnehmer: "generatorQuickJoinTeilnehmerCode"
} as const;

function pruefeEinenCode(code: string, laenge: number, art: "Übungscode" | "Teilnehmercode"): string | null {
    if (code === "") {
        return `Bitte den ${art} eintragen (${laenge} Zeichen).`;
    }
    const fremd = [...new Set([...code].filter(zeichen => !SHORT_CODE_ALPHABET.includes(zeichen)))];
    if (fremd.length > 0) {
        return `„${fremd.join("“, „")}“ kommt in Codes nicht vor. Codes enthalten kein O, 0, I oder 1 ` +
            "und keine Sonderzeichen; sieh bei Q, G und 6 genau hin.";
    }
    if (code.length !== laenge) {
        return `Der ${art} hat ${laenge} Zeichen, eingegeben sind ${code.length}.`;
    }
    return null;
}

/**
 * Codes im Schnellzugang der Startseite. Eine falsche Länge führte bisher
 * ohne Meldung ins Code-Formular (THW-Review 2026-10-05, error-recovery P3-3).
 * Erwartet die Codes bereits getrimmt und in Großbuchstaben.
 */
export function pruefeZugangsCodes(uebungCode: string, teilnehmerCode: string): FeldFehler[] {
    const fehler: FeldFehler[] = [];
    const uebung = pruefeEinenCode(uebungCode, UEBUNG_CODE_LENGTH, "Übungscode");
    if (uebung) {
        fehler.push({ feld: QUICKJOIN_FELDER.uebung, text: uebung });
    }
    const teilnehmer = pruefeEinenCode(teilnehmerCode, TEILNEHMER_CODE_LENGTH, "Teilnehmercode");
    if (teilnehmer) {
        fehler.push({ feld: QUICKJOIN_FELDER.teilnehmer, text: teilnehmer });
    }
    return fehler;
}
