// Reine Transformationslogik für die SEO-Rang-Snapshots (AP-00).
// Bewusst ohne Netzwerk-, Datei- und Auth-Zugriff, damit die Abbildung
// "Search-Console-Antwort -> Snapshot-Schema" per Vitest testbar bleibt.
// Der ausführende Teil liegt in scripts/seo-rank-snapshot.mjs.

/** Gruppen aus seo/keywords.json. `competitors` ist keine eigene Ranking-Absicht,
 *  sondern Beobachtung — ein Keyword darf bewusst in mehreren Gruppen stehen. */
export const KEYWORD_GROUPS = ["primary", "secondary", "defensive", "competitors"];

/** Search Console liefert Suchanfragen kleingeschrieben. Für den Abgleich mit
 *  der Keyword-Liste beide Seiten gleich normalisieren. */
export function normalizeQuery(query) {
    return String(query ?? "").trim().toLocaleLowerCase("de-DE");
}

/**
 * Normalisierte Keywords je Gruppe, Duplikate innerhalb einer Gruppe entfernt.
 * Mehrfachzugehörigkeit bleibt erhalten: ein Begriff kann in `defensive` und in
 * `competitors` stehen und muss dann in beiden Auswertungen auftauchen.
 * Leere Gruppen sind zulässig.
 */
export function keywordsByGroup(keywords = {}) {
    const ergebnis = {};
    for (const gruppe of KEYWORD_GROUPS) {
        const liste = Array.isArray(keywords[gruppe]) ? keywords[gruppe] : [];
        const gesehen = new Set();
        ergebnis[gruppe] = [];
        for (const keyword of liste) {
            const norm = normalizeQuery(keyword);
            if (norm && !gesehen.has(norm)) {
                gesehen.add(norm);
                ergebnis[gruppe].push(norm);
            }
        }
    }
    return ergebnis;
}

/** Menge aller verfolgten Keywords über alle Gruppen hinweg. */
export function flattenKeywords(keywords = {}) {
    const alle = new Set();
    for (const liste of Object.values(keywordsByGroup(keywords))) {
        for (const keyword of liste) alle.add(keyword);
    }
    return alle;
}

function zahl(wert) {
    const n = Number(wert);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Bildet die Rohantwort von `searchAnalytics/query` (Dimensionen query + page)
 * auf das Snapshot-Zeilenschema ab: query, page, clicks, impressions, ctr, position.
 * Zeilen ohne Suchanfrage werden verworfen — ohne query ist die Zeile für das
 * Ranking-Monitoring wertlos.
 */
export function parseSearchAnalyticsRows(response) {
    const rows = response?.rows;
    if (rows === undefined || rows === null) return [];
    if (!Array.isArray(rows)) {
        throw new TypeError("Search-Console-Antwort: 'rows' ist kein Array.");
    }

    return rows
        .map(row => {
            const [query, page] = Array.isArray(row?.keys) ? row.keys : [];
            return {
                query: String(query ?? ""),
                page: String(page ?? ""),
                clicks: zahl(row?.clicks),
                impressions: zahl(row?.impressions),
                ctr: zahl(row?.ctr),
                position: zahl(row?.position)
            };
        })
        .filter(row => row.query !== "");
}

/**
 * Verdichtet die Zeilen je Suchanfrage. Ein Keyword kann über mehrere URLs
 * ranken; `position` ist dann die beste (niedrigste) Position, clicks und
 * impressions werden summiert und die CTR daraus neu berechnet — die CTR der
 * Einzelzeilen darf man nicht mitteln.
 */
function aggregateByQuery(rows, verfolgte) {
    const treffer = new Map();
    for (const row of rows) {
        const norm = normalizeQuery(row.query);
        if (!verfolgte.has(norm)) continue;

        const vorhanden = treffer.get(norm);
        if (!vorhanden) {
            treffer.set(norm, {
                position: row.position,
                page: row.page,
                clicks: row.clicks,
                impressions: row.impressions
            });
            continue;
        }
        vorhanden.clicks += row.clicks;
        vorhanden.impressions += row.impressions;
        if (row.position < vorhanden.position) {
            vorhanden.position = row.position;
            vorhanden.page = row.page;
        }
    }
    return treffer;
}

/** Auswertung je Gruppe: beste Position, Summen und neu berechnete CTR. */
export function summarizeTracked(rows, keywords) {
    const gruppen = keywordsByGroup(keywords);
    const treffer = aggregateByQuery(rows, flattenKeywords(keywords));

    const zusammenfassung = {};
    for (const gruppe of KEYWORD_GROUPS) {
        zusammenfassung[gruppe] = gruppen[gruppe]
            .map(keyword => {
                const t = treffer.get(keyword);
                // Kein Treffer heißt: in den letzten 28 Tagen keine Impression in
                // der Search Console. Das ist ein Messergebnis, keine fehlende
                // Messung — darum explizit found:false statt die Zeile weglassen.
                if (!t) {
                    return {
                        keyword, found: false, position: null, page: null,
                        clicks: 0, impressions: 0, ctr: 0
                    };
                }
                return {
                    keyword,
                    found: true,
                    position: t.position,
                    page: t.page,
                    clicks: t.clicks,
                    impressions: t.impressions,
                    ctr: t.impressions > 0 ? t.clicks / t.impressions : 0
                };
            })
            .sort((a, b) => {
                if (a.found !== b.found) return a.found ? -1 : 1;
                if (a.found && b.found) return a.position - b.position;
                return a.keyword.localeCompare(b.keyword, "de-DE");
            });
    }
    return zusammenfassung;
}

/** Ermittelt Start- und Enddatum. Search-Console-Daten haben einen Nachlauf von
 *  rund drei Tagen; ohne diesen Versatz enthielte das Fenster leere Tage. */
export function resolveDateRange(heute, { lagDays = 3, windowDays = 28 } = {}) {
    const ende = new Date(heute.getTime());
    ende.setUTCDate(ende.getUTCDate() - lagDays);
    const start = new Date(ende.getTime());
    start.setUTCDate(start.getUTCDate() - (windowDays - 1));
    return { startDate: isoDatum(start), endDate: isoDatum(ende) };
}

/** ISO-Datum YYYY-MM-DD in UTC — auch der Dateiname der Snapshots. */
export function isoDatum(datum) {
    return datum.toISOString().slice(0, 10);
}

/**
 * Setzt den vollständigen Snapshot zusammen, wie er unter
 * seo/snapshots/YYYY-MM-DD.json landet.
 */
export function buildSnapshot({ response, keywords, site, range, generatedAt }) {
    const rows = parseSearchAnalyticsRows(response);
    return {
        generatedAt,
        site,
        range,
        rowCount: rows.length,
        rows,
        tracked: summarizeTracked(rows, keywords)
    };
}
