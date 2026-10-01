import {
    MELDEARTEN,
    UEBERMITTLUNGS_WEGE,
    type FuehrungsstellenNachricht,
    type FuehrungsstellenRolle,
    type FuehrungsstellenStab,
    type FuehrungsstellenStrang,
    type FuehrungsstellenUebung,
    type Meldeart,
    type UebermittlungsWeg
} from "../types/FuehrungsstellenUebung";
import { FUEHRUNGSSTELLEN_UEBUNGEN } from "../data/fuehrungsstellenUebungen";

/**
 * Prüft und typisiert ein Drehbuch (assets/fuehrungsstellen/<slug>.json).
 *
 * Wie die Szenarien werden die Dateien zur Laufzeit per fetch geladen und sind
 * damit ein öffentlicher Datenvertrag. Fehler werden gesammelt gemeldet, damit
 * Autoren alle Probleme auf einmal sehen
 * (tests/fuehrungsstellen/FuehrungsstellenBestand.test.ts nutzt dieselbe Prüfung).
 */
export class FuehrungsstellenParseError extends Error {
    public readonly fehler: string[];

    constructor(slug: string, fehler: string[]) {
        super(`Führungsstellen-Übung "${slug}" ist ungültig:\n- ${fehler.join("\n- ")}`);
        this.name = "FuehrungsstellenParseError";
        this.fehler = fehler;
    }
}

/** Ein Funkspruch muss auf einen A5-Vordruck passen (kein Seitenumbruch). */
export const FUEHRUNGSSTELLE_MAX_FUNKTEXT = 300;
/**
 * Ausdruck und E-Mail dürfen länger sein — ein Einsatzauftrag hat Absätze.
 * Auf dem A5-Nachrichtenvordruck wird so ein Text verkleinert gesetzt; mehr
 * als 1000 Zeichen wären dort nicht mehr lesbar.
 */
export const FUEHRUNGSSTELLE_MAX_TEXT = 1000;
export const FUEHRUNGSSTELLE_MAX_ERWARTUNG = 400;
export const FUEHRUNGSSTELLE_MAX_BETREFF = 120;
export const FUEHRUNGSSTELLE_MIN_DAUER = 30;
export const FUEHRUNGSSTELLE_MAX_DAUER = 600;
/** Mehr Stränge ließen sich weder im Formular noch im Drehbuch sinnvoll darstellen. */
export const FUEHRUNGSSTELLE_MAX_STRAENGE = 8;

const STRANG_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseFuehrungsstellenUebung(slug: string, roh: unknown): FuehrungsstellenUebung {
    if (!roh || typeof roh !== "object") {
        throw new FuehrungsstellenParseError(slug, ["Wurzel ist kein Objekt"]);
    }
    const obj = roh as Record<string, unknown>;
    const fehler: string[] = [];

    const text = (feld: string, maxLaenge: number): string => {
        const wert = obj[feld];
        if (typeof wert !== "string" || wert.trim().length === 0) {
            fehler.push(`Feld "${feld}" fehlt oder ist leer`);
            return "";
        }
        if (wert.length > maxLaenge) {
            fehler.push(`Feld "${feld}" ist länger als ${maxLaenge} Zeichen`);
        }
        return wert.trim();
    };

    const parsedSlug = text("slug", 64);
    if (parsedSlug && parsedSlug !== slug) {
        fehler.push(`Feld "slug" (${parsedSlug}) entspricht nicht dem erwarteten Slug (${slug})`);
    }
    const titel = text("titel", 120);
    const beschreibung = text("beschreibung", 300);
    const lage = text("lage", 2000);
    const auftrag = text("auftrag", 1000);
    const dauerMinuten = parseDauer(obj["dauerMinuten"], fehler);

    const strangKeys = leseStrangKeys(obj["straenge"]);
    // Eine ungültige Dauer ist genau ein Fehler; sie soll nicht jede Nachricht
    // zusätzlich als „außerhalb der Dauer" melden.
    const kontext: NachrichtenKontext = {
        dauerMinuten: dauerMinuten > 0 ? dauerMinuten : Number.POSITIVE_INFINITY,
        strangKeys
    };
    const straenge = parseStraenge(obj["straenge"], kontext, fehler);
    const uebergeordnet = parseStab(obj["uebergeordnet"], kontext, fehler);
    const minAbschnitte = parseMinAbschnitte(obj["minAbschnitte"], straenge.length, fehler);

    if (fehler.length > 0) {
        throw new FuehrungsstellenParseError(slug, fehler);
    }
    return { slug, titel, beschreibung, lage, auftrag, dauerMinuten, minAbschnitte, uebergeordnet, straenge };
}

