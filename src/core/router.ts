import { AppMode } from "./appModes";

export interface Route {
    mode: AppMode;
    params: string[];
}

type RouteListener = (route: Route) => void;

class Router {
    private listeners: RouteListener[] = [];

    constructor() {
        window.addEventListener("hashchange", () => this.handleHashChange());
    }

    private handleHashChange() {
        const route = this.parseHash();
        this.notify(route);
    }

    public parseHash(): Route {
        const hash = window.location.hash.replace(/^#\/?/, "");
        const parts = hash.split("/").filter(Boolean);
        
        const mode = (parts[0] as AppMode) || "generator";
        const params = parts.slice(1);

        return { mode, params };
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
