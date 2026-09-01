import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `src/firebase-config.js` ist bewusst eingecheckt: eine Firebase-Web-Konfiguration
 * identifiziert das Projekt, sie authentifiziert nicht, und sie steht ohnehin im
 * ausgelieferten Bundle. Die Doku hat das lange falsch als "gitignored"
 * beschrieben und Beitragende damit zu falschen Annahmen verleitet.
 *
 * Dieser Test hält drei Dinge zusammen, die sonst stumm auseinanderlaufen:
 *   1. den tatsächlichen Git-Zustand der Datei,
 *   2. die Aussagen darüber in CLAUDE.md, AGENTS.md und docs/entwicklung.md,
 *   3. die Feldgleichheit von Template, eingecheckter Datei und den sed-Ketten
 *      der Workflows — ein Feld nur im Template lässt sonst ein literales
 *      "${FIREBASE_…}" in die Produktion durchrutschen.
 */

const root = path.resolve(__dirname, "..", "..");

const DOKU_DATEIEN = ["CLAUDE.md", "AGENTS.md", "docs/entwicklung.md"];

/** Workflows, die src/firebase-config.js aus dem Template erzeugen. */
const GENERIERENDE_WORKFLOWS = [
    ".github/workflows/main.yml",
    ".github/workflows/e2e-nightly.yml"
];

function lese(relativerPfad: string): string {
    return readFileSync(path.join(root, relativerPfad), "utf8");
}

function git(...argumente: string[]): { ausgabe: string; erfolg: boolean } {
    try {
        const ausgabe = execFileSync("git", argumente, { cwd: root, encoding: "utf8" });
        return { ausgabe, erfolg: true };
    } catch {
        return { ausgabe: "", erfolg: false };
    }
}

/** Schlüsselnamen aus dem exportierten Objekt-Literal. */
function feldnamen(quelle: string): string[] {
    return [...quelle.matchAll(/^\s{2,}([A-Za-z][A-Za-z0-9_]*)\s*:/gm)].map((treffer) => treffer[1]);
}

/** Platzhalternamen der Form ${FIREBASE_…} im Template. */
function platzhalter(quelle: string): string[] {
    return [...quelle.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map((treffer) => treffer[1]);
}

describe("Git-Zustand von src/firebase-config.js", () => {
    it("ist im Index geführt", () => {
        const { erfolg } = git("ls-files", "--error-unmatch", "src/firebase-config.js");
        expect(
            erfolg,
            "src/firebase-config.js ist nicht mehr getrackt. Das war eine bewusste Entscheidung " +
                "(siehe CLAUDE.md, Conventions) — wenn sie revidiert wird, Doku und diesen Test " +
                "mit anpassen und den Key rotieren."
        ).toBe(true);
    });

    it("wird von keiner .gitignore-Regel erfasst", () => {
        // check-ignore endet mit Exit 1, wenn kein Muster greift.
        const { erfolg } = git("check-ignore", "src/firebase-config.js");
        expect(
            erfolg,
            "Eine .gitignore-Regel erfasst src/firebase-config.js, obwohl die Datei getrackt ist. " +
                "Dieser Mischzustand ist die Vorlage für genau das Missverständnis, das die Doku " +
                "früher hatte."
        ).toBe(false);
    });
});

describe("Doku-Aussagen über src/firebase-config.js", () => {
    it.each(DOKU_DATEIEN)("%s behauptet nicht, die Datei sei gitignored", (datei) => {
        const inhalt = lese(datei);
        // Erlaubt sind nur verneinte Formen ("nicht gitignored", "not gitignored").
        const bejahend = [...inhalt.matchAll(/(\S+\s+){0,2}gitignored/gi)].filter(
            (treffer) => !/\b(nicht|not|kein|keine)\b/i.test(treffer[0])
        );
        expect(
            bejahend.map((treffer) => treffer[0].trim()),
            `${datei} nennt die Datei gitignored. Sie ist getrackt — die Aussage wäre falsch.`
        ).toEqual([]);
    });

    it.each(DOKU_DATEIEN)("%s schreibt das Kopieren des Templates nicht als Setup-Schritt vor", (datei) => {
        const inhalt = lese(datei);
        expect(
            inhalt,
            `${datei} enthält "cp src/firebase-config.template.js src/firebase-config.js". Dieser ` +
                "Schritt überschreibt die eingecheckte Konfiguration mit Platzhaltern und macht den " +
                "Working Tree dirty."
        ).not.toContain("cp src/firebase-config.template.js src/firebase-config.js");
    });

    it("begründet in CLAUDE.md, warum die Datei eingecheckt ist", () => {
        // CLAUDE.md ist die Quelle, die anderen verweisen darauf. Ohne diese Begründung
        // wird die Entscheidung beim nächsten Security-Review wieder aufgerollt.
        const claude = lese("CLAUDE.md");
        expect(claude).toMatch(/deliberately committed, not gitignored/i);
        expect(claude).toMatch(/firestore\.rules/);
    });
});

describe("Feldgleichheit von Template, eingecheckter Datei und Workflows", () => {
    const template = lese("src/firebase-config.template.js");

    it("Template und eingecheckte Datei haben dieselben Felder", () => {
        // Bewusst die Fassung aus HEAD, nicht die im Working Tree: ci.yml überschreibt
        // die Datei vor dem Testlauf mit dem Template, ein Vergleich gegen das
        // Arbeitsverzeichnis wäre dort trivial erfüllt.
        const { ausgabe, erfolg } = git("show", "HEAD:src/firebase-config.js");
        expect(erfolg, "src/firebase-config.js liegt nicht in HEAD.").toBe(true);

        expect(feldnamen(ausgabe).sort()).toEqual(feldnamen(template).sort());
    });

    it("das Template enthält für jedes Feld einen Platzhalter", () => {
        expect(platzhalter(template)).toHaveLength(feldnamen(template).length);
    });

    it.each(GENERIERENDE_WORKFLOWS)("%s ersetzt jeden Platzhalter des Templates", (workflow) => {
        const inhalt = lese(workflow);
        const fehlend = platzhalter(template).filter(
            (name) => !inhalt.includes(`secrets.${name}`)
        );
        expect(
            fehlend,
            `${workflow} ersetzt diese Platzhalter nicht. Der Build liefert dann literale ` +
                '"${…}"-Strings in die Firebase-Konfiguration aus.'
        ).toEqual([]);
    });
});
