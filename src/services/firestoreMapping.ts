import { Timestamp } from "firebase/firestore";
import type { Nachricht } from "../types/Nachricht";
import {
    MELDEARTEN,
    UEBERMITTLUNGS_WEGE,
    type FuehrungsstellenKonfiguration,
    type Meldeart,
    type UebermittlungsWeg
} from "../types/FuehrungsstellenUebung";
import { FunkUebung } from "../models/FunkUebung";

type Staerke = NonNullable<Nachricht["staerken"]>[number];

function toDate(val: unknown): Date {
    if (val instanceof Timestamp) {
        return val.toDate();
    }
    if (typeof val === "string" || typeof val === "number") {
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date() : d;
    }
    return val instanceof Date ? val : new Date();
}

function toStringArray(val: unknown): string[] {
    if (!Array.isArray(val)) {
        return [];
    }
    return val.filter(v => typeof v === "string") as string[];
}

function toRecordString(val: unknown): Record<string, string> {
    if (!val || typeof val !== "object") {
        return {};
    }
    return Object.entries(val as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string")
        .reduce<Record<string, string>>((acc, [k, v]) => {
            acc[k] = v as string;
            return acc;
        }, {});
}

function toNumber(val: unknown, fallback = 0): number {
    if (typeof val === "number" && Number.isFinite(val)) {
        return val;
    }
    if (typeof val === "string" && val.trim() !== "") {
        const parsed = Number(val);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
}

function textOder<T>(val: unknown, fallback: T): string | T {
    return typeof val === "string" ? val : fallback;
}

function boolOder(val: unknown, fallback: boolean): boolean {
    return typeof val === "boolean" ? val : fallback;
}

function zahlOderUndefined(val: unknown): number | undefined {
    return typeof val === "number" ? val : undefined;
}

function endlicheZahl(val: unknown): number | undefined {
    return typeof val === "number" && Number.isFinite(val) ? val : undefined;
}

function parseStaerke(s: unknown): Staerke | null {
    if (!s || typeof s !== "object") {
        return null;
    }
    const st = s as Record<string, unknown>;
    const fuehrer = toNumber(st["fuehrer"], NaN);
    const unterfuehrer = toNumber(st["unterfuehrer"], NaN);
    const helfer = toNumber(st["helfer"], NaN);
    if (!Number.isFinite(fuehrer) || !Number.isFinite(unterfuehrer) || !Number.isFinite(helfer)) {
        return null;
    }
    return { fuehrer, unterfuehrer, helfer };
}

/** Optionale Felder einer Nachricht; leere oder ungültige Werte fallen weg. */
function parseOptionaleNachrichtenFelder(obj: Record<string, unknown>): Partial<Nachricht> {
    const felder: Partial<Nachricht> = {};
    const loesungsbuchstaben = Array.isArray(obj["loesungsbuchstaben"])
        ? (obj["loesungsbuchstaben"] as unknown[]).filter(v => typeof v === "string") as string[]
        : [];
    if (loesungsbuchstaben.length > 0) {
        felder.loesungsbuchstaben = loesungsbuchstaben;
    }
    const staerken = Array.isArray(obj["staerken"])
        ? (obj["staerken"] as unknown[]).map(parseStaerke).filter(Boolean) as Staerke[]
        : [];
    if (staerken.length > 0) {
        felder.staerken = staerken;
    }
    const xZeitSlot = endlicheZahl(obj["xZeitSlot"]);
    if (xZeitSlot !== undefined) {
        felder.xZeitSlot = xZeitSlot;
    }
    if (obj["art"] === "spruch" || obj["art"] === "durchsage") {
        felder.art = obj["art"];
    }
    const szenarioNr = endlicheZahl(obj["szenarioNr"]);
    if (szenarioNr !== undefined) {
        felder.szenarioNr = szenarioNr;
    }
    return felder;
}

function parseNachricht(val: unknown): Nachricht | null {
    if (!val || typeof val !== "object") {
        return null;
    }
    const obj = val as Record<string, unknown>;
    const id = toNumber(obj["id"], NaN);
    const nachricht = typeof obj["nachricht"] === "string" ? obj["nachricht"] : "";
    const empfaenger = toStringArray(obj["empfaenger"]);
    if (!Number.isFinite(id) || !nachricht || empfaenger.length === 0) {
        return null;
    }
    const base: Nachricht = { id, empfaenger, nachricht };
    Object.assign(base, parseOptionaleNachrichtenFelder(obj));
    Object.assign(base, parseFuehrungsstellenFelder(obj));
    return base;
}

function toNachrichtenRecord(val: unknown): Record<string, Nachricht[]> {
    if (!val || typeof val !== "object") {
        return {};
    }
    const entries = Object.entries(val as Record<string, unknown>);
    return entries.reduce<Record<string, Nachricht[]>>((acc, [sender, list]) => {
        if (!Array.isArray(list)) {
            acc[sender] = [];
            return acc;
        }
        acc[sender] = list
            .map(parseNachricht)
            .filter((n): n is Nachricht => n !== null);
        return acc;
    }, {});
}

/**
 * Felder einer Führungsstellen-Nachricht beim Laden übernehmen; unbekannte
 * Werte fallen weg, damit die Ansichten nur mit gültigen Wegen und Arten
 * arbeiten.
 */
function parseFuehrungsstellenFelder(obj: Record<string, unknown>): Partial<Nachricht> {
    const felder: Partial<Nachricht> = {};
    if (UEBERMITTLUNGS_WEGE.includes(obj["weg"] as UebermittlungsWeg)) {
        felder.weg = obj["weg"] as UebermittlungsWeg;
    }
    if (MELDEARTEN.includes(obj["meldeart"] as Meldeart)) {
        felder.meldeart = obj["meldeart"] as Meldeart;
    }
    if (typeof obj["betreff"] === "string" && obj["betreff"].trim() !== "") {
        felder.betreff = obj["betreff"];
    }
    if (typeof obj["erwartung"] === "string" && obj["erwartung"].trim() !== "") {
        felder.erwartung = obj["erwartung"];
    }
    return felder;
}

/** Rollenbesetzung einer Führungsstellen-Übung; unvollständige Daten ergeben undefined. */
function parseFuehrungsstellenKonfiguration(roh: unknown): FuehrungsstellenKonfiguration | undefined {
    if (!roh || typeof roh !== "object") {
        return undefined;
    }
    const obj = roh as Record<string, unknown>;
    const slug = nichtLeererText(obj["slug"]);
    const beuebteStelle = nichtLeererText(obj["beuebteStelle"]);
    const uebergeordnet = nichtLeererText(obj["uebergeordnet"]);
    const unterstellt = Array.isArray(obj["unterstellt"])
        ? (obj["unterstellt"] as unknown[]).map(nichtLeererText).filter((v): v is string => v !== undefined)
        : [];
    if (!slug || !beuebteStelle || !uebergeordnet || unterstellt.length === 0) {
        return undefined;
    }
    const beginn = parseBeginn(obj["beginn"]);
    const stellen = parseStellen(obj["stellen"]);
    return {
        slug, beuebteStelle, uebergeordnet, unterstellt,
        ...(beginn ? { beginn } : {}),
        ...(stellen ? { stellen } : {})
    };
}

/** Übungsbeginn „HH:MM“; alles andere wird verworfen. */
function parseBeginn(roh: unknown): string | undefined {
    const beginn = nichtLeererText(roh);
    return beginn !== undefined && /^\d{1,2}:\d{2}$/.test(beginn) ? beginn : undefined;
}

/** Stellenname je Funkrufname; nur Einträge mit Text auf beiden Seiten. */
function parseStellen(roh: unknown): Record<string, string> | undefined {
    if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
        return undefined;
    }
    const stellen: Record<string, string> = {};
    Object.entries(roh as Record<string, unknown>).forEach(([name, stelle]) => {
        if (name.trim() !== "" && nichtLeererText(stelle) !== undefined) {
            stellen[name] = stelle as string;
        }
    });
    return Object.keys(stellen).length > 0 ? stellen : undefined;
}

function nichtLeererText(wert: unknown): string | undefined {
    return typeof wert === "string" && wert.trim() !== "" ? wert : undefined;
}

/** Stammdaten, Inhalte und Mengen der Übung (Reihenfolge wie im Dokument). */
function inhaltsFelder(data: Record<string, unknown>): Record<string, unknown> {
    return {
        uebungCode: typeof data["uebungCode"] === "string" ? data["uebungCode"].toUpperCase() : "",
        name: textOder(data["name"], ""),
        datum: toDate(data["datum"]),
        createDate: toDate(data["createDate"]),
        buildVersion: textOder(data["buildVersion"], ""),
        leitung: textOder(data["leitung"], ""),
        rufgruppe: textOder(data["rufgruppe"], ""),
        teilnehmerListe: toStringArray(data["teilnehmerListe"]),
        teilnehmerIds: toRecordString(data["teilnehmerIds"]),
        teilnehmerStellen: toRecordString(data["teilnehmerStellen"]),
        nachrichten: toNachrichtenRecord(data["nachrichten"]),
        spruecheProTeilnehmer: toNumber(data["spruecheProTeilnehmer"], 0),
        spruecheAnAlle: toNumber(data["spruecheAnAlle"], 0),
        spruecheAnMehrere: toNumber(data["spruecheAnMehrere"], 0),
        buchstabierenAn: toNumber(data["buchstabierenAn"], 0),
        loesungswoerter: toRecordString(data["loesungswoerter"]),
        loesungsStaerken: toRecordString(data["loesungsStaerken"]),
        checksumme: textOder(data["checksumme"], ""),
        funksprueche: toStringArray(data["funksprueche"])
    };
}

/** Einstellungen, mit denen die Übung generiert wurde. */
function einstellungsFelder(data: Record<string, unknown>): Record<string, unknown> {
    const szenarioSlug = data["szenarioSlug"];
    return {
        anmeldungAktiv: boolOder(data["anmeldungAktiv"], true),
        nachrichtenArtAktiv: boolOder(data["nachrichtenArtAktiv"], false),
        spruchAnteilProzent: typeof data["spruchAnteilProzent"] === "number" ? data["spruchAnteilProzent"] : 50,
        seed: textOder(data["seed"], undefined),
        verwendeteVorlagen: toStringArray(data["verwendeteVorlagen"]),
        istStandardKonfiguration: boolOder(data["istStandardKonfiguration"], false),
        spielModus: data["spielModus"] === "xZeit" ? "xZeit" : undefined,
        xZeitIntervallMinuten: zahlOderUndefined(data["xZeitIntervallMinuten"]),
        xZeitStartOffsetMinuten: zahlOderUndefined(data["xZeitStartOffsetMinuten"]),
        szenarioSlug: typeof szenarioSlug === "string" && szenarioSlug.trim() !== ""
            ? szenarioSlug
            : undefined,
        fuehrungsstelle: parseFuehrungsstellenKonfiguration(data["fuehrungsstelle"])
    };
}

/**
 * Wandelt ein Firestore-Dokument in ein sauberes Uebung-Objekt um (Domain-Modell).
 */
export function mapUebungToDomain(id: string, roh: unknown): FunkUebung {
    const data = roh as Record<string, unknown>;
    const uebung = new FunkUebung(textOder(data["buildVersion"], ""));
    Object.assign(uebung, { id, ...inhaltsFelder(data), ...einstellungsFelder(data) });

    // Legacy-Daten kompatibel machen: "Alle" immer in explizite Empfängerliste auflösen.
    Object.entries(uebung.nachrichten || {}).forEach(([sender, list]) => {
        list.forEach(n => {
            if (n.empfaenger.includes("Alle")) {
                n.empfaenger = uebung.teilnehmerListe.filter(t => t !== sender);
            }
        });
    });
    return uebung;
}