function parseDauer(roh: unknown, fehler: string[]): number {
    if (typeof roh !== "number" || !Number.isInteger(roh)) {
        fehler.push("Feld \"dauerMinuten\" fehlt oder ist keine ganze Zahl");
        return 0;
    }
    if (roh < FUEHRUNGSSTELLE_MIN_DAUER || roh > FUEHRUNGSSTELLE_MAX_DAUER) {
        fehler.push(`dauerMinuten muss zwischen ${FUEHRUNGSSTELLE_MIN_DAUER} und ${FUEHRUNGSSTELLE_MAX_DAUER} liegen`);
    }
    return roh;
}

function parseMinAbschnitte(roh: unknown, anzahlStraenge: number, fehler: string[]): number {
    if (typeof roh !== "number" || !Number.isInteger(roh)) {
        fehler.push("Feld \"minAbschnitte\" fehlt oder ist keine ganze Zahl");
        return 0;
    }
    if (roh < 1) {
        fehler.push("minAbschnitte muss mindestens 1 sein");
    }
    if (anzahlStraenge > 0 && roh > anzahlStraenge) {
        fehler.push(`minAbschnitte (${roh}) übersteigt die Stranganzahl (${anzahlStraenge})`);
    }
    return roh;
}

/** Schlüssel vorab einsammeln, damit {{ea:<key>}} in jedem Text geprüft werden kann. */
function leseStrangKeys(roh: unknown): string[] {
    if (!Array.isArray(roh)) {
        return [];
    }
    return roh.flatMap(eintrag => {
        const key = eintrag && typeof eintrag === "object" ? (eintrag as Record<string, unknown>)["key"] : undefined;
        return typeof key === "string" && STRANG_KEY.test(key) ? [key] : [];
    });
}

function parseRolle(roh: unknown, pfad: string, fehler: string[]): FuehrungsstellenRolle | null {
    if (!roh || typeof roh !== "object") {
        fehler.push(`${pfad} fehlt oder ist kein Objekt`);
        return null;
    }
    const rolle = roh as Record<string, unknown>;
    const bezeichnung = typeof rolle["bezeichnung"] === "string" ? rolle["bezeichnung"].trim() : "";
    const hintergrund = typeof rolle["hintergrund"] === "string" ? rolle["hintergrund"].trim() : "";
    if (bezeichnung.length === 0 || bezeichnung.length > 80) {
        fehler.push(`${pfad}: bezeichnung fehlt, ist leer oder länger als 80 Zeichen`);
    }
    if (hintergrund.length === 0 || hintergrund.length > 1200) {
        fehler.push(`${pfad}: hintergrund fehlt, ist leer oder länger als 1200 Zeichen`);
    }
    return { bezeichnung, hintergrund };
}

function parseStab(roh: unknown, kontext: NachrichtenKontext, fehler: string[]): FuehrungsstellenStab {
    const rolle = parseRolle(roh, "uebergeordnet", fehler) ?? { bezeichnung: "", hintergrund: "" };
    const nachrichten = roh && typeof roh === "object"
        ? parseNachrichten((roh as Record<string, unknown>)["nachrichten"], "uebergeordnet", { ...kontext, imStrang: false }, fehler)
        : [];
    return { ...rolle, nachrichten };
}

