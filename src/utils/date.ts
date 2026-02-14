// src/utils/date.ts

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

// Minimales Interface für Firebase Timestamp (oder ähnliches)
interface TimestampLike {
    toDate(): Date;
}

function isTimestamp(value: unknown): value is TimestampLike {
    return typeof value === "object" && value !== null && "toDate" in value && typeof (value as TimestampLike).toDate === "function";
}

/**
 * Formatiert ein Datum im NATO-Format: DDHHMMMONYY (UTC), z.B. 170957JAN26
 * @param value - Date | ISO-String | number | Firestore Timestamp
 * @param withTime - Falls `true`, wird die Zeit (HHMM) mit ausgegeben.
 */
export function formatNatoDate(value: unknown, withTime = true): string {
    try {
        let d: Date;

        if (isTimestamp(value)) {
            d = value.toDate();
        } else if (value instanceof Date) {
            d = value;
        } else if (typeof value === "string" || typeof value === "number") {
            d = new Date(value);
        } else {
            return "–";
        }

        if (Number.isNaN(d.getTime())) {
            return "–";
        }

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