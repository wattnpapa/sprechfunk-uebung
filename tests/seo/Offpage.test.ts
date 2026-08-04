// AP-12: Werkzeuge für Off-Page-Arbeit.
//
// Geprüft wird das, was still kaputtgehen kann: der Parser des
// Search-Console-Exports, die Struktur der Zielliste, das einbettbare Widget
// und die Aushänge. Die Abrufbarkeit der Ziel-URLs prüft
// scripts/check-outreach.mjs — das braucht Netz und gehört nicht in die CI.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SITE_PAGES } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reine JS-Hilfsmodule ohne Typdeklarationen, absichtlich .mjs
import { alsCsv, baueBericht, csvZeile, normalisiereDomain, parseExport, vergleiche, vormonat, zahl } from "../../scripts/lib/backlinks.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PFLICHTSPALTEN, STATUS_WERTE, parseOutreach, urlAus } from "../../scripts/lib/outreach.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { EMBEDS, embedSnippet, embedUrl, renderEmbed, sortiereZeilen, zielUrl } from "../../scripts/lib/embed.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { AUSHAENGE, aushangPfad, aushangUrl, qrRechtecke } from "../../scripts/lib/aushaenge.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { extractDefinedTerms } from "../../scripts/lib/page-metadata.mjs";

const ROOT = path.resolve(__dirname, "..", "..");
const slugs = new Set((SITE_PAGES as { slug: string }[]).map(seite => seite.slug));

describe("Backlink-Auswertung", () => {
    it("zerlegt Zahlen mit Tausendertrennung in Anführungszeichen", () => {
        expect(csvZeile('beispiel.example,"1.234",3')).toEqual(["beispiel.example", "1.234", "3"]);
    });

    it("liest Zahlen unabhängig vom Trennzeichen", () => {
        expect(zahl("1.234")).toBe(1234);
        expect(zahl("1,234")).toBe(1234);
        expect(zahl("")).toBe(0);
        expect(zahl(undefined)).toBe(0);
    });

    it("vereinheitlicht Domains", () => {
        expect(normalisiereDomain("https://www.Beispiel.example/pfad")).toBe("beispiel.example");
        expect(normalisiereDomain("beispiel.example.")).toBe("beispiel.example");
    });

    it("führt www und nicht-www zu einer Domain zusammen", () => {
        const eintraege = parseExport([
            "Website,Verweisende Seiten,Verlinkte Seiten",
            "https://www.beispiel.example/,3,1",
            "https://beispiel.example/,2,2"
        ].join("\n"));
        expect(eintraege).toHaveLength(1);
        expect(eintraege[0]).toMatchObject({ domain: "beispiel.example", verweisendeSeiten: 5 });
    });

    it("kommt auch ohne Kopfzeile zurecht", () => {
        expect(parseExport("beispiel.example,4,2")).toHaveLength(1);
    });

    it("überspringt Zeilen ohne Domain", () => {
        expect(parseExport("Website,Verweisende Seiten\nGesamt,12")).toEqual([]);
    });

    it("schreibt eine normalisierte CSV mit fester Kopfzeile", () => {
        const csv = alsCsv(parseExport("a.example,2,1")) as string;
        expect(csv.split("\n")[0]).toBe("domain,verweisende_seiten,verlinkte_seiten");
        expect(csv).toContain("a.example,2,1");
    });

    it("erkennt neue, verlorene und veränderte Domains", () => {
        const diff = vergleiche(
            [{ domain: "neu.example", verweisendeSeiten: 1, verlinkteSeiten: 1 },
                { domain: "bleibt.example", verweisendeSeiten: 5, verlinkteSeiten: 2 }],
            [{ domain: "weg.example", verweisendeSeiten: 3, verlinkteSeiten: 1 },
                { domain: "bleibt.example", verweisendeSeiten: 2, verlinkteSeiten: 2 }]
        );
        expect(diff.neu.map((e: { domain: string }) => e.domain)).toEqual(["neu.example"]);
        expect(diff.verloren.map((e: { domain: string }) => e.domain)).toEqual(["weg.example"]);
        expect(diff.veraendert).toEqual([{ domain: "bleibt.example", vorher: 2, nachher: 5 }]);
    });

    it("meldet unveränderte Domains nicht als Veränderung", () => {
        const gleich = [{ domain: "a.example", verweisendeSeiten: 4, verlinkteSeiten: 1 }];
        expect(vergleiche(gleich, gleich).veraendert).toEqual([]);
    });

    it("rechnet über die Jahresgrenze zurück", () => {
        expect(vormonat("2026-01")).toBe("2025-12");
        expect(vormonat("2026-08")).toBe("2026-07");
    });

    it("sagt beim ersten Lauf, dass es keinen Vergleich gibt", () => {
        const bericht = baueBericht({
            monat: "2026-08",
            aktuell: [{ domain: "a.example", verweisendeSeiten: 1, verlinkteSeiten: 1 }],
            vorher: null,
            vorherMonat: "2026-07"
        }) as string;
        expect(bericht).toContain("Bestandsaufnahme");
        expect(bericht).not.toContain("## Neu gegenüber");
    });
});

