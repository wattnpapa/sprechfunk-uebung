import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `firestore.rules` wird getrennt von der Website deployt: main.yml lädt nur
 * dist/ zu GitHub Pages, Firebase liefert hier ausschließlich die Datenbank.
 * Am 2026-09-01 blieb deshalb eine gemergte Regeländerung wirkungslos, bis
 * jemand von Hand deployte — bis dahin scheiterte in Produktion jedes Speichern.
 *
 * `FirestoreRules.contract.test.ts` prüft, dass die Regeldatei zum Code passt.
 * Dieser Test prüft die andere Hälfte: dass es überhaupt einen Weg gibt, sie
 * nach Firebase zu bringen, und dass dieser Weg überall gleich benannt ist —
 * im Workflow, im npm-Skript und in der Dokumentation.
 *
 * Siehe docs/adr/0007-firestore-regeln-deploy.md.
 */

const root = path.resolve(__dirname, "..", "..");

const DEPLOY_WORKFLOW = ".github/workflows/firestore-rules.yml";
const DEPLOY_SKRIPT = "rules:deploy";

/** Doku, die den manuellen Weg nennen muss — sonst weiß ihn im Ernstfall niemand. */
const DOKU_DATEIEN = [
    "CLAUDE.md",
    "AGENTS.md",
    "CONTRIBUTING.md",
    "docs/entwicklung.md"
];

function lese(relativerPfad: string): string {
    return readFileSync(path.join(root, relativerPfad), "utf8");
}

describe("Deploy-Weg für firestore.rules", () => {
    const workflow = lese(DEPLOY_WORKFLOW);

    it("wird von einem Workflow bei Änderungen an firestore.rules ausgelöst", () => {
        expect(workflow).toMatch(/on:\s*[\s\S]*push:/);
        expect(workflow).toMatch(/branches:\s*\["main"\]/);
        expect(
            workflow,
            `${DEPLOY_WORKFLOW} filtert nicht auf firestore.rules. Ohne diesen Pfad läuft der ` +
                "Deploy entweder bei jedem Push oder gar nicht."
        ).toMatch(/paths:\s*(#[^\n]*\n\s*)*-\s*'firestore\.rules'/);
    });

    it("deployt über dasselbe Kommando wie ein Mensch von Hand", () => {
        // Ein zweiter, workflow-eigener firebase-Aufruf würde bei jeder Änderung
        // des Kommandos auseinanderlaufen.
        expect(workflow).toContain(`npm run ${DEPLOY_SKRIPT}`);
    });

    it("schlägt fehl, wenn das Deploy-Secret fehlt, statt still zu überspringen", () => {
        expect(workflow).toContain("FIREBASE_SERVICE_ACCOUNT");
        const guard = /- name: Secret prüfen[\s\S]*?\n {6}- name:/.exec(workflow)?.[0];
        expect(guard, `Schritt "Secret prüfen" fehlt in ${DEPLOY_WORKFLOW}.`).toBeDefined();
        expect(
            guard,
            "Der Guard bricht nicht ab. Ein grüner, übersprungener Job ist von der Lücke " +
                "nicht zu unterscheiden, die dieser Workflow schließen soll (ADR 0007)."
        ).toContain("exit 1");
        expect(
            guard,
            "Die Fehlermeldung nennt das nachzuholende Kommando nicht."
        ).toContain(`npm run ${DEPLOY_SKRIPT}`);
    });

    it("räumt den Service-Account-Schlüssel wieder ab", () => {
        expect(workflow).toMatch(/rm -f "\$RUNNER_TEMP\/firebase-service-account\.json"/);
    });
});

describe("npm-Skript rules:deploy", () => {
    const paket = JSON.parse(lese("package.json")) as { scripts: Record<string, string> };
    const skript = paket.scripts[DEPLOY_SKRIPT];

    it("existiert", () => {
        expect(
            skript,
            `package.json hat kein "${DEPLOY_SKRIPT}". Die Dokumentation verweist darauf.`
        ).toBeDefined();
    });

    it("deployt nur die Regeln, nicht die Indizes", () => {
        // Index-Deploys können vorschlagen, in Produktion vorhandene Indizes zu
        // löschen. Das gehört nicht in einen Lauf ohne Rückfrage (ADR 0007).
        expect(skript).toContain("--only firestore:rules");
    });

    it("braucht kein --project, weil .firebaserc das Projekt hält", () => {
        expect(skript).not.toContain("--project");
    });
});

describe(".firebaserc", () => {
    const firebaserc = JSON.parse(lese(".firebaserc")) as {
        projects: Record<string, string>;
    };

    it("nennt dasselbe Projekt wie die ausgelieferte Firebase-Konfiguration", () => {
        // Bewusst die Fassung aus HEAD: ci.yml überschreibt src/firebase-config.js
        // vor dem Testlauf mit den Platzhaltern des Templates.
        const konfiguration = execFileSync("git", ["show", "HEAD:src/firebase-config.js"], {
            cwd: root,
            encoding: "utf8"
        });
        const projektId = /projectId:\s*"([^"]+)"/.exec(konfiguration)?.[1];

        expect(projektId, "projectId nicht in src/firebase-config.js gefunden").toBeDefined();
        expect(
            firebaserc.projects.default,
            "Der Deploy würde in ein anderes Projekt schreiben als das, gegen das die " +
                "Anwendung läuft."
        ).toBe(projektId);
    });
});

describe("Dokumentation des Deploy-Schritts", () => {
    it.each(DOKU_DATEIEN)("%s nennt das Kommando für den manuellen Deploy", (datei) => {
        expect(
            lese(datei),
            `${datei} erklärt nicht, wie die Regeln nach Firebase kommen. Genau dieses Wissen ` +
                "fehlte, als der Deploy vergessen wurde."
        ).toContain(`npm run ${DEPLOY_SKRIPT}`);
    });

    it("hält in docs/entwicklung.md fest, wie der Deploy eingerichtet wird", () => {
        const doku = lese("docs/entwicklung.md");
        expect(doku).toContain("Firestore-Regeln deployen");
        expect(doku).toContain("FIREBASE_SERVICE_ACCOUNT");
        // Die Verwechslung mit den Environment-Secrets des Environments github-pages
        // ist der wahrscheinlichste Fehler beim Einrichten.
        expect(doku).toContain("Repository-Secret");
    });

    it("weist im Pull Request auf anstehende Regel-Deploys hin", () => {
        const ci = lese(".github/workflows/ci.yml");
        expect(
            ci,
            "ci.yml hat keinen Hinweis-Job. Dann erfährt man erst nach dem Merge, dass ein " +
                "Deploy fällig ist."
        ).toContain("firestore-rules-hinweis");
        expect(ci).toContain("firestore.rules");
        expect(ci).toContain(`npm run ${DEPLOY_SKRIPT}`);
    });

    it("lässt die Required Checks aus ADR 0001 unangetastet", () => {
        const ci = lese(".github/workflows/ci.yml");
        expect(ci).toMatch(/^ {2}validate:$/m);
        expect(ci).toMatch(/^ {2}e2e-smoke-routing:$/m);
    });
});
