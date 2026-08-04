// Zielliste für die Ansprache (AP-12).
//
// Liest die Markdown-Tabellen aus seo/outreach.md ein. Der Parser ist bewusst
// streng: fehlt eine Spalte oder ist die URL keine absolute https-Adresse, ist
// das ein Fehler und keine stillschweigend übersprungene Zeile. Eine Zielliste
// mit halben Einträgen ist beim Ansprechen wertlos.
//
// Reine Funktionen ohne Datei- und Netzzugriff.

export const PFLICHTSPALTEN = ["Name", "URL", "Warum passend", "Relevanter Inhalt", "Kanal", "Status"];

/** Erlaubte Werte in der Statusspalte. */
export const STATUS_WERTE = ["offen", "angesprochen", "verlinkt", "abgelehnt", "zurückgestellt"];

/**
 * Muster, die auf Kontaktdaten einer Privatperson hindeuten.
 * Die Liste darf ausschließlich öffentliche Organisationsadressen enthalten;
 * eine private E-Mail oder Telefonnummer hat hier nichts zu suchen.
 */
const PERSONENBEZUG = [
    /\b[\w.+-]+@(?:gmail|gmx|web|t-online|posteo|mailbox|outlook|hotmail|yahoo)\.[a-z.]+/i,
    /\b(?:\+49|0)\s?\d{2,5}[\s/-]?\d{3,}/
];

function zerlegeZeile(zeile) {
    return zeile
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map(feld => feld.trim());
}

/** Erste Markdown-Verlinkung oder nackte URL aus einer Zelle. */
export function urlAus(zelle) {
    const markdown = String(zelle ?? "").match(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
    if (markdown) return markdown[1];
    const nackt = String(zelle ?? "").match(/https?:\/\/\S+/);
    return nackt ? nackt[0] : "";
}

/** Sichtbarer Text einer Zelle, ohne Markdown-Auszeichnung. */
function text(zelle) {
    return String(zelle ?? "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`]/g, "")
        .trim();
}

/**
 * Liest die Zielliste.
 * @returns {{ eintraege: object[], kategorien: string[], fehler: string[] }}
 */
export function parseOutreach(markdown) {
    const zeilen = String(markdown ?? "").split(/\r?\n/);
    const eintraege = [];
    const kategorien = [];
    const fehler = [];
    const gesehen = new Set();

    let kategorie = null;
    let spalten = null;

    for (let i = 0; i < zeilen.length; i++) {
        const zeile = zeilen[i];

        const ueberschrift = zeile.match(/^##\s+(.*\S)\s*$/);
        if (ueberschrift) {
            kategorie = ueberschrift[1];
            spalten = null;
            continue;
        }
        if (!zeile.trim().startsWith("|")) {
            spalten = null;
            continue;
        }

        const felder = zerlegeZeile(zeile);

        // Trennzeile einer Tabelle überspringen.
        if (felder.every(feld => /^:?-{3,}:?$/.test(feld))) continue;

        if (spalten === null) {
            spalten = felder.map(feld => text(feld));
            const fehlend = PFLICHTSPALTEN.filter(pflicht => !spalten.includes(pflicht));
            if (fehlend.length > 0) {
                // Keine Zielliste, sondern irgendeine andere Tabelle im Dokument.
                spalten = null;
            } else if (kategorie && !kategorien.includes(kategorie)) {
                kategorien.push(kategorie);
            }
            continue;
        }

        if (felder.length !== spalten.length) {
            fehler.push(`Zeile ${i + 1}: ${felder.length} Spalten statt ${spalten.length}`);
            continue;
        }

        const werte = Object.fromEntries(spalten.map((name, index) => [name, felder[index]]));
        const url = urlAus(werte.URL);
        const name = text(werte.Name);

        if (name === "") fehler.push(`Zeile ${i + 1}: kein Name`);
        if (!url.startsWith("https://")) {
            fehler.push(`Zeile ${i + 1} (${name || "ohne Name"}): keine absolute https-URL`);
        }
        if (gesehen.has(url)) fehler.push(`Zeile ${i + 1}: URL doppelt – ${url}`);
        gesehen.add(url);

        const status = text(werte.Status).toLowerCase();
        if (!STATUS_WERTE.includes(status)) {
            fehler.push(`Zeile ${i + 1} (${name}): Status "${status}" unbekannt`);
        }
        for (const feld of ["Warum passend", "Relevanter Inhalt", "Kanal"]) {
            if (text(werte[feld]) === "") fehler.push(`Zeile ${i + 1} (${name}): ${feld} fehlt`);
        }
        for (const muster of PERSONENBEZUG) {
            if (muster.test(zeile)) {
                fehler.push(`Zeile ${i + 1} (${name}): sieht nach Kontaktdaten einer Privatperson aus`);
            }
        }

        eintraege.push({
            kategorie,
            name,
            url,
            warum: text(werte["Warum passend"]),
            inhalt: text(werte["Relevanter Inhalt"]),
            kanal: text(werte.Kanal),
            status
        });
    }

    return { eintraege, kategorien, fehler };
}
