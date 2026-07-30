import { describe, expect, it } from "vitest";
import {
    berechnePlanStatus,
    berechneSollFortschritt,
    formatCountdown,
    formatLaufzeit,
    formatXZeit,
    fruehesteBasis,
    parseHHMMtoMs
} from "../../src/utils/xzeit";

describe("parseHHMMtoMs", () => {
    const now = new Date(2026, 6, 30, 15, 0, 0);

    it("interpretiert HH:MM als heutige Uhrzeit", () => {
        expect(parseHHMMtoMs("14:30", now)).toBe(new Date(2026, 6, 30, 14, 30, 0, 0).getTime());
        expect(parseHHMMtoMs("0:05", now)).toBe(new Date(2026, 6, 30, 0, 5, 0, 0).getTime());
    });

    it("lehnt ungültige Werte ab", () => {
        expect(parseHHMMtoMs("", now)).toBeNull();
        expect(parseHHMMtoMs("24:00", now)).toBeNull();
        expect(parseHHMMtoMs("12:60", now)).toBeNull();
        expect(parseHHMMtoMs("abc", now)).toBeNull();
    });
});

describe("berechneSollFortschritt", () => {
    const basisMs = 1_000_000;

    it("zählt nur Nachrichten, deren Slot bereits fällig ist", () => {
        const nachrichten = [
            { xZeitSlot: 0 },
            { xZeitSlot: 3 },
            { xZeitSlot: 6 },
            {} // ohne Slot – zählt nie
        ];
        const nowMs = basisMs + 3 * 60000; // X+3
        expect(berechneSollFortschritt(nachrichten, basisMs, nowMs)).toBe(2);
    });

    it("liefert 0 vor Übungsbeginn", () => {
        expect(berechneSollFortschritt([{ xZeitSlot: 0 }], basisMs, basisMs - 1)).toBe(0);
    });
});

describe("berechnePlanStatus", () => {
    it("meldet „im Plan“ bei Gleichstand oder Vorsprung", () => {
        expect(berechnePlanStatus(5, 5)).toEqual({ label: "im Plan", css: "bg-success" });
        expect(berechnePlanStatus(7, 5).label).toBe("im Plan");
    });

    it("warnt bei kleinem Rückstand und eskaliert bei großem", () => {
        expect(berechnePlanStatus(4, 5)).toEqual({ label: "1 hinter Plan", css: "bg-warning text-dark" });
        expect(berechnePlanStatus(3, 5).css).toBe("bg-warning text-dark");
        expect(berechnePlanStatus(2, 5)).toEqual({ label: "3 hinter Plan", css: "bg-danger" });
    });
});

describe("formatLaufzeit", () => {
    it("formatiert unter einer Stunde als MM:SS", () => {
        expect(formatLaufzeit(0)).toBe("00:00");
        expect(formatLaufzeit(83_000)).toBe("01:23");
    });

    it("formatiert ab einer Stunde als H:MM:SS", () => {
        expect(formatLaufzeit(3_723_000)).toBe("1:02:03");
    });

    it("zeigt vor Beginn einen Strich", () => {
        expect(formatLaufzeit(-1)).toBe("–");
    });
});

describe("formatXZeit", () => {
    it("zeigt Minuten seit X", () => {
        expect(formatXZeit(0)).toBe("X + 0 min");
        expect(formatXZeit(12 * 60000 + 59_000)).toBe("X + 12 min");
    });

    it("zeigt „vor X“ vor Beginn", () => {
        expect(formatXZeit(-1)).toBe("vor X");
    });
});

describe("formatCountdown", () => {
    it("formatiert als M:SS und klemmt Negatives auf 0:00", () => {
        expect(formatCountdown(106_000)).toBe("1:46");
        expect(formatCountdown(0)).toBe("0:00");
        expect(formatCountdown(-5_000)).toBe("0:00");
    });
});

describe("fruehesteBasis", () => {
    const now = new Date(2026, 6, 30, 15, 0, 0);

    it("liefert die früheste gültige Basis", () => {
        expect(fruehesteBasis(["14:30", "14:05", undefined, "kaputt"], now)).toBe("14:05");
    });

    it("liefert null ohne gültige Angaben", () => {
        expect(fruehesteBasis([undefined, "", "99:99"], now)).toBeNull();
    });
});
