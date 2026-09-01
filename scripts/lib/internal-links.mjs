// Regeln für die interne Verlinkung (AP-05).
//
// Reine Prüflogik auf einem Link-Graphen – kein Datei- oder Netzzugriff.
// Das Einlesen des Builds macht scripts/check-internal-links.mjs, damit die
// Regeln hier mit synthetischen Graphen prüfbar sind.
//
// Gezählt werden ausschließlich Links aus dem Fließtext. Navigation, Footer,
// Brotkrumen, Seitenleiste, Hub-Karten und der Weiterlesen-Block sind auf jeder
// Seite gleich; würden sie mitzählen, hätte jede Seite dreistellige Werte und
// die Prüfung wäre wertlos.

export const GRENZWERTE = {
    minEingehend: 3,
    minAusgehend: 2,
    maxLinksProSeite: 40,
    minAnkerVarianten: 3
};

/** Ankertexte ohne eigene Aussage. */
const NICHTSSAGENDE_ANKER = new Set([
    "hier", "hier klicken", "mehr", "mehr erfahren", "weiterlesen", "link",
    "diese seite", "klick", "klicken", "siehe hier", "dazu mehr"
]);

export function istNichtssagenderAnker(text) {
    return NICHTSSAGENDE_ANKER.has(String(text ?? "").trim().toLowerCase().replace(/[.!?:]+$/, ""));
}

/**
 * Baut die Kennzahlen aus dem Graphen.
 *
 * seiten: [{ slug, istInhalt }]
 * links:  [{ von, zu, anker }]  – nur Fließtext-Links
 */
export function berechneKennzahlen(seiten, links) {
    const eingehend = new Map();
    const ausgehend = new Map();
    for (const seite of seiten) {
        eingehend.set(seite.slug, []);
        ausgehend.set(seite.slug, []);
    }
    for (const link of links) {
        if (link.von === link.zu) continue;
        if (ausgehend.has(link.von)) ausgehend.get(link.von).push(link);
        if (eingehend.has(link.zu)) eingehend.get(link.zu).push(link);
    }
    return { eingehend, ausgehend };
}

/** Ankertexte je Ziel-URL über die ganze Domain. */
export function ankerVarianten(links) {
    const varianten = new Map();
    for (const link of links) {
        if (!varianten.has(link.zu)) varianten.set(link.zu, new Set());
        varianten.get(link.zu).add(String(link.anker ?? "").trim().toLowerCase());
    }
    return varianten;
}

/**
 * Prüft alle Regeln und liefert eine Liste von Verstößen.
 * Jeder Verstoß: { regel, seite, text }
 */
export function pruefeRegeln(seiten, links, grenzwerte = GRENZWERTE) {
    const verstoesse = [];
    const bekannt = new Set(seiten.map(seite => seite.slug));
    const { eingehend, ausgehend } = berechneKennzahlen(seiten, links);

    // 3. Link auf eine URL, die nicht in der Registry steht.
    for (const link of links) {
        if (!bekannt.has(link.zu)) {
            verstoesse.push({
                regel: "unbekanntes-ziel",
                seite: link.von,
                text: `Link auf "${link.zu}" – diese URL steht nicht in der Registry`
            });
        }
    }

    for (const seite of seiten) {
        const ein = eingehend.get(seite.slug) ?? [];
        const aus = ausgehend.get(seite.slug) ?? [];

        // 1./2. Nur Inhaltsseiten: Startseite und Rechtstexte sind keine
        // Lesestrecke und tragen naturgemäß wenig Fließtext.
        if (seite.istInhalt) {
            if (ein.length < grenzwerte.minEingehend) {
                verstoesse.push({
                    regel: "zu-wenig-eingehend",
                    seite: seite.slug,
                    text: `nur ${ein.length} eingehende Fließtext-Links (mindestens ${grenzwerte.minEingehend})`
                });
            }
            if (aus.length < grenzwerte.minAusgehend) {
                verstoesse.push({
                    regel: "zu-wenig-ausgehend",
                    seite: seite.slug,
                    text: `nur ${aus.length} ausgehende Fließtext-Links (mindestens ${grenzwerte.minAusgehend})`
                });
            }
        }

        // 4. Zu viele interne Links im main-Bereich.
        //
        // Der Hub ist ausgenommen. Die Regel soll verhindern, dass redaktionelle
        // Seiten mit Links zugestopft werden; der Inhalt des Hubs *ist* die
        // Linkliste, und sie wächst mit jeder neuen Seite. Bei 37 Seiten lag er
        // bei 42 Links – die Grenze wäre dort dauerhaft und ohne Erkenntnisgewinn
        // verletzt, während sie für jede andere Seite ihren Zweck behält.
        if (!seite.istHub && seite.linksImMain !== undefined
            && seite.linksImMain > grenzwerte.maxLinksProSeite) {
            verstoesse.push({
                regel: "zu-viele-links",
                seite: seite.slug,
                text: `${seite.linksImMain} interne Links im main-Bereich (höchstens ${grenzwerte.maxLinksProSeite})`
            });
        }

        // 5. Gleicher Ankertext für zwei verschiedene Ziele auf derselben Seite.
        const ankerZuZielen = new Map();
        for (const link of aus) {
            const anker = String(link.anker ?? "").trim().toLowerCase();
            if (anker === "") continue;
            if (!ankerZuZielen.has(anker)) ankerZuZielen.set(anker, new Set());
            ankerZuZielen.get(anker).add(link.zu);
        }
        for (const [anker, ziele] of ankerZuZielen) {
            if (ziele.size > 1) {
                verstoesse.push({
                    regel: "mehrdeutiger-anker",
                    seite: seite.slug,
                    text: `Ankertext "${anker}" zeigt auf ${ziele.size} verschiedene Ziele: ${[...ziele].join(", ")}`
                });
            }
        }
    }

    // Nichtssagende Ankertexte melden.
    for (const link of links) {
        if (istNichtssagenderAnker(link.anker)) {
            verstoesse.push({
                regel: "nichtssagender-anker",
                seite: link.von,
                text: `Ankertext "${String(link.anker).trim()}" auf "${link.zu}" sagt nichts über das Ziel`
            });
        }
    }

    return verstoesse;
}

