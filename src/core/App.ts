import { initUebungsleitung } from "../uebungsleitung";
import { initTeilnehmer } from "../teilnehmer/init";
import { router } from "./router";
import { store } from "../state/store";
import { GeneratorController } from "../generator";
import { admin } from "../admin/index";
import { firebaseConfig } from "../firebase-config.js";
import type { Firestore } from "firebase/firestore";
import { NatoClock } from "./NatoClock";
import { ThemeManager } from "./ThemeManager";
import { AppView } from "./AppView";
import { AppMode } from "./appModes";
import { initFirebaseClient } from "../services/firebaseClient";

export class App {
    private appView: AppView;
    private natoClock: NatoClock;
    private themeManager: ThemeManager;
    private db: Firestore | null = null;
    /** Titel aus index.html – traegt die Suchbegriffe der Startseite. */
    private readonly startseitenTitel: string;

    constructor() {
        this.startseitenTitel = typeof document === "undefined" ? "" : document.title;
        this.appView = new AppView();
        this.natoClock = new NatoClock();
        this.themeManager = new ThemeManager();
    }

    public init(): void {
        // 1. Initialize Firebase
        this.db = initFirebaseClient(firebaseConfig);
        store.setState({ db: this.db });

        // 2. Initialize Core UI Components
        this.natoClock.init();
        this.themeManager.init();
        this.appView.initModals();
        this.appView.initGlobalListeners();

        // 3. Setup Router
        router.subscribe(() => this.handleRoute());
        
        // 4. Handle Initial Route
        this.handleRoute();

        // 5. Expose Globals (for legacy/inline HTML support)
        this.exposeGlobals();
    }

    private handleRoute(): void {
        const { mode, params } = router.parseHash();
        const pageTitle = this.getPageTitle(mode);
        this.setDocumentTitle(pageTitle);
        this.updateSeoIndexing(mode, params);
        store.setState({ mode });

        if (!this.db) {
            console.warn("⚠️ DB noch nicht initialisiert");
            return;
        }

        // Update UI visibility based on mode
        this.appView.applyAppMode(mode);

        // Dispatch to specific controllers
        switch (mode) {
            case "uebungsleitung": {
                const uebungId = params[0];
                if (uebungId) {
                    store.setState({ aktuelleUebungId: uebungId });
                    initUebungsleitung(this.db);
                }
                break;
            }

            case "teilnehmer": {
                initTeilnehmer(this.db);
                break;
            }

            case "admin": {
                admin.setDb(this.db);
                admin.ladeAlleUebungen();
                admin.renderUebungsStatistik();
                break;
            }

            case "generator":
            default: {
                const generator = GeneratorController.getInstance();
                generator.handleRoute(params);
                break;
            }
        }
    }

    private exposeGlobals(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).admin = admin;
    }

    private getPageTitle(mode: AppMode): string {
        switch (mode) {
            case "admin":
                return "Sprechfunkuebung - Admin";
            case "uebungsleitung":
                return "Sprechfunkuebung - Uebungsleitung";
            case "teilnehmer":
                return "Sprechfunkuebung - Teilnehmer";
            case "generator":
            default:
                // Die Generator-Ansicht ist die indexierbare Startseite: Ihr
                // Titel darf beim Routing nicht durch einen Arbeitstitel ersetzt
                // werden, sonst geht das Text-Matching der Suchmaschinen verloren.
                return this.startseitenTitel || "Sprechfunkuebung - Generator";
        }
    }

    private setDocumentTitle(title: string): void {
        if (typeof document === "undefined") {
            return;
        }
        document.title = title;
    }

    private updateSeoIndexing(mode: AppMode, params: string[]): void {
        if (typeof document === "undefined") {
            return;
        }

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
}
