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

export { Chart };
