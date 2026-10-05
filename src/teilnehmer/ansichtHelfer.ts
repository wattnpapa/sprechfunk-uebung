import { Nachricht } from "../types/Nachricht";
import { TeilnehmerStorage } from "../types/Storage";
import type { LeitungBestaetigung, LiveSyncState } from "../types/LiveStatus";
import type { ZeilenKontext } from "./nachrichtenMarkup";

/**
 * Standzeit der abgehenden Zeile: Verzug (380 ms) plus Dauer (--takt-kurz,
 * 180 ms) der Abgangsanimation aus Abschnitt 10.2 der CSS, aufgerundet.
 */
export const ABGANG_MS = 600;

/**
 * Tippsperre nach einem Statuswechsel. Ein Doppeltipp liegt bei 100–300 ms
 * (gemessen im THW-Review 2026-10-04); eine Sekunde fängt auch Handschuh-
 * und Wackeltipps ab, ohne beim Abhaken des nächsten Spruchs zu bremsen.
 */
export const STATUS_SPERRE_MS = 1000;

/** So lange bleibt der Rückgängig-Hinweis nach einem Statuswechsel stehen. */
export const RUECKGAENGIG_MS = 8000;

export const LIVE_SYNC_LABELS: Record<LiveSyncState, { text: string; css: string; title: string }> = {
    aus: { text: "Sync: aus", css: "bg-secondary", title: "Keine Verbindung zur Übungsleitung eingerichtet – deine Markierungen bleiben nur auf diesem Gerät." },
    verbinde: { text: "Sync: verbinde…", css: "bg-secondary", title: "Verbindung zur Übungsleitung wird aufgebaut." },
    live: { text: "Sync: live", css: "bg-success", title: "Verbunden – deine Markierungen gehen an die Übungsleitung." },
    offline: { text: "Sync: offline – wird nachgereicht", css: "bg-warning text-dark", title: "Keine Verbindung – deine Markierungen sind auf diesem Gerät gespeichert und werden gesendet, sobald wieder Netz da ist." },
    fehler: { text: "Sync: Fehler – wird nicht gesendet", css: "bg-danger", title: "Der Server lehnt die Übermittlung ab – deine Markierungen bleiben nur auf diesem Gerät. Melde den Stand per Funk." }
};

export const RESET_TEXTE = {
    live: {
        label: "Abhak-Stand für alle zurücksetzen",
        hinweis: "Setzt alle als abgesetzt markierten Funksprüche wieder auf „offen“ – auf diesem Gerät, auf deinen anderen Geräten und bei der Übungsleitung. Einen einzelnen falsch markierten Spruch korrigierst du besser mit „Zurücknehmen“ in seiner Zeile."
    },
    lokal: {
        label: "Abhak-Stand auf diesem Gerät löschen",
        hinweis: "Setzt alle als abgesetzt markierten Funksprüche auf diesem Gerät wieder auf „offen“. Einen einzelnen falsch markierten Spruch korrigierst du besser mit „Zurücknehmen“ in seiner Zeile."
    }
};

/** Optionen für renderNachrichten. */
export interface NachrichtenOptionen {
    showXZeit?: boolean;
    xZeitBasis?: string;
    /** Bestätigungen der Übungsleitung, Key = Nachrichten-ID als String. */
    bestaetigungen?: Record<string, LeitungBestaetigung>;
    /**
     * ID der Nachricht, die diesen Aufruf ausgelöst hat, weil sie
     * gerade abgesetzt wurde. Ihre Zeile bekommt den Absetzstrich
     * (Abschnitt 10.2 der CSS). Bei aktivem "Abgesetzte ausblenden"
     * bleibt sie zusätzlich noch kurz stehen und geht danach ab —
     * sonst wäre sie weg, bevor die Quittung sichtbar war.
     */
    zuletztAbgesetzt?: number;
}

export function setzeChecked(id: string, checked: boolean): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) {
        el.checked = checked;
    }
}

export function setzeSichtbar(id: string, sichtbar: boolean): void {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = sichtbar ? "" : "none";
    }
}

export function suchtext(): string {
    return (document.getElementById("teilnehmerSearchInput") as HTMLInputElement | null)?.value?.trim().toLowerCase() ?? "";
}

export function zeilenKontext(nachrichten: Nachricht[], storage: TeilnehmerStorage, optionen: NachrichtenOptionen): ZeilenKontext {
    return {
        storage,
        showXZeit: optionen.showXZeit ?? false,
        xZeitBasis: optionen.xZeitBasis,
        bestaetigungen: optionen.bestaetigungen ?? {},
        zuletztAbgesetzt: optionen.zuletztAbgesetzt,
        // Ohne X-Zeit gibt es keine Fälligkeit; der erste offene Spruch der
        // Liste ist dann der nächste.
        naechsterId: nachrichten.find(n => !storage.nachrichten[n.id]?.uebertragen)?.id
    };
}
