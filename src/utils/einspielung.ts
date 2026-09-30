import type { EinspielungArt, EinspielungKonfiguration, EinspielungWeg } from "../types/Einspielung";
import { parseHHMMtoMs } from "./xzeit";

/** Beschriftung des Übermittlungswegs für Drehbuch und Ansichten. */
export function einspielungWegLabel(weg: EinspielungWeg | undefined): string {
    switch (weg) {
    case "funk":
        return "Funk";
    case "drucker":
        return "Ausdruck";
    case "email":
        return "E-Mail";
    default:
        return "";
    }
}

/** Bootstrap-Badge-Klasse zum Weg; Funk ist der Normalfall und bleibt unauffällig. */
export function einspielungWegBadgeClass(weg: EinspielungWeg | undefined): string {
    switch (weg) {
    case "drucker":
        return "badge bg-warning text-dark";
    case "email":
        return "badge bg-info text-dark";
    default:
        return "badge bg-secondary";
    }
}

export function einspielungArtLabel(art: EinspielungArt | undefined): string {
    switch (art) {
    case "betrieb":
        return "Betrieb";
    case "lagemeldung":
        return "Lagemeldung";
    case "anforderung":
        return "Anforderung";
    case "rueckfrage":
        return "Rückfrage";
    case "auftrag":
        return "Auftrag";
    case "information":
        return "Information";
    case "vollzug":
        return "Vollzug";
    default:
        return "";
    }
}

/** Minute ab Übungsbeginn als "+H:MM", z. B. "+0:05" oder "+2:40". */
export function formatEinspielungOffset(minuten: number): string {
    const gerundet = Math.max(0, Math.round(minuten));
    const stunden = Math.floor(gerundet / 60);
    const rest = gerundet % 60;
    return `+${stunden}:${String(rest).padStart(2, "0")}`;
}

/**
 * Uhrzeit einer Einlage, wenn ein Übungsbeginn "HH:MM" bekannt ist; sonst
 * null. Läuft über Mitternacht hinaus weiter (Tageswechsel ist egal).
 */
export function formatEinspielungUhrzeit(minuten: number, beginn: string | undefined): string | null {
    if (!beginn) {
        return null;
    }
    const basisMs = parseHHMMtoMs(beginn, new Date(2000, 0, 1));
    if (basisMs === null) {
        return null;
    }
    const zeit = new Date(basisMs + Math.max(0, Math.round(minuten)) * 60000);
    return `${String(zeit.getHours()).padStart(2, "0")}:${String(zeit.getMinutes()).padStart(2, "0")}`;
}

/** Offset plus Uhrzeit in Klammern, wenn ein Beginn bekannt ist: "+0:45 (10:45)". */
export function formatEinspielungZeit(minuten: number, beginn: string | undefined): string {
    const offset = formatEinspielungOffset(minuten);
    const uhrzeit = formatEinspielungUhrzeit(minuten, beginn);
    return uhrzeit ? `${offset} (${uhrzeit})` : offset;
}

/** Ersetzt {{el}}, {{stab}} und {{eaN}} durch die Funkrufnamen der Übung. */
export function ersetzeEinspielungPlatzhalter(text: string, konfiguration: EinspielungKonfiguration): string {
    let ergebnis = text
        .replace(/\{\{el\}\}/g, konfiguration.beuebteStelle)
        .replace(/\{\{stab\}\}/g, konfiguration.uebergeordnet);
    konfiguration.unterstellt.forEach((name, index) => {
        ergebnis = ergebnis.replace(new RegExp(`\\{\\{ea${index + 1}\\}\\}`, "g"), name);
    });
    return ergebnis;
}
