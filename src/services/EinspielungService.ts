import {
    EINSPIELUNG_ARTEN,
    EINSPIELUNG_WEGE,
    einspielungAbsenderIndex,
    type Einspielung,
    type EinspielungAbsender,
    type EinspielungArt,
    type EinspielungEinlage,
    type EinspielungRolle,
    type EinspielungWeg
} from "../types/Einspielung";

/**
 * Prüft und typisiert ein Einspielungs-JSON (assets/einspielungen/<slug>.json).
 *
 * Wie die Szenarien werden die Dateien zur Laufzeit per fetch geladen und sind
 * damit ein öffentlicher Datenvertrag. Fehler werden gesammelt gemeldet, damit
 * Autoren alle Probleme auf einmal sehen
 * (tests/einspielungen/EinspielungBestand.test.ts nutzt dieselbe Prüfung).
 */
export class EinspielungParseError extends Error {
    public readonly fehler: string[];

    constructor(slug: string, fehler: string[]) {
        super(`Einspielung "${slug}" ist ungültig:\n- ${fehler.join("\n- ")}`);
        this.name = "EinspielungParseError";
        this.fehler = fehler;
    }
}

/** Ein Funkspruch muss auf einen A5-Vordruck passen (kein Seitenumbruch). */
export const EINSPIELUNG_MAX_FUNKTEXT = 300;
/** Ausdruck und E-Mail dürfen länger sein — ein Einsatzauftrag hat Absätze. */
export const EINSPIELUNG_MAX_TEXT = 1500;
export const EINSPIELUNG_MAX_ERWARTUNG = 400;
export const EINSPIELUNG_MAX_BETREFF = 120;
export const EINSPIELUNG_MIN_DAUER = 30;
export const EINSPIELUNG_MAX_DAUER = 600;
/** Mehr Abschnitte ließen sich weder im Formular noch im Drehbuch sinnvoll darstellen. */
export const EINSPIELUNG_MAX_ABSCHNITTE = 6;

