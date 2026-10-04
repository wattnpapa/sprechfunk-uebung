import { AppMode } from "./appModes";

export interface Route {
    mode: AppMode;
    params: string[];
}

type RouteListener = (route: Route) => void;

const MODI: readonly AppMode[] = ["generator", "admin", "uebungsleitung", "teilnehmer"];

const istModus = (wert: string | undefined): wert is AppMode =>
    wert !== undefined && (MODI as readonly string[]).includes(wert);

/**
 * Ist der Hash eine Route der App oder nur eine Sprungmarke im Dokument?
 *
 * Routen beginnen mit „#/“ (so erzeugt sie die App überall). Ohne Schrägstrich
 * gilt ein Hash nur dann als Route, wenn er mit einem bekannten Modus beginnt
 * und Parameter trägt („#teilnehmer/id/code“, ältere Links). Alles andere –
 * etwa „#kopfdaten“ oder „#teilnehmer“ aus einem Inhaltsverzeichnis – ist eine
 * Sprungmarke und darf die Ansicht nicht umschalten (THW-Review 2026-10-04, B4).
 */
export function istRoutenHash(hash: string): boolean {
    if (hash === "" || hash === "#") {
        return true;
    }
    if (hash.startsWith("#/")) {
        return true;
    }
    const ohneRaute = hash.replace(/^#/, "");
    const [erster, ...rest] = ohneRaute.split("?")[0]?.split("/") ?? [];
    return istModus(erster) && rest.some(Boolean);
}

class Router {
    private listeners: RouteListener[] = [];
    /** Zuletzt gemeldete Route; Sprungmarken lassen sie stehen. */
    private letzteRoute: Route | null = null;

    constructor() {
        // Ohne window (Build-Skripte, Tests der Seitengenerierung) gibt es nichts zu beobachten.
        if (typeof window === "undefined") {
            return;
        }
        window.addEventListener("hashchange", () => this.handleHashChange());
    }

    private handleHashChange() {
        if (!istRoutenHash(window.location.hash)) {
            // Sprungmarke: der Browser scrollt selbst, die Ansicht bleibt.
            return;
        }
        const route = this.parseHash();
        this.notify(route);
    }

    public parseHash(): Route {
        const hash = window.location.hash;
        if (!istRoutenHash(hash)) {
            return this.letzteRoute ?? { mode: "generator", params: [] };
        }
        const pfad = hash.replace(/^#\/?/, "");
        const [pathPart] = pfad.split("?");
        const parts = (pathPart || "").split("/").filter(Boolean);

        // Unbekannte Modi zeigen den Generator statt einer leeren Seite.
        const mode: AppMode = istModus(parts[0]) ? parts[0] : "generator";
        const params = istModus(parts[0]) ? parts.slice(1) : [];

        const route = { mode, params };
        this.letzteRoute = route;
        return route;
    }

    public subscribe(listener: RouteListener): () => void {
        this.listeners.push(listener);
        // Sofort einmal aufrufen für den initialen Zustand
        listener(this.parseHash());
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify(route: Route): void {
        this.listeners.forEach(l => l(route));
    }

    public navigate(mode: AppMode, ...params: string[]) {
        window.location.hash = `#/${mode}${params.length ? "/" + params.join("/") : ""}`;
    }
}

export const router = new Router();
