import { OFFLINE_STAND_EREIGNIS, type OfflineStandDetail } from "../services/uebungOfflineKopie";

/**
 * Hinweis „ohne Verbindung – letzter bekannter Stand“, sobald eine Übung aus
 * der Offline-Kopie dieses Geräts angezeigt wird (THW-Review 2026-10-05,
 * offline P1-2). Ohne ihn hielte man die Anzeige für aktuell.
 *
 * Unabhängig von den Ansichten: FirebaseService meldet das Ereignis, dieser
 * Baustein zeigt den Hinweis oben im Inhalt. Kommt das Netz zurück, bietet
 * er das Neuladen an; ein Routenwechsel räumt ihn ab.
 */
export const HINWEIS_ID = "offlineStandHinweis";

export function formatStand(stand: Date): string {
    const zwei = (n: number) => String(n).padStart(2, "0");
    return `${zwei(stand.getDate())}.${zwei(stand.getMonth() + 1)}.${stand.getFullYear()}, `
        + `${zwei(stand.getHours())}:${zwei(stand.getMinutes())} Uhr`;
}

export function offlineStandText(stand: Date): string {
    return `Ohne Verbindung: Angezeigt wird der letzte bekannte Stand der Übung, `
        + `auf diesem Gerät gespeichert am ${formatStand(stand)}. `
        + "Was sich seitdem an der Übung geändert hat, fehlt hier. "
        + "Lade die Seite neu, sobald wieder Netz da ist.";
}

export const WIEDER_ONLINE_TEXT = "Die Verbindung ist wieder da. Lade die Seite neu, damit du den aktuellen Stand siehst.";

function entferneHinweis(): void {
    document.getElementById(HINWEIS_ID)?.remove();
}

export function zeigeOfflineStand(stand: Date): void {
    entferneHinweis();
    const ziel = document.getElementById("appMain") ?? document.body;
    if (!ziel) {
        return;
    }
    const hinweis = document.createElement("div");
    hinweis.id = HINWEIS_ID;
    hinweis.className = "alert alert-warning offline-stand-hinweis container my-2";
    hinweis.setAttribute("role", "status");
    hinweis.dataset["testid"] = "offline-stand-hinweis";
    const text = document.createElement("span");
    text.textContent = offlineStandText(stand);
    hinweis.appendChild(text);
    ziel.prepend(hinweis);
}

function wiederOnline(): void {
    const hinweis = document.getElementById(HINWEIS_ID);
    if (!hinweis || hinweis.querySelector("button")) {
        return;
    }
    const text = hinweis.querySelector("span");
    if (text) {
        text.textContent = WIEDER_ONLINE_TEXT;
    }
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "btn btn-sm btn-outline-secondary ms-2";
    knopf.textContent = "Jetzt neu laden";
    knopf.addEventListener("click", () => window.location.reload());
    hinweis.appendChild(knopf);
}

let gebunden = false;

export function initOfflineStandHinweis(): void {
    if (gebunden || typeof window === "undefined" || typeof document === "undefined") {
        return;
    }
    gebunden = true;
    window.addEventListener(OFFLINE_STAND_EREIGNIS, event => {
        const detail = (event as CustomEvent<OfflineStandDetail>).detail;
        const stand = new Date(detail?.standIso ?? "");
        if (!Number.isNaN(stand.getTime())) {
            zeigeOfflineStand(stand);
        }
    });
    window.addEventListener("online", wiederOnline);
    window.addEventListener("hashchange", entferneHinweis);
}

/** Nur für Tests. */
export function setzeOfflineStandHinweisZurueck(): void {
    gebunden = false;
}
