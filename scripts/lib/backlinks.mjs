// Auswertung der verweisenden Domains (AP-12).
//
// Warum CSV und nicht die API: die Search-Console-API kennt keinen Endpunkt für
// den Links-Bericht. Verfügbar sind `searchanalytics`, `sitemaps` und
// `urlInspection` – verweisende Domains stehen in keinem davon. Der Bericht
// lässt sich nur in der Oberfläche exportieren. Deshalb liest dieses Modul den
// manuellen Export ein, statt eine API vorzutäuschen, die es nicht gibt.
//
// Reine Funktionen ohne Datei- und Netzzugriff; tests/seo/Backlinks.test.ts
// prüft Parser, Normalisierung und Vergleich.

/** Spaltenüberschriften, die als Domain-Spalte gelten (deutsch und englisch). */
const DOMAIN_SPALTEN = ["website", "site", "verweisende website", "linking site", "domain"];

/**
 * Zerlegt eine CSV-Zeile mit Anführungszeichen nach RFC 4180.
 * Der GSC-Export setzt Zahlen mit Tausendertrennung in Anführungszeichen
 * („1.234"), ein naives split(",") zerreißt die Zeile also.
 */
export function csvZeile(zeile) {
    const felder = [];
    let feld = "";
    let inAnfuehrung = false;
    for (let i = 0; i < zeile.length; i++) {
        const zeichen = zeile[i];
        if (inAnfuehrung) {
            if (zeichen === "\"" && zeile[i + 1] === "\"") {
                feld += "\"";
                i++;
            } else if (zeichen === "\"") {
                inAnfuehrung = false;
            } else {
                feld += zeichen;
            }
        } else if (zeichen === "\"") {
            inAnfuehrung = true;
        } else if (zeichen === ",") {
            felder.push(feld);
            feld = "";
        } else {
            feld += zeichen;
        }
    }
    felder.push(feld);
    return felder.map(wert => wert.trim());
}

/** „1.234" oder „1,234" → 1234; alles Unlesbare → 0. */
export function zahl(wert) {
    const ziffern = String(wert ?? "").replace(/[^\d]/g, "");
    return ziffern === "" ? 0 : Number(ziffern);
}

/**
 * Vereinheitlicht eine Domain: Kleinschreibung, ohne Schema, ohne „www.",
 * ohne Pfad und ohne abschließenden Punkt. Sonst gilt dieselbe Quelle in zwei
 * Monaten als zwei verschiedene und der Bericht meldet Bewegung, die es
 * nicht gab.
 */
