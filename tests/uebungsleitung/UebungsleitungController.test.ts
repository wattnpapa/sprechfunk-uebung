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
    uiConfirm: vi.fn(() => true),
    uiSuccess: vi.fn(),
    uiError: vi.fn(),
    getDocumentById: vi.fn(),
    generateDebrief: vi.fn(),
    jspdfSave: vi.fn(),
    downloadUebungsleitungPdf: vi.fn(),
    updateLiveSyncState: vi.fn(),
    publishLeitungPublic: vi.fn(),
    publishLeitungInternal: vi.fn(),
    subscribeAlleTeilnehmer: vi.fn(),
    subscribeLeitungPublic: vi.fn(),
    subscribeLeitungInternal: vi.fn(),
    liveFlush: vi.fn().mockResolvedValue(true),
    liveState: { value: "live" as string },
    showLadefehler: vi.fn(),
    renderLage: vi.fn(),
    bindLageEvents: vi.fn(),
    setResetModus: vi.fn(),
    zeigeRueckgaengig: vi.fn(),
    setCockpitVisible: vi.fn(),
    setCockpitBasisInputValue: vi.fn(),
    bindCockpitEvents: vi.fn(),
    updateCockpit: vi.fn(),
    scrollZuPlanZustand: vi.fn(),
    liveDispose: vi.fn(),
    schliesseRueckgaengig: vi.fn(),
    setTeilnehmerEingeklappt: vi.fn(),
    bindTeilnehmerEinklappen: vi.fn(),
    zeigeZurueckgesetzt: vi.fn(),
    viewDispose: vi.fn()
}));

