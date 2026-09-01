#!/usr/bin/env node
// Wöchentlicher Positions-Export aus der Google Search Console (AP-00).
//
// Aufruf:   node scripts/seo-rank-snapshot.mjs
// Ergebnis: seo/snapshots/YYYY-MM-DD.json
//
// Ohne GSC_SERVICE_ACCOUNT_JSON läuft das Skript im No-Op-Modus durch (Exit 0),
// damit lokale Builds und Forks ohne Secret nicht brechen.
//
// Absichtlich ohne SDK: der Service-Account-Flow ist ein signiertes JWT plus zwei
// POSTs. Node 20+ bringt fetch und crypto mitgeliefert, deshalb kommt hier keine
// neue Laufzeit-Abhängigkeit dazu (siehe Performance-Budget in CLAUDE.md).

import { createSign } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSnapshot, isoDatum, resolveDateRange } from "./lib/seo-snapshot.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEYWORDS_FILE = path.join(root, "seo", "keywords.json");
const SNAPSHOT_DIR = path.join(root, "seo", "snapshots");

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
// Domain-Property, passend zur empfohlenen DNS-Verifizierung. Für eine
// URL-Präfix-Property GSC_SITE_URL auf "https://sprechfunk-uebung.de/" setzen.
const DEFAULT_SITE = "sc-domain:sprechfunk-uebung.de";
const ROW_LIMIT = 25_000;

function base64url(buffer) {
    return Buffer.from(buffer).toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Signiertes JWT für den Service-Account-Flow (RS256). */
function createAssertion({ client_email, private_key }) {
    const jetzt = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(JSON.stringify({
        iss: client_email,
        scope: SCOPE,
        aud: TOKEN_ENDPOINT,
        iat: jetzt,
        exp: jetzt + 3600
    }));
    const signatur = createSign("RSA-SHA256")
        .update(`${header}.${claims}`)
        .sign(private_key);
    return `${header}.${claims}.${base64url(signatur)}`;
}

async function fetchAccessToken(credentials) {
    const antwort = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: createAssertion(credentials)
        })
    });
    if (!antwort.ok) {
        // Antworttext bewusst nicht ausgeben: er kann Teile der Assertion enthalten.
        throw new Error(`Token-Anfrage fehlgeschlagen (HTTP ${antwort.status}).`);
    }
    const daten = await antwort.json();
    if (!daten.access_token) throw new Error("Token-Antwort enthält kein access_token.");
    return daten.access_token;
}

/** Holt alle Zeilen; die API liefert maximal ROW_LIMIT pro Anfrage. */
async function fetchSearchAnalytics({ accessToken, site, range }) {
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
    const alleZeilen = [];

    for (let startRow = 0; ; startRow += ROW_LIMIT) {
        const antwort = await fetch(url, {
            method: "POST",
            headers: {
                authorization: `Bearer ${accessToken}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                startDate: range.startDate,
                endDate: range.endDate,
                dimensions: ["query", "page"],
                type: "web",
                rowLimit: ROW_LIMIT,
                startRow
            })
        });
        if (!antwort.ok) {
            const grund = antwort.status === 403
                ? " Hat der Service-Account Leserechte auf die Property?"
                : "";
            throw new Error(`searchAnalytics/query fehlgeschlagen (HTTP ${antwort.status}).${grund}`);
        }
        const daten = await antwort.json();
        const zeilen = Array.isArray(daten.rows) ? daten.rows : [];
        alleZeilen.push(...zeilen);
        if (zeilen.length < ROW_LIMIT) break;
    }

    return { rows: alleZeilen };
}

function leseCredentials() {
    const roh = process.env.GSC_SERVICE_ACCOUNT_JSON;
    if (!roh || roh.trim() === "") return null;

    let daten;
    try {
        daten = JSON.parse(roh);
    } catch {
        throw new Error("GSC_SERVICE_ACCOUNT_JSON ist kein gültiges JSON.");
    }
    if (!daten.client_email || !daten.private_key) {
        throw new Error("GSC_SERVICE_ACCOUNT_JSON braucht client_email und private_key.");
    }
    return {
        client_email: daten.client_email,
        // In CI-Secrets stehen Zeilenumbrüche oft als literales \n.
        private_key: String(daten.private_key).replace(/\\n/g, "\n")
    };
}

async function main() {
    const keywords = JSON.parse(await readFile(KEYWORDS_FILE, "utf8"));
    const site = process.env.GSC_SITE_URL || DEFAULT_SITE;
    const heute = new Date();
    const range = resolveDateRange(heute);

    const credentials = leseCredentials();
    if (!credentials) {
        process.stdout.write(
            "SEO-Snapshot: No-Op-Modus – GSC_SERVICE_ACCOUNT_JSON ist nicht gesetzt.\n" +
            "Es wird keine Snapshot-Datei geschrieben. Das ist lokal der erwartete Zustand;\n" +
            "in CI setzt der Workflow das Secret, sonst überspringt er den Job.\n"
        );
        return;
    }

    process.stdout.write(`SEO-Snapshot: ${site}, Zeitraum ${range.startDate} bis ${range.endDate}\n`);
    const accessToken = await fetchAccessToken(credentials);
    const response = await fetchSearchAnalytics({ accessToken, site, range });

    const snapshot = buildSnapshot({
        response,
        keywords,
        site,
        range,
        generatedAt: heute.toISOString()
    });

    await mkdir(SNAPSHOT_DIR, { recursive: true });
    const ziel = path.join(SNAPSHOT_DIR, `${isoDatum(heute)}.json`);
    await writeFile(ziel, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

    const gefunden = snapshot.tracked.primary.filter(k => k.found).length;
    process.stdout.write(
        `SEO-Snapshot: ${snapshot.rowCount} Zeilen geschrieben nach ${path.relative(root, ziel)}\n` +
        `Primary-Keywords mit Impressionen: ${gefunden}/${snapshot.tracked.primary.length}\n`
    );
}

main().catch(fehler => {
    console.error(`SEO-Snapshot fehlgeschlagen: ${fehler.message}`);
    process.exit(1);
});
