import type { NachrichtArt } from "../types/Nachricht";

/**
 * Beschriftung der Übermittlungsart. Leer, wenn die Übung ohne Kennzeichnung
 * generiert wurde – dann soll auch nichts angezeigt werden.
 */
export function nachrichtenArtLabel(art: NachrichtArt | undefined): string {
    switch (art) {
    case "spruch":
        return "Spruch";
    case "durchsage":
        return "Durchsage";
    default:
        return "";
    }
}

/**
 * Bootstrap-Badge-Klasse zur Art. Sprüche sind hervorgehoben, weil die
 * Gegenstelle sie mitschreiben muss.
 */
export function nachrichtenArtBadgeClass(art: NachrichtArt | undefined): string {
    return art === "spruch" ? "badge bg-primary" : "badge bg-secondary";
}
