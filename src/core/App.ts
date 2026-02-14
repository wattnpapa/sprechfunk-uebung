import { initUebungsleitung } from "../uebungsleitung";
import { initTeilnehmer } from "../teilnehmer";
import { router } from "./router";
import { store } from "../state/store";
import { GeneratorController } from "../generator";
import { admin } from "../admin/index";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "../firebase-config.js";
import { connectFirestoreEmulator, getFirestore, Firestore } from "firebase/firestore";
import { NatoClock } from "./NatoClock";
import { ThemeManager } from "./ThemeManager";
import { AppView } from "./AppView";
import pdfGenerator from "../services/pdfGenerator";

export class App {
    private appView: AppView;
    private natoClock: NatoClock;
    private themeManager: ThemeManager;
    private db: Firestore | null = null;

    constructor() {
        this.appView = new AppView();
        this.natoClock = new NatoClock();
        this.themeManager = new ThemeManager();
    }

    public init(): void {
        // 1. Initialize Firebase
        const firebaseApp = initializeApp(firebaseConfig);
        this.db = getFirestore(firebaseApp);
        const shouldUseEmulator = (() => {
            const search = window.location?.search ?? "";
            const byQuery = new URLSearchParams(search).get("emulator") === "1";
            let byStorage = false;
            try {
                byStorage = window.localStorage.getItem("useFirestoreEmulator") === "1";
            } catch {
                byStorage = false;
            }
            return byQuery || byStorage;
        })();
        if (shouldUseEmulator) {
            connectFirestoreEmulator(this.db, "127.0.0.1", 8080);
        }
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
        (window as any).pdfGenerator = pdfGenerator;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).admin = admin;
    }
}
