import { describe, expect, it } from "vitest";
import { formatNatoDate, nowIso } from "../../src/utils/date";

describe("formatNatoDate", () => {
    const expected = (d: Date, withTime: boolean) => {
        const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
        const day = String(d.getDate()).padStart(2, "0");
        const mon = months[d.getMonth()];
        const yy = String(d.getFullYear()).slice(-2);
        if (withTime) {
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            return `${day}${hh}${mm}${mon}${yy}`;
        }
        return `${day}${mon}${yy}`;
    };

    it("formats Date with time", () => {
        const d = new Date(2026, 0, 17, 9, 57, 0);
        expect(formatNatoDate(d, true)).toBe(expected(d, true));
    });

    it("formats Date without time", () => {
        const d = new Date(2026, 0, 17, 9, 57, 0);
        expect(formatNatoDate(d, false)).toBe(expected(d, false));
    });

    it("handles invalid input", () => {
        expect(formatNatoDate(null)).toBe("–");
        expect(formatNatoDate("invalid-date")).toBe("–");
    });

    it("accepts timestamp-like", () => {
        const d = new Date(2026, 0, 17, 9, 57, 0);
        const ts = { toDate: () => d };
        expect(formatNatoDate(ts, true)).toBe(expected(d, true));
    });

    it("returns dash when toDate throws", () => {
        const ts = {
            toDate: () => {
                throw new Error("boom");
            }
        };
        expect(formatNatoDate(ts, true)).toBe("–");
    });
});

describe("nowIso", () => {
    it("returns ISO string", () => {
        const val = nowIso();
        expect(typeof val).toBe("string");
        expect(val).toContain("T");
    });
});
