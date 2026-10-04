import type { Uebung } from "../types/Uebung";
import type { FuehrungsstellenUebung } from "../types/FuehrungsstellenUebung";
import { escapeHtml } from "../utils/html";

/**
 * Blatt für die beübte Stelle einer Führungsstellen-Übung: Ausgangslage,
 * Auftrag und die Funkrufnamen, mit denen sie arbeitet. Die beübte Stelle
 * bekommt keinen Link und darf das Drehbuch nicht kennen; bisher musste die
 * Übungsleitung Lage und Auftrag aus dem Drehbuch abschreiben, ohne die
 * „Erwartet“-Texte mitzunehmen (THW-Review workflow F8).
 *
 * Bewusst nur Lage und Auftrag aus dem Drehbuch – keine Nachrichten, keine
 * Erwartungen, keine Rollenkarten.
 */
export function baueBlattBeuebteStelle(
    uebung: Pick<Uebung, "name" | "datum" | "rufgruppe" | "leitung" | "fuehrungsstelle">,
    drehbuch: Pick<FuehrungsstellenUebung, "titel" | "lage" | "auftrag" | "dauerMinuten">
): string {
    const rollen = uebung.fuehrungsstelle;
    const stellen = rollen?.stellen ?? {};
    const mitStelle = (funkrufname: string) => {
        const stelle = stellen[funkrufname];
        return stelle ? `${escapeHtml(funkrufname)} (${escapeHtml(stelle)})` : escapeHtml(funkrufname);
    };
    const datum = uebung.datum ? new Date(uebung.datum) : null;
    const datumText = datum && !Number.isNaN(datum.getTime()) ? datum.toLocaleDateString("de-DE") : "";
    const zeilen: [string, string][] = [
        ["Übung", escapeHtml(uebung.name || "")],
        ["Datum", escapeHtml(datumText)],
        ["Übungsbeginn", escapeHtml(rollen?.beginn ? `${rollen.beginn} Uhr` : "laut Übungsleitung")],
        ["Dauer", `${drehbuch.dauerMinuten} Minuten`],
        ["Rufgruppe", escapeHtml(uebung.rufgruppe || "")]
    ];
    const funkrufnamen: [string, string][] = rollen
        ? [
            ["Beübte Stelle (du)", mitStelle(rollen.beuebteStelle)],
            ["Übergeordnete Stelle", mitStelle(rollen.uebergeordnet)],
            ...rollen.unterstellt.map((name, i): [string, string] => [`Einsatzabschnitt ${i + 1}`, mitStelle(name)])
        ]
        : [];
    const tabelle = (eintraege: [string, string][]) => eintraege
        .filter(([, wert]) => wert !== "")
        .map(([schluessel, wert]) => `<tr><th>${escapeHtml(schluessel)}</th><td>${wert}</td></tr>`)
        .join("");

    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Lage und Auftrag – ${escapeHtml(uebung.name || "Führungsstellen-Übung")}</title>
<style>
body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; margin: 2cm; line-height: 1.45; }
h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
h2 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; border-bottom: 1px solid #000; }
p.unter { margin: 0 0 1rem; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; vertical-align: top; padding: 0.25rem 0.5rem; border: 1px solid #000; }
th { width: 30%; }
@page { size: A4; margin: 1.5cm; }
@media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>Ausgangslage und Auftrag</h1>
<p class="unter">${escapeHtml(drehbuch.titel)} – für die beübte Führungsstelle</p>
<table>${tabelle(zeilen)}</table>
<h2>Lage</h2>
<p>${escapeHtml(drehbuch.lage)}</p>
<h2>Auftrag</h2>
<p>${escapeHtml(drehbuch.auftrag)}</p>
${funkrufnamen.length > 0 ? `<h2>Funkrufnamen</h2>\n<table>${tabelle(funkrufnamen)}</table>` : ""}
</body>
</html>`;
}

/** Öffnet das Blatt in einem neuen Fenster und ruft den Druckdialog auf. */
export function druckeBlatt(html: string): boolean {
    const fenster = typeof window !== "undefined" ? window.open("", "_blank") : null;
    if (!fenster) {
        return false;
    }
    fenster.document.open();
    fenster.document.write(html);
    fenster.document.close();
    fenster.focus();
    fenster.print();
    return true;
}
