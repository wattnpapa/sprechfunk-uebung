/**
 * Reine Hilfsfunktionen rund um Firestore-Dokumente: Fehlerklassifikation,
 * Bereinigung vor dem Schreiben und die denormalisierten Statistikfelder.
 */

function kleinText(wert: unknown): string {
    return typeof wert === "string" ? wert.toLowerCase() : "";
}

function enthaeltIndexHinweis(text: string): boolean {
    return text.includes("requires an index") || text.includes("create_composite");
}

/** Erkennt den Fehler einer Query, für die Firestore einen zusammengesetzten Index verlangt. */
export function isMissingIndexError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    const maybe = error as { code?: string; message?: string; customData?: { serverResponse?: string } };
    const code = typeof maybe.code === "string" ? maybe.code : "";
    if (code === "failed-precondition" || code.endsWith("/failed-precondition")) {
        return true;
    }
    if (enthaeltIndexHinweis(kleinText(maybe.message))) {
        return true;
    }
    return enthaeltIndexHinweis(kleinText(maybe.customData?.serverResponse));
}

export function hasNonEmptyRecord(val: unknown): boolean {
    if (!val || typeof val !== "object") {
        return false;
    }
    return Object.keys(val as Record<string, unknown>).length > 0;
}

export function extractDatum(rohwert: unknown): Date | undefined {
    if (!rohwert) {
        return undefined;
    }
    const maybeTimestamp = rohwert as { toDate?: () => Date };
    const datum = typeof maybeTimestamp.toDate === "function"
        ? maybeTimestamp.toDate()
        : new Date(rohwert as string | number | Date);
    if (!(datum instanceof Date) || isNaN(datum.getTime())) {
        return undefined;
    }
    return datum;
}

function cleanupRecordKeys(obj: unknown): Record<string, unknown> {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        return {};
    }
    return Object.fromEntries(
        Object.entries(obj).filter(([key, value]) => String(key).trim() !== "" && value !== undefined)
    );
}

/** Summe der Nachrichtenlisten eines `nachrichten`-Records. */
export function zaehleNachrichten(nachrichten: Record<string, unknown>): number {
    let anzahl = 0;
    Object.values(nachrichten).forEach(msgs => {
        if (Array.isArray(msgs)) {
            anzahl += msgs.length;
        }
    });
    return anzahl;
}

/**
 * Denormalisierte Kennzahlen, damit das Admin-Dashboard über
 * Aggregations-Queries auswerten kann, statt jedes Dokument zu laden.
 * Werden bei jedem Speichern neu berechnet.
 */
function buildStatistikFelder(cleaned: Record<string, unknown>): Record<string, unknown> {
    const teilnehmerListe = Array.isArray(cleaned["teilnehmerListe"]) ? cleaned["teilnehmerListe"] : [];
    const nachrichten = (cleaned["nachrichten"] || {}) as Record<string, unknown>;
    const datum = extractDatum(cleaned["datum"]);

    return {
        statTeilnehmerAnzahl: teilnehmerListe.length,
        statNachrichtenAnzahl: zaehleNachrichten(nachrichten),
        // Grobe Schätzung der Dokumentgröße, wie bisher im Admin-Dashboard ausgewiesen.
        statBytes: JSON.stringify(cleaned).length,
        statHatLoesungswoerter: hasNonEmptyRecord(cleaned["loesungswoerter"]),
        statHatLoesungsStaerken: hasNonEmptyRecord(cleaned["loesungsStaerken"]),
        statHatBuchstabieren: Number(cleaned["buchstabierenAn"] || 0) > 0,
        // undefined bei unlesbarem Datum -> Feld wird verworfen, Übung taucht
        // dann nicht im Monatsdiagramm auf.
        statMonat: datum?.getMonth(),
        statJahr: datum?.getFullYear()
    };
}

/**
 * Bereitet ein Übungsdokument für Firestore auf: keine leeren Schlüssel, keine
 * `undefined`-Felder, normalisierte Teilnehmerliste und Übungscode sowie die
 * Statistikfelder.
 */
export function sanitizeDataForSave(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== "object") {
        return {};
    }

    const cleaned = { ...data } as Record<string, unknown>;
    const teilnehmerListe = Array.isArray(cleaned["teilnehmerListe"])
        ? (cleaned["teilnehmerListe"] as unknown[])
            .map(t => typeof t === "string" ? t.trim() : "")
            .filter((t): t is string => t.length > 0)
        : [];

    cleaned["teilnehmerListe"] = teilnehmerListe;
    cleaned["uebungCode"] = typeof cleaned["uebungCode"] === "string"
        ? cleaned["uebungCode"].trim().toUpperCase()
        : "";

    cleaned["nachrichten"] = cleanupRecordKeys(cleaned["nachrichten"]);
    cleaned["loesungsStaerken"] = cleanupRecordKeys(cleaned["loesungsStaerken"]);
    cleaned["loesungswoerter"] = cleanupRecordKeys(cleaned["loesungswoerter"]);
    cleaned["teilnehmerIds"] = cleanupRecordKeys(cleaned["teilnehmerIds"]);
    cleaned["teilnehmerStellen"] = cleanupRecordKeys(cleaned["teilnehmerStellen"]);

    Object.assign(cleaned, buildStatistikFelder(cleaned));

    Object.keys(cleaned).forEach(key => {
        if (cleaned[key] === undefined) {
            delete cleaned[key];
        }
    });

    return cleaned;
}
