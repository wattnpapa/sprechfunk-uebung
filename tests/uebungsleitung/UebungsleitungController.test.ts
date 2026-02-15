import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    parseHash: vi.fn(),
    getUebung: vi.fn(),
    loadStorage: vi.fn(),
    saveStorage: vi.fn(),
    renderMeta: vi.fn(),
    renderTeilnehmerListe: vi.fn(),
    renderNachrichtenListe: vi.fn(),
    updateProgress: vi.fn(),
    updateOperationalStats: vi.fn(),
    updateHeatmap: vi.fn(),
    updateTeilnehmerTimeline: vi.fn(),
    bindMetaEvents: vi.fn(),
    bindTeilnehmerEvents: vi.fn(),
    bindNachrichtenEvents: vi.fn(),
    track: vi.fn(),
    uiConfirm: vi.fn(() => true),
    uiSuccess: vi.fn(),
    uiError: vi.fn(),
    getDocumentById: vi.fn(),
    generateDebrief: vi.fn(),
    jspdfSave: vi.fn()
}));

vi.mock("../../src/core/router", () => ({ router: { parseHash: mocks.parseHash } }));
vi.mock("../../src/services/FirebaseService", () => ({
    FirebaseService: class { getUebung = mocks.getUebung; }
}));
vi.mock("../../src/services/storage", () => ({
    loadUebungsleitungStorage: mocks.loadStorage,
    saveUebungsleitungStorage: mocks.saveStorage
}));
vi.mock("../../src/uebungsleitung/UebungsleitungView", () => ({
    UebungsleitungView: class {
        renderMeta = mocks.renderMeta;
        renderTeilnehmerListe = mocks.renderTeilnehmerListe;
        renderNachrichtenListe = mocks.renderNachrichtenListe;
        updateProgress = mocks.updateProgress;
        updateOperationalStats = mocks.updateOperationalStats;
        updateHeatmap = mocks.updateHeatmap;
        updateTeilnehmerTimeline = mocks.updateTeilnehmerTimeline;
        bindMetaEvents = mocks.bindMetaEvents;
        bindTeilnehmerEvents = mocks.bindTeilnehmerEvents;
        bindNachrichtenEvents = mocks.bindNachrichtenEvents;
    }
}));
vi.mock("../../src/services/analytics", () => ({ analytics: { track: mocks.track } }));
vi.mock("../../src/state/store", () => ({ store: { setState: vi.fn() } }));
vi.mock("../../src/core/UiFeedback", () => ({
    uiFeedback: {
        confirm: mocks.uiConfirm,
        success: mocks.uiSuccess,
        error: mocks.uiError
    }
}));
vi.mock("../../src/services/pdfGenerator", () => ({
    default: {
        generateTeilnehmerDebriefPdfBlob: mocks.generateDebrief,
        sanitizeFileName: (v: string) => v
    }
}));
vi.mock("jspdf", () => ({
    jsPDF: class {
        save = mocks.jspdfSave;
    }
}));
vi.mock("../../src/pdf/Uebungsleitung", () => ({
    Uebungsleitung: class {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(_uebung: unknown, _pdf: unknown, _storage: unknown) {}
        draw() {}
    }
}));

