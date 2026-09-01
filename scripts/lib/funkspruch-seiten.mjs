// Markup und Downloads des Funkspruch-Archivs (AP-08).
//
// Reine Funktionen: die Einträge kommen als Argument herein, Dateien schreibt
// postbuild-copy.mjs. Die vollständige Liste steht im ausgelieferten HTML –
// der Filter unten ist eine Zutat, keine Voraussetzung.

import { escapeHtml } from "./schema-graph.mjs";
import { deutscheZahl, KATEGORIEN, kategorieName, VORLAGEN } from "./funkspruch-daten.mjs";
import { relativerPfad } from "./navigation.mjs";

/** Einsetzstellen in den Quellseiten unter src/pages/. */
export const LISTE_PLATZHALTER = "<!-- AP-08:LISTE -->";
export const VORLAGEN_PLATZHALTER = "<!-- AP-08:VORLAGEN -->";

const STUFEN_NAME = { einfach: "einfach", mittel: "mittel", schwer: "schwer" };

/**
 * Die vollständige Liste als statisches HTML.
 *
 * Eine <ol> statt <ul>: die Nummer ist die Fundstelle, auf die sich in der
 * Nachbesprechung verweisen lässt. Jeder Eintrag trägt seine stabile Kennung
 * als id, damit ein einzelner Funkspruch verlinkbar ist, ohne dass es 2.000
 * Detailseiten mit je einem Satz Inhalt gibt.
 */
export function renderFunkspruchListe(eintraege) {
    // Markup je Eintrag knapp halten: bei 752 Einträgen kostet jedes gesparte
    // Byte 752 Byte Seitengröße. Einrückung, eine Klasse auf jedem <li> und
    // data-Attribute, die niemand ausliest, summierten sich auf über 60 KB –
    // genug, um die größte Seite über die 300-KB-Grenze zu heben.
    // Geblieben ist, was gebraucht wird: id als Anker, data-kategorie für den
    // Filter. Stufe und Buchstabieranteil stehen sichtbar in der Merkmalzeile.
    const zeilen = eintraege.map(eintrag => {
        const merkmale = [
            kategorieName(eintrag.kategorie),
            STUFEN_NAME[eintrag.schwierigkeit] ?? eintrag.schwierigkeit,
            `${eintrag.zeichen} Zeichen`
        ];
        if (eintrag.buchstabieren) merkmale.push("buchstabieren");

        return `<li id="fs-${eintrag.id}" data-kategorie="${eintrag.kategorie}">`
            + `<span class="funkspruch-text">${escapeHtml(eintrag.text)}</span>`
            + `<span class="funkspruch-meta">${escapeHtml(merkmale.join(" · "))}</span></li>`;
    }).join("\n");

    return `            <ol class="funkspruch-liste" data-testid="funkspruch-liste">
${zeilen}
            </ol>`;
}

/**
 * Filter über der Liste. Ohne JavaScript bleibt die Liste vollständig sichtbar;
 * die Bedienelemente stehen dann ungenutzt da, richten aber keinen Schaden an.
 */
export function renderFilter(eintraege) {
    const vorhandene = KATEGORIEN.filter(kategorie =>
        eintraege.some(eintrag => eintrag.kategorie === kategorie.key));

    const optionen = vorhandene.map(kategorie => {
        const anzahl = eintraege.filter(eintrag => eintrag.kategorie === kategorie.key).length;
        return `                        <option value="${kategorie.key}">`
            + `${escapeHtml(kategorie.name)} (${anzahl})</option>`;
    }).join("\n");

    return `            <div class="funkspruch-filter" data-testid="funkspruch-filter">
                <label class="form-label" for="funkspruchSuche">Im Bestand suchen</label>
                <input type="search" class="form-control" id="funkspruchSuche"
                       placeholder="Stichwort, Ort oder Straße" autocomplete="off">
                <label class="form-label mt-2" for="funkspruchKategorie">Nach Art filtern</label>
                <select class="form-select" id="funkspruchKategorie">
                        <option value="">Alle Arten</option>
${optionen}
                </select>
                <p class="small text-body-secondary mt-2 mb-0" id="funkspruchTreffer"
                   aria-live="polite" data-gesamt="${eintraege.length}">${deutscheZahl(eintraege.length)} Funksprüche</p>
            </div>`;
}