vi.mock("../../src/services/LiveStatusService", () => ({
    LiveStatusService: class {
        public enabled = true;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(_db: unknown, _uebungId: string) {}
        onStateChange = (cb: (state: string) => void) => cb("live");
        onSyncInfo = (cb: (info: { state: string; offeneAenderungen: number }) => void) => cb({ state: "live", offeneAenderungen: 0 });
        publishLeitungPublic = mocks.publishLeitungPublic;
        publishLeitungInternal = mocks.publishLeitungInternal;
        subscribeAlleTeilnehmer = mocks.subscribeAlleTeilnehmer;
        subscribeLeitungPublic = mocks.subscribeLeitungPublic;
        subscribeLeitungInternal = mocks.subscribeLeitungInternal;
        flush = mocks.liveFlush;
        dispose = mocks.liveDispose;
        getState = () => mocks.liveState.value;
        getOffeneAenderungen = () => 0;
    }
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
        updateLiveSyncState = mocks.updateLiveSyncState;
        showLadefehler = mocks.showLadefehler;
        renderLage = mocks.renderLage;
        bindLageEvents = mocks.bindLageEvents;
        setResetModus = mocks.setResetModus;
        zeigeRueckgaengig = mocks.zeigeRueckgaengig;
        setCockpitVisible = mocks.setCockpitVisible;
        setCockpitBasisInputValue = mocks.setCockpitBasisInputValue;
        bindCockpitEvents = mocks.bindCockpitEvents;
        updateCockpit = mocks.updateCockpit;
        scrollZuPlanZustand = mocks.scrollZuPlanZustand;
        schliesseRueckgaengig = mocks.schliesseRueckgaengig;
        setTeilnehmerEingeklappt = mocks.setTeilnehmerEingeklappt;
        bindTeilnehmerEinklappen = mocks.bindTeilnehmerEinklappen;
        zeigeZurueckgesetzt = mocks.zeigeZurueckgesetzt;
        dispose = mocks.viewDispose;
    }
}));
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
        downloadUebungsleitungPDF: mocks.downloadUebungsleitungPdf,
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
        vi.stubGlobal("window", {
            location: { reload: vi.fn() },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        });
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
        // Keine leeren Karten: eine klare Meldung mit der geprüften ID.
        expect(mocks.showLadefehler).toHaveBeenCalledTimes(2);
        expect(mocks.showLadefehler.mock.calls[1]?.[0]).toContain("nicht gefunden");
        expect(mocks.showLadefehler.mock.calls[1]?.[1]).toBe("u1");

        mocks.parseHash.mockReturnValueOnce({ params: ["u1"] });
        mocks.getUebung.mockRejectedValueOnce(new Error("client is offline"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        await c.init();
        expect(mocks.showLadefehler.mock.calls[2]?.[0]).toContain("keine Verbindung");
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
        const list = [1, 2, 3, 4, 5, 6, 7].map(nr => ({ sender: "A", nr, empfaenger: ["B"], text: "x" }));
        // Zwei Markierungen sind keine Grundlage für eine Hochrechnung.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateEtaLabel(list)).toBe("ETA: – (zu wenig Daten)");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage.nachrichten = Object.fromEntries([1, 2, 3, 4, 5].map(nr => [
            `A__${nr}`,
            { abgesetztUm: new Date(Date.UTC(2026, 0, 1, 10, nr)).toISOString() }
        ]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const label = (c as any).calculateEtaLabel(list);
        expect(label).toContain("ETA:");
        expect(label).toContain("Rest: 2 min");
        expect(label).toContain("aus 5 Nachrichten");

        // Nachgetragene Zeiten zählen nicht.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage.nachrichten["A__5"].nachgetragen = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateEtaLabel(list)).toBe("ETA: – (zu wenig Daten)");
    });

    it("calculates tempo/load/heatmap/timeline labels", async () => {
        const a = await import("../../src/uebungsleitung/auswertung");
        const teilnehmer = ["A", "B", "C"];
        const effektiv = {
            "A__1": { abgesetztUm: "2026-01-01T10:00:00.000Z", erledigtUm: "2026-01-01T10:00:00.000Z" },
            "B__2": { abgesetztUm: "2026-01-01T10:01:00.000Z", erledigtUm: "2026-01-01T10:01:00.000Z" },
            "A__3": { abgesetztUm: "2026-01-01T10:02:00.000Z", erledigtUm: "2026-01-01T10:02:00.000Z" }
        };
        const flat = [
            { sender: "A", nr: 1, empfaenger: ["B"], text: "x" },
            { sender: "B", nr: 2, empfaenger: ["Alle"], text: "y" },
            { sender: "A", nr: 3, empfaenger: ["C"], text: "z" }
        ];
        const sent = a.collectSentNachrichten(flat, effektiv);
        expect(a.calculateTempoLabel(sent)).toContain("Tempo:");
        expect(a.calculateLoadLabel(sent, teilnehmer)).toContain("Funklast:");
        const bins = a.buildHeatmapBins(sent);
        expect(a.calculateHeatmapLabel(bins)).toContain("Sprüche je 5 min:");
        const timeline = a.buildTeilnehmerTimeline(flat, effektiv, teilnehmer);
        expect(timeline.length).toBeGreaterThan(0);
    });

    it("action methods mutate storage", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = { teilnehmer: {}, nachrichten: {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(c as any, "renderTeilnehmer").mockImplementation(() => {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(c as any, "renderNachrichten").mockImplementation(() => {});

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.markAngemeldet("A");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.updateLoesungswort("A", "WORT");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.updateStaerke("A", 0, "1/2");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.updateNotiz("A", "Notiz");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).toggleStaerkeDetails();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.markNachrichtAbgesetzt("A", 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.resetNachricht("A", 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.persistNachrichtNotiz("A", 1, "x");

        expect(mocks.saveStorage).toHaveBeenCalled();
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
        // B2: Export über den PDF-Dienst (dort ist autoTable angemeldet), mit aktuellem Stand.
        expect(mocks.downloadUebungsleitungPdf).toHaveBeenCalledWith(
            expect.objectContaining({ id: "u1" }),
            expect.objectContaining({ nachrichten: {} })
        );

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
        const a = await import("../../src/uebungsleitung/auswertung");
        expect(a.calculateTempoLabel([])).toBe("Tempo: –");
        expect(a.calculateLoadLabel([], [])).toBe("Funklast: –");
        expect(a.calculateHeatmapLabel([])).toBe("Sprüche je 5 min: –");
        expect(a.buildHeatmapBins([])).toEqual([]);

        const sent = a.collectSentNachrichten([{ sender: "A", nr: 1, empfaenger: ["A"], text: "x" }], {});
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
        // alles erledigt
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateEtaLabel(flat)).toContain("Rest: 0");

        // remaining <= 0 branch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage.nachrichten["A__2"].abgesetztUm = "2026-01-01T10:01:00.000Z";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateEtaLabel(flat)).toContain("Rest: 0");

        // ohne Speicher keine Hochrechnung
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).storage = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((c as any).calculateEtaLabel(flat)).toBe("ETA: –");

        const a = await import("../../src/uebungsleitung/auswertung");
        // tempo avg<=0 branch
        expect(a.calculateTempoLabel([{ sender: "A", empfaenger: ["B"], ts: 1 }, { sender: "A", empfaenger: ["B"], ts: 1 }])).toBe("Tempo: –");

        // load top entry tie-break and map empty top
        const load = a.calculateLoadLabel([
            { sender: "B", empfaenger: ["A"], ts: 1 },
            { sender: "A", empfaenger: ["B"], ts: 2 }
        ], ["A", "B", "C"]);
        expect(load).toBe("Funklast: sendet am meisten A (1) | empfängt am meisten A (1)");

        // timeline without participants and without erledigte Nachrichten
        expect(a.buildTeilnehmerTimeline(flat, {}, [])).toEqual([]);
    });

    it("covers guard branches for action methods with missing state", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.markAngemeldet("A");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.updateLoesungswort("A", "X");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.updateStaerke("A", 0, "1");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.updateNotiz("A", "n");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.markNachrichtAbgesetzt("A", 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.resetNachricht("A", 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any).aktionen.persistNachrichtNotiz("A", 1, "n");
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
            const callbacks = teilnehmerArgs[0] as {
                onAnmelden: (name: string) => void;
                onLoesungswort: (name: string, val: string) => void;
                onStaerke: (name: string, idx: number, val: string) => void;
                onNotiz: (name: string, val: string) => void;
                onToggleDetails: () => void;
            };
            callbacks.onAnmelden("A");
            callbacks.onLoesungswort("A", "wort");
            callbacks.onStaerke("A", 0, "1");
            callbacks.onNotiz("A", "note");
            callbacks.onToggleDetails();
        }
        if (nachrichtenArgs) {
            const callbacks = nachrichtenArgs[0] as {
                onAbgesetzt: (sender: string, nr: number) => void;
                onReset: (sender: string, nr: number) => void;
                onNotiz: (sender: string, nr: number, val: string) => void;
                onFilterSender: (val: string) => void;
                onFilterEmpfaenger: (val: string) => void;
                onToggleHide: (val: boolean) => void;
                onFilterText: (val: string) => void;
            };
            callbacks.onAbgesetzt("A", 1);
            callbacks.onReset("A", 1);
            callbacks.onNotiz("A", 1, "x");
            callbacks.onFilterSender("A");
            callbacks.onFilterEmpfaenger("B");
            callbacks.onToggleHide(true);
            callbacks.onFilterText("alp");
        }
        await vi.runAllTimersAsync();
        expect(mocks.saveStorage).toHaveBeenCalled();
        vi.useRealTimers();
    });
});

