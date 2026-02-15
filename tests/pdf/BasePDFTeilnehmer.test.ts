import { describe, expect, it, vi } from "vitest";
import { BasePDFTeilnehmer } from "../../src/pdf/BasePDFTeilnehmer";
import { FunkUebung } from "../../src/models/FunkUebung";

class TestTeilnehmerPdf extends BasePDFTeilnehmer {
    draw(): void {}
    public nameOf(n: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).getTeilnehmerAnzeigeName(n);
    }
    public debug() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).drawDebugBox(1, 2, 3, 4);
    }
}

describe("BasePDFTeilnehmer", () => {
    it("formats participant display name and draws debug box", () => {
        const pdf = {
            internal: { pageSize: { getWidth: () => 100, getHeight: () => 50 } },
            output: vi.fn(() => new Blob(["x"])),
            setDrawColor: vi.fn(),
            setLineWidth: vi.fn(),
            rect: vi.fn()
        };
        const u = new FunkUebung("dev");
        u.teilnehmerStellen = { A: "Stelle" };
        const t = new TestTeilnehmerPdf("A", u, pdf as never);
        expect(t.nameOf("A")).toBe("Stelle (A)");
        expect(t.nameOf("B")).toBe("B");
        t.debug();
        expect(pdf.rect).toHaveBeenCalled();
    });
});
