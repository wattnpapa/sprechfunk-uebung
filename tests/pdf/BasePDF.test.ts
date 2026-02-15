import { describe, expect, it, vi } from "vitest";
import { BasePDF } from "../../src/pdf/BasePDF";
import { FunkUebung } from "../../src/models/FunkUebung";

class TestPdf extends BasePDF {
    draw(): void {}
    public callAdjust(text: string, w: number) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).adjustTextForWidth(text, w, 1, 2);
    }
    public callMulti(text: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).drawMultilineText(text, 1, 1, 30, 4, 10, 1);
    }
}

describe("BasePDF", () => {
    it("handles blob and text drawing helpers", () => {
        const pdf = {
            internal: { pageSize: { getWidth: () => 100, getHeight: () => 50 } },
            output: vi.fn(() => new Blob(["x"])),
            setFontSize: vi.fn(),
            getTextWidth: vi.fn((t: string) => t.length * 5),
            text: vi.fn(),
            splitTextToSize: vi.fn(() => ["a", "b"])
        };
        const t = new TestPdf(new FunkUebung("dev"), pdf as never);
        expect(t.blob()).toBeInstanceOf(Blob);
        t.callAdjust("abcdef", 10);
        t.callMulti("x\ny");
        t.callMulti("");
        expect(pdf.text).toHaveBeenCalled();
    });
});
