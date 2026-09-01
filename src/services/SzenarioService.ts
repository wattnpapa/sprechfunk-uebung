import type {
    Szenario,
    SzenarioRahmenSpruch,
    SzenarioSpruch,
    SzenarioStrang
} from "../types/Szenario";

/**
 * Prüft und typisiert ein Szenario-JSON (assets/szenarien/<slug>.json).
 *
 * Die Dateien werden zur Laufzeit per fetch geladen und sind damit ein
 * öffentlicher Datenvertrag wie das .txt-Zeilenformat der Vorlagen. Fehler
 * werden gesammelt gemeldet, damit Autoren neuer Szenarien alle Probleme auf
 * einmal sehen (tests/szenarien/SzenarioBestand.test.ts nutzt dieselbe Prüfung).
 */
export class SzenarioParseError extends Error {
    public readonly fehler: string[];

    constructor(slug: string, fehler: string[]) {
        super(`Szenario "${slug}" ist ungültig:\n- ${fehler.join("\n- ")}`);
        this.name = "SzenarioParseError";
        this.fehler = fehler;
    }
}

/** Ein Funkspruch muss auf einen A5-Vordruck passen (kein Seitenumbruch). */
export const SZENARIO_MAX_TEXTLAENGE = 300;

const ABSENDER_WERTE = ["ich", "partner"] as const;
const EMPFAENGER_WERTE = ["leitung", "alle", "ich", "partner"] as const;
const RAHMEN_EMPFAENGER_WERTE = ["leitung", "alle"] as const;

export function parseSzenario(slug: string, roh: unknown): Szenario {
    const fehler: string[] = [];
    const obj = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
    if (!roh || typeof roh !== "object") {
        throw new SzenarioParseError(slug, ["Wurzel ist kein Objekt"]);
    }

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
    const lage = text("lage", 1200);

    const minTeilnehmer = typeof obj["minTeilnehmer"] === "number" && Number.isInteger(obj["minTeilnehmer"])
        ? obj["minTeilnehmer"]
        : (fehler.push("Feld \"minTeilnehmer\" fehlt oder ist keine ganze Zahl"), 0);
    if (minTeilnehmer < 2) {
        fehler.push("minTeilnehmer muss mindestens 2 sein (Partner-Sprüche brauchen ein Gegenüber)");
    }

    const einleitung = parseRahmenListe(obj["einleitung"], "einleitung", fehler);
    const abschluss = parseRahmenListe(obj["abschluss"], "abschluss", fehler);
    const straenge = parseStraenge(obj["straenge"], fehler);

    if (straenge.length > 0 && minTeilnehmer > straenge.length) {
        fehler.push(`minTeilnehmer (${minTeilnehmer}) übersteigt die Stranganzahl (${straenge.length})`);
    }

    if (fehler.length > 0) {
        throw new SzenarioParseError(slug, fehler);
    }

    return { slug, titel, beschreibung, lage, minTeilnehmer, einleitung, straenge, abschluss };
}

function parseRahmenListe(roh: unknown, feld: string, fehler: string[]): SzenarioRahmenSpruch[] {
    if (roh === undefined) {
        return [];
    }
    if (!Array.isArray(roh)) {
        fehler.push(`Feld "${feld}" ist keine Liste`);
        return [];
    }
    return roh.flatMap((eintrag, index) => {
        const pfad = `${feld}[${index}]`;
        if (!eintrag || typeof eintrag !== "object") {
            fehler.push(`${pfad} ist kein Objekt`);
            return [];
        }
        const spruch = eintrag as Record<string, unknown>;
        const empfaenger = spruch["empfaenger"];
        if (!RAHMEN_EMPFAENGER_WERTE.includes(empfaenger as never)) {
            fehler.push(`${pfad}: empfaenger muss "leitung" oder "alle" sein`);
            return [];
        }
        const textWert = pruefeSpruchText(spruch["text"], pfad, fehler);
        if (textWert === null) {
            return [];
        }
        // Rahmensprüche haben keinen Strang-Kontext: {{ich}}/{{partner}} würden
        // beide durch den rotierenden Absender selbst ersetzt.
        if (textWert.includes("{{ich}}") || textWert.includes("{{partner}}")) {
            fehler.push(`${pfad}: in Rahmensprüchen ist nur der Platzhalter {{leitung}} erlaubt`);
            return [];
        }
        return [{ empfaenger: empfaenger as SzenarioRahmenSpruch["empfaenger"], text: textWert }];
    });
}

