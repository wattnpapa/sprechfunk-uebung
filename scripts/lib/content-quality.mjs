// Qualitätsregeln für die Inhaltsseiten (AP-06).
//
// Reine Prüflogik auf ausgelesenen Seitenwerten – kein Datei- oder Netzzugriff,
// damit jede Regel mit synthetischen Werten testbar ist. Das Einlesen des Builds
// macht scripts/check-content-quality.mjs.

export const GRENZEN = {
    titelMin: 50,
    titelMax: 60,
    descMin: 140,
    descMax: 160,
    woerterMin: 800,
    satzlaengeMax: 20,
    absatzMax: 120,
    transferMaxBytes: 120 * 1024
};

/**
 * Zielwortzahlen der Prioritätsseiten. Der Rückstand gegenüber dem Wettbewerb
 * ist dort am größten; für alle übrigen Seiten gilt GRENZEN.woerterMin.
 */
export const ZIELWOERTER = {
    "regiebuch-funkuebung": 1100,
    "funkuebung-feuerwehr": 1100,
    "funkuebung-dienstabend": 900,
    "funkuebung-thw": 1000,
    "funkuebung-szenarien": 1200
};

/**
 * Floskeln, die nichts aussagen. Sie stehen in der „Nicht tun“-Liste des
 * Arbeitspakets; als Regel verhindern sie, dass sie beim Ausbau einwandern.
 */
export const FLOSKELN = [
    "spielt eine wichtige rolle",
    "spielt eine entscheidende rolle",
    "unterstreicht die bedeutung",
    "wendepunkt",
    "tief verwurzelt",
    "experten sind sich einig",
    "kritiker bemängeln",
    "nicht nur",
    "zusammenfassend",
    "abschließend lässt sich",
    "es ist wichtig zu",
    "in der heutigen zeit",
    "von zentraler bedeutung",
    "gilt es zu beachten"
];

export function findeFloskeln(text) {
    const klein = String(text ?? "").toLowerCase();
    return FLOSKELN.filter(floskel => klein.includes(floskel));
}

/**
 * Sätze eines Textes. Abkürzungen mit Punkt trennen keinen Satz.
 *
 * Zwei Fälle: mehrbuchstabige Abkürzungen wie „bzw.“ und einzelne Buchstaben.
 * Letztere generisch, denn „z. B.“ besteht aus zwei davon – eine Liste nur mit
 * „z.“ hätte am „B.“ getrennt.
 */
export function saetze(text) {
    return String(text ?? "")
        .replace(/\b(bzw|ca|Nr|Abs|vgl|etc|evtl|ggf|inkl|max|min|Nrn|usw)\./g, "$1&punkt;")
        .replace(/(?<=(?:^|\s))(\p{L})\./gu, "$1&punkt;")
        .split(/(?<=[.!?])\s+/)
        .map(satz => satz.replace(/&punkt;/g, ".").trim())
        .filter(satz => /\p{L}/u.test(satz));
}

export function woerterIm(text) {
    return String(text ?? "").split(/\s+/).filter(wort => /\p{L}/u.test(wort)).length;
}

/** Durchschnittliche Satzlänge in Wörtern. */
export function durchschnittlicheSatzlaenge(text) {
    const liste = saetze(text);
    if (liste.length === 0) return 0;
    return woerterIm(text) / liste.length;
}

/**
 * Prüft eine Seite. `seite` enthält die ausgelesenen Werte:
 * { slug, titel, description, woerter, text, absaetze, ankerZiele, ankerVorhanden,
 *   transferBytes, hatMetazeile, hatKurzGesagt, hatFaq, hatWeiterlesen, h2OhneId }
 */
