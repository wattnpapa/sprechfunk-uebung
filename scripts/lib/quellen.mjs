// Quellenregister der Fachseiten (AP-11).
//
// Reine Datendeklaration ohne Datei- und Netzzugriff. Der sichtbare Abschnitt
// „Grundlagen und Quellen“ entsteht daraus in lib/render-page.mjs.
//
// Grundregel: hier steht nur, was am Dokument selbst geprüft wurde. Jede
// Abschnittsnummer in `abschnitte` wurde im Volltext gelesen. Was nicht geprüft
// ist, steht unter `ungeprueft` oder als `hinweis` und erscheint NICHT als
// Beleg – eine erfundene Fundstelle ist schlimmer als keine.
//
// Geprüft am 2026-08-04; tests/seo/Quellen.test.ts erzwingt die Struktur.

import { escapeHtml } from "./schema-graph.mjs";

export const PRUEFDATUM = "2026-08-04";

export const QUELLEN = {
    "dv810-3": {
        kurz: "PDV/DV 810.3 „Sprechfunkdienst“",
        titel: "Sprechfunkdienst",
        untertitel: "Dienstvorschrift für die Abwicklung des Sprechfunkverkehrs und die "
            + "Sprechfunkausbildung im Bereich des nichtöffentlichen beweglichen "
            + "Landfunkdienstes der Behörden und Organisationen mit Sicherheitsaufgaben (BOS), "
            + "mit Ergänzungen für den Katastrophenschutz",
        ausgabe: "Ausgabe 1983, Stand Dezember 1988",
        url: "https://kv-lahn-dill.dlrg.de/fileadmin/groups/7210000/downloads/PDv-810-3.pdf",
        geprueft: PRUEFDATUM,
        // Nur Abschnitte, die im Volltext gelesen wurden.
        abschnitte: {
            "1": "Allgemeines, Geltungsbereich für die BOS",
            "3.4": "Vorrangstufen: Einfach (eee), Sofort (sss), Blitz (bbb), Staatsnot (aaa)",
            "4.1": "Verkehrsarten: Richtungs-, Wechsel- und Gegenverkehr",
            "4.2": "Verkehrsformen: Linien-, Stern-, Kreis- und Querverkehr",
            "4.3": "Abwicklung; Betriebsworte, Sprachwendungen und Buchstabiertafel nach Anlage 15",
            "4.5": "Übungen: Vermerk „Übung“, Tatsachenmeldungen mit Vermerk „Tatsache“",
            "7.2": "Direktbetrieb",
            "7.3": "Relaisbetrieb: Vergrößerung der Reichweite, Überleitung in andere Verkehrsbereiche"
        }
    },
    "din5009": {
        kurz: "DIN 5009 „Diktierregeln“",
        titel: "DIN 5009 – Diktierregeln",
        untertitel: "Enthält die Buchstabiertafel; die Ausgabe 2022-06 ersetzt DIN 5009:1996-12 "
            + "und führt Städtenamen statt Vornamen",
        ausgabe: "Ausgabe 2022-06",
        url: "https://www.dinmedia.de/de/norm/din-5009/352073096",
        geprueft: PRUEFDATUM,
        abschnitte: {}
    },
    "thw-handbuch": {
        kurz: "Ausbildungshandbuch Sprechfunk im THW",
        titel: "Ausbildungshandbuch Sprechfunk im THW",
        untertitel: "Ausbildungsunterlage des Technischen Hilfswerks für die Sprechfunkausbildung",
        herausgeber: "THW-Leitung",
        geprueft: PRUEFDATUM,
        abschnitte: {},
        // Der Titel ist belegt, das Dokument selbst nicht einsehbar: der Abruf
        // lief in eine Zugriffssperre. Ausgabe, Version und Kapitelnummern
        // stehen deshalb bewusst nirgends auf der Website.
        ungeprueft: "Ausgabe, Version und Kapitelnummern konnten nicht am Dokument geprüft werden."
    }
};