export function normalisiereDomain(roh) {
    let wert = String(roh ?? "").trim().toLowerCase();
    if (wert === "") return "";
    wert = wert.replace(/^https?:\/\//, "");
    wert = wert.split("/")[0];
    wert = wert.replace(/^www\./, "");
    wert = wert.replace(/\.$/, "");
    return wert;
}

/**
 * Liest einen Search-Console-Export.
 *
 * Erwartet wird eine Kopfzeile mit einer Domain-Spalte; die erste
 * Zahlenspalte gilt als Anzahl verweisender Seiten, die zweite als Anzahl
 * verlinkter Zielseiten. Fehlt die Kopfzeile, wird die erste Spalte als
 * Domain gelesen.
 */
export function parseExport(text) {
    const zeilen = String(text ?? "")
        .split(/\r?\n/)
        .map(zeile => zeile.trim())
        .filter(zeile => zeile !== "");
    if (zeilen.length === 0) return [];

    const kopf = csvZeile(zeilen[0]).map(feld => feld.toLowerCase());
    const hatKopf = kopf.some(feld => DOMAIN_SPALTEN.includes(feld));
    const datenZeilen = hatKopf ? zeilen.slice(1) : zeilen;

    const gefunden = new Map();
    for (const zeile of datenZeilen) {
        const felder = csvZeile(zeile);
        const domain = normalisiereDomain(felder[0]);
        if (domain === "" || !domain.includes(".")) continue;

        const eintrag = {
            domain,
            verweisendeSeiten: zahl(felder[1]),
            verlinkteSeiten: zahl(felder[2])
        };
        // Doppelte Zeilen (www und nicht-www) zusammenfassen statt verdoppeln.
        const vorhanden = gefunden.get(domain);
        if (vorhanden) {
            vorhanden.verweisendeSeiten += eintrag.verweisendeSeiten;
            vorhanden.verlinkteSeiten = Math.max(vorhanden.verlinkteSeiten, eintrag.verlinkteSeiten);
        } else {
            gefunden.set(domain, eintrag);
        }
    }

    return [...gefunden.values()].sort((a, b) => a.domain.localeCompare(b.domain));
}

/** Normalisierte Fassung als CSV, so wie sie unter seo/backlinks/ liegt. */
export function alsCsv(eintraege) {
    const zeilen = ["domain,verweisende_seiten,verlinkte_seiten"];
    for (const eintrag of eintraege) {
        zeilen.push(`${eintrag.domain},${eintrag.verweisendeSeiten},${eintrag.verlinkteSeiten}`);
    }
    return `${zeilen.join("\n")}\n`;
}

/** Monatsschlüssel „2026-08" aus einem ISO-Datum. */
export function monatsSchluessel(iso) {
    return String(iso).slice(0, 7);
}

/** Der Monat davor, über die Jahresgrenze hinweg. */
export function vormonat(schluessel) {
    const [jahr, monat] = schluessel.split("-").map(Number);
    return monat === 1
        ? `${jahr - 1}-12`
        : `${jahr}-${String(monat - 1).padStart(2, "0")}`;
}

/**
 * Vergleicht zwei Monate.
 * `veraendert` meldet nur Domains, bei denen sich die Zahl verweisender Seiten
 * bewegt hat – eine unveränderte Liste ist keine Nachricht.
 */
export function vergleiche(aktuell, vorher) {
    const jetzt = new Map(aktuell.map(eintrag => [eintrag.domain, eintrag]));
    const davor = new Map((vorher ?? []).map(eintrag => [eintrag.domain, eintrag]));

    const neu = [...jetzt.values()].filter(eintrag => !davor.has(eintrag.domain));
    const verloren = [...davor.values()].filter(eintrag => !jetzt.has(eintrag.domain));
    const veraendert = [];
    for (const eintrag of jetzt.values()) {
        const alt = davor.get(eintrag.domain);
        if (!alt || alt.verweisendeSeiten === eintrag.verweisendeSeiten) continue;
        veraendert.push({
            domain: eintrag.domain,
            vorher: alt.verweisendeSeiten,
            nachher: eintrag.verweisendeSeiten
        });
    }

    return {
        neu: neu.sort((a, b) => b.verweisendeSeiten - a.verweisendeSeiten),
        verloren: verloren.sort((a, b) => b.verweisendeSeiten - a.verweisendeSeiten),
        veraendert: veraendert.sort((a, b) => (b.nachher - b.vorher) - (a.nachher - a.vorher)),
        summeDomains: jetzt.size,
        summeSeiten: [...jetzt.values()].reduce((summe, e) => summe + e.verweisendeSeiten, 0)
    };
}

function tabelle(kopf, zeilen) {
    if (zeilen.length === 0) return "_keine_\n";
    return `${[`| ${kopf.join(" | ")} |`, `|${kopf.map(() => "---").join("|")}|`, ...zeilen].join("\n")}\n`;
}

/**
 * Der Bericht als Markdown.
 *
 * Ohne Vormonat wird das ausdrücklich gesagt statt alles als „neu" zu melden –
 * der erste Lauf ist eine Bestandsaufnahme, kein Zuwachs.
 */
export function baueBericht({ monat, aktuell, vorher, vorherMonat }) {
    const diff = vergleiche(aktuell, vorher);
    const teile = [];

    teile.push(`# Verweisende Domains – ${monat}`);
    teile.push("");
    teile.push("Erzeugt von `scripts/seo-backlinks.mjs` aus dem Links-Bericht der Google");
    teile.push("Search Console. Der Bericht ist dort nur als CSV zu exportieren; die API");
    teile.push("bietet ihn nicht an.");
    teile.push("");
    teile.push(`**Bestand:** ${diff.summeDomains} verweisende Domains mit zusammen `
        + `${diff.summeSeiten} verweisenden Seiten.`);
    teile.push("");

    if (!vorher) {
        teile.push("## Vergleich zum Vormonat");
        teile.push("");
        teile.push(`Kein Export für ${vorherMonat} vorhanden – dieser Lauf ist eine`);
        teile.push("Bestandsaufnahme. Ein Vergleich ist ab dem nächsten Monat möglich.");
        teile.push("");
    } else {
        teile.push(`## Neu gegenüber ${vorherMonat}`);
        teile.push("");
        teile.push(tabelle(["Domain", "Verweisende Seiten"],
            diff.neu.map(e => `| ${e.domain} | ${e.verweisendeSeiten} |`)));

        teile.push(`## Verloren gegenüber ${vorherMonat}`);
        teile.push("");
        teile.push(tabelle(["Domain", "Verweisende Seiten zuvor"],
            diff.verloren.map(e => `| ${e.domain} | ${e.verweisendeSeiten} |`)));

        teile.push("## Verändert");
        teile.push("");
        teile.push(tabelle(["Domain", "Vorher", "Nachher"],
            diff.veraendert.map(e => `| ${e.domain} | ${e.vorher} | ${e.nachher} |`)));
    }

    teile.push("## Vollständiger Bestand");
    teile.push("");
    teile.push(tabelle(["Domain", "Verweisende Seiten", "Verlinkte Zielseiten"],
        [...aktuell]
            .sort((a, b) => b.verweisendeSeiten - a.verweisendeSeiten || a.domain.localeCompare(b.domain))
            .map(e => `| ${e.domain} | ${e.verweisendeSeiten} | ${e.verlinkteSeiten} |`)));

    return teile.join("\n");
}