function parseStraenge(roh: unknown, kontext: NachrichtenKontext, fehler: string[]): FuehrungsstellenStrang[] {
    if (!Array.isArray(roh) || roh.length === 0) {
        fehler.push("Feld \"straenge\" fehlt oder ist leer");
        return [];
    }
    if (roh.length > FUEHRUNGSSTELLE_MAX_STRAENGE) {
        fehler.push(`straenge: höchstens ${FUEHRUNGSSTELLE_MAX_STRAENGE} Stränge`);
    }
    const gesehen = new Set<string>();
    return roh.flatMap((eintrag, index) => {
        const pfad = `straenge[${index}]`;
        const rolle = parseRolle(eintrag, pfad, fehler);
        if (!rolle) {
            return [];
        }
        const strang = eintrag as Record<string, unknown>;
        const key = typeof strang["key"] === "string" ? strang["key"] : "";
        if (!STRANG_KEY.test(key)) {
            fehler.push(`${pfad}: key fehlt oder enthält andere Zeichen als a-z, 0-9 und Bindestrich`);
        } else if (gesehen.has(key)) {
            fehler.push(`${pfad}: key "${key}" ist doppelt`);
        }
        gesehen.add(key);
        const nachrichten = parseNachrichten(strang["nachrichten"], pfad, { ...kontext, imStrang: true }, fehler);
        return [{ ...rolle, key, nachrichten }];
    });
}

interface NachrichtenKontext {
    dauerMinuten: number;
    strangKeys: string[];
}

interface NachrichtKontext extends NachrichtenKontext {
    imStrang: boolean;
}

function parseNachrichten(
    roh: unknown,
    pfad: string,
    kontext: NachrichtKontext,
    fehler: string[]
): FuehrungsstellenNachricht[] {
    if (!Array.isArray(roh) || roh.length === 0) {
        fehler.push(`${pfad}: nachrichten fehlt oder ist leer`);
        return [];
    }
    let letzteZeit = -1;
    return roh.flatMap((eintrag, index) => {
        const nachrichtPfad = `${pfad}.nachrichten[${index}]`;
        const nachricht = parseNachricht(eintrag, nachrichtPfad, kontext, fehler);
        // Die Sortierung auch über Nachrichten mit anderen Fehlern prüfen,
        // sonst versteckt ein Tippfehler den Sortierfehler bis zur Korrektur.
        const zeit = nachricht?.zeit ?? leseZeit(eintrag);
        if (zeit !== undefined) {
            if (zeit < letzteZeit) {
                fehler.push(`${nachrichtPfad}: zeit (${zeit}) liegt vor der vorherigen Nachricht (${letzteZeit}) — aufsteigend sortieren`);
            }
            letzteZeit = Math.max(letzteZeit, zeit);
        }
        return nachricht ? [nachricht] : [];
    });
}

function leseZeit(roh: unknown): number | undefined {
    const zeit = roh && typeof roh === "object" ? (roh as Record<string, unknown>)["zeit"] : undefined;
    return typeof zeit === "number" && Number.isInteger(zeit) ? zeit : undefined;
}

// eslint-disable-next-line complexity
function parseNachricht(
    roh: unknown,
    pfad: string,
    kontext: NachrichtKontext,
    fehler: string[]
): FuehrungsstellenNachricht | null {
    if (!roh || typeof roh !== "object") {
        fehler.push(`${pfad} ist kein Objekt`);
        return null;
    }
    const nachricht = roh as Record<string, unknown>;
    const anzahlFehlerVorher = fehler.length;

    const zeit = nachricht["zeit"];
    if (typeof zeit !== "number" || !Number.isInteger(zeit) || zeit < 0 || zeit > kontext.dauerMinuten) {
        const obergrenze = Number.isFinite(kontext.dauerMinuten) ? ` und ${kontext.dauerMinuten}` : "";
        fehler.push(`${pfad}: zeit muss eine ganze Minute zwischen 0${obergrenze} sein`);
    }
    const weg = nachricht["weg"];
    const wegGueltig = UEBERMITTLUNGS_WEGE.includes(weg as UebermittlungsWeg);
    if (!wegGueltig) {
        fehler.push(`${pfad}: weg muss ${UEBERMITTLUNGS_WEGE.join(", ")} sein`);
    } else if (kontext.imStrang && weg !== "funk") {
        // Einsatzabschnitte melden über Funk; Ausdruck und E-Mail kommen vom Stab.
        fehler.push(`${pfad}: Stränge senden nur über funk`);
    }
    const art = nachricht["art"];
    if (!MELDEARTEN.includes(art as Meldeart)) {
        fehler.push(`${pfad}: art muss ${MELDEARTEN.join(", ")} sein`);
    }

    const platzhalter = erlaubtePlatzhalter(kontext.strangKeys, kontext.imStrang);
    const maxText = weg === "funk" ? FUEHRUNGSSTELLE_MAX_FUNKTEXT : FUEHRUNGSSTELLE_MAX_TEXT;
    const textWert = pruefeText(nachricht["text"], `${pfad}.text`, { maxLaenge: maxText, pflicht: true, platzhalter }, fehler);
    const erwartung = pruefeText(
        nachricht["erwartung"], `${pfad}.erwartung`,
        { maxLaenge: FUEHRUNGSSTELLE_MAX_ERWARTUNG, pflicht: true, platzhalter }, fehler
    );
    const betreff = pruefeText(
        nachricht["betreff"], `${pfad}.betreff`,
        { maxLaenge: FUEHRUNGSSTELLE_MAX_BETREFF, pflicht: wegGueltig && weg !== "funk", platzhalter }, fehler
    );
    if (weg === "funk" && betreff) {
        fehler.push(`${pfad}: betreff ist nur bei drucker und email vorgesehen`);
    }

    if (fehler.length > anzahlFehlerVorher) {
        return null;
    }
    return {
        zeit: zeit as number,
        weg: weg as UebermittlungsWeg,
        art: art as Meldeart,
        ...(betreff ? { betreff } : {}),
        text: textWert as string,
        erwartung: erwartung as string
    };
}

