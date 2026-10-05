import { FunkUebung } from "../models/FunkUebung";
import type { LoesungswortOption } from "./GeneratorStateService";
import type { GeneratorEntwurf } from "./GeneratorEntwurf";

/**
 * Zustandslose Hilfen des GeneratorControllers: Texte, Normalisierung,
 * Fingerabdruck und kleine DOM-Zugriffe, die ohne Controller auskommen.
 */

/** Wie eine schon gespeicherte Übung erneut generiert wird. */
export type GenerierModus = "neu" | "ueberschreiben";

/** Ohne Antwort des Servers nach dieser Zeit gilt das Speichern als gescheitert. */
export const SPEICHERN_ZEITLIMIT_MS = 15000;
export const ENTWURF_VERZOEGERUNG_MS = 400;
/** Leere Zeilen einer neuen Übung: Beispielnamen stehen nur als Platzhalter da. */
export const LEERE_TEILNEHMERZEILEN = 3;

export const VORDEFINIERTE_LOESUNGSWOERTER: readonly string[] = [
    "Funkverkehr", "Rettungswagen", "Notruf", "Blaulicht", "Funkdisziplin",
    "Einsatzleitung", "Mikrofon", "Durchsage", "Sprechgruppe", "Digitalfunk",
    "Frequenz", "Funkstille", "Antennenmast", "Feuerwehr", "Katastrophenschutz",
    "Alarmierung", "Fernmelder", "Kommunikation", "Verständigung", "Sicherheitszone",
    "Einsatzplan", "Koordination", "Funkgerät", "Signalstärke", "Verbindung",
    "Repeater", "Einsatzbesprechung", "Lautstärke", "Funkkanal", "Empfang",
    "Relaisstation", "Funkraum", "Gruppenruf", "Rückmeldung", "Einsatzgebiet",
    "Wellenlänge", "Übertragung", "Ausfallsicherheit", "Rescue", "Einsatzwagen"
];

export class ZeitlimitFehler extends Error {}

export function mitZeitlimit<T>(versprechen: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ablauf = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ZeitlimitFehler("Zeitlimit")), SPEICHERN_ZEITLIMIT_MS);
    });
    return Promise.race([versprechen, ablauf]).finally(() => clearTimeout(timer));
}

/** Rückfrage vor dem Überschreiben; „Als neue Übung“ fragt nicht nach. */
export function rueckfrageText(uebungName: string): string {
    const name = uebungName || "ohne Namen";
    return [
        `Bestehende Übung „${name}“ überschreiben?`,
        "",
        "Die Funksprüche werden neu verteilt, Übungscode und Teilnehmer-Links bleiben gleich. Danach gilt:",
        "• Verteilte Ausdrucke und Vordrucke passen nicht mehr zur Übung.",
        "• Geöffnete Teilnehmer-Links zeigen andere Funksprüche; umbenannte Teilnehmer bekommen einen neuen Code.",
        "• Der Übungsstand wird für alle zurückgesetzt: abgesetzte Sprüche, Anmeldungen, empfangene " +
        "Lösungswörter und Stärken sowie die Notizen der Übungsleitung. Sie gehören zur alten Fassung. " +
        "Wer ihn behalten will, sichert ihn vorher in der Übungsleitung mit „Übungsleitung als PDF“.",
        "• Geänderte Lösungswörter gelten sofort, auch gegenüber schon ausgedruckten.",
        "",
        "Das lässt sich nicht rückgängig machen."
    ].join("\n");
}

/**
 * Nach einem Fehler oder Zeitlimit. Ein abgelaufenes Zeitlimit heißt nicht
 * „nicht gespeichert“: Der Schreibvorgang bleibt in der Warteschlange und kann
 * ankommen, sobald die Verbindung zurück ist (THW-Review 2026-10-05,
 * offline-resilience P2-1).
 */
export function speicherFehlerText(error: unknown, warGespeichert: boolean): string {
    if (error instanceof ZeitlimitFehler) {
        const folge = warGespeichert
            ? "Unten stehen weiter die Links der zuletzt bestätigten Fassung. Kommt das Speichern noch an, " +
              "gilt die neue Fassung. Öffne die Übung später mit Netz über ihren Bearbeiten-Link neu, um zu sehen, welche gilt."
            : "Gib noch keine Links weiter. Kommt das Speichern noch an, erscheint die Übung später unter " +
              "„Gespeicherte Übungen“; erzeugst du sie jetzt neu, gibt es sie dann womöglich doppelt.";
        return "Speichern nicht bestätigt: Der Server hat nicht rechtzeitig geantwortet, vermutlich keine oder eine " +
            `schwache Internetverbindung. Das Speichern kann noch ankommen, solange diese Seite offen ist. ${folge}`;
    }
    const stand = warGespeichert
        ? "Es wurde nichts verändert: Die angezeigten Links gehören weiter zur zuletzt gespeicherten Fassung."
        : "Gib noch keine Links weiter – es gibt noch keine gespeicherte Übung.";
    return `Die Übung wurde nicht gespeichert. Prüfe die Internetverbindung. ${stand}`;
}

