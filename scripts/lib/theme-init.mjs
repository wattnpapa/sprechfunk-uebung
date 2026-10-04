// Theme vor dem ersten Bild setzen (THW-Review 2026-10-04, B5).
//
// Vorher stand auf jeder Seite <body data-theme="light">; die App setzte das
// gespeicherte Theme erst aus dem Modul-Bundle, die Inhaltsseiten erst bei
// DOMContentLoaded und nur, wenn etwas gespeichert war. Folge: ein heller
// Blitz bei jedem Laden, und Inhaltsseiten ignorierten das dunkle
// System-Theme. Ein kleines Inline-Skript direkt hinter <body> läuft, bevor
// irgendetwas gezeichnet wird, und gilt für App und Inhaltsseiten gleich.
//
// Regel (identisch mit src/core/ThemeManager.ts): Eine eigene Wahl im
// localStorage hat Vorrang; ohne sie gilt das System-Theme und folgt dessen
// Wechseln.

/**
 * Farbe der Browser-Adressleiste je Theme = Kopfbalken (--kopf-fond in
 * src/styles/main.css). tests/core/ThemeFarben.test.ts hält beides gleich.
 */
export const THEME_FARBEN = {
    light: "#12275e",
    dark: "#0e1526",
    startrek: "#000000"
};

/** Altes Snippet der Inhaltsseiten, das durch das frühe Skript ersetzt wird. */
const ALTES_SNIPPET = /\s*<script>\s*\/\/ Gleiche Theme-Auswahl wie in der App anwenden[\s\S]*?<\/script>/;

/** Das Inline-Skript; bewusst ES5 und ohne Abhängigkeiten. */
export function fruehesThemaSkript() {
    const farben = JSON.stringify(THEME_FARBEN);
    return "<script>(function(){try{"
        + "var f=" + farben + ",d=document,b=d.body,g=null;"
        + "try{g=localStorage.getItem(\"theme\");}catch(e){}"
        + "var mq=window.matchMedia?window.matchMedia(\"(prefers-color-scheme: dark)\"):null;"
        + "function s(t){b.setAttribute(\"data-theme\",t);"
        + "var m=d.querySelector('meta[name=\"theme-color\"]');if(m&&f[t])m.setAttribute(\"content\",f[t]);}"
        + "s(f.hasOwnProperty(g)?g:(mq&&mq.matches?\"dark\":\"light\"));"
        + "if(mq&&mq.addEventListener)mq.addEventListener(\"change\",function(e){"
        + "var j=null;try{j=localStorage.getItem(\"theme\");}catch(x){}"
        + "if(!f.hasOwnProperty(j))s(e.matches?\"dark\":\"light\");});"
        + "}catch(e){}})();</script>";
}

/**
 * Setzt das frühe Theme-Skript als erstes Element in <body>, entfernt das alte
 * DOMContentLoaded-Snippet und stellt die Grundfarbe der Adressleiste auf den
 * hellen Kopfbalken.
 */
export function setzeFruehesThema(html) {
    const body = /<body([^>]*)>/i;
    if (!body.test(html)) {
        throw new Error("Kein <body> für das Theme-Skript gefunden.");
    }
    return html
        .replace(ALTES_SNIPPET, "")
        .replace(/<meta name="theme-color" content="[^"]*">/i,
            `<meta name="theme-color" content="${THEME_FARBEN.light}">`)
        .replace(body, (ganz) => `${ganz}\n${fruehesThemaSkript()}`);
}
