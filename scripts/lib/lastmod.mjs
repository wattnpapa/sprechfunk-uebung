// Ermittlung des Änderungsdatums je Seite aus der Git-Historie (AP-03).
//
// Regeln:
// 1. Eine Seite kann sich aus mehreren Quelldateien speisen; es gilt das
//    jüngste Commit-Datum über alle Quellen.
// 2. Rein mechanische Commits (Formatierung, Lint, Build-Kram) bewegen das
//    Datum nicht. Sonst signalisiert ein Prettier-Lauf 29 geänderte Seiten.
// 3. Lässt sich kein Datum ermitteln – etwa im flachen Klon – wird nichts
//    geraten: der Aufrufer bekommt null und lässt das Feld weg. Ein falsches
//    lastmod ist schlechter als keines, weil Google das Feld dann domainweit
//    entwertet.
//
// `runGit` ist injizierbar, damit der Test gegen ein Fixture-Repository läuft.

/**
 * Commits, die Dateien anfassen, ohne den sichtbaren Inhalt zu ändern.
 * Die Conventional-Commit-Präfixe deckt der erste Ausdruck ab.
 */
export const MECHANICAL_SUBJECT_PATTERNS = [
    /^(style|chore|ci|refactor|build|docs|test|perf)(\([^)]*\))?!?:/i,
    // Einmalige Migration: dieser Commit hat das handgeschriebene JSON-LD aus
    // allen 29 Seiten entfernt (AP-02), ohne ein Wort sichtbaren Text zu ändern.
    // Ohne diesen Eintrag trügen alle Seiten dasselbe, irreführende Datum.
    /^seo\(AP-02\): erzeuge strukturierte Daten/
];

export function istMechanischerCommit(subject, patterns = MECHANICAL_SUBJECT_PATTERNS) {
    const betreff = String(subject ?? "").trim();
    return patterns.some(muster => muster.test(betreff));
}

/** Standard-Git-Aufruf. Wird im Test durch eine Attrappe ersetzt. */
export function createGitRunner(execFileAsync, cwd) {
    return async args => {
        const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
        return stdout;
    };
}

const TRENNER = "";

/**
 * Liest die Commits einer Datei, jüngster zuerst.
 * Rückgabe: [{ iso, subject }]
 */
export async function commitsFuerDatei(datei, runGit) {
    let ausgabe;
    try {
        ausgabe = await runGit(["log", `--format=%cI${TRENNER}%s`, "--", datei]);
    } catch {
        // Kein Git-Checkout (Tarball-Build) – der Aufrufer entscheidet.
        return [];
    }
    return ausgabe
        .split("\n")
        .map(zeile => zeile.trim())
        .filter(zeile => zeile !== "")
        .map(zeile => {
            const [iso, subject = ""] = zeile.split(TRENNER);
            return { iso, subject };
        })
        .filter(eintrag => eintrag.iso);
}

/**
 * Jüngstes inhaltliches Commit-Datum einer einzelnen Datei, oder null.
 */
export async function lastContentCommit(datei, runGit, patterns = MECHANICAL_SUBJECT_PATTERNS) {
    const commits = await commitsFuerDatei(datei, runGit);
    for (const commit of commits) {
        if (!istMechanischerCommit(commit.subject, patterns)) return commit.iso;
    }
    return null;
}

/**
 * Änderungsdatum einer Seite über alle ihre Quelldateien.
 *
 * `contentUpdated` in der Registry hat Vorrang: damit lässt sich ein Datum
 * festnageln, wenn die Historie in die Irre führt (etwa nach einem Import).
 */
export async function resolveLastmod({ sources, contentUpdated = null }, runGit, patterns = MECHANICAL_SUBJECT_PATTERNS) {
    if (contentUpdated) return contentUpdated;
    if (!Array.isArray(sources) || sources.length === 0) return null;

    const daten = [];
    for (const datei of sources) {
        const iso = await lastContentCommit(datei, runGit, patterns);
        if (iso) daten.push(iso);
    }
    if (daten.length === 0) return null;
    // ISO-8601 mit Offset lässt sich nicht lexikografisch vergleichen, sobald
    // verschiedene Zeitzonen vorkommen – deshalb über den Zeitstempel.
    return daten.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

/** YYYY-MM-DD aus einem ISO-Zeitstempel, für sichtbare Datumsangaben. */
export function nurDatum(iso) {
    return iso ? String(iso).slice(0, 10) : null;
}

/** Deutsche Schreibweise TT.MM.JJJJ für die sichtbare Anzeige. */
export function deutschesDatum(iso) {
    const datum = nurDatum(iso);
    if (!datum) return null;
    const [jahr, monat, tag] = datum.split("-");
    return `${tag}.${monat}.${jahr}`;
}
