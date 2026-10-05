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

/**
 * Beschriftung des Umschalters je Theme (identisch mit
 * src/core/ThemeManager.ts, tests/core/ThemeFarben.test.ts hält beides gleich).
 */
export const THEME_LABEL = {
    light: "🌙 Dark Mode",
    dark: "☀️ Light Mode",
    startrek: "🖖 Star Trek Theme"
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
 * Skript direkt hinter </header>: beschriftet die Umschalter passend zum
 * schon gesetzten Theme, bevor das Bundle lädt (THW-Review 2026-10-05,
 * Night Befund 6: bis dahin hieß der Knopf auf dunkler Seite „Dark Mode“),
 * hält die Beschriftung bei jedem Theme-Wechsel aktuell und bedient die
 * Umschalter der Inhaltsseiten (`data-theme-schalter`), die kein Bundle laden
 * (Night Befund 5). Die App-Knöpfe (#themeToggle) bedient der ThemeManager.
 */
export function themeSchalterSkript() {
    const farben = JSON.stringify(THEME_FARBEN);
    const label = JSON.stringify(THEME_LABEL);
    return "<script>(function(){try{"
        + "var f=" + farben + ",L=" + label + ",d=document,b=d.body;"
        + "function l(){var t=b.getAttribute(\"data-theme\"),n=d.querySelectorAll(\"#themeToggle,#themeToggleMobile,[data-theme-schalter]\");"
        + "for(var i=0;i<n.length;i++)n[i].textContent=L[t]||L.light;}"
        + "l();"
        + "var s=d.querySelectorAll(\"[data-theme-schalter]\");"
        + "for(var i=0;i<s.length;i++)s[i].addEventListener(\"click\",function(){"
        + "var t=b.getAttribute(\"data-theme\")===\"dark\"?\"light\":\"dark\";"
        + "try{localStorage.setItem(\"theme\",t);}catch(e){}"
        + "b.setAttribute(\"data-theme\",t);"
        + "var m=d.querySelector('meta[name=\"theme-color\"]');if(m)m.setAttribute(\"content\",f[t]);});"
        + "if(window.MutationObserver)new MutationObserver(l).observe(b,{attributes:true,attributeFilter:[\"data-theme\"]});"
        + "}catch(e){}})();</script>";
}

/** Umschalter für Inhaltsseiten: Desktop in der Kopfleiste, mobil an der Stelle des Menüknopfs. */
const SCHALTER_DESKTOP = `<button type="button" class="btn btn-outline-secondary" data-theme-schalter data-testid="theme-toggle-seite">${THEME_LABEL.light}</button>`;
const SCHALTER_MOBIL = `<div class="app-header-burger d-md-none"><button type="button" class="btn btn-outline-secondary" data-theme-schalter data-testid="theme-toggle-seite-mobil">${THEME_LABEL.light}</button></div>`;

/**
 * Inhaltsseiten haben keinen Theme-Umschalter; die App bringt ihren eigenen
 * mit (#themeToggle). Eingesetzt wird er ans Ende der Kopfleisten-Aktionen.
 */
export function setzeThemeSchalter(html) {
    if (html.includes('id="themeToggle"') || html.includes("data-theme-schalter")) {
        return html;
    }
    const aktionen = /(<div class="app-header-actions[^"]*">)([\s\S]*?)(\n\s*<\/div>)/;
    if (!aktionen.test(html)) {
        return html;
    }
    return html.replace(aktionen, (_ganz, auf, inhalt, zu) =>
        `${auf}${inhalt}\n            ${SCHALTER_DESKTOP}${zu}\n        ${SCHALTER_MOBIL}`);
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
    const mitSkript = setzeThemeSchalter(html)
        .replace(ALTES_SNIPPET, "")
        .replace(/<meta name="theme-color" content="[^"]*">/i,
            `<meta name="theme-color" content="${THEME_FARBEN.light}">`)
        .replace(body, (ganz) => `${ganz}\n${fruehesThemaSkript()}`);
    // Ohne Kopfzeile (Einbett-Widget o. Ä.) gibt es keinen Umschalter.
    return mitSkript.includes("</header>")
        ? mitSkript.replace("</header>", `</header>\n${themeSchalterSkript()}`)
        : mitSkript;
}
