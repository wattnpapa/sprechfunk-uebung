import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reines JS-Hilfsmodul ohne Typdeklarationen, absichtlich .mjs
import {
    ankerHinweise,
    ankerVarianten,
    baueBericht,
    berechneKennzahlen,
    GRENZWERTE,
    istNichtssagenderAnker,
    pruefeRegeln
} from "../../scripts/lib/internal-links.mjs";

/**
 * Synthetische Graphen statt des echten Builds: nur so lässt sich jede Regel
 * einzeln auslösen. Gegen den Bestand könnte man nicht prüfen, ob eine Regel
 * überhaupt anschlägt – dort sind inzwischen alle erfüllt.
 */
type Seite = { slug: string; istInhalt: boolean; linksImMain?: number };
type Link = { von: string; zu: string; anker: string };

const inhalt = (slug: string, linksImMain?: number): Seite =>
    ({ slug, istInhalt: true, ...(linksImMain === undefined ? {} : { linksImMain }) });

/** Erzeugt n eingehende Links auf `ziel` mit unterschiedlichen Ankern. */
const eingehendeLinks = (ziel: string, n: number, quellen: string[]): Link[] =>
    Array.from({ length: n }, (_, i) => ({
        von: quellen[i % quellen.length],
        zu: ziel,
        anker: `Ankertext ${i + 1} für ${ziel}`
    }));

const regelnVon = (verstoesse: { regel: string }[]) => verstoesse.map(v => v.regel);

describe("berechneKennzahlen", () => {
    it("zählt ein- und ausgehende Links je Seite", () => {
        const seiten = [inhalt("a"), inhalt("b"), inhalt("c")];
        const links: Link[] = [
            { von: "a", zu: "b", anker: "zu b" },
            { von: "c", zu: "b", anker: "auch zu b" }
        ];
        const { eingehend, ausgehend } = berechneKennzahlen(seiten, links);

        expect(eingehend.get("b")).toHaveLength(2);
        expect(ausgehend.get("a")).toHaveLength(1);
        expect(eingehend.get("a")).toHaveLength(0);
    });

    it("ignoriert Selbstverweise", () => {
        const seiten = [inhalt("a")];
        const { eingehend, ausgehend } = berechneKennzahlen(seiten, [
            { von: "a", zu: "a", anker: "auf sich selbst" }
        ]);
        expect(eingehend.get("a")).toHaveLength(0);
        expect(ausgehend.get("a")).toHaveLength(0);
    });
});

describe("Regel: zu wenig eingehende Links", () => {
    it("meldet eine Inhaltsseite mit weniger als drei eingehenden Links", () => {
        const seiten = [inhalt("ziel"), inhalt("q1"), inhalt("q2")];
        const links = eingehendeLinks("ziel", 2, ["q1", "q2"]);

        expect(regelnVon(pruefeRegeln(seiten, links))).toContain("zu-wenig-eingehend");
    });

    it("schweigt bei genau drei eingehenden Links", () => {
        const seiten = [inhalt("ziel"), inhalt("q1"), inhalt("q2"), inhalt("q3")];
        const links = [
            ...eingehendeLinks("ziel", 3, ["q1", "q2", "q3"]),
            // Quellen brauchen selbst ein- und ausgehende Links.
            ...eingehendeLinks("q1", 3, ["ziel", "q2", "q3"]),
            ...eingehendeLinks("q2", 3, ["ziel", "q1", "q3"]),
            ...eingehendeLinks("q3", 3, ["ziel", "q1", "q2"])
        ];
        expect(regelnVon(pruefeRegeln(seiten, links))).not.toContain("zu-wenig-eingehend");
    });

    it("nimmt Nicht-Inhaltsseiten von der Regel aus", () => {
        // Startseite und Rechtstexte sind keine Lesestrecke.
        const seiten: Seite[] = [{ slug: "impressum", istInhalt: false }];
        expect(regelnVon(pruefeRegeln(seiten, []))).toEqual([]);
    });
});

describe("Regel: zu wenig ausgehende Links", () => {
    it("meldet eine Inhaltsseite mit weniger als zwei ausgehenden Links", () => {
        const seiten = [inhalt("a"), inhalt("b")];
        const links: Link[] = [{ von: "a", zu: "b", anker: "einziger Verweis" }];

        const verstoesse = pruefeRegeln(seiten, links)
            .filter(v => v.regel === "zu-wenig-ausgehend");
        expect(verstoesse.map(v => v.seite)).toContain("a");
    });
});

describe("Regel: unbekanntes Ziel", () => {
    it("meldet einen Link auf eine URL außerhalb der Registry", () => {
        const seiten = [inhalt("a")];
        const links: Link[] = [{ von: "a", zu: "gibt-es-nicht", anker: "Tippfehler" }];

        const verstoss = pruefeRegeln(seiten, links).find(v => v.regel === "unbekanntes-ziel");
        expect(verstoss).toBeDefined();
        expect(verstoss!.text).toContain("gibt-es-nicht");
    });

    it("akzeptiert Ziele, die in der Registry stehen", () => {
        const seiten = [inhalt("a"), inhalt("b")];
        const links: Link[] = [{ von: "a", zu: "b", anker: "nach b" }];
        expect(regelnVon(pruefeRegeln(seiten, links))).not.toContain("unbekanntes-ziel");
    });
});

