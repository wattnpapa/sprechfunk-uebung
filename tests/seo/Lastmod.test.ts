import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SITEMAP_PAGES } from "../../scripts/site-pages.mjs";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reines JS-Hilfsmodul ohne Typdeklarationen, absichtlich .mjs
import {
    createGitRunner,
    deutschesDatum,
    istMechanischerCommit,
    lastContentCommit,
    nurDatum,
    resolveLastmod
} from "../../scripts/lib/lastmod.mjs";

const execFileAsync = promisify(execFile);

/**
 * Fixture-Repository mit gebauter Historie. Nur so lässt sich prüfen, dass ein
 * `chore:`-Commit das Datum wirklich nicht bewegt – gegen das echte Repo wäre
 * die Aussage vom Zufall der letzten Commits abhängig.
 */
let repo: string;
let runGit: (args: string[]) => Promise<string>;

const git = (args: string[], datum?: string) =>
    execFileSync("git", args, {
        cwd: repo,
        encoding: "utf8",
        env: {
            ...process.env,
            GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.invalid",
            GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.invalid",
            ...(datum ? { GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } : {})
        }
    });

function schreibeUndCommitte(datei: string, inhalt: string, betreff: string, datum: string) {
    writeFileSync(path.join(repo, datei), inhalt, "utf8");
    git(["add", datei]);
    git(["commit", "-m", betreff], datum);
}

beforeAll(() => {
    repo = mkdtempSync(path.join(tmpdir(), "lastmod-fixture-"));
    git(["init", "-q", "-b", "main"]);
    runGit = createGitRunner(execFileAsync, repo);

    // Inhaltlicher Commit
    schreibeUndCommitte("seite.html", "<p>Fassung 1</p>", "feat(seo): Seite angelegt", "2026-01-10T10:00:00+01:00");
    // Zweiter inhaltlicher Commit – muss das Datum bewegen
    schreibeUndCommitte("seite.html", "<p>Fassung 2</p>", "fix(seo): Text korrigiert", "2026-02-20T10:00:00+01:00");
    // Rein mechanischer Commit – darf das Datum NICHT bewegen
    schreibeUndCommitte("seite.html", "<p>Fassung 2</p>\n", "chore: Zeilenende ergänzt", "2026-03-30T10:00:00+02:00");

    // Zweite Quelldatei derselben Seite, jünger als seite.html
    schreibeUndCommitte("daten.json", "{\"a\":1}", "feat(seo): Datenquelle ergänzt", "2026-04-15T10:00:00+02:00");

    // Datei, die ausschließlich mechanische Commits hat
    schreibeUndCommitte("nur-formatiert.html", "<p>x</p>", "style: eingerückt", "2026-05-01T10:00:00+02:00");
});

afterAll(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
});

describe("istMechanischerCommit", () => {
    it("erkennt die üblichen Präfixe", () => {
        for (const betreff of [
            "chore: Abhängigkeiten aktualisiert",
            "style(css): eingerückt",
            "ci: Workflow angepasst",
            "refactor: Modul aufgeteilt",
            "build: Rollup aktualisiert",
            "docs: README ergänzt",
            "test: Fall ergänzt",
            "perf: Schleife gestrafft",
            "chore!: Breaking Change im Werkzeug"
        ]) {
            expect(istMechanischerCommit(betreff), betreff).toBe(true);
        }
    });

    it("lässt inhaltliche Commits durch", () => {
        for (const betreff of [
            "feat(seo): sechs Fachseiten ergänzt",
            "fix(generator): Verteilung korrigiert",
            "seo(AP-01): Startseite überarbeitet"
        ]) {
            expect(istMechanischerCommit(betreff), betreff).toBe(false);
        }
    });

    it("greift nur am Anfang der Betreffzeile", () => {
        expect(istMechanischerCommit("fix(seo): chore: im Text erwähnt")).toBe(false);
    });
});

describe("lastContentCommit gegen das Fixture-Repository", () => {
    it("nimmt den jüngsten inhaltlichen Commit", async () => {
        const iso = await lastContentCommit("seite.html", runGit);
        expect(nurDatum(iso)).toBe("2026-02-20");
    });

    it("überspringt den chore-Commit, obwohl er jünger ist", async () => {
        const iso = await lastContentCommit("seite.html", runGit);
        // Der chore-Commit vom 30.03. darf das Datum nicht auf sich ziehen.
        expect(nurDatum(iso)).not.toBe("2026-03-30");
    });

    it("liefert null, wenn eine Datei nur mechanische Commits hat", async () => {
        expect(await lastContentCommit("nur-formatiert.html", runGit)).toBeNull();
    });

    it("liefert null für eine unbekannte Datei", async () => {
        expect(await lastContentCommit("gibt-es-nicht.html", runGit)).toBeNull();
    });
});

