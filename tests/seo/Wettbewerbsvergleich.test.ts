import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SITE_PAGES } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reine JS-Hilfsmodule ohne Typdeklarationen, absichtlich .mjs
import { plainText, zaehleWoerter } from "../../scripts/lib/page-metadata.mjs";

interface Registrierung {
    slug: string;
    kurzGesagt?: string;
    faq?: { q: string; a: string }[];
}

const ROOT = path.resolve(__dirname, "..", "..");
const lese = (datei: string) => readFileSync(path.join(ROOT, datei), "utf8");

const ALTERNATIVE = "src/pages/alternative.html";
const KOSTENLOS = "src/pages/kostenlos-ohne-anmeldung.html";
const REGISTER = "seo/wettbewerbsvergleich.md";

/** Der namentlich genannte Wettbewerber. */
const WETTBEWERBER = "funkuebung.de";

describe("Belegpflicht für Aussagen über Dritte", () => {
    it("nennt den Wettbewerber ausschließlich auf der Vergleichsseite", () => {
        // Auf anderen Seiten hätte eine Nennung keinen Beleg-Kommentar und
        // wäre damit nicht nachprüfbar.
        const seiten = ["src/index.html", KOSTENLOS, "src/pages/open-source.html",
            "src/pages/funktionen.html", "src/pages/faq.html", "src/pages/funkuebung-vorlage.html"];
        for (const seite of seiten) {
            expect(lese(seite), `${seite} nennt ${WETTBEWERBER} ohne Beleg`)
                .not.toContain(WETTBEWERBER);
        }
    });

    it("belegt die Aussagen der Vergleichstabelle mit URL und Abrufdatum", () => {
        const html = lese(ALTERNATIVE);
        const tabelle = /<table[^>]*data-testid="alternativen-tabelle"[\s\S]*?<\/table>/.exec(html)?.[0];
        expect(tabelle, "Vergleichstabelle fehlt").toBeTruthy();

        const belege = [...tabelle!.matchAll(
            /<!--\s*Beleg:\s*(https:\/\/[^\s]+)\s*–\s*abgerufen\s*(\d{4}-\d{2}-\d{2})\s*–\s*([\s\S]*?)-->/g
        )];
        expect(belege.length, "zu wenige Beleg-Kommentare").toBeGreaterThanOrEqual(8);

        for (const [, url, datum] of belege) {
            expect(url).toContain(WETTBEWERBER);
            expect(datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });

    it("trägt das Abrufdatum sichtbar an der Tabelle", () => {
        const html = lese(ALTERNATIVE);
        const caption = /<caption[\s\S]*?<\/caption>/.exec(html)?.[0] ?? "";
        expect(caption).toMatch(/abgerufen am \d{1,2}\. \w+ \d{4}/);
        expect(caption).toContain(WETTBEWERBER);
    });

    it("nennt keine Beträge auf der Vergleichsseite", () => {
        // Preise veralten. Die Seite nennt nur die Tarifstruktur und verlinkt
        // die Preisseite des Anbieters; die Beträge stehen datiert im Register.
        const text = plainText(lese(ALTERNATIVE));
        expect(text).not.toMatch(/\d+[,.]\d{2}\s*€/);
        expect(text).not.toMatch(/€\s*\d/);
        expect(text).not.toMatch(/\d+\s*Euro/i);
    });

    it("verzichtet auf herabsetzende Wertungen", () => {
        const text = plainText(lese(ALTERNATIVE)).toLowerCase();
        for (const wort of ["schlechter", "überteuert", "umständlich", "unseriös",
            "veraltet", "mangelhaft"]) {
            expect(text, `Wertung „${wort}“ auf der Vergleichsseite`).not.toContain(wort);
        }
    });

    it("benennt mindestens zwei Punkte für die Alternative", () => {
        const html = lese(ALTERNATIVE);
        expect(html).toContain('id="wann-kommerziell"');
        const abschnitt = /id="wann-kommerziell"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
        const gruende = [...abschnitt.matchAll(/<strong>[^<]+<\/strong>/g)];
        expect(gruende.length).toBeGreaterThanOrEqual(2);
    });
});

describe("Quellenregister", () => {
    const register = lese(REGISTER);

    it("führt jede Beleg-URL der Seite auch im Register", () => {
        const urls = new Set([...lese(ALTERNATIVE).matchAll(/<!--\s*Beleg:\s*(https:\/\/[^\s]+)/g)]
            .map(treffer => treffer[1] as string));
        expect(urls.size).toBeGreaterThan(0);
        for (const url of urls) {
            expect(register, `${url} fehlt im Register`).toContain(url);
        }
    });

    it("nennt Erhebung, fachliche Bestätigung und rechtliche Freigabe", () => {
        expect(register).toContain("Erhebung");
        expect(register).toContain("Fachliche Bestätigung");
        expect(register).toContain("Rechtliche Freigabe");
    });

    it("nennt eine Wiedervorlage in der Zukunft der Erhebung", () => {
        const erhebung = /Letzte Erhebung: (\d{4}-\d{2}-\d{2})/.exec(register)?.[1];
        const wieder = /Nächste Wiedervorlage: (\d{4}-\d{2}-\d{2})/.exec(register)?.[1];
        expect(erhebung).toBeTruthy();
        expect(wieder).toBeTruthy();
        expect(new Date(wieder!).getTime()).toBeGreaterThan(new Date(erhebung!).getTime());
    });

    it("hält fest, was bewusst nicht behauptet wird", () => {
        expect(register).toContain("Bewusst nicht behauptet");
    });
});

describe("Eigene Aussagen deckungsgleich mit der Datenschutzerklärung", () => {
    const datenschutz = plainText(lese("src/pages/datenschutz.html"));
    const seite = plainText(lese(KOSTENLOS));

    it("nennt dieselben gespeicherten Daten wie die Datenschutzerklärung", () => {
        for (const begriff of ["Übungsname", "Funkrufnamen", "Funksprüche"]) {
            expect(datenschutz, `Datenschutz nennt ${begriff} nicht mehr`).toContain(begriff);
            expect(seite, `Seite nennt ${begriff} nicht`).toContain(begriff);
        }
    });

    it("übernimmt den Hinweis, nichts Schützenswertes einzutragen", () => {
        expect(datenschutz).toContain("nicht in einer Übung sichtbar sein sollen");
        expect(seite).toContain("nicht in einer Übung sichtbar sein sollen");
    });

    it("nennt GoatCounter und die Cookiefreiheit wie die Erklärung", () => {
        expect(datenschutz).toContain("GoatCounter");
        expect(seite).toContain("GoatCounter");
        expect(datenschutz).toContain("keine Cookies");
        expect(seite).toContain("ohne Cookies");
    });

    it("sagt keine Speicherdauer zu, weil die Erklärung keine nennt", () => {
        // Es gibt keine TTL und keinen Aufräumjob. Eine Dauer auf der Seite wäre
        // eine Zusage, die weder Erklärung noch Code hergeben.
        expect(datenschutz).not.toMatch(/Speicherdauer|gelöscht nach|Löschfrist/);
        expect(seite).not.toMatch(/Speicherdauer|gelöscht nach|Löschfrist|\d+\s*Tage[n]? gespeichert/);
    });

    it("verschweigt den fehlenden Zugriffsschutz nicht", () => {
        // firestore.rules dokumentiert das als Restrisiko 1. Eine Seite, die
        // „ohne Anmeldung“ bewirbt und das auslässt, wäre irreführend.
        expect(lese("firestore.rules")).toContain("kein Zugriffsschutz");
        expect(seite).toContain("keinen Zugriffsschutz");
    });
});

describe("Umfang und Format der neuen Seiten", () => {
    it.each([
        ["alternative", ALTERNATIVE],
        ["kostenlos-ohne-anmeldung", KOSTENLOS]
    ])("/%s/ hat mindestens 900 Wörter", (slug, datei) => {
        // Gezählt wird, was auf der ausgelieferten Seite steht: der Quelltext
        // plus „Kurz gesagt“ und die FAQ, die der Build aus der Registry
        // einsetzt. Beides ist sichtbarer Inhalt – check-content-quality.mjs
        // zählt es ebenso. Nur den Quelltext zu messen wäre zu streng und
        // würde außerdem eine zweite, abweichende Zählweise etablieren.
        const main = /<main[\s\S]*?<\/main>/.exec(lese(datei))?.[0] ?? "";
        const seite = (SITE_PAGES as Registrierung[]).find(eintrag => eintrag.slug === slug);
        expect(seite, `${slug} fehlt in der Registry`).toBeTruthy();

        const ausRegistry = [
            seite!.kurzGesagt ?? "",
            ...(seite!.faq ?? []).flatMap(eintrag => [eintrag.q, eintrag.a])
        ].join(" ");

        const woerter = zaehleWoerter(plainText(main)) + zaehleWoerter(ausRegistry);
        expect(woerter).toBeGreaterThanOrEqual(900);
    });

    it.each([
        ["/alternative/", ALTERNATIVE],
        ["/kostenlos-ohne-anmeldung/", KOSTENLOS]
    ])("%s trägt den Wettbewerbernamen nicht in Titel, h1 oder Description", (_name, datei) => {
        const html = lese(datei);
        const felder: [string, string][] = [
            ["Titel", /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? ""],
            ["h1", /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? ""],
            ["Description", /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? ""]
        ];
        for (const [feld, wert] of felder) {
            expect(wert, `${feld} nennt den Wettbewerber`).not.toContain(WETTBEWERBER);
        }
    });
});
