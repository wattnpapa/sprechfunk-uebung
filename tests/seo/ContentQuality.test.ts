import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SITE_PAGES } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reine JS-Hilfsmodule ohne Typdeklarationen, absichtlich .mjs
import {
    durchschnittlicheSatzlaenge,
    findeFloskeln,
    GRENZEN,
    pruefeEindeutigkeit,
    pruefeSeite,
    saetze,
    woerterIm,
    ZIELWOERTER
} from "../../scripts/lib/content-quality.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { lesezeitMinuten, slugFuerUeberschrift } from "../../scripts/lib/page-metadata.mjs";

const ROOT = path.resolve(__dirname, "..", "..");

interface Seite { slug: string; source: string; inSitemap?: boolean; kurzGesagt?: string }
const inhaltsseiten = (SITE_PAGES as Seite[])
    .filter(seite => seite.slug !== "" && seite.inSitemap !== false);

const leseQuelle = (source: string) => readFileSync(path.join(ROOT, "src", source), "utf8");

/** Synthetische Seite mit lauter erfüllten Werten – Basis für Einzelregeln. */
const gueltigeSeite = (ueberschreibung: Record<string, unknown> = {}) => ({
    slug: "test",
    titel: "Ein Titel mit genau der richtigen Laenge fuer die Regel",
    description: "Eine Beschreibung, die im erlaubten Bereich zwischen einhundertvierzig und "
        + "einhundertsechzig Zeichen liegt und daher keine Meldung ausloest.",
    woerter: 900,
    text: "Ein kurzer Satz. Noch ein Satz. Und ein dritter.",
    absaetze: ["Ein kurzer Absatz."],
    ankerZiele: [],
    ankerVorhanden: [],
    transferBytes: 1000,
    hatMetazeile: true,
    hatKurzGesagt: true,
    hatFaq: true,
    hatWeiterlesen: true,
    h2OhneId: 0,
    ...ueberschreibung
});

describe("Titel und Description im Bestand", () => {
    it.each(inhaltsseiten.map(seite => [seite.slug, seite] as const))(
        "%s hat einen Titel von 50 bis 60 Zeichen",
        (_slug, seite) => {
            const titel = /<title>([^<]*)<\/title>/i.exec(leseQuelle(seite.source))?.[1] ?? "";
            expect(titel.length).toBeGreaterThanOrEqual(GRENZEN.titelMin);
            expect(titel.length).toBeLessThanOrEqual(GRENZEN.titelMax);
        }
    );

    it.each(inhaltsseiten.map(seite => [seite.slug, seite] as const))(
        "%s hat eine Description von 140 bis 160 Zeichen",
        (_slug, seite) => {
            const desc = /<meta name="description" content="([^"]*)"/i
                .exec(leseQuelle(seite.source))?.[1] ?? "";
            expect(desc.length).toBeGreaterThanOrEqual(GRENZEN.descMin);
            expect(desc.length).toBeLessThanOrEqual(GRENZEN.descMax);
        }
    );

    it("führt jede Kombination aus Titel und Description genau einmal", () => {
        const seiten = inhaltsseiten.map(seite => {
            const html = leseQuelle(seite.source);
            return {
                slug: seite.slug,
                titel: /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "",
                description: /<meta name="description" content="([^"]*)"/i.exec(html)?.[1] ?? ""
            };
        });
        expect(pruefeEindeutigkeit(seiten)).toEqual([]);
    });

    it("lässt das Marken-Suffix auf Unterseiten weg", () => {
        // 60 Zeichen minus " | Sprechfunk Übungsgenerator" (29) lassen keinen
        // Platz für ein aussagekräftiges Thema. Die Startseite behält es.
        for (const seite of inhaltsseiten) {
            const titel = /<title>([^<]*)<\/title>/i.exec(leseQuelle(seite.source))?.[1] ?? "";
            expect(titel, `${seite.slug} trägt noch das Suffix`)
                .not.toContain("| Sprechfunk Übungsgenerator");
        }
        const start = readFileSync(path.join(ROOT, "src", "index.html"), "utf8");
        expect(/<title>([^<]*)<\/title>/i.exec(start)?.[1])
            .toContain("| Sprechfunk Übungsgenerator");
    });
});

describe("„Kurz gesagt“ in der Registry", () => {
    it.each(inhaltsseiten.map(seite => [seite.slug, seite] as const))(
        "%s hat drei bis vier Sätze",
        (_slug, seite) => {
            expect(seite.kurzGesagt, "kurzGesagt fehlt").toBeTruthy();
            const anzahl = saetze(seite.kurzGesagt!).length;
            expect(anzahl).toBeGreaterThanOrEqual(3);
            expect(anzahl).toBeLessThanOrEqual(4);
        }
    );

    it("enthält keine Floskeln", () => {
        for (const seite of inhaltsseiten) {
            expect(findeFloskeln(seite.kurzGesagt), `Floskel in /${seite.slug}/`).toEqual([]);
        }
    });
});

describe("Regel: Wortzahl", () => {
    it("meldet eine Seite unter dem Mindestwert", () => {
        const verstoesse = pruefeSeite(gueltigeSeite({ woerter: 799 }));
        expect(verstoesse.map(v => v.regel)).toContain("zu-kurz");
    });

    it("nutzt für Prioritätsseiten den höheren Zielwert", () => {
        const slug = "regiebuch-funkuebung";
        expect(ZIELWOERTER[slug]).toBe(1100);
        // 900 Wörter genügen sonst, hier nicht.
        expect(pruefeSeite(gueltigeSeite({ slug, woerter: 900 })).map(v => v.regel))
            .toContain("zu-kurz");
        expect(pruefeSeite(gueltigeSeite({ slug, woerter: 1100 })).map(v => v.regel))
            .not.toContain("zu-kurz");
    });
});

