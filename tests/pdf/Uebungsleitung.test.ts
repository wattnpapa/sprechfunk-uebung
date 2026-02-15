import { describe, expect, it, vi } from "vitest";
import { Uebungsleitung } from "../../src/pdf/Uebungsleitung";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("pdf/Uebungsleitung", () => {
    it("draws instructor PDF with local data", () => {
        let autoTableCall = 0;
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
            autoTable: vi.fn(function (this: unknown, opts: { didDrawCell?: (data: { section: string; column: { index: number }; cell: { raw: number; x: number; y: number; width: number }; table: { columns: Array<{ width: number }> }; doc: { setDrawColor: (n: number) => void; setLineWidth: (n: number) => void; line: (a: number, b: number, c: number, d: number) => void } }) => void }) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (pdf as any).lastAutoTable = { finalY: 100 };
                autoTableCall += 1;
                if (autoTableCall === 2 && opts?.didDrawCell) {
                    opts.didDrawCell({
                        section: "body",
                        column: { index: 0 },
                        cell: { raw: 1, x: 10, y: 20, width: 12 },
                        table: { columns: [{ width: 12 }, { width: 20 }, { width: 20 }] },
                        doc: {
                            setDrawColor: vi.fn(),
                            setLineWidth: vi.fn(),
                            line: vi.fn()
                        }
                    });
                    // no-op branch
                    opts.didDrawCell({
                        section: "head",
                        column: { index: 1 },
                        cell: { raw: 1, x: 0, y: 0, width: 0 },
                        table: { columns: [{ width: 0 }] },
                        doc: {
                            setDrawColor: vi.fn(),
                            setLineWidth: vi.fn(),
                            line: vi.fn()
                        }
                    });
                }
                return this;
            }),
            lastAutoTable: { finalY: 80 },
            getNumberOfPages: vi.fn(() => 2)
        };

        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A", "B"];
        u.nachrichten = {
            A: [{ id: 1, empfaenger: ["B"], nachricht: "Hallo" }],
            B: [{ id: 1, empfaenger: ["A"], nachricht: "Moin" }]
        };
        const localData = {
            teilnehmer: { A: { angemeldetUm: new Date().toISOString() } },
            nachrichten: { "A__1": { abgesetztUm: new Date().toISOString() } }
        };
        const doc = new Uebungsleitung(u, pdf as never, localData);
        doc.draw();
        expect(pdf.autoTable).toHaveBeenCalled();
        expect(pdf.text).toHaveBeenCalled();
    });

    it("handles missing arrays and single-page footer/header branches", () => {
        const pdf = {
            internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
            setFont: vi.fn(() => pdf),
            setFontSize: vi.fn(() => pdf),
            text: vi.fn(() => pdf),
            line: vi.fn(() => pdf),
            setDrawColor: vi.fn(() => pdf),
            setLineWidth: vi.fn(() => pdf),
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
            getNumberOfPages: vi.fn(() => 1)
        };

        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A"];
        // missing array for sender A and empty text branches
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (u.nachrichten as any) = { A: null };
        const doc = new Uebungsleitung(u, pdf as never, null);
        doc.draw();
        expect(pdf.textWithLink).toHaveBeenCalled();
    });
});
