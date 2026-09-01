// Einlesen des Funkspruch-Bestands zur Buildzeit (AP-08).
//
// Synchron und beim Import, damit die Anzahl als echte Konstante zur Verfügung
// steht: site-pages.mjs braucht sie in Template-Strings für „Kurz gesagt“ und
// FAQ-Antworten, und dort ist kein await möglich.
//
// Absichtlich getrennt von funkspruch-daten.mjs: dort stehen die reinen Regeln,
// hier der Dateizugriff. Nur so kann der Test die Regeln mit synthetischem Text
// prüfen, ohne 350 KB Vorlagen zu laden.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { baueBestand, deutscheZahl, VORLAGEN } from "./funkspruch-daten.mjs";

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const VORLAGEN_VERZEICHNIS = path.join(wurzel, "assets", "funksprueche");

const inhalte = {};
for (const vorlage of VORLAGEN) {
    inhalte[vorlage.datei] = readFileSync(path.join(VORLAGEN_VERZEICHNIS, vorlage.datei), "utf8");
}

export const BESTAND = baueBestand(inhalte);

/**
 * Zwei Zahlen, die nicht verwechselt werden dürfen:
 *
 * ANZAHL_GESAMT – was der Generator verteilt, also alle Vorlagen. Das ist die
 *   Zahl für Aussagen über den Umfang der Anwendung.
 * ANZAHL_ARCHIV – was das öffentliche Archiv zeigt. Kleiner, weil die
 *   humorvolle Vorlage nicht veröffentlicht wird (siehe VORLAGEN).
 */
export const ANZAHL_GESAMT = BESTAND.anzahlGesamt;
export const ANZAHL_ARCHIV = BESTAND.anzahlArchiv;

export const ANZAHL_GESAMT_TEXT = deutscheZahl(ANZAHL_GESAMT);
export const ANZAHL_ARCHIV_TEXT = deutscheZahl(ANZAHL_ARCHIV);

/** Einträge einer Vorlage, leer wenn der Slug unbekannt ist. */
export function funkspruecheDerVorlage(slug) {
    return BESTAND.nachVorlage.get(slug) ?? [];
}