describe("UebungsleitungController – THW-Review", () => {
    const anmeldeUebung = {
        id: "u1",
        name: "Ü",
        anmeldungAktiv: true,
        teilnehmerListe: ["A", "B"],
        nachrichten: {
            A: [{ id: 1, empfaenger: ["B"], nachricht: "Ich melde mich an" }, { id: 2, empfaenger: ["B"], nachricht: "x" }],
            B: [{ id: 1, empfaenger: ["A"], nachricht: "Ich melde mich an" }]
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function controllerMit(uebung: any, storage: any = { teilnehmer: {}, nachrichten: {} }) {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const intern = c as any;
        intern.uebung = uebung;
        intern.storage = storage;
        return intern;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.liveState.value = "live";
        mocks.liveFlush.mockResolvedValue(true);
        vi.stubGlobal("window", {
            location: { reload: vi.fn() },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        });
        vi.stubGlobal("localStorage", { removeItem: vi.fn() });
        vi.stubGlobal("document", {
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() },
            getElementById: () => ({ textContent: "" }),
            activeElement: null
        });
        const urlCtor = globalThis.URL;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (urlCtor as any).createObjectURL = vi.fn(() => "blob:test");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (urlCtor as any).revokeObjectURL = vi.fn();
        mocks.generateDebrief.mockResolvedValue(new Blob(["pdf"]));
    });

    it("koppelt „Anmeldung erhalten“ und Anmelde-Funkspruch in beide Richtungen", async () => {
        const c = await controllerMit(anmeldeUebung);

        c.aktionen.markAngemeldet("A");
        expect(c.storage.teilnehmer.A.angemeldetUm).toBeTruthy();
        expect(c.storage.nachrichten["A__1"].abgesetztUm).toBe(c.storage.teilnehmer.A.angemeldetUm);

        c.aktionen.markNachrichtAbgesetzt("B", 1);
        expect(c.storage.teilnehmer.B.angemeldetUm).toBe(c.storage.nachrichten["B__1"].abgesetztUm);
        expect(mocks.saveStorage).toHaveBeenCalled();
    });

    it("nimmt eine Anmeldung einzeln zurück und bietet Rückgängig an", async () => {
        const c = await controllerMit(anmeldeUebung);
        c.aktionen.markAngemeldet("A");
        const vorher = c.storage.teilnehmer.A.angemeldetUm;

        c.aktionen.anmeldungZuruecknehmen("A");
        expect(c.storage.teilnehmer.A.angemeldetUm).toBeUndefined();
        expect(c.storage.nachrichten["A__1"].abgesetztUm).toBeUndefined();
        expect(c.storage.teilnehmer.B).toBeUndefined();
        expect(mocks.zeigeRueckgaengig).toHaveBeenCalledWith(expect.stringContaining("Anmeldung von A"), expect.any(Function));

        const undo = mocks.zeigeRueckgaengig.mock.calls.at(-1)?.[1] as () => void;
        undo();
        expect(c.storage.teilnehmer.A.angemeldetUm).toBe(vorher);
        expect(c.storage.nachrichten["A__1"].abgesetztUm).toBe(vorher);
    });

    it("lässt einen Doppeltipp die Markierung nicht aufheben", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-04T19:00:00Z"));
        const { RUECKNAHME_SPERRE_MS } = await import("../../src/uebungsleitung");
        const c = await controllerMit({ ...anmeldeUebung, anmeldungAktiv: false });

        c.aktionen.markNachrichtAbgesetzt("A", 2);
        const zeit = c.storage.nachrichten["A__2"].abgesetztUm;
        vi.advanceTimersByTime(100);
        // Zweiter Tipp auf dieselbe Aktion: nichts ändert sich.
        c.aktionen.markNachrichtAbgesetzt("A", 2);
        expect(c.storage.nachrichten["A__2"].abgesetztUm).toBe(zeit);
        // Tipp auf „zurücknehmen“ innerhalb der Sperre: ebenfalls nichts.
        c.aktionen.resetNachricht("A", 2);
        expect(c.storage.nachrichten["A__2"].abgesetztUm).toBe(zeit);
        expect(mocks.zeigeRueckgaengig).not.toHaveBeenCalled();
        const letzterPlan = mocks.renderNachrichtenListe.mock.calls.at(-1)?.[0] as { ruecknahmeGesperrt: Set<string> };
        expect(letzterPlan.ruecknahmeGesperrt.has("A__2")).toBe(true);

        vi.advanceTimersByTime(RUECKNAHME_SPERRE_MS + 100);
        c.aktionen.resetNachricht("A", 2);
        expect(c.storage.nachrichten["A__2"].abgesetztUm).toBeUndefined();

        // Rückgängig stellt den ursprünglichen Zeitpunkt wieder her.
        const undo = mocks.zeigeRueckgaengig.mock.calls.at(-1)?.[1] as () => void;
        undo();
        expect(c.storage.nachrichten["A__2"].abgesetztUm).toBe(zeit);
        vi.useRealTimers();
    });

    it("nimmt mit dem Anmelde-Funkspruch auch die Anmeldung zurück", async () => {
        vi.useFakeTimers();
        const c = await controllerMit(anmeldeUebung);
        c.aktionen.markNachrichtAbgesetzt("A", 1);
        vi.advanceTimersByTime(5000);
        c.aktionen.resetNachricht("A", 1);
        expect(c.storage.teilnehmer.A.angemeldetUm).toBeUndefined();
        (mocks.zeigeRueckgaengig.mock.calls.at(-1)?.[1] as () => void)();
        expect(c.storage.teilnehmer.A.angemeldetUm).toBeTruthy();
        vi.useRealTimers();
    });

    it("trägt Papierzeiten nach und kennzeichnet sie", async () => {
        const c = await controllerMit(anmeldeUebung);

        c.aktionen.zeitNachtragen("A", 2, "00:05");
        const eintrag = c.storage.nachrichten["A__2"];
        expect(eintrag.nachgetragen).toBe(true);
        expect(new Date(eintrag.abgesetztUm).getMinutes()).toBe(5);

        c.aktionen.zeitNachtragen("A", 2, "kaputt");
        expect(mocks.uiError).toHaveBeenCalled();

        // Nachtrag des Anmelde-Funkspruchs meldet mit derselben Zeit an.
        c.aktionen.zeitNachtragen("B", 1, "00:01");
        expect(c.storage.teilnehmer.B.angemeldetUm).toBe(c.storage.nachrichten["B__1"].abgesetztUm);
    });

    it("bestätigt gemeldete Nachrichten mit der Zeit der Teilnehmer-Meldung", async () => {
        const c = await controllerMit(anmeldeUebung);
        c.teilnehmerLiveDocs = [{
            version: 1, teilnehmerId: "X", teilnehmer: "A", lastUpdated: "",
            nachrichten: { "2": { uebertragen: true, uebertragenUm: "2026-10-04T18:10:00.000Z" } }
        }];

        c.aktionen.gemeldeteBestaetigen();
        expect(c.storage.nachrichten["A__2"].abgesetztUm).toBe("2026-10-04T18:10:00.000Z");
        expect(mocks.uiSuccess).toHaveBeenCalledWith(expect.stringContaining("1 gemeldete Nachricht bestätigt – mit der Meldezeit des Teilnehmers"));

        mocks.uiSuccess.mockClear();
        c.aktionen.gemeldeteBestaetigen();
        expect(mocks.uiSuccess).not.toHaveBeenCalled();
    });

    it("gibt dem Debrief Selbstmeldungen und die Anmeldung über den Funkspruch mit", async () => {
        const c = await controllerMit(anmeldeUebung, {
            teilnehmer: {},
            nachrichten: { "A__1": { abgesetztUm: "2026-10-04T18:00:00.000Z" } }
        });
        c.teilnehmerLiveDocs = [{
            version: 1, teilnehmerId: "X", teilnehmer: "A", lastUpdated: "",
            nachrichten: { "2": { uebertragen: true, uebertragenUm: "2026-10-04T18:10:00.000Z" } }
        }];

        await c.downloadTeilnehmerDebrief("A");
        const storage = mocks.generateDebrief.mock.calls.at(-1)?.[1];
        expect(storage.nachrichten["A__2"].gemeldetUm).toBe("2026-10-04T18:10:00.000Z");
        expect(storage.teilnehmer.A.angemeldetUm).toBe("2026-10-04T18:00:00.000Z");
        // Der eigene Speicher bleibt unberührt.
        expect(c.storage.teilnehmer.A).toBeUndefined();
    });

    it("setzt die X-Zeit-Basis verbindlich und übernimmt keine Rollenspieler-Basis", async () => {
        const c = await controllerMit({
            ...anmeldeUebung,
            spielModus: "xZeit",
            fuehrungsstelle: { slug: "s", beuebteStelle: "A", uebergeordnet: "B", unterstellt: [], beginn: "09:00" }
        });
        c.teilnehmerLiveDocs = [{ version: 1, teilnehmerId: "X", teilnehmer: "B", lastUpdated: "", nachrichten: {}, xZeitBasis: "08:55" }];

        expect(c.cockpit.basis()).toBeNull();
        c.cockpit.update();
        const anzeige = mocks.updateCockpit.mock.calls.at(-1)?.[0];
        expect(anzeige.vorschlag).toBe("09:00");
        expect(anzeige.basisHinweis).toContain("Geplanter Übungsbeginn");
        expect(anzeige.abweichungen).toEqual(["B (08:55)"]);
        expect(anzeige.soll).toBeNull();

        c.liveStatus = { enabled: true, publishLeitungPublic: mocks.publishLeitungPublic, publishLeitungInternal: mocks.publishLeitungInternal };
        c.cockpit.aendereBasis("09:00", "eingabe");
        expect(c.storage.xZeitBasisGeaendertUm).toBeTruthy();
        expect(mocks.publishLeitungPublic).toHaveBeenLastCalledWith(expect.objectContaining({ xZeitBasis: "09:00" }));
        expect(c.cockpit.basis()).toBe("09:00");
        const nachher = mocks.updateCockpit.mock.calls.at(-1)?.[0];
        expect(nachher.vorschlag).toBeNull();
        expect(nachher.basisHinweis).toContain("gilt für alle");
    });

    it("schlägt ohne geplanten Beginn die früheste Rollenspieler-Basis vor, ohne sie zu übernehmen", async () => {
        const c = await controllerMit({ ...anmeldeUebung, spielModus: "xZeit" });
        c.teilnehmerLiveDocs = [{ version: 1, teilnehmerId: "X", teilnehmer: "B", lastUpdated: "", nachrichten: {}, xZeitBasis: "08:55" }];
        c.cockpit.update();
        const anzeige = mocks.updateCockpit.mock.calls.at(-1)?.[0];
        expect(anzeige.vorschlag).toBe("08:55");
        expect(anzeige.basisHinweis).toContain("nicht übernommen");
    });

    it("zeigt im X-Zeit-Plan Soll-Uhrzeit und Fälligkeit", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 4, 9, 10, 0));
        const c = await controllerMit({
            id: "u1", name: "Ü", spielModus: "xZeit", xZeitIntervallMinuten: 1, teilnehmerListe: ["A"],
            nachrichten: { A: [
                { id: 1, empfaenger: ["B"], nachricht: "a", xZeitSlot: 3 },
                { id: 2, empfaenger: ["B"], nachricht: "b", xZeitSlot: 10 },
                { id: 3, empfaenger: ["B"], nachricht: "c", xZeitSlot: 15 }
            ] }
        }, { teilnehmer: {}, nachrichten: {}, xZeitBasis: "09:00" });

        c.renderNachrichten();
        const optionen = mocks.renderNachrichtenListe.mock.calls.at(-1)?.[0];
        expect(optionen.sollUhrzeit).toEqual({ "A__1": "09:03", "A__2": "09:10", "A__3": "09:15" });
        expect(optionen.faelligkeit["A__1"].zustand).toBe("ueberfaellig");
        expect(optionen.faelligkeit["A__2"].zustand).toBe("faellig");
        expect(optionen.faelligkeit["A__3"].zustand).toBe("spaeter");
        expect(optionen.nachrichten.map((n: { planNr: number }) => n.planNr)).toEqual([1, 2, 3]);
        const lage = mocks.renderLage.mock.calls.at(-1)?.[0];
        expect(lage.ueberfaellig).toBe(1);
        expect(lage.naechste[0].planNr).toBe(1);
        expect(mocks.updateProgress.mock.calls.at(-1)?.[2]).toBe("Ende laut Plan: 09:15 (noch 3 offen)");
        vi.useRealTimers();
    });

    it("setzt ohne Verbindung nicht für alle zurück und lädt ohne Bestätigung nicht neu", async () => {
        const c = await controllerMit(anmeldeUebung, {
            teilnehmer: { A: { angemeldetUm: "x", notizen: "n" } },
            nachrichten: { "A__1": { abgesetztUm: "x", notiz: "y" } }
        });
        c.uebungId = "u1";
        c.liveStatus = {
            enabled: true,
            getState: () => mocks.liveState.value,
            publishLeitungPublic: mocks.publishLeitungPublic,
            publishLeitungInternal: mocks.publishLeitungInternal,
            flush: mocks.liveFlush
        };

        mocks.liveState.value = "offline";
        c.resetData();
        expect(mocks.uiConfirm).not.toHaveBeenCalled();
        expect(mocks.uiError).toHaveBeenCalledWith(expect.stringContaining("braucht eine Verbindung"));

        mocks.liveState.value = "live";
        mocks.liveFlush.mockResolvedValueOnce(false);
        c.resetData();
        expect(mocks.uiConfirm.mock.calls.at(-1)?.[0]).toContain("1 abgesetzte Nachrichten, 2 Notizen und 1 Anmeldungen");
        expect(mocks.uiConfirm.mock.calls.at(-1)?.[0]).toContain("ALLE");
        await vi.waitFor(() => expect(mocks.uiError).toHaveBeenCalledTimes(2));
        expect(localStorage.removeItem).not.toHaveBeenCalled();
        expect(window.location.reload).not.toHaveBeenCalled();

        c.resetData();
        await vi.waitFor(() => expect(window.location.reload).toHaveBeenCalled());
        expect(localStorage.removeItem).toHaveBeenCalledWith("sprechfunk:uebungsleitung:u1");
    });
});