describe("resolveLastmod", () => {
    it("nimmt über mehrere Quellen das jüngste Datum", async () => {
        const iso = await resolveLastmod({ sources: ["seite.html", "daten.json"] }, runGit);
        expect(nurDatum(iso)).toBe("2026-04-15");
    });

    it("bewegt sich, wenn eine Quelldatei inhaltlich geändert wird", async () => {
        const vorher = await resolveLastmod({ sources: ["seite.html"] }, runGit);
        schreibeUndCommitte("seite.html", "<p>Fassung 3</p>", "fix(seo): Zahl berichtigt", "2026-06-01T10:00:00+02:00");
        const nachher = await resolveLastmod({ sources: ["seite.html"] }, runGit);

        expect(nurDatum(vorher)).toBe("2026-02-20");
        expect(nurDatum(nachher)).toBe("2026-06-01");
        expect(Date.parse(nachher)).toBeGreaterThan(Date.parse(vorher));
    });

    it("bewegt sich nicht durch einen weiteren chore-Commit", async () => {
        const vorher = await resolveLastmod({ sources: ["seite.html"] }, runGit);
        schreibeUndCommitte("seite.html", "<p>Fassung 3</p>  ", "chore: Leerzeichen", "2026-07-01T10:00:00+02:00");
        const nachher = await resolveLastmod({ sources: ["seite.html"] }, runGit);

        expect(nachher).toBe(vorher);
    });

    it("gibt contentUpdated den Vorrang vor der Historie", async () => {
        const iso = await resolveLastmod(
            { sources: ["seite.html"], contentUpdated: "2025-12-24T08:00:00+01:00" },
            runGit
        );
        expect(iso).toBe("2025-12-24T08:00:00+01:00");
    });

    it("liefert null ohne Quellen", async () => {
        expect(await resolveLastmod({ sources: [] }, runGit)).toBeNull();
        expect(await resolveLastmod({}, runGit)).toBeNull();
    });

    it("liefert null, wenn git nicht verfügbar ist", async () => {
        const kaputt = async () => { throw new Error("kein Git"); };
        expect(await resolveLastmod({ sources: ["seite.html"] }, kaputt)).toBeNull();
    });

    it("liefert ISO-8601 mit Zeitzonen-Offset", async () => {
        const iso = await resolveLastmod({ sources: ["seite.html"] }, runGit);
        expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    });
});

