#!/usr/bin/env node
// Prüft eine Funkspruch-Vorlage vor dem Einbau in den Bestand.
//
// Aufruf: node .claude/skills/funkspruch-basis/scripts/pruefe-vorlage.mjs <datei.txt> [--streng]
//
// Fehler (Exit 1): Formatverstöße, Dubletten in der Datei, Dubletten gegen den
// restlichen Bestand, verbotene Wendungen. Hinweise (Exit 0): Verteilung außerhalb
// der Richtwerte. Mit --streng werden auch Hinweise zu Fehlern.
//
// Die Regeln kommen aus scripts/lib/funkspruch-daten.mjs, damit hier nichts
// anderes gilt als im Build.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const daten = await import(path.join(wurzel, "scripts", "lib", "funkspruch-daten.mjs"));
const { VORLAGEN, KATEGORIEN, funkspruchId, kategorieFuer, schwierigkeitFuer, hatBuchstabieranteil } = daten;

const argumente = process.argv.slice(2);
const streng = argumente.includes("--streng");
const dateiArg = argumente.find(a => !a.startsWith("--"));
if (!dateiArg) {
    console.error("Aufruf: pruefe-vorlage.mjs <datei.txt> [--streng]");
    process.exit(2);
}
const datei = path.resolve(dateiArg);
if (!existsSync(datei)) {
    console.error(`Datei nicht gefunden: ${datei}`);
    process.exit(2);
}
const basename = path.basename(datei);
const roh = readFileSync(datei, "utf8");

const fehler = [];
const hinweise = [];

// --- Format -----------------------------------------------------------------
if (!roh.endsWith("\n")) fehler.push("Datei endet nicht mit einem Zeilenumbruch.");
if (roh.endsWith("\n\n")) fehler.push("Datei endet mit einer Leerzeile.");
if (roh.includes("\r")) fehler.push("Datei enthält Windows-Zeilenumbrüche (\\r).");
if (roh.includes("\t")) fehler.push("Datei enthält Tabulatoren.");
if (roh.charCodeAt(0) === 0xfeff) fehler.push("Datei beginnt mit einer BOM.");

const zeilenRoh = roh.split("\n");
if (zeilenRoh.at(-1) === "") zeilenRoh.pop();

