import type { Firestore } from "firebase/firestore";
import { TeilnehmerController } from "./index";

/**
 * Teilnehmer arbeiten am Handy. Die Website-Navigation (sieben Links) steht
 * dort sonst ausgeklappt vor dem ersten Funkspruch; zugeklappt bleibt sie
 * über „Menü“ erreichbar. Auf breiten Bildschirmen ist die Zusammenfassung
 * ausgeblendet und die Liste immer sichtbar, dort ändert das nichts.
 */
export function klappeNavigationEin(): void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return;
    }
    if (!window.matchMedia("(max-width: 767.98px)").matches) {
        return;
    }
    document.querySelector<HTMLDetailsElement>(".site-nav-details[open]")?.removeAttribute("open");
}

export async function initTeilnehmer(db: Firestore): Promise<void> {
    klappeNavigationEin();
    const controller = new TeilnehmerController(db);
    await controller.init();

    const area = document.getElementById("teilnehmerArea");
    if (area) {
        area.style.display = "block";
    }
}
