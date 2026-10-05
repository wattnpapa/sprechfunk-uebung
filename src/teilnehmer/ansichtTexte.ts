import { Nachricht } from "../types/Nachricht";
import { TeilnehmerStorage } from "../types/Storage";
import type { LiveSyncState } from "../types/LiveStatus";
import { formatCountdown, parseHHMMtoMs } from "../utils/xzeit";
import { naechsteFaelligkeitMs } from "./nachrichtenMarkup";
import type { ZustellInfo } from "./ansichtHelfer";

/** Länge des Übungscodes; danach springt die Eingabe ins zweite Feld. */
const UEBUNGSCODE_LAENGE = 6;

/**
 * Nach dem sechsten Zeichen des Übungscodes geht es im Teilnehmercode
 * weiter – ein Präzisionstipp weniger (glove-touch P3-2, 2026-10-05).
 */
export function bindeCodeSprung(uebungInput: HTMLInputElement | null, teilnehmerInput: HTMLInputElement | null): void {
    if (!uebungInput || !teilnehmerInput) {
        return;
    }
    uebungInput.addEventListener("input", () => {
        if (uebungInput.value.length >= UEBUNGSCODE_LAENGE && !teilnehmerInput.value) {
            teilnehmerInput.focus();
        }
    });
}

function sprueche(anzahl: number): string {
    return anzahl === 1 ? "1 Spruch" : `${anzahl} Sprüche`;
}

/**
 * Mitlaufender Hinweis über der Liste, solange die Verbindung fehlt. Leer,
 * wenn alles normal läuft.
 */
export function syncLeistenText(state: LiveSyncState, info: ZustellInfo): string {
    if (state === "offline") {
        return info.offen > 0
            ? `Keine Verbindung zur Übungsleitung – ${sprueche(info.offen)} nur auf diesem Gerät. Sie werden gesendet, sobald wieder Netz da ist.`
            : "Keine Verbindung zur Übungsleitung – neue Markierungen bleiben vorerst auf diesem Gerät.";
    }
    if (state === "fehler") {
        return "Die Übermittlung an die Übungsleitung wird abgelehnt – deine Markierungen bleiben auf diesem Gerät. Melde den Stand per Funk.";
    }
    return "";
}

/**
 * Countdown-Zeile der X-Zeit-Karte. Hängt etwas nach, steht der Rückstand
 * vorn – „Nächste in 6:54“ allein ließ Rollenspieler glauben, sie hätten
 * Zeit, während die Leitung sie weit hinter Plan sah (workflow W2, 2026-10-05).
 */
export function rueckstandText(
    nachrichten: Nachricht[],
    storage: TeilnehmerStorage,
    xZeitBasis: string,
    jetzt = Date.now()
): { text: string; rueckstand: boolean } {
    const basisMs = parseHHMMtoMs(xZeitBasis);
    const naechste = naechsteFaelligkeitMs(nachrichten, storage, xZeitBasis);
    const naechsteText = naechste !== null ? `Nächste in ${formatCountdown(naechste)}` : "";
    const faellig = basisMs === null ? [] : nachrichten
        .filter(n => n.xZeitSlot !== undefined && !storage.nachrichten[n.id]?.uebertragen)
        .map(n => basisMs + (n.xZeitSlot ?? 0) * 60000)
        .filter(zeit => zeit <= jetzt);
    if (faellig.length === 0) {
        return { text: naechsteText || "Keine ausstehenden Nachrichten", rueckstand: false };
    }
    const aeltesteMin = Math.floor((jetzt - Math.min(...faellig)) / 60000);
    const kopf = aeltesteMin >= 1
        ? `${faellig.length} fällig, älteste seit ${aeltesteMin} min`
        : `${faellig.length} jetzt fällig`;
    return { text: naechsteText ? `${kopf} · ${naechsteText}` : kopf, rueckstand: true };
}
