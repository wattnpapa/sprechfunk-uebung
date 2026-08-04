// Ableitungen für die seitenindividuellen Social-Preview-Bilder (AP-10).
//
// Reine Funktionen ohne Datei- und Browserzugriff: das Rendern macht
// scripts/generate-og-images.mjs, das Einsetzen der Meta-Tags
// scripts/lib/render-page.mjs. So prüft der Test dieselbe Ableitung, die
// Erzeugung und Auslieferung verwenden – sonst zeigten die Tags irgendwann
// auf Dateien, die anders heißen.

/** Verzeichnis der Bilder, relativ zur Domainwurzel. */
export const OG_VERZEICHNIS = "assets/og";

/**
 * Dateiname je Seite. Schrägstriche verschachtelter Slugs werden zu
 * Bindestrichen, damit alle Bilder in einem flachen Verzeichnis liegen und
 * kein Slug versehentlich ein Unterverzeichnis anlegt.
 *
 * JPEG, nicht PNG: die Vorlage hat einen Farbverlauf, den PNG verlustfrei
 * speichern muss – als PNG wog jedes Bild rund 320 KB und damit weit über der
 * Grenze von 200 KB. Transparenz braucht ein Social-Preview nicht.
 */
export function ogDateiname(slug) {
    const basis = slug === "" ? "start" : String(slug).replaceAll("/", "-");
    return `${basis}.jpg`;
}

/** Absolute URL des Bildes, wie sie in og:image gehört. */
export function ogUrl(slug, siteUrl) {
    return `${siteUrl}/${OG_VERZEICHNIS}/${ogDateiname(slug)}`;
}

/**
 * Die Kategoriezeile über dem Titel. Sie beantwortet „wo bin ich“ und
 * unterscheidet die Bilder auch dann, wenn zwei Titel ähnlich anfangen.
 *
 * Reihenfolge der Herleitung: ausdrückliche Angabe, dann Hub-Kategorie, dann
 * Rechtstext, sonst der Markenbegriff. Geraten wird nichts.
 */
export function ogKicker(page, hubKategorien = []) {
    if (page.ogKicker) return page.ogKicker;
    if (page.slug === "") return "BOS-Sprechfunk";
    if (page.inSitemap === false) return "Rechtliches";
    if (page.hubCategory) {
        const kategorie = hubKategorien.find(eintrag => eintrag.key === page.hubCategory);
        if (kategorie) return kategorie.label;
    }
    return "Sprechfunk-Wissen";
}
