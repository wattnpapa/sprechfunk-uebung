// Die Vergleichsseite /alternative/ vergleicht Wege, nicht Anbieter.
//
// Ursprünglich (AP-09) stand dort ein namentlicher Vergleich mit einem
// kommerziellen Anbieter, belegt mit Fundstellen und Abrufdatum. Diese
// Entscheidung wurde zurückgenommen: über andere soll hier nicht geurteilt
// werden. Der Test dreht sich damit um – er erzwingt jetzt die Abwesenheit
// solcher Aussagen, statt sie zu belegen.
//
// Was bleibt: die Seite muss die eigenen Grenzen weiterhin offen benennen.
// Eine Vergleichsseite, die nur die eigenen Vorzüge aufzählt, wäre Werbung.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reines JS-Hilfsmodul ohne Typdeklarationen, absichtlich .mjs
import { plainText } from "../../scripts/lib/page-metadata.mjs";

const ROOT = path.resolve(__dirname, "..", "..");
const lese = (datei: string) => readFileSync(path.join(ROOT, datei), "utf8");

const ALTERNATIVE = "src/pages/alternative.html";

/**
 * Hosts, auf die eine Inhaltsseite verweisen darf.
 *
 * Bewusst strukturell statt über eine Sperrliste von Namen: eine Sperrliste
 * müsste den Namen, um den es geht, selbst führen – und genau der soll hier
 * nirgends stehen. Erlaubt sind die eigene Domain, das eigene Repository und
 * die Fundstellen aus dem Quellenregister (AP-11).
 */
const ERLAUBTE_HOSTS = [
    "sprechfunk-uebung.de",
    "github.com",
    "www.dinmedia.de",
    "kv-lahn-dill.dlrg.de",
    "www.gravatar.com",
    "gc.zgo.at",
    "www.thw.de",
    // Eigenes Schwesterprojekt, kein fremder Anbieter.
    "erfassungsbogen.app"
];

const host = (url: string): string => {
    try {
        return new URL(url).host;
    } catch {
        return "";
    }
};

/** Alle ausgelieferten Quellen, die Fließtext enthalten. */
function inhaltsdateien(): string[] {
    const seiten = readdirSync(path.join(ROOT, "src", "pages"))
        .filter(name => name.endsWith(".html"))
        .map(name => `src/pages/${name}`);
    return ["src/index.html", ...seiten];
}

describe("Keine Bewertung fremder Anbieter", () => {
    it.each(inhaltsdateien())("%s verweist nur auf bekannte Hosts", datei => {
        const fremd = [...lese(datei).matchAll(/href="(https?:\/\/[^"]+)"/g)]
            .map(treffer => host(treffer[1]))
            .filter(wert => wert !== "" && !ERLAUBTE_HOSTS.includes(wert));
        expect([...new Set(fremd)], `${datei} verweist auf ${[...new Set(fremd)].join(", ")}`)
            .toEqual([]);
    });

    it("verfolgt keine fremde Marke als Keyword", () => {
        const keywords = JSON.parse(lese("seo/keywords.json")) as Record<string, string[]>;
        expect(keywords.competitors).toEqual([]);
        // Auch in den übrigen Gruppen darf kein Domainname stehen: ein Keyword
        // mit Punkt-TLD ist praktisch immer ein Markenname.
        for (const [gruppe, liste] of Object.entries(keywords)) {
            const domains = liste.filter(begriff => /\.[a-z]{2,}$/i.test(begriff));
            expect(domains, `Gruppe ${gruppe} enthält einen Domainnamen`).toEqual([]);
        }
    });

    it("erkennt einen fremden Host auch wirklich", () => {
        // Gegenprobe: ohne sie wäre der Test auch bei kaputter Prüfung grün.
        expect(host("https://beispiel-anbieter.example/preise")).toBe("beispiel-anbieter.example");
        expect(ERLAUBTE_HOSTS).not.toContain("beispiel-anbieter.example");
    });

    it("verlinkt von der Vergleichsseite auf keine fremde Anbieterseite", () => {
        const html = lese(ALTERNATIVE);
        const externe = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)]
            .map(treffer => treffer[1])
            .filter(url => !url.startsWith("https://sprechfunk-uebung.de/")
                && !url.startsWith("https://github.com/wattnpapa/"));
        expect(externe, `unerwartete externe Verweise: ${externe.join(", ")}`).toEqual([]);
    });

    it("führt keine Belegkommentare über Dritte mehr", () => {
        expect(lese(ALTERNATIVE)).not.toMatch(/<!--\s*Beleg:/);
    });
});

describe("Vergleichsseite", () => {
    it("vergleicht vier Wege und in der Tabelle nur die drei nachprüfbaren", () => {
        const html = lese(ALTERNATIVE);
        for (const anker of ["handarbeit", "tabelle", "freier-generator", "kommerziell"]) {
            expect(html, `Abschnitt #${anker} fehlt`).toContain(`id="${anker}"`);
        }

        const tabelle = /<table[^>]*data-testid="alternativen-tabelle"[\s\S]*?<\/table>/.exec(html)?.[0];
        expect(tabelle, "Vergleichstabelle fehlt").toBeDefined();

        // Merkmal + drei Wege: über die kommerzielle Kategorie steht in der
        // Tabelle bewusst nichts, weil es hier nicht nachprüfbar wäre.
        const kopf = /<thead>[\s\S]*?<\/thead>/.exec(tabelle!)?.[0] ?? "";
        expect([...kopf.matchAll(/<th(?=[\s>])[^>]*>/g)]).toHaveLength(4);

        // Jede Zeile trägt genau so viele Zellen wie der Kopf Spalten hat.
        for (const zeile of tabelle!.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
            const zellen = [...zeile[1].matchAll(/<(th|td)(?=[\s>])[^>]*>/g)];
            if (zellen.length === 0) continue;
            expect(zellen).toHaveLength(4);
        }
    });

    it("nennt keine Beträge", () => {
        // Preise Dritter ändern sich und wären hier sofort veraltet.
        const text = plainText(lese(ALTERNATIVE));
        expect(text).not.toMatch(/\d+[.,]\d{2}\s*(€|EUR|Euro)/i);
        expect(text).not.toMatch(/(€|EUR)\s*\d/i);
    });

    it("verzichtet auf herabsetzende Wertungen", () => {
        const text = plainText(lese(ALTERNATIVE)).toLowerCase();
        for (const wort of ["schlechter", "überteuert", "umständlich", "unseriös",
            "abzocke", "veraltet", "primitiv", "besser als"]) {
            expect(text, `wertendes Wort "${wort}"`).not.toContain(wort);
        }
    });

    it("benennt die eigenen Grenzen, nicht nur die eigenen Vorzüge", () => {
        const text = plainText(lese(ALTERNATIVE)).toLowerCase();
        // Ohne Konto kein Zugriffsschutz, keine Rollen, kein Vertragspartner:
        // das sind die drei Punkte, an denen dieser Generator nicht passt.
        expect(text).toContain("zugriffsschutz");
        expect(text).toContain("rechteverwaltung");
        expect(text).toMatch(/weder rechnung noch vertrag/);
    });

    it("räumt ein, dass ein anderer Weg der bessere sein kann", () => {
        const html = lese(ALTERNATIVE);
        expect(html).toContain('id="wann-kommerziell"');
        const text = plainText(html).toLowerCase();
        expect(text).toContain("keine gegner");
    });
});