describe("UebungsleitungController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("window", { location: { reload: vi.fn() } });
        vi.stubGlobal("localStorage", { removeItem: vi.fn() });
        const idEl = { textContent: "" };
        const area = { style: { display: "none" } };
        vi.stubGlobal("document", {
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() },
            getElementById: (id: string) => {
                if (id === "uebungsId") return idEl;
                if (id === "uebungsleitungArea") return area;
                if (id === "nachrichtenTextFilterInput") {
                    return {
                        id,
                        value: "abc",
                        selectionStart: 1,
                        focus: vi.fn(),
                        setSelectionRange: vi.fn()
                    };
                }
                return { textContent: "" };
            },
            activeElement: null
        });
        const urlCtor = globalThis.URL;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (urlCtor as any).createObjectURL = vi.fn(() => "blob:test");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (urlCtor as any).revokeObjectURL = vi.fn();
        mocks.loadStorage.mockReturnValue({ teilnehmer: {}, nachrichten: {}, version: 1, uebungId: "u1", lastUpdated: "" });
        mocks.generateDebrief.mockResolvedValue(new Blob(["pdf"]));
    });

    it("init exits without id and with missing exercise", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        mocks.parseHash.mockReturnValueOnce({ params: [] });
        await c.init();
        expect(mocks.renderMeta).not.toHaveBeenCalled();

        mocks.parseHash.mockReturnValueOnce({ params: ["u1"] });
        mocks.getUebung.mockResolvedValueOnce(null);
        await c.init();
        expect(mocks.renderMeta).not.toHaveBeenCalled();
    });

    it("init renders and binds events on success", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        mocks.parseHash.mockReturnValue({ params: ["u1"] });
        mocks.getUebung.mockResolvedValue({
            id: "u1",
            name: "Ü",
            teilnehmerListe: ["A"],
            nachrichten: { A: [{ id: 1, empfaenger: ["B"], nachricht: "x" }] }
        });
        await c.init();
        expect(mocks.renderMeta).toHaveBeenCalled();
        expect(mocks.renderNachrichtenListe).toHaveBeenCalled();
        expect(mocks.bindNachrichtenEvents).toHaveBeenCalled();
    });

    it("calculates ETA labels across branches", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = { nachrichten: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateEtaLabel([])).toBe("ETA: –");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = {
            nachrichten: {
                "A__1": { abgesetztUm: new Date("2026-01-01T10:00:00Z").toISOString() },
                "A__2": { abgesetztUm: new Date("2026-01-01T10:01:00Z").toISOString() }
            }
        };
        const list = [
            { sender: "A", nr: 1, empfaenger: ["B"], text: "x" },
            { sender: "A", nr: 2, empfaenger: ["B"], text: "x" },
            { sender: "A", nr: 3, empfaenger: ["B"], text: "x" }
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const label = (c as any).calculateEtaLabel(list);
        expect(label).toContain("ETA:");
        expect(label).toContain("Rest:");
    });

    it("calculates tempo/load/heatmap/timeline labels", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).uebung = { teilnehmerListe: ["A", "B", "C"] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = {
            nachrichten: {
                "A__1": { abgesetztUm: "2026-01-01T10:00:00.000Z" },
                "B__2": { abgesetztUm: "2026-01-01T10:01:00.000Z" },
                "A__3": { abgesetztUm: "2026-01-01T10:02:00.000Z" }
            }
        };
        const flat = [
            { sender: "A", nr: 1, empfaenger: ["B"], text: "x" },
            { sender: "B", nr: 2, empfaenger: ["Alle"], text: "y" },
            { sender: "A", nr: 3, empfaenger: ["C"], text: "z" }
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sent = (c as any).collectSentNachrichten(flat);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateTempoLabel(sent)).toContain("Tempo:");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateLoadLabel(sent)).toContain("Funklast:");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bins = (c as any).buildHeatmapBins(sent);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateHeatmapLabel(bins)).toContain("Heatmap 5m:");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const timeline = (c as any).buildTeilnehmerTimeline(flat);
        expect(timeline.length).toBeGreaterThan(0);
    });

    it("action methods mutate storage and track analytics", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = { teilnehmer: {}, nachrichten: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(c as any, "renderTeilnehmer").mockImplementation(() => {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(c as any, "renderNachrichten").mockImplementation(() => {});

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).markAngemeldet("A");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).updateLoesungswort("A", "WORT");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).updateStaerke("A", 0, "1/2");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).updateNotiz("A", "Notiz");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).toggleStaerkeDetails();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).markNachrichtAbgesetzt("A", 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).resetNachricht("A", 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).persistNachrichtNotiz("A", 1, "x");

        expect(mocks.saveStorage).toHaveBeenCalled();
        expect(mocks.track).toHaveBeenCalled();
    });

    it("download debrief handles success and error", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).uebung = { id: "u1", name: "Ü", teilnehmerListe: [], nachrichten: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = { teilnehmer: {}, nachrichten: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (c as any).downloadTeilnehmerDebrief("Alpha");
        expect(mocks.uiSuccess).toHaveBeenCalled();

        mocks.generateDebrief.mockRejectedValueOnce(new Error("fail"));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (c as any).downloadTeilnehmerDebrief("Alpha");
        expect(mocks.uiError).toHaveBeenCalled();
    });

    it("exports PDF and handles reset/init wrapper", async () => {
        const { UebungsleitungController, initUebungsleitung } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).uebung = { id: "u1", name: "Ü", teilnehmerListe: [], nachrichten: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = { teilnehmer: {}, nachrichten: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (c as any).exportPdf();
        expect(mocks.jspdfSave).toHaveBeenCalled();

        mocks.uiConfirm.mockReturnValueOnce(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).resetData();
        expect(localStorage.removeItem).not.toHaveBeenCalled();
        mocks.uiConfirm.mockReturnValueOnce(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).uebungId = "u1";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).resetData();
        expect(localStorage.removeItem).toHaveBeenCalledWith("sprechfunk:uebungsleitung:u1");

        mocks.parseHash.mockReturnValue({ params: [] });
        await initUebungsleitung({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((document.getElementById("uebungsleitungArea") as any).style.display).toBe("block");
    });

    it("covers metric helper edge branches", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateTempoLabel([])).toBe("Tempo: –");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateLoadLabel([])).toBe("Funklast: –");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateHeatmapLabel([])).toBe("Heatmap 5m: –");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).buildHeatmapBins([])).toEqual([]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).uebung = { teilnehmerListe: ["A"] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = { nachrichten: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sent = (c as any).collectSentNachrichten([{ sender: "A", nr: 1, empfaenger: ["A"], text: "x" }]);
        expect(sent).toEqual([]);
    });

    it("covers eta/tempo/load/timeline additional branches", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = {
            nachrichten: {
                "A__1": { abgesetztUm: "2026-01-01T10:00:00.000Z" },
                "A__2": { abgesetztUm: "2026-01-01T10:00:00.000Z" }
            }
        };
        const flat = [
            { sender: "A", nr: 1, empfaenger: ["B"], text: "x" },
            { sender: "A", nr: 2, empfaenger: ["B"], text: "y" }
        ];
        // avgInterval <= 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateEtaLabel(flat)).toBe("ETA: –");

        // remaining <= 0 branch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage.nachrichten["A__2"].abgesetztUm = "2026-01-01T10:01:00.000Z";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateEtaLabel(flat)).toContain("Rest: 0");

        // tempo avg<=0 branch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateTempoLabel([{ sender: "A", empfaenger: ["B"], ts: 1 }, { sender: "A", empfaenger: ["B"], ts: 1 }])).toBe("Tempo: –");

        // load top entry tie-break and map empty top
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).uebung = { teilnehmerListe: ["A", "B", "C"] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const load = (c as any).calculateLoadLabel([
            { sender: "B", empfaenger: ["A"], ts: 1 },
            { sender: "A", empfaenger: ["B"], ts: 2 }
        ]);
        expect(load).toContain("Funklast:");

        // timeline when storage/uebung missing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).buildTeilnehmerTimeline(flat)).toEqual([]);
    });

    it("covers guard branches for action methods with missing state", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).markAngemeldet("A");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).updateLoesungswort("A", "X");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).updateStaerke("A", 0, "1");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).updateNotiz("A", "n");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).markNachrichtAbgesetzt("A", 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).resetNachricht("A", 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).persistNachrichtNotiz("A", 1, "n");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (c as any).downloadTeilnehmerDebrief("A");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (c as any).exportPdf();
        expect(true).toBe(true);
    });

    it("covers render flow with active text filter focus restore", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        const focus = vi.fn();
        const setSelectionRange = vi.fn();
        vi.stubGlobal("document", {
            activeElement: { id: "nachrichtenTextFilterInput", selectionStart: 2 },
            getElementById: (id: string) => {
                if (id === "nachrichtenTextFilterInput") {
                    return { value: "abc", focus, setSelectionRange };
                }
                if (id === "uebungsId") return { textContent: "" };
                return { textContent: "" };
            },
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).uebung = {
            teilnehmerListe: ["A", "B"],
            nachrichten: { A: [{ id: 1, empfaenger: ["Alle"], nachricht: "x" }], B: [] }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = {
            nachrichten: { "A__1": { abgesetztUm: "2026-01-01T10:00:00.000Z" } },
            teilnehmer: {}
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).textFilter = "ab";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).renderNachrichten();
        expect(focus).toHaveBeenCalled();
        expect(setSelectionRange).toHaveBeenCalled();
    });

    it("invokes bound callbacks from init to cover interaction paths", async () => {
        vi.useFakeTimers();
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        mocks.parseHash.mockReturnValue({ params: ["u1"] });
        mocks.getUebung.mockResolvedValue({
            id: "u1",
            name: "Ü",
            teilnehmerListe: ["A", "B"],
            nachrichten: {
                A: [{ id: 1, empfaenger: ["B"], nachricht: "alpha" }],
                B: [{ id: 2, empfaenger: ["Alle"], nachricht: "bravo" }]
            }
        });
        mocks.loadStorage.mockReturnValue({
            teilnehmer: {},
            nachrichten: {},
            version: 1,
            uebungId: "u1",
            lastUpdated: ""
        });
        await c.init();

        const teilnehmerArgs = mocks.bindTeilnehmerEvents.mock.calls.at(-1);
        const nachrichtenArgs = mocks.bindNachrichtenEvents.mock.calls.at(-1);
        expect(teilnehmerArgs).toBeTruthy();
        expect(nachrichtenArgs).toBeTruthy();
        if (teilnehmerArgs) {
            teilnehmerArgs[0]("A");
            teilnehmerArgs[1]("A", "wort");
            teilnehmerArgs[2]("A", 0, "1");
            teilnehmerArgs[3]("A", "note");
            teilnehmerArgs[4]();
        }
        if (nachrichtenArgs) {
            nachrichtenArgs[0]("A", 1);
            nachrichtenArgs[1]("A", 1);
            nachrichtenArgs[2]("A", 1, "x");
            nachrichtenArgs[3]("A");
            nachrichtenArgs[4]("B");
            nachrichtenArgs[5](true);
            nachrichtenArgs[6]("alp");
        }
        await vi.runAllTimersAsync();
        expect(mocks.saveStorage).toHaveBeenCalled();
        vi.useRealTimers();
    });
});