/**
 * Das Filterskript. Gehört vor </body> und damit außerhalb von <main>:
 * innerhalb würde sein Quelltext als Seiteninhalt mitgezählt und jede
 * Lesbarkeitsmessung verfälschen.
 */
export const FILTER_SKRIPT = `<script>
    // Filter über der vollständig ausgelieferten Liste. Läuft das Skript nicht,
    // bleibt die Liste unverändert vollständig sichtbar.
    (function () {
        var suche = document.getElementById("funkspruchSuche");
        var art = document.getElementById("funkspruchKategorie");
        var treffer = document.getElementById("funkspruchTreffer");
        var liste = document.querySelector(".funkspruch-liste");
        if (!suche || !art || !liste || !treffer) { return; }
        var eintraege = Array.prototype.slice.call(liste.children);
        var gesamt = Number(treffer.getAttribute("data-gesamt"));
        function anwenden() {
            var begriff = suche.value.trim().toLowerCase();
            var kategorie = art.value;
            var sichtbar = 0;
            for (var i = 0; i < eintraege.length; i++) {
                var li = eintraege[i];
                var passt = (kategorie === "" || li.getAttribute("data-kategorie") === kategorie)
                    && (begriff === "" || li.textContent.toLowerCase().indexOf(begriff) !== -1);
                li.hidden = !passt;
                if (passt) { sichtbar++; }
            }
            treffer.textContent = sichtbar === gesamt
                ? sichtbar.toLocaleString("de-DE") + " Funksprüche"
                : sichtbar.toLocaleString("de-DE") + " von " + gesamt.toLocaleString("de-DE") + " Funksprüchen";
        }
        suche.addEventListener("input", anwenden);
        art.addEventListener("change", anwenden);
    })();
</script>
`;

/**
 * Der Download im Upload-Format des Generators: eine Nachricht je Zeile, sonst
 * nichts. Keine Kopfzeile und kein Kommentar – der Upload liest jede nicht
 * leere Zeile als Funkspruch, ein Hinweistext würde als Nachricht auftauchen.
 */
export function txtInhalt(eintraege) {
    return `${eintraege.map(eintrag => eintrag.text).join("\n")}\n`;
}

export function downloadDateiname(vorlagenSlug) {
    return `funksprueche-${vorlagenSlug}.txt`;
}

/** Übersicht aller Vorlagen mit Anzahl, für /funksprueche/. */
export function renderVorlagenTabelle(bestand, vonSlug = "funksprueche") {
    const zeilen = VORLAGEN.map(vorlage => {
        const anzahl = (bestand.nachVorlage.get(vorlage.slug) ?? []).length;
        const ziel = vorlage.imArchiv
            ? `<a href="${relativerPfad(vonSlug, `funksprueche/vorlage/${vorlage.slug}`)}">`
                + `${escapeHtml(vorlage.name)}</a>`
            : `${escapeHtml(vorlage.name)} <span class="text-body-secondary">`
                + `(nur im Generator, ${escapeHtml(vorlage.grund ?? "nicht im Archiv")})</span>`;
        const organisation = vorlage.organisation.includes("thw") ? "THW" : "organisationsübergreifend";
        return `                        <tr><td>${ziel}</td>`
            + `<td class="text-end">${deutscheZahl(anzahl)}</td>`
            + `<td>${organisation}</td></tr>`;
    }).join("\n");

    return `            <div class="table-responsive">
                <table class="table table-sm align-middle" data-testid="vorlagen-tabelle">
                    <thead>
                        <tr><th scope="col">Vorlage</th><th scope="col" class="text-end">Funksprüche</th><th scope="col">Herkunft</th></tr>
                    </thead>
                    <tbody>
${zeilen}
                    </tbody>
                </table>
            </div>`;
}
