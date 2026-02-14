import { describe, expect, it, vi } from "vitest";
import { debounce } from "../../src/utils/debounce";

describe("debounce", () => {
    it("calls wrapped fn only once for rapid calls", () => {
        vi.useFakeTimers();
        const fn = vi.fn();
        const wrapped = debounce(fn, 100);
        wrapped();
        wrapped();
        wrapped();
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(101);
        expect(fn).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });
});
