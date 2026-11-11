import type { NachrichtArt } from "../types/Nachricht";

/**
 * Beschriftung der Nachrichtenart. Leer, wenn die Übung ohne Kennzeichnung
 * generiert wurde – dann soll auch nichts angezeigt werden.
 */
export function nachrichtenArtLabel(art: NachrichtArt | undefined): string {
    switch (art) {
    case "durchsage":
        return "Durchsage";
    case "gespraech":
        return "Gespräch";
    default:
        return "";
    }
}

/**
 * Bootstrap-Badge-Klasse zur Art. Durchsagen sind hervorgehoben, weil die
 * Gegenstelle sie mitschreiben muss.
 */
export function nachrichtenArtBadgeClass(art: NachrichtArt | undefined): string {
    return art === "durchsage" ? "badge bg-primary" : "badge bg-secondary";
}
