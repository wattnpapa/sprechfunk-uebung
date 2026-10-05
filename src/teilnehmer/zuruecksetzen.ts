import type { TeilnehmerStorage } from "../types/Storage";
import type { LiveStatusService } from "../services/LiveStatusService";
import { toTeilnehmerLiveDoc } from "../services/liveStatusMerge";
import { uiFeedback } from "../core/UiFeedback";

/** Wartezeit auf die Serverbestätigung beim Zurücksetzen für alle. */
export const RESET_BESTAETIGUNG_MS = 10000;

type LiveStatus = Pick<LiveStatusService, "enabled" | "getState" | "publishTeilnehmerStatus" | "flush">;

/** Rückfrage vor dem Zurücksetzen, mit Anzahl und echter Reichweite. */
export function resetRueckfrage(anzahl: number, live: boolean): string {
    const kopf = `Wirklich alle ${anzahl} als abgesetzt markierten Funksprüche wieder auf „offen“ setzen?`;
    return live
        ? `${kopf}\n\nDas gilt auch für die Übungsleitung und deine anderen Geräte: Dort erscheinen die Sprüche danach ebenfalls als offen. Eine eigene X-Zeit wird gelöscht. Das lässt sich nicht rückgängig machen.\n\nEinen einzelnen falsch markierten Spruch korrigierst du besser mit „Zurücknehmen“ in seiner Zeile.`
        : `${kopf}\n\nDas betrifft nur dieses Gerät. Eine eigene X-Zeit wird gelöscht. Das lässt sich nicht rückgängig machen.`;
}

/**
 * Zurückgesetzter Stand fürs Remote-Dokument: Zurücksetz-Marker mit
 * aktuellem Zeitstempel, denn ein bloß leeres Dokument würde vom
 * Last-Write-Wins-Merge nicht gewinnen.
 */
export function zurueckgesetzterStand(storage: TeilnehmerStorage, now: string): TeilnehmerStorage {
    const nachrichten = Object.keys(storage.nachrichten).reduce<TeilnehmerStorage["nachrichten"]>(
        (acc, key) => {
            acc[key] = { uebertragen: false, geaendertUm: now };
            return acc;
        },
        {}
    );
    const cleared: TeilnehmerStorage = { ...storage, nachrichten, lastUpdated: now, xZeitBasisGeaendertUm: now };
    delete cleared.xZeitBasis;
    return cleared;
}

/**
 * Mit Live-Sync gilt das Zurücksetzen für alle und braucht eine Verbindung.
 * Ohne Verbindung wird abgelehnt, statt still zu warten und Minuten später
 * neu zu laden (offline-resilience P1-4, 2026-10-05) – wie bei der Leitung.
 *
 * @returns true, wenn zurückgesetzt werden darf.
 */
export function resetErlaubt(liveStatus: LiveStatus | null): boolean {
    if (!liveStatus?.enabled) {
        return true;
    }
    const zustand = liveStatus.getState();
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (offline || zustand === "offline" || zustand === "fehler") {
        uiFeedback.error("Zurücksetzen für alle braucht eine Verbindung zur Übungsleitung. Gerade ist keine da – es wurde nichts gelöscht.");
        return false;
    }
    return true;
}

/**
 * Schreibt die Zurücksetz-Marker und wartet höchstens
 * {@link RESET_BESTAETIGUNG_MS} auf die Bestätigung.
 *
 * @returns true, wenn der Server bestätigt hat (oder kein Live-Sync läuft).
 */
export async function veroeffentlicheReset(
    liveStatus: LiveStatus | null,
    storage: TeilnehmerStorage | null,
    teilnehmerId: string | null
): Promise<boolean> {
    if (!liveStatus?.enabled || !storage || !teilnehmerId) {
        return true;
    }
    const cleared = zurueckgesetzterStand(storage, new Date().toISOString());
    liveStatus.publishTeilnehmerStatus(toTeilnehmerLiveDoc(cleared, teilnehmerId));
    const bestaetigt = await liveStatus.flush(RESET_BESTAETIGUNG_MS);
    if (!bestaetigt) {
        uiFeedback.error("Die Übungsleitung hat das Zurücksetzen nicht bestätigt. Auf diesem Gerät wurde nichts gelöscht. Kommt die Verbindung zurück, kann es noch ankommen – prüfe dann deine Liste.");
    }
    return bestaetigt;
}