/**
 * Welche Seite stützt sich auf welche Quelle.
 *
 * `abschnitte` nennt nur Nummern, die in QUELLEN als gelesen hinterlegt sind –
 * ein Test erzwingt das. `hinweis` steht für Aussagen, für die es keinen
 * geprüften Beleg gibt; sie werden als solche gekennzeichnet, statt eine Quelle
 * zu behaupten.
 */
export const SEITEN_QUELLEN = {
    "sprechfunk-regeln": {
        quellen: [{ id: "dv810-3", abschnitte: ["1", "4.3"] }],
        hinweis: "Der Ablauf einer Verbindung mit Anruf und Anrufantwort ist Stoff der "
            + "Sprechfunklehrgänge. Die Vorschrift behandelt ihn im Abschnitt zur "
            + "Durchführung des Sprechfunkverkehrs."
    },
    "betriebsworte": {
        quellen: [{ id: "dv810-3", abschnitte: ["4.3"] }],
        hinweis: "Die Betriebsworte und Sprachwendungen selbst stehen in Anlage 15 der Vorschrift."
    },
    "buchstabiertafel": {
        quellen: [
            { id: "dv810-3", abschnitte: ["4.3"] },
            { id: "din5009", abschnitte: [] }
        ]
    },
    "verkehrsarten": {
        quellen: [{ id: "dv810-3", abschnitte: ["4.1", "4.2", "7.2", "7.3"] }],
        hinweis: "Die Relaisschaltungen RS-1 bis RS-4 stammen aus der Gerätepraxis des "
            + "analogen BOS-Funks. Die Vorschrift beschreibt den Relaisbetrieb, benennt "
            + "diese Schaltungen aber nicht; eine geprüfte Quelle dafür liegt nicht vor."
    },
    "uebungsfunkverkehr": {
        quellen: [{ id: "dv810-3", abschnitte: ["3.4", "4.5"] }]
    },
    "funkrufnamen": {
        quellen: [{ id: "dv810-3", abschnitte: ["1"] }],
        hinweis: "Funkrufnamen sind Ländersache: die Regelungen unterscheiden sich je "
            + "Bundesland und je Organisation. Die Beispiele zeigen den Aufbau, nicht eine "
            + "bundesweit gültige Festlegung."
    },
    "funkrufnamen-thw": {
        quellen: [{ id: "thw-handbuch", abschnitte: [] }],
        hinweis: "Maßgeblich ist die Funkrufnamenregelung des THW in ihrer jeweils gültigen "
            + "Fassung. Die Angaben hier geben den Aufbau wieder."
    },
    "funkuebung-katastrophenschutz": {
        quellen: [{ id: "dv810-3", abschnitte: ["1"] }],
        hinweis: "Dass das Verfahren organisationsübergreifend gilt, folgt aus dem "
            + "Geltungsbereich der Vorschrift. Wie die einzelnen Organisationen üben und "
            + "welche Rufgruppen sie nutzen, regeln sie dagegen selbst."
    },
    "wissen": {
        quellen: [{ id: "dv810-3", abschnitte: ["1"] }],
        hinweis: "Diese Übersicht führt nur zu den Themenseiten. Die Fundstellen zu den "
            + "einzelnen Regeln stehen jeweils dort im Abschnitt „Grundlagen und Quellen“."
    },
    "funkmeldesystem": {
        quellen: [],
        hinweis: "Für die Statusmeldungen des Funkmeldesystems liegt hier keine geprüfte "
            + "Quelle vor. Die Bedeutungen sind weitgehend, aber nicht vollständig "
            + "einheitlich; maßgeblich ist die Festlegung der zuständigen Leitstelle."
    },
    "bos-funk": {
        quellen: [{ id: "dv810-3", abschnitte: ["1"] }],
        hinweis: "Die Angaben zum Digitalfunk mit TMO und DMO geben den Sprachgebrauch der "
            + "Ausbildung wieder. Eine geprüfte Quelle für die technischen Einzelheiten "
            + "liegt hier nicht vor."
    },
    "funkreichweite": {
        quellen: [{ id: "thw-handbuch", abschnitte: [] }]
    },
    "antennen": {
        quellen: [{ id: "thw-handbuch", abschnitte: [] }]
    }
};

