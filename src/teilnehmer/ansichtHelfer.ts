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

/**
 * Sperre der Gegenaktion: „Zurücknehmen“ derselben Nachricht kurz nach dem
 * Absetzen. Ein träger zweiter Tipp kam im Review nach 1,3 s (stress-test
 * P2-1, 2026-10-05); die Sperre liegt deutlich darüber.
 */
export const GEGENAKTION_SPERRE_MS = 2500;

/**
 * Kontextsperre für Ansichten, in denen nach einem Wechsel ein anderer Spruch
 * an dieselbe Stelle rückt (Fokus-Karte, Vordruck, Liste beim Ausblenden).
 * Gemessen wurden zweite Tipps bis 1,3 s; 1,5 s deckt das ab.
 */
export const KONTEXT_SPERRE_MS = 1500;

/**
 * So lange bleibt eine eben abgesetzte Karte bei „Abgesetzte ausblenden“
 * stehen, bevor sie geht. Ein zweiter Tipp trifft in dieser Zeit ihr
 * Statusfeld und nicht den nächsten Spruch (stress-test P1-1, 2026-10-05).
 */
export const HALTEN_MS = 3000;

/** So lange bleibt der Rückgängig-Hinweis nach einem Statuswechsel stehen. */
export const RUECKGAENGIG_MS = 8000;

/**
 * Verbindungsanzeige im Kopf. Klartext statt „Sync“ (field-user P3,
 * 2026-10-05); die Zahl offener Änderungen und die Uhrzeit der letzten
 * Bestätigung hängt {@link syncAnzeige} an.
 */
export const LIVE_SYNC_LABELS: Record<LiveSyncState, { text: string; css: string; title: string }> = {
    aus: { text: "Nur auf diesem Gerät", css: "bg-secondary", title: "Keine Verbindung zur Übungsleitung eingerichtet – deine Markierungen bleiben nur auf diesem Gerät." },
    verbinde: { text: "Verbinde mit der Übungsleitung …", css: "bg-secondary", title: "Verbindung zur Übungsleitung wird aufgebaut." },
    live: { text: "Übungsleitung: live", css: "bg-success", title: "Verbunden – deine Markierungen gehen an die Übungsleitung." },
    offline: { text: "Keine Verbindung – wird nachgereicht", css: "bg-warning text-dark", title: "Keine Verbindung – deine Markierungen sind auf diesem Gerät gespeichert und werden gesendet, sobald wieder Netz da ist." },
    fehler: { text: "Fehler – wird nicht gesendet", css: "bg-danger", title: "Der Server lehnt die Übermittlung ab – deine Markierungen bleiben nur auf diesem Gerät. Melde den Stand per Funk." }
};

/** Was die Verbindungsanzeige außer dem Zustand kennt. */
export interface ZustellInfo {
    /** Sprüche, deren Änderung noch nicht beim Server bestätigt ist. */
    offen: number;
    /** HH:MM der letzten vollständigen Bestätigung, leer wenn unbekannt. */
    bestaetigtUm: string;
}

/** Text und Tooltip der Verbindungsanzeige mit Zahl und Uhrzeit (offline P2-2). */
export function syncAnzeige(state: LiveSyncState, info: ZustellInfo): { text: string; css: string; title: string } {
    const label = LIVE_SYNC_LABELS[state];
    const seit = info.bestaetigtUm ? ` Zuletzt alles angekommen um ${info.bestaetigtUm}.` : "";
    if (state === "live") {
        const text = info.offen > 0
            ? `${label.text} · ${info.offen} wird gesendet`
            : `${label.text}${info.bestaetigtUm ? ` · alles gesendet ${info.bestaetigtUm}` : ""}`;
        return { ...label, text, title: `${label.title}${seit}` };
    }
    if ((state === "offline" || state === "fehler") && info.offen > 0) {
        const wort = info.offen === 1 ? "Spruch" : "Sprüche";
        const text = state === "offline"
            ? `Keine Verbindung – ${info.offen} ${wort} nur hier`
            : `Fehler – ${info.offen} ${wort} nur hier`;
        return { ...label, text, title: `${label.title}${seit}` };
    }
    return { ...label, title: `${label.title}${seit}` };
}

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
     * bleibt sie zusätzlich {@link HALTEN_MS} stehen und geht danach ab —
     * sonst rückte der nächste Spruch unter den Finger.
     */
    zuletztAbgesetzt?: number;
    /** Sprüche, deren Änderung erst auf diesem Gerät liegt. */
    nurLokal?: ReadonlySet<number>;
    /** Zustand der Verbindung zur Übungsleitung; ohne Angabe „aus“. */
    syncZustand?: LiveSyncState;
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

export function zeilenKontext(
    nachrichten: Nachricht[],
    storage: TeilnehmerStorage,
    optionen: NachrichtenOptionen,
    halt: { gehalten: ReadonlySet<number>; abgang: ReadonlySet<number> } = { gehalten: new Set(), abgang: new Set() }
): ZeilenKontext {
    return {
        storage,
        showXZeit: optionen.showXZeit ?? false,
        xZeitBasis: optionen.xZeitBasis,
        bestaetigungen: optionen.bestaetigungen ?? {},
        zuletztAbgesetzt: optionen.zuletztAbgesetzt,
        gehalten: halt.gehalten,
        abgang: halt.abgang,
        nurLokal: optionen.nurLokal ?? new Set(),
        syncZustand: optionen.syncZustand ?? "aus",
        // Ohne X-Zeit gibt es keine Fälligkeit; der erste offene Spruch der
        // Liste ist dann der nächste.
        naechsterId: nachrichten.find(n => !storage.nachrichten[n.id]?.uebertragen)?.id
    };
}
