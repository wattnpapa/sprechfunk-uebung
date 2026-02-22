// =========================
// UI / Theme / Header Logic
// =========================

import { initUebungsleitung } from "./uebungsleitung";
import { initTeilnehmer } from "./teilnehmer";
import { router } from "./core/router";
import { store } from "./state/store";
import { GeneratorController } from "./generator";
import { admin } from "./admin/index";
import { firebaseConfig } from "./firebase-config.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import pdfGenerator from "./services/pdfGenerator";
import "./core/select2-setup";
import { NatoClock } from "./core/NatoClock";
import { ThemeManager } from "./core/ThemeManager";
import { AppView } from "./core/AppView";
import { FooterView } from "./core/FooterView";
import { analytics } from "./services/analytics";
import { featureFlags } from "./services/featureFlags";
import { errorMonitoring } from "./services/errorMonitoring";
import { initFirebaseClient } from "./services/firebaseClient";
import { buildRouteChangePayload } from "./services/analyticsPayloads";

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
const footerView = new FooterView();
let appBuildVersion = "dev";

function getPageTitle(mode: string): string {
    switch (mode) {
        case "admin":
            return "Sprechfunkuebung - Admin";
        case "uebungsleitung":
            return "Sprechfunkuebung - Uebungsleitung";
        case "teilnehmer":
            return "Sprechfunkuebung - Teilnehmer";
        case "generator":
        default:
            return "Sprechfunkuebung - Generator";
    }
}

function updateSeoIndexing(mode: string, params: string[]): void {
    const robotsMeta = document.querySelector("meta[name=\"robots\"]");
    if (!robotsMeta) {
        return;
    }

    const shouldIndex = mode === "generator" && params.length === 0;
    robotsMeta.setAttribute(
        "content",
        shouldIndex
            ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
            : "noindex,nofollow,noarchive"
    );
}

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

    footerView.setVersion(appBuildVersion);
}

// Initialize Firebase
const db = initFirebaseClient(firebaseConfig);
featureFlags.init();
analytics.init(firebaseConfig.measurementId);
errorMonitoring.init({
    getMode: () => store.getState().mode,
    getVersion: () => appBuildVersion
});
store.setState({ db });

// Main Routing Logic
function handleRoute(): void {
    const { mode, params } = router.parseHash();
    const pageTitle = getPageTitle(mode);
    document.title = pageTitle;
    updateSeoIndexing(mode, params);
    analytics.trackPage(window.location?.hash || "#/", pageTitle);
    analytics.track("route_change", buildRouteChangePayload(mode, params));

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
        footerView.setUebungId(uebungId || "-");
        if (uebungId) {
            store.setState({ aktuelleUebungId: uebungId });
            initUebungsleitung(db);
        }
        return;
    }

    if (mode === "teilnehmer") {
        footerView.setUebungId(params[0] || "-");
        initTeilnehmer(db);
        return;
    }

    if (mode === "admin") {
        footerView.setUebungId("-");
        admin.setDb(db);
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
    footerView.bindAnalyticsConsent(
        () => analytics.isConsentGranted(),
        enabled => analytics.setConsent(enabled)
    );
    loadBuildVersion().finally(() => {
        // Start Routing
        handleRoute();
    });
});

router.subscribe(() => handleRoute());

// Expose globals for legacy/inline usage
window.pdfGenerator = pdfGenerator;
window.admin = admin;