describe("Regel: zu viele Links im main-Bereich", () => {
    it(`meldet mehr als ${GRENZWERTE.maxLinksProSeite} interne Links`, () => {
        const seiten = [inhalt("a", GRENZWERTE.maxLinksProSeite + 1)];
        const verstoss = pruefeRegeln(seiten, []).find(v => v.regel === "zu-viele-links");
        expect(verstoss).toBeDefined();
        expect(verstoss!.text).toContain(String(GRENZWERTE.maxLinksProSeite + 1));
    });

    it("lässt genau den Grenzwert durch", () => {
        const seiten = [inhalt("a", GRENZWERTE.maxLinksProSeite)];
        expect(regelnVon(pruefeRegeln(seiten, []))).not.toContain("zu-viele-links");
    });
});

describe("Regel: mehrdeutiger Ankertext", () => {
    it("meldet denselben Ankertext für zwei Ziele auf einer Seite", () => {
        const seiten = [inhalt("a"), inhalt("b"), inhalt("c")];
        const links: Link[] = [
            { von: "a", zu: "b", anker: "Funkübung" },
            { von: "a", zu: "c", anker: "Funkübung" }
        ];

        const verstoss = pruefeRegeln(seiten, links).find(v => v.regel === "mehrdeutiger-anker");
        expect(verstoss).toBeDefined();
        expect(verstoss!.seite).toBe("a");
    });

    it("erlaubt denselben Ankertext auf verschiedenen Seiten", () => {
        const seiten = [inhalt("a"), inhalt("b"), inhalt("ziel")];
        const links: Link[] = [
            { von: "a", zu: "ziel", anker: "Buchstabiertafel" },
            { von: "b", zu: "ziel", anker: "Buchstabiertafel" }
        ];
        expect(regelnVon(pruefeRegeln(seiten, links))).not.toContain("mehrdeutiger-anker");
    });

    it("erlaubt denselben Ankertext für dasselbe Ziel", () => {
        const seiten = [inhalt("a"), inhalt("ziel")];
        const links: Link[] = [
            { von: "a", zu: "ziel", anker: "Regeln" },
            { von: "a", zu: "ziel", anker: "Regeln" }
        ];
        expect(regelnVon(pruefeRegeln(seiten, links))).not.toContain("mehrdeutiger-anker");
    });
});

describe("Regel: nichtssagende Ankertexte", () => {
    it.each(["hier", "Hier", "mehr", "hier klicken", "Weiterlesen", "diese Seite"])(
        "erkennt \"%s\" als nichtssagend",
        anker => expect(istNichtssagenderAnker(anker)).toBe(true)
    );

    it.each(["Buchstabiertafel", "Funkübung planen", "Sprechfunk-Regeln"])(
        "lässt \"%s\" durch",
        anker => expect(istNichtssagenderAnker(anker)).toBe(false)
    );

    it("meldet einen nichtssagenden Anker als Verstoß", () => {
        const seiten = [inhalt("a"), inhalt("b")];
        const links: Link[] = [{ von: "a", zu: "b", anker: "hier" }];
        expect(regelnVon(pruefeRegeln(seiten, links))).toContain("nichtssagender-anker");
    });
});

describe("Ankertext-Varianten", () => {
    it("sammelt die Varianten je Ziel", () => {
        const links: Link[] = [
            { von: "a", zu: "ziel", anker: "Buchstabiertafel" },
            { von: "b", zu: "ziel", anker: "Funkalphabet" },
            { von: "c", zu: "ziel", anker: "buchstabiertafel" } // Groß/klein zählt einmal
        ];
        expect(ankerVarianten(links).get("ziel")!.size).toBe(2);
    });

    it("meldet Ziele mit zu wenig Varianten als Hinweis, nicht als Verstoß", () => {
        const seiten = [inhalt("ziel"), inhalt("a"), inhalt("b")];
        const links: Link[] = [
            { von: "a", zu: "ziel", anker: "gleicher Text" },
            { von: "b", zu: "ziel", anker: "gleicher Text" }
        ];

        const hinweise = ankerHinweise(seiten, links);
        expect(hinweise.map(h => h.seite)).toContain("ziel");
        expect(regelnVon(pruefeRegeln(seiten, links))).not.toContain("zu-wenig-anker-varianten");
    });
});

describe("Bericht", () => {
    const seiten = [inhalt("beliebt"), inhalt("verwaist"), inhalt("quelle")];
    const links: Link[] = [
        { von: "quelle", zu: "beliebt", anker: "erster Anker" },
        { von: "quelle", zu: "beliebt", anker: "zweiter Anker" }
    ];
    const bericht = baueBericht({
        seiten,
        links,
        verstoesse: pruefeRegeln(seiten, links),
        hinweise: ankerHinweise(seiten, links),
        erhoben: "2026-08-03"
    });

    it("nennt Stand, Kennzahlen und Abschnitte", () => {
        expect(bericht).toContain("# Interne Verlinkung");
        expect(bericht).toContain("**Stand: 2026-08-03**");
        expect(bericht).toContain("## Verwaiste Seiten");
        expect(bericht).toContain("## Ankertexte je Ziel");
    });

    it("listet Seiten ohne eingehende Links auf", () => {
        expect(bericht).toContain("`/verwaist/`");
    });

    it("führt die Ankertexte des Ziels auf", () => {
        expect(bericht).toContain("erster anker");
        expect(bericht).toContain("zweiter anker");
    });

    it("meldet keine verwaisten Seiten, wenn jede Seite verlinkt ist", () => {
        const alle = [inhalt("a"), inhalt("b")];
        const beide: Link[] = [
            { von: "a", zu: "b", anker: "nach b" },
            { von: "b", zu: "a", anker: "nach a" }
        ];
        const text = baueBericht({
            seiten: alle, links: beide,
            verstoesse: [], hinweise: [], erhoben: "2026-08-03"
        });
        expect(text).toContain("Keine. Jede Inhaltsseite hat mindestens einen eingehenden");
    });
});
