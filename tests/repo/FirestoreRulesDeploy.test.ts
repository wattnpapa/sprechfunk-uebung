import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `firestore.rules` gehört zum Deployment: Firebase liefert hier nur die
 * Datenbank, die Website kommt von GitHub Pages. Am 2026-09-01 blieb eine
 * gemergte Regeländerung wirkungslos, bis jemand von Hand deployte — bis dahin
 * scheiterte in Produktion jedes Speichern. Seit ADR 0008 deployt der Job
 * `firestore-rules` in main.yml die Regeln bei jedem Push auf main, bevor die
 * Website live geht.
 *
 * `FirestoreRules.contract.test.ts` prüft, dass die Regeldatei zum Code passt,
 * `FirestoreRules.emulator.test.ts`, dass Firestore sie auch auswerten kann.
 * Dieser Test prüft die dritte Hälfte: dass es genau einen Weg gibt, sie nach
 * Firebase zu bringen, dass er die Website gegen alte Regeln absichert und
 * dass er überall gleich benannt ist — im Workflow, im npm-Skript und in der
 * Dokumentation.
 *
 * Siehe docs/adr/0007-firestore-regeln-deploy.md und
 * docs/adr/0008-firestore-regeln-im-deployment.md.
 */

const root = path.resolve(__dirname, "..", "..");

const DEPLOY_WORKFLOW = ".github/workflows/main.yml";
const DEPLOY_JOB = "firestore-rules";
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

/** Block eines Jobs: von `  name:` bis zum nächsten Job auf derselben Ebene. */
function jobBlock(workflow: string, name: string): string {
    const block = new RegExp(`^ {2}${name}:\\n([\\s\\S]*?)(?=^ {2}[a-z-]+:$|(?![\\s\\S]))`, "m").exec(workflow)?.[0];
    expect(block, `Job "${name}" fehlt in ${DEPLOY_WORKFLOW}.`).toBeDefined();
    return block as string;
}

describe("Deploy-Weg für firestore.rules", () => {
    const workflow = lese(DEPLOY_WORKFLOW);

    it("ist ein Job im Pages-Workflow, der bei jedem Push auf main läuft", () => {
        expect(workflow).toMatch(/on:\s*[\s\S]*push:/);
        expect(workflow).toMatch(/branches:\s*\["main"\]/);
        jobBlock(workflow, DEPLOY_JOB);
        // Kein Pfadfilter auf firestore.rules: Der Deploy ist idempotent und holt
        // auch einen früher ausgefallenen Lauf nach (ADR 0008).
        expect(workflow).not.toMatch(/paths:\s*(#[^\n]*\n\s*)*-\s*'firestore\.rules'/);
    });

    it("hält die Website zurück, bis die Regeln deployt sind", () => {
        const deploy = jobBlock(workflow, "deploy");
        expect(deploy, "deploy braucht `needs: [... firestore-rules]`").toMatch(
            new RegExp(`needs:\\s*\\[[^\\]]*\\b${DEPLOY_JOB}\\b`)
        );
        // `!cancelled()` im if lässt den Job auch nach einem Fehlschlag von
        // Abhängigkeiten laufen — deshalb muss das Ergebnis ausdrücklich geprüft werden.
        expect(deploy).toContain(`needs.${DEPLOY_JOB}.result == 'success'`);
    });

    it("hat keinen zweiten Deploy-Weg neben dem Pages-Workflow", () => {
        expect(
            existsSync(path.join(root, ".github/workflows/firestore-rules.yml")),
            "firestore-rules.yml existiert wieder. Zwei Deploy-Wege laufen auseinander (ADR 0008)."
        ).toBe(false);
    });

    it("deployt über dasselbe Kommando wie ein Mensch von Hand", () => {
        // Ein zweiter, workflow-eigener firebase-Aufruf würde bei jeder Änderung
        // des Kommandos auseinanderlaufen.
        expect(jobBlock(workflow, DEPLOY_JOB)).toContain(`npm run ${DEPLOY_SKRIPT}`);
    });

    it("schlägt fehl, wenn das Deploy-Secret fehlt, statt still zu überspringen", () => {
        const job = jobBlock(workflow, DEPLOY_JOB);
        expect(job).toContain("FIREBASE_SERVICE_ACCOUNT");
        const guard = /- name: Secret prüfen[\s\S]*?\n {6}- name:/.exec(job)?.[0];
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
        expect(jobBlock(workflow, DEPLOY_JOB)).toMatch(/rm -f "\$RUNNER_TEMP\/firebase-service-account\.json"/);
    });
});

describe("npm-Skript rules:deploy", () => {
    const paket = JSON.parse(lese("package.json")) as { scripts: Record<string, string> };
    const skript = paket.scripts[DEPLOY_SKRIPT];

    it("hat ein Gegenstück rules:test, das die Regeln im Emulator prüft", () => {
        const test = paket.scripts["rules:test"];
        expect(test).toBeDefined();
        expect(test).toContain("emulators:exec");
        // Nie gegen das echte Projekt: demo-* kennt der Emulator ohne Zugangsdaten.
        expect(test).toContain("--project demo-");
    });

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

    it("prüft die Regeln im Pull Request im Emulator", () => {
        const ci = lese(".github/workflows/ci.yml");
        expect(ci, "ci.yml hat keinen Emulator-Job für firestore.rules (ADR 0008).")
            .toMatch(/^ {2}firestore-rules-emulator:$/m);
        expect(ci).toContain("npm run rules:test");
    });

    it("lässt die Required Checks aus ADR 0001 unangetastet", () => {
        const ci = lese(".github/workflows/ci.yml");
        expect(ci).toMatch(/^ {2}validate:$/m);
        expect(ci).toMatch(/^ {2}e2e-smoke-routing:$/m);
    });
});