function parseStraenge(roh: unknown, fehler: string[]): SzenarioStrang[] {
    if (!Array.isArray(roh) || roh.length === 0) {
        fehler.push("Feld \"straenge\" fehlt oder ist leer");
        return [];
    }
    return roh.flatMap((eintrag, index) => {
        const pfad = `straenge[${index}]`;
        if (!eintrag || typeof eintrag !== "object") {
            fehler.push(`${pfad} ist kein Objekt`);
            return [];
        }
        const strang = eintrag as Record<string, unknown>;
        const titel = typeof strang["titel"] === "string" ? strang["titel"].trim() : "";
        if (titel.length === 0) {
            fehler.push(`${pfad}: titel fehlt oder ist leer`);
        }
        const sprueche = parseStrangSprueche(strang["sprueche"], pfad, fehler);
        if (titel.length === 0 || sprueche.length === 0) {
            return [];
        }
        return [{ titel, sprueche }];
    });
}

function parseStrangSprueche(roh: unknown, strangPfad: string, fehler: string[]): SzenarioSpruch[] {
    if (!Array.isArray(roh) || roh.length === 0) {
        fehler.push(`${strangPfad}: sprueche fehlt oder ist leer`);
        return [];
    }
    const sprueche = roh.flatMap((eintrag, index) => {
        const pfad = `${strangPfad}.sprueche[${index}]`;
        if (!eintrag || typeof eintrag !== "object") {
            fehler.push(`${pfad} ist kein Objekt`);
            return [];
        }
        const spruch = eintrag as Record<string, unknown>;
        const absender = spruch["absender"];
        if (!ABSENDER_WERTE.includes(absender as never)) {
            fehler.push(`${pfad}: absender muss "ich" oder "partner" sein`);
            return [];
        }
        const empfaenger = spruch["empfaenger"];
        if (!EMPFAENGER_WERTE.includes(empfaenger as never)) {
            fehler.push(`${pfad}: empfaenger muss "leitung", "alle", "ich" oder "partner" sein`);
            return [];
        }
        if (absender === empfaenger) {
            fehler.push(`${pfad}: absender und empfaenger dürfen nicht dieselbe Rolle sein (Selbstadressierung)`);
            return [];
        }
        const textWert = pruefeSpruchText(spruch["text"], pfad, fehler);
        if (textWert === null) {
            return [];
        }
        return [{
            absender: absender as SzenarioSpruch["absender"],
            empfaenger: empfaenger as SzenarioSpruch["empfaenger"],
            text: textWert
        }];
    });

    if (sprueche.length > 0 && sprueche[0]?.absender !== "ich") {
        fehler.push(`${strangPfad}: der erste Spruch muss vom Inhaber ("ich") stammen`);
    }
    return sprueche;
}

function pruefeSpruchText(roh: unknown, pfad: string, fehler: string[]): string | null {
    if (typeof roh !== "string" || roh.trim().length === 0) {
        fehler.push(`${pfad}: text fehlt oder ist leer`);
        return null;
    }
    const text = roh.replace(/\s+/g, " ").trim();
    if (text.length > SZENARIO_MAX_TEXTLAENGE) {
        fehler.push(`${pfad}: text ist länger als ${SZENARIO_MAX_TEXTLAENGE} Zeichen (passt nicht auf den A5-Vordruck)`);
    }
    return text;
}
