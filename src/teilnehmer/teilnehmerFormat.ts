import { escapeHtml } from "../utils/html";
import { Nachricht } from "../types/Nachricht";
import { nachrichtenArtBadgeClass, nachrichtenArtLabel } from "../utils/nachrichtenArt";

/** Codes bestehen nur aus Großbuchstaben und Ziffern. */
export const sanitizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Kopfzeile ohne doppeltes „Sprechfunkübung: Sprechfunkübung …“. */
export function teilnehmerTitel(name: string | undefined): string {
    const n = (name || "").trim() || "–";
    return /übung/i.test(n) ? n : `Sprechfunkübung: ${n}`;
}

/** Datum für Menschen (TT.MM.JJJJ) statt Datum-Zeit-Gruppe. */
export function formatDatumKurz(datum: Date | string | undefined): string {
    if (!datum) {
        return "–";
    }
    const d = datum instanceof Date ? datum : new Date(datum);
    if (Number.isNaN(d.getTime())) {
        return "–";
    }
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Uhrzeit HH:MM eines ISO-Zeitstempels, leer bei fehlendem/ungültigem Wert. */
export function formatUhrzeit(iso: string | undefined): string {
    if (!iso) {
        return "";
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return "";
    }
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Nachrichtentext escaped, mit Zeilenumbrüchen (echte und als „\n“ gespeicherte). */
export function nachrichtHtml(text: string): string {
    return escapeHtml(text).replace(/\\n/g, "<br>").replace(/\n/g, "<br>");
}

/**
 * Kennzeichnet die Übermittlungsart. Bleibt leer, wenn die Übung ohne
 * Kennzeichnung generiert wurde.
 */
export function renderArtBadge(nachricht: Nachricht): string {
    if (!nachricht.art) {
        return "";
    }
    return `<span class="${nachrichtenArtBadgeClass(nachricht.art)} me-2">${nachrichtenArtLabel(nachricht.art)}</span>`;
}
