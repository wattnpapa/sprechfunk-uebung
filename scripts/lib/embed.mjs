// Einbettbare Widgets (AP-12).
//
// Ehrlich zur Wirkung: ein iframe erzeugt KEINEN klassischen Backlink – der
// Link darin steht auf unserer eigenen Seite, nicht auf der fremden. Deshalb
// besteht der Einbettungscode aus zwei Teilen: dem iframe UND einer sichtbaren
// Quellenzeile mit echtem Anchor auf der einbettenden Seite. Nur der zweite
// Teil ist ein Link. Wer ihn weglässt, bekommt trotzdem ein funktionierendes
// Widget; die Lizenz verlangt die Nennung, die Technik erzwingt sie nicht.
//
// Das Widget lädt nichts nach: kein Skript, keine Schrift, kein Bild, keine
// Verbindung nach außen. Damit kann es auch keine Cookies setzen und keine
// Reichweite messen – das ist die Voraussetzung dafür, dass eine Dienststelle
// es überhaupt einbinden darf.
//
// Reine Funktionen ohne Datei- und Netzzugriff.

import { SITE_URL } from "../site-pages.mjs";
import { escapeHtml } from "./schema-graph.mjs";

export const EMBEDS = [
    {
        slug: "buchstabiertafel",
        titel: "Buchstabiertafel",
        untertitel: "Buchstabieren im BOS-Sprechfunk",
        beschreibung: "Die Buchstabiertafel als kompakte Tabelle, fertig zum Einbinden "
            + "in Ausbildungsseiten und Intranets.",
        ziel: "buchstabiertafel",
        quelle: { seite: "buchstabiertafel", tabelle: 0 },
        spalten: ["Buchstabe", "Wort"],
        hoehe: 560,
        sortiert: true
    }
];

export function embedPfad(embed) {
    return `embed/${embed.slug}`;
}

export function embedUrl(embed) {
    return `${SITE_URL}/${embedPfad(embed)}/`;
}

export function zielUrl(embed) {
    return `${SITE_URL}/${embed.ziel}/`;
}

/**
 * Der Code zum Kopieren.
 *
 * `sandbox` ohne `allow-scripts`: der Browser der einbettenden Seite erzwingt
 * damit, dass im Widget kein Skript läuft. Das ist nachprüfbar und nicht nur
 * eine Zusage im Fließtext.
 */
export function embedSnippet(embed) {
    return `<iframe src="${embedUrl(embed)}"
        title="${embed.titel} – ${embed.untertitel}"
        width="100%" height="${embed.hoehe}" loading="lazy"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        style="border:1px solid #dee2e6;border-radius:8px;max-width:100%"></iframe>
<p><small>${embed.titel} von <a href="${zielUrl(embed)}">sprechfunk-uebung.de</a>
        – kostenlos und ohne Anmeldung, Lizenz EUPL-1.2</small></p>`;
}

/** Zeilen in deutscher Reihenfolge, wenn der Eintrag es verlangt. */
export function sortiereZeilen(embed, zeilen) {
    return embed.sortiert
        ? [...zeilen].sort((a, b) => String(a.name).localeCompare(String(b.name), "de"))
        : zeilen;
}

/**
 * Das vollständige HTML-Dokument des Widgets.
 *
 * Alles inline: eine externe Datei wäre ein zweiter Request und damit ein
 * Datum, das beim Betreiber der einbettenden Seite anfällt.
 */
export function renderEmbed(embed, zeilen) {
    if (zeilen.length === 0) throw new Error(`Widget "${embed.slug}": keine Zeilen gefunden.`);
    const eintraege = sortiereZeilen(embed, zeilen)
        .map(zeile => `        <tr><th scope="row">${escapeHtml(String(zeile.name))}</th>`
            + `<td>${escapeHtml(String(zeile.description))}</td></tr>`)
        .join("\n");

    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(embed.titel)} – ${escapeHtml(embed.untertitel)}</title>
<!-- Widget zum Einbetten: absichtlich nicht indexiert, damit es der
     eigentlichen Inhaltsseite keine Konkurrenz macht. -->
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${zielUrl(embed)}">
<style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
        margin: 0;
        padding: 12px 14px 10px;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-size: 15px;
        line-height: 1.35;
        color: #1a1d21;
        background: #ffffff;
    }
    h1 { font-size: 17px; margin: 0 0 2px; color: #0d6efd; }
    p.untertitel { margin: 0 0 10px; font-size: 13px; color: #5a6169; }
    table { width: 100%; border-collapse: collapse; }
    caption { text-align: left; font-size: 12px; color: #5a6169; padding-bottom: 4px; }
    th, td { padding: 3px 6px; text-align: left; }
    thead th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6c757d; }
    tbody th { width: 4.5em; font-weight: 700; }
    tbody tr:nth-child(odd) { background: #f4f6f9; }
    .quelle { margin: 10px 0 0; font-size: 12px; color: #5a6169; }
    .quelle a { color: #0d6efd; }
    @media (prefers-color-scheme: dark) {
        body { color: #e6e8ea; background: #16191c; }
        tbody tr:nth-child(odd) { background: #1f2429; }
        p.untertitel, .quelle, thead th { color: #9aa3ad; }
    }
</style>
</head>
<body>
<h1>${escapeHtml(embed.titel)}</h1>
<p class="untertitel">${escapeHtml(embed.untertitel)}</p>
<table data-testid="embed-tabelle">
    <caption>${escapeHtml(embed.beschreibung)}</caption>
    <thead><tr><th scope="col">${escapeHtml(embed.spalten[0])}</th><th scope="col">${escapeHtml(embed.spalten[1])}</th></tr></thead>
    <tbody>
${eintraege}
    </tbody>
</table>
<p class="quelle">Quelle:
    <a href="${zielUrl(embed)}" target="_blank" rel="noopener">sprechfunk-uebung.de</a>
    – kostenloser Übungsgenerator für BOS-Sprechfunk, Lizenz EUPL-1.2.
    Dieses Widget lädt nichts nach und setzt keine Cookies.</p>
</body>
</html>
`;
}
