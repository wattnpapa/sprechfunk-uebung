import { Uebung } from "../types/Uebung";
import { AppMode } from "../appModes";
import { Firestore } from "firebase/firestore";

export interface AppState {
    mode: AppMode;
    aktuelleUebung: Uebung | null;
    aktuelleUebungId: string | null;
    theme: "light" | "dark";
    db: Firestore | null;
}

type Listener = (state: AppState) => void;

class Store {
    private state: AppState = {
        mode: "generator",
        aktuelleUebung: null,
        aktuelleUebungId: null,
        theme: (localStorage.getItem("theme") as "light" | "dark") || "light",
        db: null
    };

    private listeners: Listener[] = [];

    getState(): AppState {
        return { ...this.state };
    }

    setState(patch: Partial<AppState>): void {
        this.state = { ...this.state, ...patch };
        this.notify();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify(): void {
        this.listeners.forEach(l => l(this.state));
    }
}

export const store = new Store();
