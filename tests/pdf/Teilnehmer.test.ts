import { describe, expect, it, vi } from "vitest";
import { Teilnehmer } from "../../src/pdf/Teilnehmer";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("pdf/Teilnehmer", () => {
    it("draws participant report with mocked jsPDF api", () => {
        const pdf = {
            internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
            setFont: vi.fn(() => pdf),
            setFontSize: vi.fn(() => pdf),
            text: vi.fn(() => pdf),
            line: vi.fn(() => pdf),
            setDrawColor: vi.fn(() => pdf),
            getTextWidth: vi.fn(() => 20),
            textWithLink: vi.fn(() => pdf),
            output: vi.fn(() => new Blob(["x"])),
            setPage: vi.fn(),
            addPage: vi.fn(),
            autoTable: vi.fn(function (this: unknown) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (pdf as any).lastAutoTable = { finalY: 100 };
                return this;
            }),
            lastAutoTable: { finalY: 80 },
            getNumberOfPages: vi.fn(() => 2)
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdf as any).getNumberOfPages = vi.fn(() => 2);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pdf as any).setLineDash = vi.fn();

        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A", "B"];
        u.nachrichten = {
            A: [{ id: 1, empfaenger: ["B"], nachricht: "Hallo" }],
            B: []
        };
        const t = new Teilnehmer("A", u, pdf as never);
        t.draw();
        expect(pdf.autoTable).toHaveBeenCalled();
        expect(pdf.text).toHaveBeenCalled();
    });

    it("handles page 1 only and participant table gaps", () => {
        const pdf = {
            internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
            setFont: vi.fn(() => pdf),
            setFontSize: vi.fn(() => pdf),
            text: vi.fn(() => pdf),
            line: vi.fn(() => pdf),
            setDrawColor: vi.fn(() => pdf),
            getTextWidth: vi.fn(() => 20),
            textWithLink: vi.fn(() => pdf),
            output: vi.fn(() => new Blob(["x"])),
            setPage: vi.fn(),
            addPage: vi.fn(),
            autoTable: vi.fn(function (this: unknown) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (pdf as any).lastAutoTable = { finalY: 60 };
                return this;
            }),
            lastAutoTable: { finalY: 60 },
            getNumberOfPages: vi.fn(() => 1)
        };
        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A", "B", "C"];
        u.nachrichten = { A: [] };
        const t = new Teilnehmer("A", u, pdf as never);
        t.draw();
        expect(pdf.textWithLink).toHaveBeenCalled();
    });
});