export function parseEinspielung(slug: string, roh: unknown): Einspielung {
    if (!roh || typeof roh !== "object") {
        throw new EinspielungParseError(slug, ["Wurzel ist kein Objekt"]);
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

    const uebergeordnet = parseRolle(obj["uebergeordnet"], "uebergeordnet", fehler)
        ?? { bezeichnung: "", hintergrund: "" };
    const einsatzabschnitte = parseEinsatzabschnitte(obj["einsatzabschnitte"], fehler);
    const einlagen = parseEinlagen(obj["einlagen"], {
        anzahlAbschnitte: einsatzabschnitte.length,
        dauerMinuten
    }, fehler);

    if (fehler.length > 0) {
        throw new EinspielungParseError(slug, fehler);
    }

    return { slug, titel, beschreibung, lage, auftrag, dauerMinuten, uebergeordnet, einsatzabschnitte, einlagen };
}

function parseDauer(roh: unknown, fehler: string[]): number {
    if (typeof roh !== "number" || !Number.isInteger(roh)) {
        fehler.push("Feld \"dauerMinuten\" fehlt oder ist keine ganze Zahl");
        return 0;
    }
    if (roh < EINSPIELUNG_MIN_DAUER || roh > EINSPIELUNG_MAX_DAUER) {
        fehler.push(`dauerMinuten muss zwischen ${EINSPIELUNG_MIN_DAUER} und ${EINSPIELUNG_MAX_DAUER} liegen`);
    }
    return roh;
}

function parseRolle(roh: unknown, pfad: string, fehler: string[]): EinspielungRolle | null {
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

function parseEinsatzabschnitte(roh: unknown, fehler: string[]): EinspielungRolle[] {
    if (!Array.isArray(roh) || roh.length === 0) {
        fehler.push("Feld \"einsatzabschnitte\" fehlt oder ist leer");
        return [];
    }
    if (roh.length > EINSPIELUNG_MAX_ABSCHNITTE) {
        fehler.push(`einsatzabschnitte: höchstens ${EINSPIELUNG_MAX_ABSCHNITTE} Abschnitte`);
    }
    return roh.flatMap((eintrag, index) => {
        const rolle = parseRolle(eintrag, `einsatzabschnitte[${index}]`, fehler);
        return rolle ? [rolle] : [];
    });
}

interface EinlagenKontext {
    anzahlAbschnitte: number;
    dauerMinuten: number;
}

function parseEinlagen(roh: unknown, kontext: EinlagenKontext, fehler: string[]): EinspielungEinlage[] {
    if (!Array.isArray(roh) || roh.length === 0) {
        fehler.push("Feld \"einlagen\" fehlt oder ist leer");
        return [];
    }
    let letzteZeit = -1;
    return roh.flatMap((eintrag, index) => {
        const pfad = `einlagen[${index}]`;
        const einlage = parseEinlage(eintrag, pfad, kontext, fehler);
        if (!einlage) {
            return [];
        }
        if (einlage.zeit < letzteZeit) {
            fehler.push(`${pfad}: zeit (${einlage.zeit}) liegt vor der vorherigen Einlage (${letzteZeit}) — einlagen müssen aufsteigend sortiert sein`);
        }
        letzteZeit = Math.max(letzteZeit, einlage.zeit);
        return [einlage];
    });
}

// eslint-disable-next-line complexity
function parseEinlage(
    roh: unknown,
    pfad: string,
    kontext: EinlagenKontext,
    fehler: string[]
): EinspielungEinlage | null {
    if (!roh || typeof roh !== "object") {
        fehler.push(`${pfad} ist kein Objekt`);
        return null;
    }
    const einlage = roh as Record<string, unknown>;
    const anzahlFehlerVorher = fehler.length;

    const zeit = einlage["zeit"];
    if (typeof zeit !== "number" || !Number.isInteger(zeit) || zeit < 0 || zeit > kontext.dauerMinuten) {
        fehler.push(`${pfad}: zeit muss eine ganze Minute zwischen 0 und ${kontext.dauerMinuten} sein`);
    }

    const von = einlage["von"];
    if (!istGueltigerAbsender(von, kontext.anzahlAbschnitte)) {
        fehler.push(`${pfad}: von muss "stab" oder ea1 bis ea${kontext.anzahlAbschnitte} sein`);
    }

    const weg = einlage["weg"];
    if (!EINSPIELUNG_WEGE.includes(weg as EinspielungWeg)) {
        fehler.push(`${pfad}: weg muss ${EINSPIELUNG_WEGE.join(", ")} sein`);
    }

    const art = einlage["art"];
    if (!EINSPIELUNG_ARTEN.includes(art as EinspielungArt)) {
        fehler.push(`${pfad}: art muss ${EINSPIELUNG_ARTEN.join(", ")} sein`);
    }

    const platzhalter = erlaubtePlatzhalter(kontext.anzahlAbschnitte);
    const maxText = weg === "funk" ? EINSPIELUNG_MAX_FUNKTEXT : EINSPIELUNG_MAX_TEXT;
    const textWert = pruefeText(einlage["text"], `${pfad}.text`, { maxLaenge: maxText, pflicht: true, platzhalter }, fehler);
    const erwartung = pruefeText(
        einlage["erwartung"], `${pfad}.erwartung`, { maxLaenge: EINSPIELUNG_MAX_ERWARTUNG, pflicht: true, platzhalter }, fehler
    );
    const betreff = pruefeText(
        einlage["betreff"], `${pfad}.betreff`, { maxLaenge: EINSPIELUNG_MAX_BETREFF, pflicht: weg !== "funk", platzhalter }, fehler
    );
    if (weg === "funk" && betreff) {
        fehler.push(`${pfad}: betreff ist nur bei drucker und email vorgesehen`);
    }

    if (fehler.length > anzahlFehlerVorher) {
        return null;
    }
    return {
        zeit: zeit as number,
        von: von as EinspielungAbsender,
        weg: weg as EinspielungWeg,
        art: art as EinspielungArt,
        ...(betreff ? { betreff } : {}),
        text: textWert as string,
        erwartung: erwartung as string
    };
}

function istGueltigerAbsender(von: unknown, anzahlAbschnitte: number): von is EinspielungAbsender {
    if (von === "stab") {
        return true;
    }
    if (typeof von !== "string") {
        return false;
    }
    const index = einspielungAbsenderIndex(von as EinspielungAbsender);
    return index !== null && index >= 1 && index <= anzahlAbschnitte;
}

export function erlaubtePlatzhalter(anzahlAbschnitte: number): string[] {
    return ["{{el}}", "{{stab}}", ...Array.from({ length: anzahlAbschnitte }, (_, i) => `{{ea${i + 1}}}`)];
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
