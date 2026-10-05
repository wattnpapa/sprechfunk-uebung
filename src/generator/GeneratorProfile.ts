import { type GeneratorEntwurf, pruefeEntwurf } from "./GeneratorEntwurf";

/**
 * Profile des Generators: Wer regelmäßig Übungen mit derselben Rufgruppe,
 * Übungsleitung und denselben Funkstellen anlegt, hebt die Eingaben unter
 * einem Namen auf und lädt sie später wieder – im Browser oder als Datei,
 * die sich sichern, auf ein anderes Gerät bringen oder weitergeben lässt.
 *
 * Ein Profil ist bewusst nichts anderes als ein benannter Entwurf
 * (`GeneratorEntwurf`). Was der Entwurf kennt, kennt auch das Profil: Kommt
 * ein Spielmodus oder ein Formularfeld hinzu, wird es dort ergänzt und ist
 * damit automatisch Teil von Profilen. Profile liegen nie in Firestore.
 */

export const PROFIL_TYP = "sprechfunk-uebung-profil";
export const PROFILE_SCHLUESSEL = "generatorProfile:v1";
/** Ein Profil ist ein paar Kilobyte groß; alles darüber ist keine Profildatei. */
export const PROFIL_DATEI_MAX_BYTES = 512 * 1024;
export const PROFIL_NAME_MAX = 80;

export interface GeneratorProfil {
    typ: typeof PROFIL_TYP;
    version: 1;
    name: string;
    gespeichertAm: string;
    entwurf: GeneratorEntwurf;
}

type Speicher = Pick<Storage, "getItem" | "setItem">;

function speicher(): Speicher | null {
    try {
        return (globalThis as { localStorage?: Speicher }).localStorage ?? null;
    } catch {
        return null;
    }
}

export function bereinigeProfilName(name: string): string {
    return name.replace(/\s+/g, " ").trim().slice(0, PROFIL_NAME_MAX);
}

function gleicherName(a: string, b: string): boolean {
    return a.toLocaleLowerCase("de-DE") === b.toLocaleLowerCase("de-DE");
}

export function erstelleProfil(name: string, entwurf: GeneratorEntwurf, jetzt = new Date()): GeneratorProfil {
    return {
        typ: PROFIL_TYP,
        version: 1,
        name: bereinigeProfilName(name),
        gespeichertAm: jetzt.toISOString(),
        entwurf
    };
}

/** Prüft ein gelesenes Profil; alles Unerwartete verwirft es ganz. */
export function pruefeProfil(roh: unknown): GeneratorProfil | null {
    if (!roh || typeof roh !== "object") {
        return null;
    }
    const p = roh as Partial<GeneratorProfil>;
    if (p.typ !== PROFIL_TYP || p.version !== 1 || typeof p.gespeichertAm !== "string") {
        return null;
    }
    const name = typeof p.name === "string" ? bereinigeProfilName(p.name) : "";
    const entwurf = pruefeEntwurf(p.entwurf);
    if (!name || !entwurf) {
        return null;
    }
    return { typ: PROFIL_TYP, version: 1, name, gespeichertAm: p.gespeichertAm, entwurf };
}

/** Alle gültigen Profile dieses Browsers, nach Namen sortiert. */
export function ladeProfile(): GeneratorProfil[] {
    let roh: string | null;
    try {
        roh = speicher()?.getItem(PROFILE_SCHLUESSEL) ?? null;
    } catch {
        return [];
    }
    if (!roh) {
        return [];
    }
    let liste: unknown;
    try {
        liste = JSON.parse(roh);
    } catch {
        return [];
    }
    if (!Array.isArray(liste)) {
        return [];
    }
    return liste
        .map(pruefeProfil)
        .filter((p): p is GeneratorProfil => p !== null)
        .sort((a, b) => a.name.localeCompare(b.name, "de-DE"));
}

export function findeProfil(name: string): GeneratorProfil | null {
    const gesucht = bereinigeProfilName(name);
    return ladeProfile().find(p => gleicherName(p.name, gesucht)) ?? null;
}

function schreibeProfile(profile: GeneratorProfil[]): boolean {
    const s = speicher();
    if (!s) {
        return false;
    }
    try {
        s.setItem(PROFILE_SCHLUESSEL, JSON.stringify(profile));
        return true;
    } catch {
        return false;
    }
}

/** Legt ein Profil an oder ersetzt das gleichnamige. false: Speicher voll oder gesperrt. */
export function speichereProfil(profil: GeneratorProfil): boolean {
    const andere = ladeProfile().filter(p => !gleicherName(p.name, profil.name));
    return schreibeProfile([...andere, profil]);
}

export function loescheProfil(name: string): boolean {
    const gesucht = bereinigeProfilName(name);
    const profile = ladeProfile();
    const rest = profile.filter(p => !gleicherName(p.name, gesucht));
    return rest.length === profile.length ? false : schreibeProfile(rest);
}

