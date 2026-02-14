// =========================
// UI / Theme / Header Logic
// =========================

import { initUebungsleitung } from "./uebungsleitung";
import { initTeilnehmer } from "./teilnehmer";
import { router } from "./core/router";
import { store } from "./state/store";
import { GeneratorController } from "./generator";
import { admin } from "./admin/index";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./firebase-config.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { getFirestore } from "firebase/firestore";
import pdfGenerator from "./services/pdfGenerator";
import "./core/select2-setup";
import { NatoClock } from "./core/NatoClock";
import { ThemeManager } from "./core/ThemeManager";
import { AppView } from "./core/AppView";

import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

declare global {
    interface Window {
        chart: Chart;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app: any; 
        pdfGenerator: typeof pdfGenerator;
        admin: typeof admin;
        $: typeof import("jquery");
        jQuery: typeof import("jquery");
    }
}

// Initialize Core Components
const appView = new AppView();
const natoClock = new NatoClock();
const themeManager = new ThemeManager();
let appBuildVersion = "dev";

async function loadBuildVersion(): Promise<void> {
    const isLocal = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
    if (isLocal) {
        appBuildVersion = "dev";
    } else {
        try {
            const response = await fetch("build.json");
            const data = await response.json();
            appBuildVersion = `${data.buildDate}-${data.runNumber}-${data.commit}`;
        } catch {
            appBuildVersion = "dev";
        }
    }

    const versionEl = document.getElementById("version");
    if (versionEl) {
        versionEl.textContent = appBuildVersion;
    }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
store.setState({ db });

// Main Routing Logic
function handleRoute(): void {
    const { mode, params } = router.parseHash();

    store.setState({ mode });

    if (!db) {
        console.warn("⚠️ DB noch nicht initialisiert");
        return;
    }

    // Update UI based on mode
    appView.applyAppMode(mode);

    // Dispatch to specific controllers
    if (mode === "uebungsleitung") {
        const uebungId = params[0];
        const idEl = document.getElementById("uebungsId");
        if (idEl) {
            idEl.textContent = uebungId || "-";
        }
        if (uebungId) {
            store.setState({ aktuelleUebungId: uebungId });
            initUebungsleitung(db);
        }
        return;
    }

    if (mode === "teilnehmer") {
        const idEl = document.getElementById("uebungsId");
        if (idEl) {
            idEl.textContent = params[0] || "-";
        }
        initTeilnehmer(db);
        return;
    }

    if (mode === "admin") {
        const idEl = document.getElementById("uebungsId");
        if (idEl) {
            idEl.textContent = "-";
        }
        admin.db = db;
        admin.ladeAlleUebungen();
        admin.renderUebungsStatistik();
        return;
    }

    // Fallback: Generator
    const generator = GeneratorController.getInstance();
    generator.handleRoute(params);
}

// Bootstrap Application
window.addEventListener("DOMContentLoaded", () => {
    natoClock.init();
    themeManager.init();
    appView.initModals();
    appView.initGlobalListeners();
    loadBuildVersion().finally(() => {
        // Start Routing
        handleRoute();
    });
});

router.subscribe(() => handleRoute());

// Expose globals for legacy/inline usage
window.pdfGenerator = pdfGenerator;
window.admin = admin;
