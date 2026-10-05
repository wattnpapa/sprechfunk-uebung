import type { AppMode } from "./appModes";
import type { Route } from "./router";

interface RoutenQuelle {
    subscribe(listener: (route: Route) => void): () => void;
}

/**
 * Meldet nur echte Routenwechsel. `router.subscribe` ruft den Listener
 * sofort mit der aktuellen Route auf; die App startet die erste Route aber
 * selbst beim DOMContentLoaded. Beides zusammen initialisierte jede Ansicht
 * doppelt – mit doppelt gebundenen Klicks (THW-Review 2026-10-05, offline
 * P3-4: ein Klick auf „Debrief PDF“, zwei Downloads).
 */
export function abonniereRoutenwechsel(quelle: RoutenQuelle, listener: (route: Route) => void): () => void {
    let bereit = false;
    const abmelden = quelle.subscribe(route => {
        if (bereit) {
            listener(route);
        }
    });
    bereit = true;
    return abmelden;
}

/**
 * Ansichten, in denen Vordruck, ZIP oder PDFs gebraucht werden: Teilnehmer,
 * Übungsleitung und ein geöffnetes Generator-Ergebnis (`#/generator/<id>`).
 * Die leere Startseite lädt den Druckteil nicht vor – sie ist die
 * Einstiegsseite für Suchmaschinen und soll schlank bleiben.
 */
export function brauchtDruckteil(mode: AppMode, params: string[]): boolean {
    if (mode === "teilnehmer" || mode === "uebungsleitung") {
        return true;
    }
    return mode === "generator" && params.some(Boolean);
}