/** Ziele, auf die zu wenige verschiedene Ankertexte zeigen. */
export function ankerHinweise(seiten, links, grenzwerte = GRENZWERTE) {
    const varianten = ankerVarianten(links);
    const hinweise = [];
    for (const seite of seiten) {
        if (!seite.istInhalt) continue;
        const anzahl = varianten.get(seite.slug)?.size ?? 0;
        if (anzahl > 0 && anzahl < grenzwerte.minAnkerVarianten) {
            hinweise.push({
                seite: seite.slug,
                varianten: anzahl,
                text: `nur ${anzahl} verschiedene Ankertexte (Ziel: ${grenzwerte.minAnkerVarianten})`
            });
        }
    }
    return hinweise;
}

/** Markdown-Bericht über den Zustand der internen Verlinkung. */
export function baueBericht({ seiten, links, verstoesse, hinweise, erhoben }) {
    const { eingehend, ausgehend } = berechneKennzahlen(seiten, links);
    const inhalt = seiten.filter(seite => seite.istInhalt);

    const verwaist = inhalt
        .filter(seite => (eingehend.get(seite.slug) ?? []).length === 0)
        .map(seite => seite.slug);

    const sortiert = [...inhalt].sort((a, b) =>
        (eingehend.get(b.slug)?.length ?? 0) - (eingehend.get(a.slug)?.length ?? 0));

    const zeilen = [];
    zeilen.push("# Interne Verlinkung");
    zeilen.push("");
    zeilen.push("Erzeugt von `scripts/check-internal-links.mjs`. Nicht von Hand bearbeiten –");
    zeilen.push("die Datei wird bei jedem CI-Lauf neu geschrieben.");
    zeilen.push("");
    zeilen.push(`**Stand: ${erhoben}**`);
    zeilen.push("");
    zeilen.push("Gezählt werden nur Fließtext-Links. Navigation, Footer, Brotkrumen,");
    zeilen.push("Seitenleiste, Hub-Karten und Weiterlesen-Block bleiben außen vor, weil sie");
    zeilen.push("auf jeder Seite gleich sind.");
    zeilen.push("");

    zeilen.push("## Überblick");
    zeilen.push("");
    zeilen.push(`- Seiten in der Registry: ${seiten.length}`);
    zeilen.push(`- davon Inhaltsseiten: ${inhalt.length}`);
    zeilen.push(`- Fließtext-Links gesamt: ${links.length}`);
    zeilen.push(`- Verstöße: ${verstoesse.length}`);
    zeilen.push(`- Seiten ohne eingehenden Fließtext-Link: ${verwaist.length}`);
    zeilen.push("");

    zeilen.push("## Verwaiste Seiten");
    zeilen.push("");
    zeilen.push(verwaist.length === 0
        ? "Keine. Jede Inhaltsseite hat mindestens einen eingehenden Fließtext-Link."
        : verwaist.map(slug => `- \`/${slug}/\``).join("\n"));
    zeilen.push("");

    zeilen.push("## Eingehende Links je Seite");
    zeilen.push("");
    zeilen.push("| Seite | eingehend | ausgehend |");
    zeilen.push("| --- | ---: | ---: |");
    for (const seite of sortiert) {
        zeilen.push(`| \`/${seite.slug}/\` | ${eingehend.get(seite.slug)?.length ?? 0}`
            + ` | ${ausgehend.get(seite.slug)?.length ?? 0} |`);
    }
    zeilen.push("");

    zeilen.push("## Ankertexte je Ziel");
    zeilen.push("");
    const varianten = ankerVarianten(links);
    zeilen.push("| Ziel | Varianten | Ankertexte |");
    zeilen.push("| --- | ---: | --- |");
    for (const seite of sortiert) {
        const menge = varianten.get(seite.slug);
        if (!menge || menge.size === 0) continue;
        const texte = [...menge].sort().map(text => `„${text}“`).join(", ");
        zeilen.push(`| \`/${seite.slug}/\` | ${menge.size} | ${texte} |`);
    }
    zeilen.push("");

    if (hinweise.length > 0) {
        zeilen.push("## Zu wenig Ankertext-Varianten");
        zeilen.push("");
        for (const hinweis of hinweise) zeilen.push(`- \`/${hinweis.seite}/\`: ${hinweis.text}`);
        zeilen.push("");
    }

    if (verstoesse.length > 0) {
        zeilen.push("## Verstöße");
        zeilen.push("");
        for (const verstoss of verstoesse) {
            zeilen.push(`- **${verstoss.regel}** auf \`/${verstoss.seite}/\`: ${verstoss.text}`);
        }
        zeilen.push("");
    }

    return zeilen.join("\n");
}
