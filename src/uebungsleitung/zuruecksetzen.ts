import type { UebungsleitungStorage } from "../types/Storage";
import type { LiveStatusService } from "../services/LiveStatusService";
import { toLeitungLiveDoc, toLeitungPublicLiveDoc } from "../services/liveStatusMerge";
import { uiFeedback } from "../core/UiFeedback";

/** Wartezeit auf die Serverbestätigung beim Zurücksetzen für alle. */
const RESET_BESTAETIGUNG_MS = 10000;

type LiveStatus = Pick<LiveStatusService, "enabled" | "getState" | "publishLeitungPublic" | "publishLeitungInternal" | "flush">;

/** Was beim Zurücksetzen verloren geht – für eine konkrete Rückfrage. */
export function zaehleVerlust(storage: UebungsleitungStorage | null): { abgesetzt: number; notizen: number; anmeldungen: number } {
    const nachrichten = Object.values(storage?.nachrichten ?? {});
    const teilnehmer = Object.values(storage?.teilnehmer ?? {});
    return {
        abgesetzt: nachrichten.filter(n => n.abgesetztUm).length,
        notizen: nachrichten.filter(n => n.notiz).length + teilnehmer.filter(t => t.notizen).length,
        anmeldungen: teilnehmer.filter(t => t.angemeldetUm).length
    };
}

/**
 * Fragt nach, bevor zurückgesetzt wird. Mit Live-Sync gilt das für alle und
 * braucht eine Verbindung; ohne wird nichts gelöscht.
 *
 * @returns `true`, wenn zurückgesetzt werden soll.
 */
export function resetBestaetigen(liveStatus: LiveStatus | null, storage: UebungsleitungStorage | null): boolean {
    const live = Boolean(liveStatus?.enabled);
    const zustand = liveStatus?.getState();
    if (live && (zustand === "offline" || zustand === "fehler")) {
        uiFeedback.error("Zurücksetzen für alle braucht eine Verbindung. Gerade ist keine da – es wurde nichts gelöscht.");
        return false;
    }
    const verlust = zaehleVerlust(storage);
    const umfang = `${verlust.abgesetzt} abgesetzte Nachrichten, ${verlust.notizen} Notizen und ${verlust.anmeldungen} Anmeldungen`;
    const message = live
        ? `Übungsstand für ALLE zurücksetzen?\n\nGelöscht werden ${umfang} – auf allen Leitungs-Arbeitsplätzen und bei allen Teilnehmern. Das lässt sich nicht rückgängig machen.\n\nTipp: Vorher „Übungsleitung als PDF“ sichern.`
        : `Daten der Übungsleitung auf diesem Gerät löschen?\n\nGelöscht werden ${umfang}. Das lässt sich nicht rückgängig machen.`;
    return uiFeedback.confirm(message);
}

/** Zurücksetz-Marker mit aktuellem Zeitstempel – ein leeres Dokument gewänne den Merge nicht. */
function geleerterStand(storage: UebungsleitungStorage): UebungsleitungStorage {
    const now = new Date().toISOString();
    const nachrichten = Object.keys(storage.nachrichten).reduce<UebungsleitungStorage["nachrichten"]>((acc, key) => {
        acc[key] = { statusGeaendertUm: now, notiz: "", notizGeaendertUm: now };
        return acc;
    }, {});
    const teilnehmer = Object.keys(storage.teilnehmer).reduce<UebungsleitungStorage["teilnehmer"]>((acc, key) => {
        acc[key] = { geaendertUm: now };
        return acc;
    }, {});
    return { ...storage, lastUpdated: now, nachrichten, teilnehmer };
}

/**
 * Setzt lokal und – falls aktiv – auch remote zurück. Remote werden dazu
 * Zurücksetz-Marker mit aktuellem Zeitstempel geschrieben; ein leeres Dokument
 * würde vom Last-Write-Wins-Merge nicht gewinnen. Ohne Bestätigung des
 * Servers wird lokal nichts gelöscht und nicht neu geladen.
 */
export async function fuehreResetAus(
    liveStatus: LiveStatus | null,
    storage: UebungsleitungStorage | null,
    uebungId: string
): Promise<void> {
    if (liveStatus?.enabled && storage) {
        const cleared = geleerterStand(storage);
        liveStatus.publishLeitungPublic(toLeitungPublicLiveDoc(cleared));
        liveStatus.publishLeitungInternal(toLeitungLiveDoc(cleared));
        const bestaetigt = await liveStatus.flush(RESET_BESTAETIGUNG_MS);
        if (!bestaetigt) {
            uiFeedback.error("Der Server hat das Zurücksetzen nicht bestätigt. Es wird nachgereicht, sobald wieder Verbindung besteht – lade die Seite bis dahin nicht neu.");
            return;
        }
    }
    localStorage.removeItem(`sprechfunk:uebungsleitung:${uebungId}`);
    window.location.reload();
}