/** Rückmeldung nach erneutem Generieren einer schon gespeicherten Übung. */
export function erfolgsText(modus: GenerierModus, uebungCode: string, statusZurueckgesetzt = true): string {
    if (modus === "neu") {
        return `Neue Übung angelegt (Übungscode ${uebungCode}). Die bisherige Übung bleibt unverändert. ` +
            "Die Links unten gehören zur neuen Übung.";
    }
    return statusZurueckgesetzt
        ? "Übung überschrieben, der Übungsstand ist für alle zurückgesetzt. Verteile die Unterlagen neu."
        : "Übung überschrieben. Das Zurücksetzen des Übungsstands hat der Server noch nicht bestätigt; es wird " +
          "nachgereicht, solange diese Seite offen ist. Zeigt die Übungsleitung noch alte Status, setze sie dort zurück. " +
          "Verteile die Unterlagen neu.";
}

/**
 * Name für „Als neue Übung“: Hat der Nutzer ihn nicht geändert, bekommt er
 * einen Zusatz („(2)“, „(3)“ …), sonst gäbe es zwei gleichnamige Übungen.
 */
export function nameFuerNeueUebung(name: string, bisherigerName: string): string {
    const aktuell = (name ?? "").trim();
    if (aktuell === "" || aktuell !== (bisherigerName ?? "").trim()) {
        return name;
    }
    const treffer = /^(.*?)\s*\((\d+)\)$/.exec(aktuell);
    return treffer
        ? `${treffer[1]} (${Number(treffer[2]) + 1})`
        : `${aktuell} (2)`;
}

export function setzeNameImFormular(name: string): void {
    if (typeof document === "undefined" || typeof document.getElementById !== "function") {
        return;
    }
    const input = document.getElementById("nameDerUebung") as HTMLInputElement | null;
    if (input) {
        input.value = name;
    }
}

/**
 * Vereinheitlicht Zeilen aus Vorlagen/Upload und entfernt Dubletten.
 * Doppelte Zeilen (auch über mehrere Vorlagen hinweg oder mit abweichender
 * Groß-/Kleinschreibung) würden sonst zwangsläufig bei mehreren Teilnehmern landen.
 */
export function normalizeFunksprueche(lines: string[]): string[] {
    const gesehen = new Set<string>();
    const result: string[] = [];
    for (const line of lines) {
        const text = line.normalize("NFKC").replace(/\s+/g, " ").trim();
        const key = text.toLowerCase();
        if (text === "" || gesehen.has(key)) {
            continue;
        }
        gesehen.add(key);
        result.push(text);
    }
    return result;
}

export function createConfigFingerprint(uebung: FunkUebung): string {
    const date = new Date(uebung.datum);
    const dateOnly = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return JSON.stringify({
        name: uebung.name,
        datum: dateOnly,
        rufgruppe: uebung.rufgruppe,
        leitung: uebung.leitung,
        teilnehmerListe: uebung.teilnehmerListe,
        teilnehmerStellen: uebung.teilnehmerStellen || {},
        spruecheProTeilnehmer: uebung.spruecheProTeilnehmer,
        spruecheAnAlle: uebung.spruecheAnAlle,
        spruecheAnMehrere: uebung.spruecheAnMehrere,
        buchstabierenAn: uebung.buchstabierenAn,
        anmeldungAktiv: uebung.anmeldungAktiv,
        nachrichtenArtAktiv: uebung.nachrichtenArtAktiv ?? false,
        spruchAnteilProzent: uebung.spruchAnteilProzent ?? 50,
        loesungswoerter: uebung.loesungswoerter || {},
        loesungsStaerken: uebung.loesungsStaerken || {},
        szenarioSlug: uebung.szenarioSlug ?? null,
        fuehrungsstelle: uebung.fuehrungsstelle ?? null
    });
}

export function optionAusWoertern(woerter: Record<string, string> | undefined): LoesungswortOption {
    const werte = Object.values(woerter ?? {}).filter(w => typeof w === "string" && w.trim() !== "");
    if (werte.length === 0) {
        return "none";
    }
    return new Set(werte).size === 1 ? "central" : "individual";
}

export function endlich(wert: number | undefined, ersatz: number): number {
    return typeof wert === "number" && Number.isFinite(wert) ? wert : ersatz;
}

/**
 * Eine neue Übung startet ohne fremde Beispielwerte: Funkrufnamen,
 * Rufgruppe und Leitung stehen nur als Platzhalter im Formular
 * (THW-Review new-user P1-3, workflow F7).
 */
