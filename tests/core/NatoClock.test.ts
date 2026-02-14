import { describe, expect, it, vi } from "vitest";
import { NatoClock } from "../../src/core/NatoClock";
import { formatNatoDate } from "../../src/utils/date";

const makeDocument = () => {
    const element = { textContent: "" };
    const doc = {
        getElementById: (id: string) => (id === "natoTime" ? element : null)
    };
    return { document: doc, element };
};

describe("NatoClock", () => {
    it("renders NATO time into element", () => {
        const { document, element } = makeDocument();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = document;

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-14T12:34:00Z"));

        const clock = new NatoClock();
        clock.init();

        expect(element.textContent).toBe(formatNatoDate(new Date(), true));
        vi.useRealTimers();
    });
});