export function erlaubtePlatzhalter(strangKeys: readonly string[], imStrang: boolean): string[] {
    return [
        "{{el}}",
        "{{stab}}",
        ...(imStrang ? ["{{ea}}"] : []),
        ...strangKeys.map(key => `{{ea:${key}}}`)
    ];
}

interface TextRegel {
    maxLaenge: number;
    pflicht: boolean;
    platzhalter: readonly string[];
}

function pruefeText(roh: unknown, pfad: string, regel: TextRegel, fehler: string[]): string | null {
    if (roh === undefined || roh === null || (typeof roh === "string" && roh.trim().length === 0)) {
        if (regel.pflicht) {
            fehler.push(`${pfad} fehlt oder ist leer`);
        }
        return null;
    }
    if (typeof roh !== "string") {
        fehler.push(`${pfad} ist kein Text`);
        return null;
    }
    // Absätze bleiben erhalten (Ausdruck, E-Mail); Leerraum innerhalb einer
    // Zeile wird wie bei den Szenarien vereinheitlicht.
    const textWert = roh
        .split("\n")
        .map(zeile => zeile.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    if (textWert.length > regel.maxLaenge) {
        fehler.push(`${pfad} ist länger als ${regel.maxLaenge} Zeichen`);
    }
    let rest = textWert;
    regel.platzhalter.forEach(platzhalter => {
        rest = rest.split(platzhalter).join("");
    });
    if (rest.includes("{{") || rest.includes("}}")) {
        fehler.push(`${pfad}: unbekannter Platzhalter — erlaubt sind ${regel.platzhalter.join(", ")}`);
    }
    return textWert;
}

const geladeneUebungen = new Map<string, FuehrungsstellenUebung>();

/**
 * Lädt und prüft ein mitgeliefertes Drehbuch; Ergebnisse werden gecacht.
 * Wird vom Generator (Auswahl, Generierung) und vom PDF-Export (Drehbuch im
 * ZIP) gebraucht, deshalb hier statt im Controller.
 */
export async function ladeFuehrungsstellenUebung(slug: string): Promise<FuehrungsstellenUebung> {
    const cached = geladeneUebungen.get(slug);
    if (cached) {
        return cached;
    }
    const eintrag = FUEHRUNGSSTELLEN_UEBUNGEN[slug];
    if (!eintrag) {
        throw new Error(`Unbekannte Führungsstellen-Übung: ${slug}`);
    }
    const response = await fetch(eintrag.filename);
    if (!response.ok) {
        throw new Error(`Drehbuch ${slug} nicht ladbar (HTTP ${response.status})`);
    }
    const uebung = parseFuehrungsstellenUebung(slug, await response.json());
    geladeneUebungen.set(slug, uebung);
    return uebung;
}
