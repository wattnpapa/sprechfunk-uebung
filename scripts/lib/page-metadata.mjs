// Auslesen sichtbarer Seitenangaben für den Schema-Generator (AP-02).
//
// Alles, was ohnehin im HTML steht, wird von hier gelesen statt in der Registry
// doppelt geführt: Titel, Description, Brotkrumen, die Fragen der FAQ-Seite und
// die Einträge der Nachschlagetabellen.
//
// Der Grund ist derselbe wie bei den FAQ-Blöcken: strukturierte Daten dürfen
// nichts behaupten, was nicht sichtbar auf der Seite steht. Eine zweite,
// handgepflegte Quelle würde genau das irgendwann tun.

const NAMED_ENTITIES = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    ndash: "–", mdash: "—", bdquo: "„", ldquo: "“", rdquo: "”",
    sbquo: "‚", lsquo: "‘", rsquo: "’", hellip: "…", shy: "",
    auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
    eacute: "é", deg: "°", euro: "€", laquo: "«", raquo: "»", middot: "·"
};

/** Dekodiert die im Bestand vorkommenden Entities. Unbekannte bleiben stehen,
 *  damit ein Tippfehler auffällt statt still zu verschwinden. */
export function decodeEntities(text) {
    return String(text)
        .replace(/&#(\d+);/g, (_, ziffern) => String.fromCodePoint(Number(ziffern)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&([a-zA-Z]+);/g, (treffer, name) =>
            Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : treffer);
}

/**
 * Elemente, die im Textfluss stehen. Sie werden ohne Ersatzzeichen entfernt,
 * Blockelemente dagegen durch ein Leerzeichen ersetzt.
 *
 * Grund: Ein pauschales Leerzeichen je Tag erzeugt aus
 * `nach dem <a href="…">Sprechfunker-Lehrgang</a>.` ein „Lehrgang ." mit
 * Leerzeichen vor dem Punkt. Der Browser rendert „Lehrgang." – die Texte im
 * JSON-LD wären damit nicht mehr wortgleich mit dem sichtbaren Text.
 */
const INLINE_ELEMENTE = /^(a|abbr|b|bdi|bdo|cite|code|data|dfn|em|i|kbd|mark|q|rp|rt|ruby|s|samp|small|span|strong|sub|sup|time|u|var|wbr)$/i;

/** Entfernt Tags wie ein Browser und normalisiert Leerraum. */
export function plainText(html) {
    const ohneTags = String(html).replace(
        /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g,
        (_, tag) => (INLINE_ELEMENTE.test(tag) ? "" : " ")
    );
    return decodeEntities(ohneTags)
        .replace(/\s+/g, " ")
        .trim();
}

export function extractTitle(html) {
    const treffer = html.match(/<title>([\s\S]*?)<\/title>/i);
    return treffer ? plainText(treffer[1]) : null;
}

/**
 * Erster Satz eines Textes, für die Kartentexte des Hubs (AP-04).
 * Die Descriptions sind zwei bis drei Sätze lang; auf einer Karte steht einer.
 * Abkürzungen mit Punkt (z. B., ca., Nr.) beenden keinen Satz.
 */
export function ersterSatz(text) {
    const roh = String(text ?? "").trim();
    if (roh === "") return "";
    const ABKUERZUNG = /(?:\b[zZ]\.|\bca\.|\bNr\.|\bbzw\.|\bevtl\.|\bggf\.|\bu\.|\bd\.|\bo\.|\bS\.|\bAbs\.|\bvgl\.|\betc\.)$/;
    for (const treffer of roh.matchAll(/[.!?](?=\s|$)/g)) {
        const ende = treffer.index + 1;
        const davor = roh.slice(0, ende);
        if (ABKUERZUNG.test(davor)) continue;
        // Ein einzelner Buchstabe vor dem Punkt ist eine Initiale, kein Satzende.
        if (/(?:^|\s)\p{L}\.$/u.test(davor)) continue;
        return davor;
    }
    return roh;
}

export function extractMetaDescription(html) {
    const treffer = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    return treffer ? decodeEntities(treffer[1]).trim() : null;
}

/**
 * Liest die sichtbare Brotkrumenleiste. `baseUrl` ist die kanonische URL der
 * Seite, gegen die relative hrefs (`../`, `../funkrufnamen/`) aufgelöst werden.
 * Der letzte Eintrag ist die aktuelle Seite und bleibt ohne URL.
 */
export function extractBreadcrumb(html, baseUrl) {
    const liste = html.match(/<ol[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>([\s\S]*?)<\/ol>/i);
    if (!liste) return [];

    const eintraege = [...liste[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(treffer => {
        const inhalt = treffer[1];
        const name = plainText(inhalt);
        const href = inhalt.match(/<a[^>]*href="([^"]*)"/i)?.[1];
        if (!href) return { name };
        return { name, url: new URL(href, baseUrl).toString() };
    });

    // Das letzte Glied verweist nie auf sich selbst.
    if (eintraege.length > 0) delete eintraege[eintraege.length - 1].url;
    return eintraege.filter(eintrag => eintrag.name !== "");
}

/**
 * Liest bereits sichtbar vorhandene Fragen einer FAQ-Seite: jede Überschrift,
 * die mit einem Fragezeichen endet, plus den darauf folgenden Absatz.
 * Damit braucht /faq/ keine zweite Datenhaltung in der Registry.
 */
export function extractFaqFromHtml(html) {
    const treffer = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h[123][^>]*>|<\/section>|<\/main>)/gi)];
    const faq = [];
    for (const eintrag of treffer) {
        const frage = plainText(eintrag[1]);
        if (!frage.endsWith("?")) continue;
        const absatz = eintrag[2].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
        if (!absatz) continue;
        const antwort = plainText(absatz[1]);
        if (antwort === "") continue;
        faq.push({ q: frage, a: antwort });
    }
    return faq;
}

/**
 * Liest eine Nachschlagetabelle als Begriffspaare. Gezählt werden
 * `<th scope="row">`-Zellen mit der jeweils folgenden `<td>`-Zelle; die
 * Buchstabiertafel legt zwei solche Paare pro Zeile nebeneinander.
 */
export function extractDefinedTerms(html, { tableIndex = 0 } = {}) {
    const tabellen = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
    const tabelle = tabellen[tableIndex];
    if (!tabelle) return [];

    const terme = [];
    for (const zeile of tabelle[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const zellen = [...zeile[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)]
            .map(z => ({ tag: z[1].toLowerCase(), text: plainText(z[2]) }));
        for (let i = 0; i < zellen.length - 1; i += 1) {
            if (zellen[i].tag !== "th" || zellen[i + 1].tag !== "td") continue;
            const name = zellen[i].text;
            const description = zellen[i + 1].text;
            if (name === "" || description === "") continue;
            terme.push({ name, description });
        }
    }
    return terme;
}
