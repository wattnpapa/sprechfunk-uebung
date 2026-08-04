#!/usr/bin/env node
// Prüft die Zielliste in seo/outreach.md (AP-12).
//
// Aufruf:   node scripts/check-outreach.mjs [--offline]
//
// Zweck: Eine Zielliste, in der eine URL erfunden oder verwaist ist, kostet
// beim Ansprechen Glaubwürdigkeit. Deshalb wird jeder Eintrag abgerufen. Der
// Lauf braucht Netz und gehört deshalb NICHT in die CI-Pflichtprüfung – die
// Struktur prüft tests/seo/Outreach.test.ts ohne Netz.
//
// --offline prüft nur Aufbau und Vollständigkeit der Tabelle.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseOutreach, PFLICHTSPALTEN } from "./lib/outreach.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LISTE = path.join(ROOT, "seo", "outreach.md");

const GLEICHZEITIG = 6;
const ZEITLIMIT_MS = 20_000;

/**
 * Ein Abruf.
 *
 * Erst HEAD, bei Ablehnung GET: manche Server antworten auf HEAD mit 403 oder
 * 405, obwohl die Seite existiert. Ein User-Agent wird mitgeschickt, weil
 * einige Auftritte anonyme Abrufe sonst abweisen.
 */
async function pruefe(url) {
    const optionen = {
        redirect: "follow",
        headers: {
            "user-agent": "sprechfunk-uebung-linkcheck/1.0 (+https://sprechfunk-uebung.de/)",
            "accept": "text/html,application/xhtml+xml"
        }
    };

    for (const methode of ["HEAD", "GET"]) {
        try {
            const antwort = await fetch(url, {
                ...optionen,
                method: methode,
                signal: AbortSignal.timeout(ZEITLIMIT_MS)
            });
            if (antwort.status === 200) return { ok: true, status: 200, ziel: antwort.url };
            if (methode === "GET") return { ok: false, status: antwort.status, ziel: antwort.url };
        } catch (fehler) {
            if (methode === "GET") return { ok: false, status: 0, fehler: fehler.message };
        }
    }
    return { ok: false, status: 0, fehler: "unerreichbar" };
}

async function inHaeppchen(eintraege, groesse, arbeit) {
    const ergebnisse = [];
    for (let i = 0; i < eintraege.length; i += groesse) {
        ergebnisse.push(...await Promise.all(eintraege.slice(i, i + groesse).map(arbeit)));
    }
    return ergebnisse;
}

async function main() {
    const offline = process.argv.includes("--offline");
    const markdown = await readFile(LISTE, "utf8");
    const { eintraege, kategorien, fehler } = parseOutreach(markdown);

    console.log(`Zielliste: ${eintraege.length} Einträge in ${kategorien.length} Kategorien`);
    console.log(`Pflichtspalten: ${PFLICHTSPALTEN.join(", ")}`);

    if (fehler.length > 0) {
        console.error(`\n${fehler.length} Strukturfehler:`);
        for (const eintrag of fehler) console.error(`  ${eintrag}`);
        process.exitCode = 1;
        return;
    }

    if (offline) {
        console.log("\n--offline: keine Abrufe durchgeführt.");
        return;
    }

    const ergebnisse = await inHaeppchen(eintraege, GLEICHZEITIG, async eintrag => ({
        eintrag,
        ergebnis: await pruefe(eintrag.url)
    }));

    const kaputt = ergebnisse.filter(zeile => !zeile.ergebnis.ok);
    for (const zeile of ergebnisse) {
        const status = zeile.ergebnis.ok ? "200" : (zeile.ergebnis.status || "—");
        const marke = zeile.ergebnis.ok ? "✓" : "✗";
        console.log(`${marke} ${String(status).padStart(3)}  ${zeile.eintrag.url}`);
    }

    if (kaputt.length > 0) {
        console.error(`\n${kaputt.length} von ${eintraege.length} URLs antworten nicht mit 200:`);
        for (const zeile of kaputt) {
            const grund = zeile.ergebnis.fehler ?? `HTTP ${zeile.ergebnis.status}`;
            console.error(`  ${zeile.eintrag.name} – ${zeile.eintrag.url} (${grund})`);
        }
        console.error("\nEintrag korrigieren oder entfernen. Eine tote URL in der Zielliste");
        console.error("kostet beim Ansprechen mehr, als der Eintrag wert ist.");
        process.exitCode = 1;
        return;
    }

    console.log(`\nAlle ${eintraege.length} URLs antworten mit 200.`);
}

main().catch(fehler => {
    console.error(fehler.message);
    process.exitCode = 1;
});