export function pruefeSeite(seite, grenzen = GRENZEN) {
    const verstoesse = [];
    const melde = (regel, text) => verstoesse.push({ regel, seite: seite.slug, text });

    const titelLaenge = (seite.titel ?? "").length;
    if (titelLaenge < grenzen.titelMin || titelLaenge > grenzen.titelMax) {
        melde("titel-laenge", `Titel hat ${titelLaenge} Zeichen (erlaubt ${grenzen.titelMin}–${grenzen.titelMax})`);
    }

    const descLaenge = (seite.description ?? "").length;
    if (descLaenge < grenzen.descMin || descLaenge > grenzen.descMax) {
        melde("description-laenge", `Description hat ${descLaenge} Zeichen (erlaubt ${grenzen.descMin}–${grenzen.descMax})`);
    }

    const ziel = ZIELWOERTER[seite.slug] ?? grenzen.woerterMin;
    if (seite.woerter < ziel) {
        melde("zu-kurz", `${seite.woerter} Wörter (Ziel ${ziel})`);
    }

    for (const floskel of findeFloskeln(seite.text)) {
        melde("floskel", `enthält „${floskel}“`);
    }

    const satzlaenge = durchschnittlicheSatzlaenge(seite.text);
    if (satzlaenge > grenzen.satzlaengeMax) {
        melde("satzlaenge", `durchschnittlich ${satzlaenge.toFixed(1)} Wörter je Satz (höchstens ${grenzen.satzlaengeMax})`);
    }

    for (const absatz of seite.absaetze ?? []) {
        const laenge = woerterIm(absatz);
        if (laenge > grenzen.absatzMax) {
            melde("absatz-zu-lang", `Absatz mit ${laenge} Wörtern: „${absatz.slice(0, 60)}…“`);
        }
    }

    for (const anker of seite.ankerZiele ?? []) {
        if (!(seite.ankerVorhanden ?? []).includes(anker)) {
            melde("toter-anker", `Inhaltsverzeichnis verweist auf #${anker}, das es nicht gibt`);
        }
    }

    // Doppelte id ist ungültiges HTML und bricht Ankerlinks: der Browser
    // springt zum ersten Vorkommen, das Inhaltsverzeichnis meint das zweite.
    const gesehen = new Set();
    for (const id of seite.ankerVorhanden ?? []) {
        if (gesehen.has(id)) melde("doppelte-id", `id="${id}" kommt mehrfach vor`);
        gesehen.add(id);
    }

    if ((seite.h2OhneId ?? 0) > 0) {
        melde("h2-ohne-id", `${seite.h2OhneId} Überschriften ohne id`);
    }

    for (const [feld, name] of [
        ["hatMetazeile", "Metazeile"],
        ["hatKurzGesagt", "„Kurz gesagt“-Block"],
        ["hatFaq", "FAQ-Sektion"],
        ["hatWeiterlesen", "Weiterlesen-Block"]
    ]) {
        if (seite[feld] === false) melde("format-unvollstaendig", `${name} fehlt`);
    }

    if ((seite.transferBytes ?? 0) > grenzen.transferMaxBytes) {
        melde("zu-gross", `${Math.round(seite.transferBytes / 1024)} KB (höchstens ${grenzen.transferMaxBytes / 1024} KB)`);
    }

    return verstoesse;
}

/** Titel und Descriptions müssen domainweit eindeutig sein. */
export function pruefeEindeutigkeit(seiten) {
    const verstoesse = [];
    for (const [feld, name] of [["titel", "Titel"], ["description", "Description"]]) {
        const gesehen = new Map();
        for (const seite of seiten) {
            const wert = seite[feld];
            if (!wert) continue;
            if (gesehen.has(wert)) {
                verstoesse.push({
                    regel: "nicht-eindeutig",
                    seite: seite.slug,
                    text: `${name} ist identisch mit /${gesehen.get(wert)}/`
                });
            } else {
                gesehen.set(wert, seite.slug);
            }
        }
    }
    return verstoesse;
}

export function pruefeAlle(seiten, grenzen = GRENZEN) {
    return [
        ...seiten.flatMap(seite => pruefeSeite(seite, grenzen)),
        ...pruefeEindeutigkeit(seiten)
    ];
}
