/**
 * Speichern mit ehrlichem Ergebnis bei schwachem Netz (THW-Review
 * 2026-10-05, offline P2-1).
 *
 * Firestore bricht ein `setDoc` nicht ab: Antwortet der Server nicht, bleibt
 * der Schreibvorgang in der Warteschlange des SDK und wird übertragen, sobald
 * die Verbindung zurückkommt – solange der Tab offen ist. Ein Zeitlimit, das
 * danach „nicht gespeichert, nichts verändert“ meldet, sagt deshalb mitunter
 * die Unwahrheit. Diese Funktion unterscheidet stattdessen:
 *
 * - `bestaetigt`: der Server hat das Speichern bestätigt.
 * - `ausstehend`: innerhalb des Zeitlimits kam keine Bestätigung. Das
 *   Schreiben kann später noch ankommen; `spaeter` erfüllt sich dann (oder
 *   scheitert endgültig). Die Oberfläche sollte „noch nicht bestätigt – wird
 *   ggf. nachgereicht“ sagen und auf `spaeter` reagieren.
 *
 * Ein Fehler, den der Server sofort meldet (z. B. Regeln), wird wie bisher
 * geworfen: dann ist sicher nichts gespeichert.
 */
export type SpeicherErgebnis =
    | { status: "bestaetigt" }
    | { status: "ausstehend"; spaeter: Promise<void> };

export async function speichereMitBestaetigung(
    speichern: () => Promise<void>,
    zeitlimitMs: number
): Promise<SpeicherErgebnis> {
    const schreiben = speichern();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ablauf = new Promise<"zeitlimit">(resolve => {
        timer = setTimeout(() => resolve("zeitlimit"), zeitlimitMs);
    });
    try {
        const sieger = await Promise.race([schreiben.then(() => "fertig" as const), ablauf]);
        if (sieger === "fertig") {
            return { status: "bestaetigt" };
        }
    } finally {
        clearTimeout(timer);
    }
    // Unbehandelte Ablehnung vermeiden, falls niemand auf `spaeter` hört.
    schreiben.catch(() => undefined);
    return { status: "ausstehend", spaeter: schreiben };
}