/** Dateiname ohne Umlaute und Sonderzeichen, damit jedes System ihn annimmt. */
export function profilDateiname(name: string): string {
    const slug = name
        .toLowerCase()
        .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
        .normalize("NFKD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    return `sprechfunk-profil-${slug || "ohne-namen"}.json`;
}

export function profilAlsJson(profil: GeneratorProfil): string {
    return JSON.stringify(profil, null, 2);
}

export type ProfilDateiErgebnis =
    | { ok: true; profil: GeneratorProfil }
    | { ok: false; fehler: string };

/** Liest den Inhalt einer hochgeladenen Profildatei. */
export function leseProfilDatei(text: string): ProfilDateiErgebnis {
    if (text.length > PROFIL_DATEI_MAX_BYTES) {
        return { ok: false, fehler: "Die Datei ist zu groß für ein Profil." };
    }
    let roh: unknown;
    try {
        roh = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    } catch {
        return { ok: false, fehler: "Die Datei ist kein Profil des Übungsgenerators (kein gültiges JSON)." };
    }
    if (!roh || typeof roh !== "object" || (roh as { typ?: unknown }).typ !== PROFIL_TYP) {
        return { ok: false, fehler: "Die Datei ist kein Profil des Übungsgenerators." };
    }
    if ((roh as { version?: unknown }).version !== 1) {
        return { ok: false, fehler: "Das Profil stammt aus einer anderen Version des Generators und lässt sich hier nicht lesen." };
    }
    const profil = pruefeProfil(roh);
    return profil
        ? { ok: true, profil }
        : { ok: false, fehler: "Das Profil ist unvollständig oder beschädigt und wurde nicht geladen." };
}

/** Bekannte Bestände, gegen die ein Profil beim Laden abgeglichen wird. */
export interface ProfilBestand {
    vorlagen: ReadonlySet<string>;
    szenarien: ReadonlySet<string>;
    fuehrungsstellen: ReadonlySet<string>;
}

function datumNurTag(datum: Date): number {
    return new Date(datum.getFullYear(), datum.getMonth(), datum.getDate()).getTime();
}

function bekannteQuellen(
    quelle: GeneratorEntwurf,
    bestand: ProfilBestand,
    entfernt: string[]
): Pick<GeneratorEntwurf, "vorlagen" | "szenarioSlug" | "fuehrungsstelle"> {
    const vorlagen = quelle.vorlagen.filter(slug => bestand.vorlagen.has(slug));
    quelle.vorlagen.filter(slug => !bestand.vorlagen.has(slug)).forEach(slug => entfernt.push(`Vorlage „${slug}“`));
    const teil: Pick<GeneratorEntwurf, "vorlagen" | "szenarioSlug" | "fuehrungsstelle"> = { vorlagen };
    if (quelle.szenarioSlug !== undefined) {
        if (bestand.szenarien.has(quelle.szenarioSlug)) {
            teil.szenarioSlug = quelle.szenarioSlug;
        } else {
            entfernt.push(`Szenario „${quelle.szenarioSlug}“`);
        }
    }
    const fs = quelle.fuehrungsstelle;
    if (fs) {
        const bekannt = bestand.fuehrungsstellen.has(fs.slug);
        if (!bekannt) {
            entfernt.push(`Drehbuch „${fs.slug}“`);
        }
        // Rollen bleiben auch ohne Drehbuch erhalten; die Auswahl fällt auf ein vorhandenes.
        teil.fuehrungsstelle = { ...fs, slug: bekannt ? fs.slug : "", unterstellt: [...fs.unterstellt] };
    }
    return teil;
}

/**
 * Macht einen Profil-Entwurf für eine neue Übung fertig: Ein Datum in der
 * Vergangenheit wird zu heute, Vorlagen, Szenarien und Drehbücher, die es
 * nicht mehr gibt, fallen heraus. `entfernt` nennt, was fehlt.
 */
export function entwurfAusProfil(
    profil: GeneratorProfil,
    bestand: ProfilBestand,
    heute = new Date()
): { entwurf: GeneratorEntwurf; entfernt: string[] } {
    const quelle = profil.entwurf;
    const entfernt: string[] = [];
    const datum = new Date(quelle.formular.datum);
    const datumAlt = Number.isNaN(datum.getTime()) || datumNurTag(datum) < datumNurTag(heute);
    const { szenarioSlug: _s, fuehrungsstelle: _f, ...rest } = quelle;
    const entwurf: GeneratorEntwurf = {
        ...rest,
        gespeichertAm: heute.toISOString(),
        formular: { ...quelle.formular, datum: datumAlt ? heute.toISOString() : quelle.formular.datum },
        teilnehmerListe: [...quelle.teilnehmerListe],
        teilnehmerStellen: { ...quelle.teilnehmerStellen },
        loesungswoerter: { ...quelle.loesungswoerter },
        ...bekannteQuellen(quelle, bestand, entfernt)
    };
    return { entwurf, entfernt };
}