export const QUELLEN_SEITEN = Object.keys(SEITEN_QUELLEN);

export function hatQuellen(slug) {
    return Object.hasOwn(SEITEN_QUELLEN, slug);
}

/** Ein Quelleneintrag als Listenelement, mit Fundstellen und Prüfdatum. */
function quellenEintrag(bezug) {
    const quelle = QUELLEN[bezug.id];
    if (!quelle) throw new Error(`Unbekannte Quelle "${bezug.id}".`);

    const teile = [`<strong>${escapeHtml(quelle.kurz)}</strong>`];
    if (quelle.untertitel) teile.push(escapeHtml(quelle.untertitel));
    if (quelle.ausgabe) teile.push(escapeHtml(quelle.ausgabe));
    if (quelle.herausgeber) teile.push(`Herausgeber: ${escapeHtml(quelle.herausgeber)}`);

    // Fundstellen: nur Abschnitte, die im Volltext gelesen wurden.
    const abschnitte = (bezug.abschnitte ?? [])
        .map(nummer => {
            const inhalt = quelle.abschnitte?.[nummer];
            if (!inhalt) throw new Error(`Abschnitt ${nummer} in "${bezug.id}" nicht als geprüft hinterlegt.`);
            return `<li>Abschnitt ${escapeHtml(nummer)} – ${escapeHtml(inhalt)}</li>`;
        });

    const link = quelle.url
        ? ` <a href="${escapeHtml(quelle.url)}" target="_blank" rel="noopener noreferrer">Dokument aufrufen</a>.`
        : "";

    return `                    <li>
                        ${teile.join(". ")}.${link}
                        <span class="text-body-secondary">Geprüft am ${escapeHtml(quelle.geprueft)}.</span>
${abschnitte.length > 0 ? `                        <ul class="mt-2">\n${abschnitte.map(z => `    ${z}`).join("\n")}\n                        </ul>` : ""}
${quelle.ungeprueft ? `                        <p class="small text-body-secondary mb-0">${escapeHtml(quelle.ungeprueft)}</p>` : ""}
                    </li>`;
}

/**
 * Der sichtbare Abschnitt „Grundlagen und Quellen“.
 *
 * Er nennt nur, was am Dokument geprüft wurde, und sagt ausdrücklich, wo kein
 * Beleg vorliegt. Das ist der Unterschied zwischen einer Quellenangabe und
 * einer Behauptung mit Fußnote.
 */
export function renderQuellenAbschnitt(slug) {
    const eintrag = SEITEN_QUELLEN[slug];
    if (!eintrag) throw new Error(`Keine Quellen für "${slug}" hinterlegt.`);

    const liste = eintrag.quellen.map(quellenEintrag).join("\n");
    const hinweis = eintrag.hinweis
        ? `                <p class="mb-0">${escapeHtml(eintrag.hinweis)}</p>`
        : "";
    const ohneQuelle = eintrag.quellen.length === 0
        ? `                <p>Für die Angaben auf dieser Seite liegt keine am Dokument geprüfte Quelle vor.</p>`
        : `                <p>Die fachlichen Angaben auf dieser Seite stützen sich auf:</p>
                <ul>
${liste}
                </ul>`;

    return `        <section class="card shadow-sm my-4" id="quellen" aria-labelledby="quellen-titel" data-testid="quellen">
            <div class="card-header"><h2 class="h4 mb-0" id="quellen-titel">Grundlagen und Quellen</h2></div>
            <div class="card-body">
${ohneQuelle}
${hinweis}
            </div>
        </section>`;
}