describe("lastmod im echten Repository", () => {
    const projekt = path.resolve(__dirname, "..", "..");
    const projektGit = createGitRunner(execFileAsync, projekt);

    const istFlach = () => {
        try {
            return execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
                cwd: projekt, encoding: "utf8"
            }).trim() === "true";
        } catch {
            return true;
        }
    };

    // Einmal für alle 27 Seiten ermitteln: je Seite ein git-Aufruf, das dauert
    // im echten Repo länger als der Standard-Timeout eines einzelnen Tests.
    const werte: Record<string, string | null> = {};
    /** Alle Commit-Zeitpunkte je Seite – ebenfalls zu langsam für einen Einzeltest. */
    const zeitenProSeite: Record<string, Set<string>> = {};

    beforeAll(async () => {
        for (const seite of SITEMAP_PAGES as { slug: string; sources: string[] }[]) {
            werte[seite.slug] = await resolveLastmod(seite, projektGit);
            zeitenProSeite[seite.slug] = commitZeiten(seite);
        }
    }, 120_000);

    /**
     * Ist die Seite selbst schon committet?
     *
     * Geprüft wird allein sources[0], die eigene HTML-Quelle. Ein `some` über
     * alle Quellen wäre falsch: Archivseiten führen zusätzlich ihre
     * Funkspruch-Datei, und deren Historie kann ausschließlich aus mechanischen
     * Commits bestehen (nachrichten_thw_saarstedt.txt hat genau einen, mit
     * Betreff „refactor(…)“). Die Seite gälte dann als committet, obwohl ihr
     * eigenes HTML noch nirgends steht – und hätte zu Recht kein Datum.
     */
    const istCommittet = (seite: { sources: string[] }) => {
        const eigeneQuelle = seite.sources[0];
        if (eigeneQuelle === undefined) return false;
        try {
            return execFileSync("git", ["log", "-1", "--format=%H", "--", eigeneQuelle], {
                cwd: projekt, encoding: "utf8"
            }).trim() !== "";
        } catch {
            return false;
        }
    };

    it("liefert für jede committete Sitemap-Seite ein Datum", () => {
        if (istFlach()) {
            // Flacher Klon: git log kennt nur den Tip-Commit. Kein Fehler, aber
            // auch keine belastbare Aussage – der Deploy-Job klont vollständig.
            expect(Object.keys(werte)).toHaveLength(SITEMAP_PAGES.length);
            return;
        }
        for (const seite of SITEMAP_PAGES as { slug: string; sources: string[] }[]) {
            // Eine neu angelegte, noch nicht committete Seite hat zu Recht kein
            // Datum – geraten wird nichts. Alles andere muss eines haben.
            if (!istCommittet(seite)) continue;
            expect(werte[seite.slug], `kein lastmod für "${seite.slug || "/"}"`).toBeTruthy();
        }
    });

    /**
     * Der eigentliche Regressionsschutz: Tragen alle URLs denselben Wert, ist
     * das das Muster, an dem Google lastmod domainweit entwertet. Genau dieser
     * Zustand war vor AP-03 live (alle 29 URLs auf dem Deploy-Datum).
     */
    it("vergibt nicht überall denselben Wert", () => {
        if (istFlach()) return;
        expect(new Set(Object.values(werte)).size, "alle Seiten tragen denselben lastmod")
            .toBeGreaterThan(1);
    });

    /**
     * Alle Commit-Zeitpunkte, die eine der Quellen der Seite berührt haben.
     * Wird in beforeAll erhoben: 35 Seiten mal bis zu zwei Quellen sind rund 50
     * git-Aufrufe und überschreiten den Standard-Timeout eines Einzeltests.
     */
    const commitZeiten = (seite: { sources: string[] }) => {
        const zeiten = new Set<string>();
        for (const quelle of seite.sources ?? []) {
            try {
                const ausgabe = execFileSync("git", ["log", "--format=%cI", "--", quelle], {
                    cwd: projekt, encoding: "utf8"
                });
                for (const zeile of ausgabe.split("\n")) {
                    if (zeile.trim() !== "") zeiten.add(zeile.trim());
                }
            } catch {
                // Ohne Git keine Aussage – der Aufrufer prüft das über istFlach().
            }
        }
        return zeiten;
    };

    /**
     * Der Wert muss aus der Historie der Seite stammen, nicht aus der Uhr.
     *
     * Die frühere Fassung prüfte, ob nicht alle URLs das heutige Datum tragen.
     * Das war kalenderabhängig und damit unbrauchbar: nach einem Tag, an dem
     * jede Seite angefasst wurde, tragen zu Recht alle dasselbe Datum, und der
     * Test schlug an, obwohl der Mechanismus einwandfrei arbeitete. Umgekehrt
     * wäre er an jedem anderen Tag grün geworden, ohne etwas zu beweisen.
     *
     * Diese Fassung ist falsifizierbar und datumsunabhängig: würde lastmod aus
     * `new Date()` gestempelt, träfe der Wert keinen Commit-Zeitpunkt der Quelle.
     */
    it("übernimmt lastmod aus der Historie der Seite, nicht aus der Uhr", () => {
        if (istFlach()) return;

        let geprueft = 0;
        for (const seite of SITEMAP_PAGES as { slug: string; sources: string[] }[]) {
            const wert = werte[seite.slug];
            if (!wert) continue;

            const zeiten = zeitenProSeite[seite.slug] ?? new Set<string>();
            expect(zeiten.has(wert),
                `lastmod "${wert}" für "${seite.slug || "/"}" gehört zu keinem Commit `
                + "ihrer Quellen – stammt der Wert aus der Uhr?").toBe(true);
            geprueft++;
        }

        // Ohne geprüfte Seite wäre die Zusicherung wertlos.
        expect(geprueft, "keine Seite mit lastmod – nichts geprüft").toBeGreaterThan(0);
    });

    it("nutzt nicht für jede Seite denselben Commit", () => {
        if (istFlach()) return;
        // Ergänzt die Datumsprüfung oben um die Streuung: ein einziger Wert für
        // alle URLs ist das Muster, an dem Google lastmod domainweit entwertet.
        const werteOhneNull = Object.values(werte).filter(Boolean);
        expect(new Set(werteOhneNull).size,
            "alle Seiten tragen denselben Zeitstempel").toBeGreaterThan(1);
    });
});

describe("Datumsformate", () => {
    it("kürzt auf YYYY-MM-DD", () => {
        expect(nurDatum("2026-08-01T17:19:45+02:00")).toBe("2026-08-01");
        expect(nurDatum(null)).toBeNull();
    });

    it("formatiert deutsch als TT.MM.JJJJ", () => {
        expect(deutschesDatum("2026-08-01T17:19:45+02:00")).toBe("01.08.2026");
        expect(deutschesDatum("2026-12-24")).toBe("24.12.2026");
        expect(deutschesDatum(null)).toBeNull();
    });
});
