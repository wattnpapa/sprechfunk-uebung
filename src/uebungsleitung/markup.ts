import { escapeHtml } from "../utils/html";

/** Wert für ein HTML-Attribut in doppelten Anführungszeichen. */
export function escapeAttr(value: string): string {
    return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** „HH:MM“ in Ortszeit für einen Zeitstempel in Millisekunden. */
export function formatHHMM(ts: number): string {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

/** „HH:MM“ aus einem ISO-Zeitpunkt – leer, wenn keiner da oder er ungültig ist. */
export function hhmmAus(iso: string | undefined): string {
    const ts = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(ts) ? formatHHMM(ts) : "";
}