describe("UebungsleitungController – THW-Review 2026-10-05", () => {
    const fsUebung = {
        id: "u1",
        name: "FS",
        teilnehmerListe: ["Stelle", "EA1"],
        createDate: new Date("2026-10-05T18:00:00.000Z"),
        fuehrungsstelle: { slug: "s", beuebteStelle: "Stelle", uebergeordnet: "Stab", unterstellt: ["EA1"] },
        nachrichten: { EA1: [{ id: 1, empfaenger: ["Stelle"], nachricht: "a", erwartung: "quittieren", xZeitSlot: 0 }] }
    };
    let speicher: Map<string, string>;

    beforeEach(() => {
        vi.clearAllMocks();
        speicher = new Map();
        const ls = {
            getItem: (k: string) => speicher.get(k) ?? null,
            setItem: (k: string, v: string) => void speicher.set(k, v),
            removeItem: (k: string) => void speicher.delete(k)
        };
        vi.stubGlobal("localStorage", ls);
        vi.stubGlobal("sessionStorage", ls);
        vi.stubGlobal("window", {
            location: { reload: vi.fn(), hash: "#/uebungsleitung/u1" },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        });
        vi.stubGlobal("document", {
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() },
            getElementById: () => ({ textContent: "", style: {} }),
            activeElement: null
        });
        mocks.parseHash.mockReturnValue({ params: ["u1"] });
        mocks.getUebung.mockResolvedValue(fsUebung);
        mocks.loadStorage.mockReturnValue({ teilnehmer: {}, nachrichten: {}, version: 1, uebungId: "u1", lastUpdated: "" });
    });

    it("baut die Übungsleitung für dieselbe Adresse nur einmal auf (offline P3-4: doppelter Debrief)", async () => {
        const { initUebungsleitung } = await import("../../src/uebungsleitung");
        await Promise.all([initUebungsleitung({} as never), initUebungsleitung({} as never)]);
        expect(mocks.getUebung).toHaveBeenCalledTimes(1);
        expect(mocks.bindNachrichtenEvents).toHaveBeenCalledTimes(1);

        // Eine andere Übung ersetzt die alte und räumt ihre Listener ab.
        const vorher = mocks.viewDispose.mock.calls.length;
        (window.location as { hash: string }).hash = "#/uebungsleitung/u2";
        await initUebungsleitung({} as never);
        expect(mocks.getUebung).toHaveBeenCalledTimes(2);
        expect(mocks.viewDispose).toHaveBeenCalledTimes(vorher + 1);
    });

    it("merkt „Abgesetzte ausblenden“ und das Einklappen je Gerät und bestätigt ein Zurücksetzen", async () => {
        speicher.set("sprechfunk:leitungsansicht", JSON.stringify({ hideAbgesetzt: true, teilnehmerEingeklappt: true }));
        speicher.set("sprechfunk:leitung-zurueckgesetzt", JSON.stringify({ uebungId: "u1", um: "2026-10-05T19:05:00.000Z" }));
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        await c.init();
        expect(mocks.renderNachrichtenListe.mock.calls.at(-1)?.[0].hideAbgesetzt).toBe(true);
        expect(mocks.setTeilnehmerEingeklappt).toHaveBeenCalledWith(true);
        expect(mocks.zeigeZurueckgesetzt).toHaveBeenCalledWith("2026-10-05T19:05:00.000Z");

        const toggleHide = mocks.bindNachrichtenEvents.mock.calls[0]?.[0].onToggleHide;
        toggleHide(false);
        expect(JSON.parse(speicher.get("sprechfunk:leitungsansicht") ?? "{}")).toMatchObject({ hideAbgesetzt: false });
        mocks.bindTeilnehmerEinklappen.mock.calls[0]?.[0]();
        expect(mocks.setTeilnehmerEingeklappt).toHaveBeenLastCalledWith(false);
    });

    it("füllt die Lage mit Reaktionen und Verbindung und leitet Plan-Entscheidungen weiter", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        await c.init();
        const lage = mocks.renderLage.mock.calls.at(-1)?.[0];
        expect(lage.reaktionen).toMatchObject({ ausstehend: 0 });
        expect(lage.verbindung).toEqual({ state: "live", offen: 0 });

        const cb = mocks.bindNachrichtenEvents.mock.calls[0]?.[0];
        cb.onAbgesetzt("EA1", 1);
        cb.onReaktion("EA1", 1, "ausgeblieben");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const intern = c as any;
        expect(intern.storage.nachrichten["EA1__1"].reaktion).toBe("ausgeblieben");
        expect(mocks.renderLage.mock.calls.at(-1)?.[0].reaktionen).toMatchObject({ ausgeblieben: 1 });
        cb.onAuslassen("EA1", 1);
        expect(intern.storage.nachrichten["EA1__1"].ausgelassen).toBeUndefined();
        cb.onWiederOeffnen("EA1", 1);

        // Verbindungsverlust zeichnet die Lage neu.
        const vorher = mocks.renderLage.mock.calls.length;
        intern.aufSyncInfo({ state: "offline", offeneAenderungen: 2 });
        expect(mocks.updateLiveSyncState).toHaveBeenLastCalledWith("offline", 2);
        expect(mocks.renderLage.mock.calls.length).toBe(vorher + 1);
        expect(mocks.renderLage.mock.calls.at(-1)?.[0].verbindung).toEqual({ state: "offline", offen: 2 });
        intern.aufSyncInfo({ state: "offline", offeneAenderungen: 3 });
        expect(mocks.renderLage.mock.calls.length).toBe(vorher + 1);

        await intern.exportPdf();
        const stand = mocks.downloadUebungsleitungPdf.mock.calls.at(-1)?.[1];
        expect(stand.teilnehmer.Stelle.notizen).toContain("1 ausgeblieben");
        expect(stand.nachrichten["EA1__1"].notiz).toContain("ausgeblieben");

        c.dispose();
        c.dispose();
        expect(mocks.viewDispose).toHaveBeenCalledTimes(1);
    });

    it("hört nach dem Verlassen während des Ladens auf", async () => {
        const { UebungsleitungController } = await import("../../src/uebungsleitung");
        const c = new UebungsleitungController({} as never);
        const laden = c.init();
        c.dispose();
        await laden;
        expect(mocks.renderMeta).not.toHaveBeenCalled();
    });
});
