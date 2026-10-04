// Zentrale Chart.js-Registrierung.
//
// "chart.js/auto" bzw. Chart.register(...registerables) zieht saemtliche
// Controller (pie, doughnut, radar, polarArea, bubble, line) samt Scales und
// Plugins ins Bundle, obwohl die Anwendung nur Balken- und Streudiagramme
// zeichnet. Deshalb registriert dieses Modul genau die genutzten Bausteine und
// alle Aufrufer importieren Chart von hier statt direkt aus "chart.js".
import {
    BarController,
    BarElement,
    CategoryScale,
    Chart,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    ScatterController,
    Title,
    Tooltip
} from "chart.js";

Chart.register(
    BarController,
    ScatterController,
    BarElement,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Legend,
    Title,
    Tooltip
);

/** Rollen-Token aus src/styles/main.css, die Diagramme brauchen. */
export interface ThemeFarben {
    text: string;
    text2: string;
    linie: string;
    akzent: string;
    akzentHell: string;
    gut: string;
    warn: string;
}

const FALLBACK: ThemeFarben = {
    text: "#11141b",
    text2: "#5c6478",
    linie: "#d7dce7",
    akzent: "#12275e",
    akzentHell: "#1d3d8f",
    gut: "#146b3a",
    warn: "#6d4700"
};

/**
 * Chart.js zeichnet auf Canvas und kann keine CSS-Variablen lesen. Diese
 * Funktion löst die Rollen-Token des aktuellen Themes auf, damit Diagramme
 * dieselben Farben tragen wie die übrige Oberfläche.
 */
export function themeFarben(): ThemeFarben {
    if (typeof document === "undefined" || typeof window === "undefined" || !document.body) {
        return { ...FALLBACK };
    }
    const stil = window.getComputedStyle(document.body);
    const token = (name: string, fallback: string) => stil.getPropertyValue(name).trim() || fallback;
    return {
        text: token("--text", FALLBACK.text),
        text2: token("--text-2", FALLBACK.text2),
        linie: token("--linie-fein", FALLBACK.linie),
        akzent: token("--akzent", FALLBACK.akzent),
        akzentHell: token("--akzent-hell", FALLBACK.akzentHell),
        gut: token("--gut", FALLBACK.gut),
        warn: token("--warn-text", FALLBACK.warn)
    };
}

let themeBeobachter: MutationObserver | null = null;

/**
 * Setzt Text- und Rasterfarbe aller Diagramme aus dem aktuellen Theme und
 * zeichnet bei jedem Theme-Wechsel alle offenen Diagramme neu. Ohne das
 * liefen Generator-Statistik und Übungsleitungs-Zeitleiste auf den
 * Chart.js-Standardfarben, die auf dunklem Grund kaum lesbar sind
 * (THW-Review 2026-10-04, Night-Visibility Befund 3).
 *
 * Diagramme mit eigenen Farben (Admin-Statistik) behalten diese. Datensätze,
 * die ihre Farbe als Funktion `() => themeFarben().…` angeben, folgen dem
 * Wechsel ebenfalls.
 */
export function wendeChartThemeAn(): void {
    const farben = themeFarben();
    Chart.defaults.color = farben.text2;
    Chart.defaults.borderColor = farben.linie;
    Object.values(Chart.instances).forEach(instanz => instanz.update("none"));
}

/** Einmalig beim Start: Farben setzen und Theme-Wechsel beobachten. */
export function initChartTheme(): void {
    wendeChartThemeAn();
    if (themeBeobachter || typeof MutationObserver === "undefined" || typeof document === "undefined" || !document.body) {
        return;
    }
    themeBeobachter = new MutationObserver(() => wendeChartThemeAn());
    themeBeobachter.observe(document.body, { attributeFilter: ["data-theme"] });
}

export { Chart };