export function leereBeispielwerte(uebung: FunkUebung): void {
    uebung.teilnehmerListe = Array.from({ length: LEERE_TEILNEHMERZEILEN }, () => "");
    uebung.teilnehmerStellen = {};
    uebung.rufgruppe = "";
    uebung.leitung = "";
}

/** Tiefe Kopie der Übung, um nach einem Fehlschlag den alten Stand zurückzuholen. */
export function sichereZustand(uebung: FunkUebung, buildInfo: string): FunkUebung {
    const kopie = typeof structuredClone === "function"
        ? structuredClone({ ...uebung })
        : JSON.parse(JSON.stringify(uebung));
    return Object.assign(new FunkUebung(buildInfo), kopie);
}

/** Neue Identität für eine Kopie: neue ID, neue Codes, neue Verteilung. */
export function alsNeueUebungVorbereiten(uebung: FunkUebung, buildInfo: string): void {
    const frisch = new FunkUebung(buildInfo);
    uebung.id = frisch.id;
    uebung.uebungCode = "";
    uebung.teilnehmerIds = {};
    uebung.nachrichten = {};
    delete uebung.seed;
    uebung.createDate = frisch.createDate;
    uebung.checksumme = "";
}

/** Rohwert eines Zahlenfelds; undefined, wenn es das Feld nicht gibt. */
export function leseZahlAusFormular(id: string): number | undefined {
    if (typeof document === "undefined" || typeof document.getElementById !== "function") {
        return undefined;
    }
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (!input || typeof input.value !== "string") {
        return undefined;
    }
    return input.value.trim() === "" ? Number.NaN : Number(input.value);
}

export function leseLoesungswortZeile(index: number): string | undefined {
    if (typeof document === "undefined") {
        return undefined;
    }
    const input = document.getElementById(`loesungswort-${index}`) as HTMLInputElement | null;
    const wert = input?.value?.trim().toUpperCase();
    return wert ? wert : undefined;
}

export function setzeZentralesWortImFormular(wort: string): void {
    if (typeof document === "undefined") {
        return;
    }
    const input = document.getElementById("zentralLoesungswortInput") as HTMLInputElement | null;
    if (input) {
        input.value = wort;
    }
}

/**
 * Nach dem Generieren steht die Übungs-ID in der Adresse: Reload, Zurück
 * und Lesezeichen führen wieder zum Ergebnis (THW-Review stress-test P2-1).
 * replaceState löst kein hashchange aus, das Formular bleibt, wie es ist.
 */
export function setzeAdresseAufUebung(uebungId: string): void {
    if (typeof window === "undefined" || typeof window.history?.replaceState !== "function") {
        return;
    }
    const ziel = `#/generator/${uebungId}`;
    if (window.location?.hash !== ziel) {
        window.history.replaceState(window.history.state, "", ziel);
    }
}

/** Rohdaten des Formulars, wie GeneratorView.getFormData sie liefert. */
type Formular = Partial<FunkUebung>;

function gueltigesDatum(datum: unknown): Date {
    return datum instanceof Date && !Number.isNaN(datum.getTime()) ? datum : new Date();
}

function text(wert: string | undefined): string {
    return wert ?? "";
}

function schalter(wert: boolean | undefined, ersatz: boolean): boolean {
    return wert ?? ersatz;
}

/** Formularteil eines Entwurfs: fehlende oder unendliche Werte bekommen die Vorgaben. */
export function formularFuerEntwurf(formular: Formular): GeneratorEntwurf["formular"] {
    return {
        name: text(formular.name),
        datum: gueltigesDatum(formular.datum).toISOString(),
        rufgruppe: text(formular.rufgruppe),
        leitung: text(formular.leitung),
        spruecheProTeilnehmer: endlich(formular.spruecheProTeilnehmer, 10),
        spruecheAnAlle: endlich(formular.spruecheAnAlle, 0),
        spruecheAnMehrere: endlich(formular.spruecheAnMehrere, 0),
        buchstabierenAn: endlich(formular.buchstabierenAn, 0),
        anmeldungAktiv: schalter(formular.anmeldungAktiv, true),
        autoStaerkeErgaenzen: schalter(formular.autoStaerkeErgaenzen, true),
        nachrichtenArtAktiv: schalter(formular.nachrichtenArtAktiv, false),
        spruchAnteilProzent: endlich(formular.spruchAnteilProzent, 50),
        spielModus: formular.spielModus === "xZeit" ? "xZeit" : "klassisch",
        xZeitIntervallMinuten: endlich(formular.xZeitIntervallMinuten, 3),
        xZeitStartOffsetMinuten: endlich(formular.xZeitStartOffsetMinuten, 0)
    };
}
