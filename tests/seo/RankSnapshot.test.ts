import { describe, expect, it } from "vitest";

import fixture from "./fixtures/gsc-searchanalytics.json";
import keywords from "../../seo/keywords.json";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reines JS-Hilfsmodul ohne Typdeklarationen, absichtlich .mjs
import {
    buildSnapshot,
    flattenKeywords,
    isoDatum,
    keywordsByGroup,
    parseSearchAnalyticsRows,
    resolveDateRange,
    summarizeTracked
} from "../../scripts/lib/seo-snapshot.mjs";

const SNAPSHOT_ZEILENFELDER = ["query", "page", "clicks", "impressions", "ctr", "position"];

describe("parseSearchAnalyticsRows", () => {
    it("bildet die API-Antwort auf genau die Snapshot-Felder ab", () => {
        const rows = parseSearchAnalyticsRows(fixture);

        // Die Zeile mit leerem keys-Array fällt weg: 7 Fixture-Zeilen -> 6 Zeilen.
        expect(rows).toHaveLength(6);
        for (const row of rows) {
            expect(Object.keys(row).sort()).toEqual([...SNAPSHOT_ZEILENFELDER].sort());
        }
        expect(rows[0]).toEqual({
            query: "funkübung",
            page: "https://sprechfunk-uebung.de/",
            clicks: 12,
            impressions: 300,
            ctr: 0.04,
            position: 8.4
        });
    });

    it("liefert eine leere Liste, wenn die Antwort keine Zeilen enthält", () => {
        expect(parseSearchAnalyticsRows({})).toEqual([]);
        expect(parseSearchAnalyticsRows({ rows: null })).toEqual([]);
    });

    it("wirft, wenn rows kein Array ist", () => {
        expect(() => parseSearchAnalyticsRows({ rows: "kaputt" })).toThrow(TypeError);
    });

    it("ersetzt fehlende Kennzahlen durch 0 statt NaN", () => {
        const rows = parseSearchAnalyticsRows({ rows: [{ keys: ["funkübung", "/"] }] });
        expect(rows[0]).toMatchObject({ clicks: 0, impressions: 0, ctr: 0, position: 0 });
    });
});

describe("keywordsByGroup", () => {
    it("übernimmt alle vier Gruppen aus seo/keywords.json", () => {
        const gruppen = keywordsByGroup(keywords);
        expect(Object.keys(gruppen)).toEqual(["primary", "secondary", "defensive", "competitors"]);
        expect(gruppen.primary).toContain("funkübung");
        expect(gruppen.primary).toHaveLength(8);
    });

    // Mehrfachzugehörigkeit wird mit einem erfundenen Begriff geprüft, nicht mit
    // einem echten Anbieter aus der Konfiguration: die Eigenschaft gehört dem
    // Code, nicht der Keyword-Liste, und der Test soll nicht brechen, wenn sich
    // die verfolgten Begriffe ändern.
    const MEHRFACH = {
        primary: ["funkübung"],
        secondary: [],
        defensive: ["beispiel-anbieter.example"],
        competitors: ["beispiel-anbieter.example"]
    };

    it("behält Keywords, die in mehreren Gruppen stehen, in jeder Gruppe", () => {
        const gruppen = keywordsByGroup(MEHRFACH);
        expect(gruppen.defensive).toContain("beispiel-anbieter.example");
        expect(gruppen.competitors).toContain("beispiel-anbieter.example");
    });

    it("kommt mit leeren Gruppen zurecht", () => {
        const gruppen = keywordsByGroup(keywords);
        expect(gruppen.competitors).toEqual([]);
    });

    it("bildet die Vereinigungsmenge ohne Duplikate", () => {
        const alle = flattenKeywords(MEHRFACH);
        expect(alle.has("beispiel-anbieter.example")).toBe(true);
        expect(alle.size).toBeLessThan(
            MEHRFACH.primary.length + MEHRFACH.secondary.length
            + MEHRFACH.defensive.length + MEHRFACH.competitors.length
        );
    });
});

