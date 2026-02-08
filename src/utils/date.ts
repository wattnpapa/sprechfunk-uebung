// src/utils/date.ts

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

/**
 * Formatiert ein Datum im NATO-Format: DDHHMMMONYY (UTC), z.B. 170957JAN26
 * @param value - Date | ISO-String | number | Firestore Timestamp
 * @param withTime - Falls `true`, wird die Zeit (HHMM) mit ausgegeben.
 */
export function formatNatoDate(value: unknown, withTime: boolean = true): string {
    try {
        const d =
            (value as any)?.toDate?.() instanceof Date
                ? (value as any).toDate()
                : value instanceof Date
                    ? value
                    : new Date(value as any);

        if (Number.isNaN(d.getTime())) return "–";

        const day = String(d.getDate()).padStart(2, "0");
        const mon = MONTHS[d.getMonth()];
        const yy = String(d.getFullYear()).slice(-2);

        if (withTime) {
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            return `${day}${hh}${mm}${mon}${yy}`;
        }
        
        return `${day}${mon}${yy}`;
    } catch {
        return "–";
    }
}

/** ISO “now” (UTC) fürs Speichern im Storage */
export function nowIso(): string {
    return new Date().toISOString();
}