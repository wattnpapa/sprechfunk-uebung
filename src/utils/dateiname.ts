const UMLAUTE: Record<string, string> = { Ä: "Ae", Ö: "Oe", Ü: "Ue", ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/**
 * Dateiname nur aus druckbarem ASCII. Mit Umlaut („Sprechfunkübung …“) kam
 * ein Blob-Download in Chromium als „download“ ohne Endung an (THW-Review
 * 2026-10-05, workflow, nicht prüfbar/Download). Umlaute werden
 * umschrieben, andere Akzente abgelegt, Zeichen, die Dateisysteme nicht
 * mögen, durch „-“ ersetzt.
 */
export function asciiDateiname(name: string, ersatz = "Datei"): string {
    const ascii = String(name ?? "")
        .replace(/[ÄÖÜäöüß]/g, z => UMLAUTE[z] ?? z)
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[–—]/g, "-")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/[/\\:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    return ascii || ersatz;
}