describe("Zielliste", () => {
    const markdown = readFileSync(path.join(ROOT, "seo", "outreach.md"), "utf8");
    const { eintraege, kategorien, fehler } = parseOutreach(markdown) as {
        eintraege: { name: string; url: string; inhalt: string; kanal: string; status: string }[];
        kategorien: string[];
        fehler: string[];
    };

    it("hat keine Strukturfehler", () => {
        expect(fehler).toEqual([]);
    });

    it("enthält mindestens 40 Einträge", () => {
        expect(eintraege.length).toBeGreaterThanOrEqual(40);
    });

    it("deckt mehrere Kategorien ab", () => {
        expect(kategorien.length).toBeGreaterThanOrEqual(5);
    });

    it("nennt zu jedem Eintrag alle Pflichtangaben", () => {
        for (const eintrag of eintraege) {
            for (const feld of ["name", "url", "inhalt", "kanal", "status"] as const) {
                expect(eintrag[feld], `${eintrag.name}: ${feld}`).not.toBe("");
            }
            expect(STATUS_WERTE).toContain(eintrag.status);
        }
    });

    it("verweist nur auf Seiten, die es gibt", () => {
        // „/funkuebung-thw/" im Inhaltsfeld muss ein echter Slug sein.
        for (const eintrag of eintraege) {
            for (const treffer of eintrag.inhalt.matchAll(/\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)\//g)) {
                expect(slugs.has(treffer[1]), `${eintrag.name} nennt /${treffer[1]}/`).toBe(true);
            }
        }
    });

    it("sammelt keine Kontaktdaten von Privatpersonen", () => {
        // Die Prüfung sitzt im Parser; hier die Gegenprobe, dass sie greift.
        const erfunden = [
            "## Probe",
            `| ${PFLICHTSPALTEN.join(" | ")} |`,
            `|${PFLICHTSPALTEN.map(() => "---").join("|")}|`,
            "| Test | https://example.org/ | Grund | /faq/ | max.mustermann@gmx.de | offen |"
        ].join("\n");
        const ergebnis = parseOutreach(erfunden) as { fehler: string[] };
        expect(ergebnis.fehler.join(" ")).toMatch(/Privatperson/);
    });

    it("erkennt fehlende Spalten", () => {
        const kaputt = [
            "## Probe",
            `| ${PFLICHTSPALTEN.join(" | ")} |`,
            `|${PFLICHTSPALTEN.map(() => "---").join("|")}|`,
            "| Test | https://example.org/ | Grund | /faq/ | Formular |"
        ].join("\n");
        expect((parseOutreach(kaputt) as { fehler: string[] }).fehler.length).toBeGreaterThan(0);
    });

    it("liest die URL aus einer Markdown-Verlinkung", () => {
        expect(urlAus("[Text](https://example.org/pfad)")).toBe("https://example.org/pfad");
        expect(urlAus("https://example.org/")).toBe("https://example.org/");
        expect(urlAus("kein Link")).toBe("");
    });

    it("hält die Regeln der Ansprache fest", () => {
        expect(markdown).toContain("Kein Massenversand");
        expect(markdown).toMatch(/Kommentar-Links/);
        expect(markdown).toMatch(/Linkfarmen/);
        expect(markdown).toMatch(/verschickt wurde nichts/i);
    });
});

