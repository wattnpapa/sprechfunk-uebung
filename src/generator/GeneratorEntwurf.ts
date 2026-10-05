import type { FunkUebung } from "../models/FunkUebung";
import type { FuehrungsstellenKonfiguration } from "../types/FuehrungsstellenUebung";
import type { LoesungswortOption } from "./GeneratorStateService";

/**
 * Entwurf des Generator-Formulars im localStorage. Ein Reload, eine
 * Wischgeste oder ein abgestürzter Tab kosteten bisher alle Eingaben
 * (THW-Review stress-test P1-4, error-recovery P1-3). Der Entwurf gilt nur
 * für eine noch nicht gespeicherte Übung; nach dem Generieren steht die
 * Übungs-ID in der Adresse und der Entwurf wird verworfen.
 *
 * Bewusst nur pro Gerät und Browser: Das ist eine Bequemlichkeit, kein
 * Speicherort. Jeder Zugriff ist abgesichert, damit ein privates Fenster
 * oder gesperrter Speicher den Generator nicht stört.
 */

export const ENTWURF_SCHLUESSEL = "generatorEntwurf:v1";

export type EntwurfQuelle = "vorlagen" | "upload" | "szenario" | "fuehrungsstelle";

export interface EntwurfFormular {
    name: string;
    datum: string;
    rufgruppe: string;
    leitung: string;
    spruecheProTeilnehmer: number;
    spruecheAnAlle: number;
    spruecheAnMehrere: number;
    buchstabierenAn: number;
    anmeldungAktiv: boolean;
    autoStaerkeErgaenzen: boolean;
    nachrichtenArtAktiv: boolean;
    spruchAnteilProzent: number;
    spielModus: "klassisch" | "xZeit";
    xZeitIntervallMinuten: number;
    xZeitStartOffsetMinuten: number;
}

export interface GeneratorEntwurf {
    version: 1;
    gespeichertAm: string;
    formular: EntwurfFormular;
    quelle: EntwurfQuelle;
    vorlagen: string[];
    szenarioSlug?: string;
    fuehrungsstelle?: FuehrungsstellenKonfiguration;
    teilnehmerListe: string[];
    teilnehmerStellen: Record<string, string>;
    loesungswortOption: LoesungswortOption;
    loesungswoerter: Record<string, string>;
}

type Speicher = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function speicher(): Speicher | null {
    try {
        const s = (globalThis as { localStorage?: Speicher }).localStorage;
        return s ?? null;
    } catch {
        return null;
    }
}

export function speichereEntwurf(entwurf: GeneratorEntwurf): void {
    try {
        speicher()?.setItem(ENTWURF_SCHLUESSEL, JSON.stringify(entwurf));
    } catch {
        // Voll oder gesperrt: Der Entwurf ist nur eine Bequemlichkeit.
    }
}

export function verwerfeEntwurf(): void {
    try {
        speicher()?.removeItem(ENTWURF_SCHLUESSEL);
    } catch {
        // siehe speichereEntwurf
    }
}

export function ladeEntwurf(): GeneratorEntwurf | null {
    let roh: string | null;
    try {
        roh = speicher()?.getItem(ENTWURF_SCHLUESSEL) ?? null;
    } catch {
        return null;
    }
    if (!roh) {
        return null;
    }
    try {
        return pruefeEntwurf(JSON.parse(roh));
    } catch {
        return null;
    }
}

const QUELLEN: readonly EntwurfQuelle[] = ["vorlagen", "upload", "szenario", "fuehrungsstelle"];
const LOESUNGSWORT_OPTIONEN: readonly LoesungswortOption[] = ["none", "central", "individual"];

function istStringRecord(wert: unknown): wert is Record<string, string> {
    return !!wert && typeof wert === "object" && !Array.isArray(wert)
        && Object.values(wert as Record<string, unknown>).every(v => typeof v === "string");
}

function istStringListe(wert: unknown): wert is string[] {
    return Array.isArray(wert) && wert.every(v => typeof v === "string");
}

const ZAHLEN: readonly (keyof EntwurfFormular)[] = [
    "spruecheProTeilnehmer", "spruecheAnAlle", "spruecheAnMehrere", "buchstabierenAn",
    "spruchAnteilProzent", "xZeitIntervallMinuten", "xZeitStartOffsetMinuten"
];
const TEXTE: readonly (keyof EntwurfFormular)[] = ["name", "datum", "rufgruppe", "leitung"];
const SCHALTER: readonly (keyof EntwurfFormular)[] = ["anmeldungAktiv", "autoStaerkeErgaenzen", "nachrichtenArtAktiv"];