describe("summarizeTracked", () => {
    const tracked = summarizeTracked(parseSearchAnalyticsRows(fixture), keywords);

    it("fasst ein Keyword über mehrere URLs zur besten Position zusammen", () => {
        const eintrag = tracked.primary.find(k => k.keyword === "funkübung");
        expect(eintrag).toMatchObject({
            found: true,
            position: 5.1,
            page: "https://sprechfunk-uebung.de/funkuebung-planen/",
            clicks: 15,
            impressions: 400
        });
    });

    it("berechnet die CTR aus den Summen neu, statt Zeilen-CTRs zu mitteln", () => {
        const eintrag = tracked.primary.find(k => k.keyword === "funkübung");
        // 15/400 = 0.0375; der Mittelwert der Zeilen-CTRs (0.04, 0.03) wäre 0.035.
        expect(eintrag.ctr).toBeCloseTo(0.0375, 10);
    });

    it("markiert Keywords ohne Impressionen als found:false statt sie zu verschweigen", () => {
        const ohneTreffer = tracked.primary.find(k => k.keyword === "funkübung generator");
        expect(ohneTreffer).toMatchObject({ found: false, position: null, page: null, clicks: 0 });
    });

    it("führt ein mehrfach zugeordnetes Keyword in beiden Gruppen mit denselben Werten", () => {
        // Eigene Gruppen statt der ausgelieferten Konfiguration: dort steht
        // bewusst kein Anbietername mehr.
        const eigene = summarizeTracked(parseSearchAnalyticsRows(fixture), {
            primary: [],
            secondary: [],
            defensive: ["beispiel-anbieter.example"],
            competitors: ["beispiel-anbieter.example"]
        });
        const defensiv = eigene.defensive.find(k => k.keyword === "beispiel-anbieter.example");
        const wettbewerb = eigene.competitors.find(k => k.keyword === "beispiel-anbieter.example");
        expect(defensiv.found).toBe(true);
        expect(wettbewerb).toEqual(defensiv);
    });

    it("sortiert Treffer vor Nicht-Treffer und nach Position", () => {
        const positionen = tracked.primary.filter(k => k.found).map(k => k.position);
        expect(positionen).toEqual([...positionen].sort((a, b) => a - b));
        const ersterOhneTreffer = tracked.primary.findIndex(k => !k.found);
        const letzterMitTreffer = tracked.primary.map(k => k.found).lastIndexOf(true);
        expect(letzterMitTreffer).toBeLessThan(ersterOhneTreffer);
    });

    it("ignoriert Suchanfragen, die nicht in der Keyword-Liste stehen", () => {
        const alleKeywords = Object.values(tracked).flat().map(k => k.keyword);
        expect(alleKeywords).not.toContain("nicht verfolgter begriff");
    });
});

describe("resolveDateRange", () => {
    it("liefert ein 28-Tage-Fenster mit drei Tagen Datennachlauf", () => {
        const range = resolveDateRange(new Date("2026-08-03T00:00:00Z"));
        expect(range).toEqual({ startDate: "2026-07-04", endDate: "2026-07-31" });
    });

    it("rechnet über Monatsgrenzen hinweg korrekt", () => {
        const range = resolveDateRange(new Date("2026-03-02T00:00:00Z"));
        expect(range).toEqual({ startDate: "2026-01-31", endDate: "2026-02-27" });
    });

    it("formatiert Daten als ISO YYYY-MM-DD", () => {
        expect(isoDatum(new Date("2026-08-03T22:15:00Z"))).toBe("2026-08-03");
    });
});

describe("buildSnapshot", () => {
    const snapshot = buildSnapshot({
        response: fixture,
        keywords,
        site: "sc-domain:sprechfunk-uebung.de",
        range: { startDate: "2026-07-04", endDate: "2026-07-31" },
        generatedAt: "2026-08-03T05:00:00.000Z"
    });

    it("schreibt Metadaten, Zeilen und Auswertung in eine Datei-Struktur", () => {
        expect(Object.keys(snapshot).sort())
            .toEqual(["generatedAt", "range", "rowCount", "rows", "site", "tracked"]);
        expect(snapshot.site).toBe("sc-domain:sprechfunk-uebung.de");
        expect(snapshot.range).toEqual({ startDate: "2026-07-04", endDate: "2026-07-31" });
    });

    it("hält rowCount und rows konsistent", () => {
        expect(snapshot.rowCount).toBe(snapshot.rows.length);
        expect(snapshot.rowCount).toBe(6);
    });

    it("ist als JSON serialisierbar und verlustfrei wieder lesbar", () => {
        expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    });
});