describe("Regel: Floskeln", () => {
    it.each([
        "Das spielt eine wichtige Rolle im Funkverkehr.",
        "Der Vorfall war ein Wendepunkt.",
        "Experten sind sich einig darüber.",
        "Zusammenfassend bleibt festzuhalten.",
        "Es geht nicht nur um Technik, sondern auch um Disziplin."
    ])("erkennt „%s“", satz => {
        expect(findeFloskeln(satz).length).toBeGreaterThan(0);
    });

    it("lässt normale Fachsprache durch", () => {
        expect(findeFloskeln(
            "Die Betriebsworte sind in der PDV/DV 810.3 festgelegt und gelten organisationsübergreifend."
        )).toEqual([]);
    });

    it("meldet einen Treffer als Verstoß", () => {
        const verstoesse = pruefeSeite(gueltigeSeite({ text: "Das ist ein Wendepunkt." }));
        expect(verstoesse.map(v => v.regel)).toContain("floskel");
    });
});

describe("Regel: Lesbarkeit", () => {
    it("zählt Sätze, ohne an Abkürzungen zu trennen", () => {
        expect(saetze("Erst z. B. hier. Dann dort.")).toHaveLength(2);
    });

    it("meldet zu lange Sätze im Durchschnitt", () => {
        const langer = `${Array.from({ length: 25 }, (_, i) => `Wort${i}`).join(" ")}.`;
        expect(durchschnittlicheSatzlaenge(langer)).toBeGreaterThan(GRENZEN.satzlaengeMax);
        expect(pruefeSeite(gueltigeSeite({ text: langer })).map(v => v.regel))
            .toContain("satzlaenge");
    });

    it("meldet einen Absatz über 120 Wörtern", () => {
        const absatz = Array.from({ length: 121 }, (_, i) => `Wort${i}`).join(" ");
        expect(woerterIm(absatz)).toBe(121);
        expect(pruefeSeite(gueltigeSeite({ absaetze: [absatz] })).map(v => v.regel))
            .toContain("absatz-zu-lang");
    });
});

describe("Regel: Anker und Format", () => {
    it("meldet ein Inhaltsverzeichnis, das auf einen fehlenden Anker verweist", () => {
        const verstoesse = pruefeSeite(gueltigeSeite({
            ankerZiele: ["gibt-es-nicht"], ankerVorhanden: ["inhalt"]
        }));
        expect(verstoesse.map(v => v.regel)).toContain("toter-anker");
    });

    it("akzeptiert vorhandene Anker", () => {
        const verstoesse = pruefeSeite(gueltigeSeite({
            ankerZiele: ["abschnitt"], ankerVorhanden: ["abschnitt"]
        }));
        expect(verstoesse.map(v => v.regel)).not.toContain("toter-anker");
    });

    it("meldet doppelte ids", () => {
        const verstoesse = pruefeSeite(gueltigeSeite({
            ankerVorhanden: ["inhalt", "abschnitt", "abschnitt"]
        }));
        expect(verstoesse.map(v => v.regel)).toContain("doppelte-id");
    });

    it("akzeptiert eindeutige ids", () => {
        const verstoesse = pruefeSeite(gueltigeSeite({
            ankerVorhanden: ["inhalt", "abschnitt", "weiteres"]
        }));
        expect(verstoesse.map(v => v.regel)).not.toContain("doppelte-id");
    });

    it("meldet Überschriften ohne id", () => {
        expect(pruefeSeite(gueltigeSeite({ h2OhneId: 2 })).map(v => v.regel))
            .toContain("h2-ohne-id");
    });

    it.each([
        ["hatMetazeile", "Metazeile"],
        ["hatKurzGesagt", "Kurz gesagt"],
        ["hatFaq", "FAQ"],
        ["hatWeiterlesen", "Weiterlesen"]
    ])("meldet fehlendes Element: %s", feld => {
        const verstoesse = pruefeSeite(gueltigeSeite({ [feld]: false }));
        expect(verstoesse.map(v => v.regel)).toContain("format-unvollstaendig");
    });
});

describe("Regel: Transfergröße", () => {
    it("meldet eine Seite über 120 KB", () => {
        expect(pruefeSeite(gueltigeSeite({ transferBytes: 121 * 1024 })).map(v => v.regel))
            .toContain("zu-gross");
    });

    it("lässt den Grenzwert durch", () => {
        expect(pruefeSeite(gueltigeSeite({ transferBytes: 120 * 1024 })).map(v => v.regel))
            .not.toContain("zu-gross");
    });
});

describe("Hilfsfunktionen für das Seitenformat", () => {
    it("erzeugt stabile Anker aus Überschriften", () => {
        expect(slugFuerUeberschrift("Antennen und Leitungen"))
            .toBe(slugFuerUeberschrift("Antennen und Leitungen"));
        expect(slugFuerUeberschrift("Übungsfunkverkehr im Betrieb"))
            .toBe("uebungsfunkverkehr-im-betrieb");
    });

    it("rechnet die Lesezeit mit 200 Wörtern je Minute", () => {
        expect(lesezeitMinuten(200)).toBe(1);
        expect(lesezeitMinuten(201)).toBe(2);
        expect(lesezeitMinuten(0)).toBe(1);
        expect(lesezeitMinuten(1100)).toBe(6);
    });
});