function istGueltigesFormular(f: Partial<EntwurfFormular> | undefined): boolean {
    if (!f || typeof f !== "object") {
        return false;
    }
    return ZAHLEN.every(k => typeof f[k] === "number" && Number.isFinite(f[k]))
        && TEXTE.every(k => typeof f[k] === "string")
        && SCHALTER.every(k => typeof f[k] === "boolean")
        && (f.spielModus === "klassisch" || f.spielModus === "xZeit");
}

function hatGueltigeListen(e: Partial<GeneratorEntwurf>): boolean {
    return QUELLEN.includes(e.quelle as EntwurfQuelle)
        && LOESUNGSWORT_OPTIONEN.includes(e.loesungswortOption as LoesungswortOption)
        && istStringListe(e.vorlagen)
        && istStringListe(e.teilnehmerListe)
        && istStringRecord(e.teilnehmerStellen)
        && istStringRecord(e.loesungswoerter)
        && typeof e.gespeichertAm === "string";
}

function hatGueltigeQuellenangaben(e: Partial<GeneratorEntwurf>): boolean {
    return (e.szenarioSlug === undefined || typeof e.szenarioSlug === "string")
        && (e.fuehrungsstelle === undefined || istFuehrungsstellenKonfiguration(e.fuehrungsstelle));
}

/** Prüft einen gelesenen Entwurf; alles Unerwartete verwirft ihn ganz. */
export function pruefeEntwurf(roh: unknown): GeneratorEntwurf | null {
    if (!roh || typeof roh !== "object") {
        return null;
    }
    const e = roh as Partial<GeneratorEntwurf>;
    const gueltig = e.version === 1
        && istGueltigesFormular(e.formular as Partial<EntwurfFormular> | undefined)
        && hatGueltigeListen(e)
        && hatGueltigeQuellenangaben(e);
    return gueltig ? e as GeneratorEntwurf : null;
}

function istFuehrungsstellenKonfiguration(wert: unknown): wert is FuehrungsstellenKonfiguration {
    if (!wert || typeof wert !== "object") {
        return false;
    }
    const k = wert as Partial<FuehrungsstellenKonfiguration>;
    return typeof k.slug === "string"
        && typeof k.beuebteStelle === "string"
        && typeof k.uebergeordnet === "string"
        && istStringListe(k.unterstellt)
        && (k.beginn === undefined || typeof k.beginn === "string")
        && (k.stellen === undefined || istStringRecord(k.stellen));
}

/** Ein Entwurf ohne jede Eingabe lohnt keinen Hinweis beim nächsten Öffnen. */
export function entwurfHatInhalt(entwurf: GeneratorEntwurf): boolean {
    return entwurf.teilnehmerListe.some(name => name.trim() !== "")
        || entwurf.formular.leitung.trim() !== ""
        || entwurf.formular.rufgruppe.trim() !== ""
        || entwurf.vorlagen.length > 0
        || entwurf.quelle !== "vorlagen";
}

/** Überträgt einen Entwurf auf eine frische Übung (ohne Nachrichten und Codes). */
export function wendeEntwurfAn(uebung: FunkUebung, entwurf: GeneratorEntwurf): void {
    const { formular } = entwurf;
    const datum = new Date(formular.datum);
    Object.assign(uebung, {
        ...formular,
        datum: Number.isNaN(datum.getTime()) ? uebung.datum : datum
    });
    uebung.verwendeteVorlagen = [...entwurf.vorlagen];
    uebung.szenarioSlug = entwurf.quelle === "szenario" ? entwurf.szenarioSlug : undefined;
    uebung.fuehrungsstelle = entwurf.quelle === "fuehrungsstelle" && entwurf.fuehrungsstelle
        ? { ...entwurf.fuehrungsstelle, unterstellt: [...entwurf.fuehrungsstelle.unterstellt] }
        : undefined;
    uebung.teilnehmerListe = [...entwurf.teilnehmerListe];
    uebung.teilnehmerStellen = { ...entwurf.teilnehmerStellen };
    uebung.loesungswoerter = entwurf.loesungswortOption === "none" ? {} : { ...entwurf.loesungswoerter };
}