describe("Einbettbares Widget", () => {
    const zeilenFuer = (embed: { quelle: { seite: string; tabelle: number } }) => {
        const seite = (SITE_PAGES as { slug: string; source: string }[])
            .find(eintrag => eintrag.slug === embed.quelle.seite);
        const html = readFileSync(path.join(ROOT, "src", seite!.source), "utf8");
        return extractDefinedTerms(html, { tableIndex: embed.quelle.tabelle });
    };

    it.each(EMBEDS as { slug: string; ziel: string }[])("$slug verweist auf eine echte Seite", embed => {
        expect(slugs.has(embed.ziel)).toBe(true);
    });

    it.each(EMBEDS as { slug: string; quelle: { seite: string; tabelle: number } }[])(
        "$slug übernimmt alle Zeilen der Quelltabelle",
        embed => {
            const zeilen = zeilenFuer(embed);
            expect(zeilen.length).toBeGreaterThan(20);
            const html = renderEmbed(embed, zeilen) as string;
            for (const zeile of zeilen) {
                expect(html).toContain(`<th scope="row">${zeile.name}</th>`);
            }
        }
    );

    it("lädt nichts nach und führt kein Skript aus", () => {
        const embed = EMBEDS[0];
        const html = renderEmbed(embed, zeilenFuer(embed)) as string;
        expect(html).not.toContain("<script");
        expect(html).not.toContain("goatcounter");
        // Keine Verweise auf fremde Hosts außer dem eigenen Quellenlink.
        const fremde = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)]
            .map(treffer => treffer[1])
            .filter(url => !url.startsWith("https://sprechfunk-uebung.de/"));
        expect(fremde).toEqual([]);
    });

    it("bleibt für Suchmaschinen außen vor und zeigt auf die echte Seite", () => {
        const embed = EMBEDS[0];
        const html = renderEmbed(embed, zeilenFuer(embed)) as string;
        expect(html).toContain('<meta name="robots" content="noindex,follow">');
        expect(html).toContain(`<link rel="canonical" href="${zielUrl(embed)}">`);
    });

    it("bricht ab, statt ein leeres Widget auszuliefern", () => {
        expect(() => renderEmbed(EMBEDS[0], [])).toThrow(/keine Zeilen/);
    });

    it("sortiert die Buchstabiertafel in deutscher Reihenfolge", () => {
        const sortiert = sortiereZeilen(EMBEDS[0], [
            { name: "B", description: "Berta" },
            { name: "Ä", description: "Ärger" },
            { name: "A", description: "Anton" }
        ]) as { name: string }[];
        expect(sortiert.map(zeile => zeile.name)).toEqual(["A", "Ä", "B"]);
    });

    it("liefert einen Code, der den Quellenlink auf der fremden Seite trägt", () => {
        const embed = EMBEDS[0];
        const code = embedSnippet(embed) as string;
        expect(code).toContain(`<iframe src="${embedUrl(embed)}"`);
        // Der Link außerhalb des iframes ist der eigentliche Verweis.
        expect(code).toContain(`<a href="${zielUrl(embed)}">sprechfunk-uebung.de</a>`);
        // Ohne allow-scripts kann im Widget nichts laufen.
        expect(code).toContain("sandbox=");
        expect(code).not.toContain("allow-scripts");
    });
});