const zeilen = [];
zeilenRoh.forEach((zeile, i) => {
    const nr = i + 1;
    if (zeile.trim() === "") { fehler.push(`Zeile ${nr}: leer.`); return; }
    if (zeile !== zeile.trim()) fehler.push(`Zeile ${nr}: führende oder folgende Leerzeichen.`);
    if (/ {2,}/.test(zeile)) hinweise.push(`Zeile ${nr}: doppelte Leerzeichen.`);
    if (zeile.length < 15) fehler.push(`Zeile ${nr}: kürzer als 15 Zeichen („${zeile}“).`);
    if (zeile.length > 300) fehler.push(`Zeile ${nr}: länger als 300 Zeichen (${zeile.length}).`);
    if (/^[„"']|[“"']$/.test(zeile)) hinweise.push(`Zeile ${nr}: in Anführungszeichen gesetzt.`);
    zeilen.push(zeile.trim());
});

// --- Verbotene Wendungen ------------------------------------------------------
const VERBOTEN = [
    [/\b(bitte|danke|hallo|moin|tschüss)\b/i, "Höflichkeitsfloskel"],
    [/\b(roger|over|copy|10-4|affirmative|negative)\b/i, "Funkslang aus Film und Fernsehen"],
    [/\b(kommen|ende|verstanden)\.?$/i, "Betriebswort am Zeilenende – gehört ins Gespräch, nicht in die Nachricht"],
    [/!{1,}/, "Ausrufezeichen"],
    [/\bd\. ?h\.|\bz\. ?B\.|\(.*?\)/, "Erklärung oder Klammer – kein Lehrtext in der Zeile"],
    [/[\u{1F300}-\u{1FAFF}]/u, "Emoji"],
    [/\bhttps?:\/\//i, "URL"],
    [/\b(Ortsverband|Fachgruppe|Bergungsgruppe)\b/, "THW-Vokabular – nur in THW-Vorlagen (das THW als Partner anzufordern ist in Ordnung)"],
];
const istThw = /thw/i.test(basename);
zeilen.forEach((zeile, i) => {
    for (const [muster, grund] of VERBOTEN) {
        if (grund.startsWith("THW-Vokabular") && istThw) continue;
        if (muster.test(zeile)) fehler.push(`Zeile ${i + 1}: ${grund} („${zeile.slice(0, 60)}${zeile.length > 60 ? "…" : ""}“).`);
    }
});

// --- Dubletten ---------------------------------------------------------------
const gesehen = new Map();
zeilen.forEach((zeile, i) => {
    const id = funkspruchId(zeile);
    if (gesehen.has(id)) fehler.push(`Zeile ${i + 1}: Dublette von Zeile ${gesehen.get(id)}.`);
    else gesehen.set(id, i + 1);
});

const fremd = new Map();
for (const vorlage of VORLAGEN) {
    if (vorlage.datei === basename) continue;
    const pfad = path.join(wurzel, "assets", "funksprueche", vorlage.datei);
    if (!existsSync(pfad)) continue;
    for (const zeile of readFileSync(pfad, "utf8").split(/\r?\n/)) {
        const t = zeile.trim();
        if (t !== "") fremd.set(funkspruchId(t), vorlage.datei);
    }
}
zeilen.forEach((zeile, i) => {
    const id = funkspruchId(zeile);
    if (fremd.has(id)) fehler.push(`Zeile ${i + 1}: steht bereits in ${fremd.get(id)}.`);
});

// --- Verteilung ----------------------------------------------------------------
const anzahl = zeilen.length;
const prozent = n => `${Math.round((n / Math.max(anzahl, 1)) * 100)} %`;
const vorlageMeta = VORLAGEN.find(v => v.datei === basename) ?? {};

const stufen = { einfach: 0, mittel: 0, schwer: 0 };
const kategorien = new Map(KATEGORIEN.map(k => [k.key, 0]));
let buchstabieren = 0;
for (const zeile of zeilen) {
    stufen[schwierigkeitFuer(zeile, vorlageMeta)]++;
    kategorien.set(kategorieFuer(zeile), (kategorien.get(kategorieFuer(zeile)) ?? 0) + 1);
    if (hatBuchstabieranteil(zeile)) buchstabieren++;
}

const anteil = n => n / Math.max(anzahl, 1);
if (anzahl < 10) fehler.push(`Nur ${anzahl} Einträge – eine Archivvorlage braucht mindestens 10.`);
if (anteil(stufen.einfach) < 0.2 || anteil(stufen.einfach) > 0.4) hinweise.push(`Anteil „einfach“ ${prozent(stufen.einfach)} (Richtwert 25–35 %).`);
if (anteil(stufen.schwer) < 0.1 || anteil(stufen.schwer) > 0.3) hinweise.push(`Anteil „schwer“ ${prozent(stufen.schwer)} (Richtwert 15–25 %).`);
if (anteil(buchstabieren) < 0.25) hinweise.push(`Buchstabieranteil ${prozent(buchstabieren)} (Richtwert 30–50 %) – mehr Wörter in GROSSBUCHSTABEN.`);
if (anteil(buchstabieren) > 0.6) hinweise.push(`Buchstabieranteil ${prozent(buchstabieren)} – zu viele Großschreibungen, das ermüdet.`);
if (anteil(kategorien.get("allgemein")) > 0.5) hinweise.push(`Sammelkategorie „allgemein“ bei ${prozent(kategorien.get("allgemein"))} (höchstens 50 %) – mehr Stärke-, Standort-, Anforderungs- und Erkundungsmeldungen mit den erkannten Wortmustern.`);
const vertreten = [...kategorien.entries()].filter(([k, n]) => k !== "allgemein" && n > 0).length;
if (vertreten < 5) hinweise.push(`Nur ${vertreten} Kategorien vertreten (mindestens 5).`);

// --- Bericht -------------------------------------------------------------------
console.log(`\n${basename}: ${anzahl} Einträge${vorlageMeta.slug ? ` (Slug „${vorlageMeta.slug}“)` : " (noch nicht in VORLAGEN registriert)"}`);
console.log(`  Schwierigkeit: einfach ${stufen.einfach} (${prozent(stufen.einfach)}), mittel ${stufen.mittel} (${prozent(stufen.mittel)}), schwer ${stufen.schwer} (${prozent(stufen.schwer)})`);
console.log(`  Buchstabieranteil: ${buchstabieren} (${prozent(buchstabieren)})`);
const laengen = zeilen.map(z => z.length).sort((a, b) => a - b);
console.log(`  Zeichen: min ${laengen[0] ?? 0}, median ${laengen[Math.floor(laengen.length / 2)] ?? 0}, max ${laengen.at(-1) ?? 0}`);
console.log("  Kategorien:");
for (const k of KATEGORIEN) {
    const n = kategorien.get(k.key) ?? 0;
    if (n > 0) console.log(`    ${k.name.padEnd(26)} ${String(n).padStart(4)}  ${prozent(n)}`);
}

if (hinweise.length) {
    console.log(`\nHinweise (${hinweise.length}):`);
    for (const h of hinweise) console.log(`  - ${h}`);
}
if (fehler.length) {
    console.log(`\nFehler (${fehler.length}):`);
    for (const f of fehler) console.log(`  - ${f}`);
}
if (!fehler.length && !hinweise.length) console.log("\nKeine Beanstandungen.");

process.exit(fehler.length || (streng && hinweise.length) ? 1 : 0);