describe("Druckfertige Aushänge", () => {
    it("gibt es mindestens viermal", () => {
        expect(AUSHAENGE.length).toBeGreaterThanOrEqual(4);
    });

    it.each(AUSHAENGE as { slug: string; ziel: string; dateiname: string }[])(
        "$slug zeigt auf eine echte Seite und hat einen PDF-Namen",
        aushang => {
            expect(slugs.has(aushang.ziel)).toBe(true);
            expect(aushang.dateiname).toMatch(/^[a-z0-9-]+\.pdf$/);
            expect(aushangPfad(aushang)).toBe(`/downloads/${aushang.dateiname}`);
            expect(aushangUrl(aushang)).toBe(`https://sprechfunk-uebung.de/${aushang.ziel}/`);
        }
    );

    it("hat für jeden Aushang eine eindeutige Datei", () => {
        const namen = (AUSHAENGE as { dateiname: string }[]).map(a => a.dateiname);
        expect(new Set(namen).size).toBe(namen.length);
    });

    it("zeichnet den QR-Code mit Ruhezone und verschmolzenen Läufen", () => {
        const { rechtecke, groesse, modul } = qrRechtecke("https://sprechfunk-uebung.de/", {
            x: 0, y: 0, kante: 24
        }) as { rechtecke: { x: number; y: number; breite: number }[]; groesse: number; modul: number };

        expect(rechtecke.length).toBeGreaterThan(0);
        // Weniger Rechtecke als dunkle Module: es wird tatsächlich verschmolzen.
        expect(rechtecke.length).toBeLessThan(groesse * groesse);
        // Vier Module Ruhezone: nichts wird links oben angeschnitten.
        for (const feld of rechtecke) {
            expect(feld.x).toBeGreaterThanOrEqual(4 * modul - 1e-9);
            expect(feld.y).toBeGreaterThanOrEqual(4 * modul - 1e-9);
            expect(feld.x + feld.breite).toBeLessThanOrEqual(24 - 4 * modul + 1e-9);
        }
    });

    it("wird beim Build erzeugt", () => {
        // Nur prüfen, wenn gebaut wurde – der reine Unit-Lauf braucht kein dist.
        const dist = path.join(ROOT, "dist", "downloads");
        if (!existsSync(dist)) return;
        for (const aushang of AUSHAENGE as { dateiname: string }[]) {
            const datei = path.join(dist, aushang.dateiname);
            expect(existsSync(datei), `${aushang.dateiname} fehlt in dist/downloads`).toBe(true);
            expect(readFileSync(datei).subarray(0, 5).toString()).toBe("%PDF-");
        }
    });
});

describe("Beitragen", () => {
    it("beschreibt Format, Ordner und Registry-Eintrag", () => {
        const text = readFileSync(path.join(ROOT, "CONTRIBUTING.md"), "utf8");
        expect(text).toContain("Funksprüche beitragen");
        expect(text).toContain("assets/funksprueche/");
        expect(text).toContain("funkspruch-daten.mjs");
        expect(text).toMatch(/ein Funkspruch je Zeile/i);
        expect(text).toMatch(/keine echten personenbezogenen daten/i);
    });

    it("hat eine Issue-Vorlage, die die Zustimmung zur Nennung abfragt", () => {
        const vorlage = readFileSync(
            path.join(ROOT, ".github", "ISSUE_TEMPLATE", "funksprueche.yml"), "utf8"
        );
        expect(vorlage).toContain("name: Neue Funksprüche");
        expect(vorlage).toContain("CONTRIBUTORS.md");
        // Die Nennung ist optional; die Datenschutz-Zusicherungen sind Pflicht.
        expect(vorlage).toMatch(/id: nennung\n[\s\S]*?required: false/);
        expect(vorlage).toMatch(/id: pruefung\n[\s\S]*?required: true/);
    });

    it("nennt Beitragende nur mit Zustimmung", () => {
        const text = readFileSync(path.join(ROOT, "CONTRIBUTORS.md"), "utf8");
        expect(text).toMatch(/nur, wer ausdrücklich zugestimmt hat/i);
        expect(text).toContain("CONTRIBUTING.md");
    });
});
