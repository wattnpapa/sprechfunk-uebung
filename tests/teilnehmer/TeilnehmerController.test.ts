import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    parseHash: vi.fn(),
    getUebung: vi.fn(),
    loadTeilnehmerStorage: vi.fn(),
    setState: vi.fn(),
    saveTeilnehmerStorage: vi.fn(),
    clearTeilnehmerStorage: vi.fn(),
    generateTeilnehmerPDFsAsZip: vi.fn(),
    generateMeldevordruckPageBlob: vi.fn(),
    generateNachrichtenvordruckPageBlob: vi.fn(),
    uiSuccess: vi.fn(),
    uiError: vi.fn(),
    uiConfirm: vi.fn(() => true),
    analyticsTrack: vi.fn(),
    renderHeader: vi.fn(),
    renderNachrichten: vi.fn(),
    setDocMode: vi.fn(),
    bindEvents: vi.fn(),
    renderPdfPage: vi.fn().mockResolvedValue(undefined),
    setDocTransmitted: vi.fn()
}));

vi.mock("../../src/teilnehmer/TeilnehmerView", () => ({
    TeilnehmerView: class {
        renderHeader = mocks.renderHeader;
        renderNachrichten = mocks.renderNachrichten;
        setDocMode = mocks.setDocMode;
        bindEvents = mocks.bindEvents;
        renderPdfPage = mocks.renderPdfPage;
        setDocTransmitted = mocks.setDocTransmitted;
    }
}));

vi.mock("../../src/services/FirebaseService", () => ({
    FirebaseService: class {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(_db: unknown) {}
        getUebung = mocks.getUebung;
    }
}));

vi.mock("../../src/services/storage", () => ({
    loadTeilnehmerStorage: mocks.loadTeilnehmerStorage,
    saveTeilnehmerStorage: mocks.saveTeilnehmerStorage,
    clearTeilnehmerStorage: mocks.clearTeilnehmerStorage
}));

vi.mock("../../src/core/router", () => ({
    router: {
        parseHash: mocks.parseHash
    }
}));

vi.mock("../../src/state/store", () => ({
    store: {
        setState: mocks.setState
    }
}));

vi.mock("../../src/services/pdfGenerator", () => ({
    default: {
        generateTeilnehmerPDFsAsZip: mocks.generateTeilnehmerPDFsAsZip,
        generateMeldevordruckPageBlob: mocks.generateMeldevordruckPageBlob,
        generateNachrichtenvordruckPageBlob: mocks.generateNachrichtenvordruckPageBlob,
        sanitizeFileName: (value: string) => value.replace(/\s+/g, "_")
    }
}));

vi.mock("../../src/core/UiFeedback", () => ({
    uiFeedback: {
        success: mocks.uiSuccess,
        error: mocks.uiError,
        confirm: mocks.uiConfirm
    }
}));

vi.mock("../../src/services/analytics", () => ({
    analytics: {
        track: mocks.analyticsTrack
    }
}));

describe("TeilnehmerController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("localStorage", {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
        });
        vi.stubGlobal("window", {
            addEventListener: vi.fn(),
            location: { reload: vi.fn() }
        });
        vi.stubGlobal("document", {
            createElement: () => ({
                href: "",
                download: "",
                click: vi.fn()
            }),
            getElementById: () => null,
            body: {
                appendChild: vi.fn(),
                removeChild: vi.fn()
            }
        });
        const urlCtor = globalThis.URL;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (urlCtor as any).createObjectURL = vi.fn(() => "blob:test");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (urlCtor as any).revokeObjectURL = vi.fn();
        mocks.parseHash.mockReturnValue({ params: [] });
        mocks.getUebung.mockResolvedValue(null);
        mocks.loadTeilnehmerStorage.mockReturnValue({
            version: 1,
            uebungId: "u1",
            teilnehmer: "Alpha",
            lastUpdated: "",
            nachrichten: {},
            hideTransmitted: false
        });
        mocks.generateMeldevordruckPageBlob.mockResolvedValue(new Blob(["m"]));
        mocks.generateNachrichtenvordruckPageBlob.mockResolvedValue(new Blob(["n"]));
    });

    const makeController = async () => {
        const { TeilnehmerController } = await import("../../src/teilnehmer");
        const controller = new TeilnehmerController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).uebung = { id: "u1", name: "Test Übung", nachrichten: { Alpha: [] } };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).teilnehmerName = "Alpha";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).storage = {
            version: 1,
            uebungId: "u1",
            teilnehmer: "Alpha",
            lastUpdated: "",
            nachrichten: {},
            hideTransmitted: false
        };
        return controller;
    };

    it("toggleUebertragen stores and removes transmission flags", async () => {
        const controller = await makeController();
        const renderSpy = vi.spyOn(controller as never, "renderNachrichten" as never);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleUebertragen(3, true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).storage.nachrichten[3]?.uebertragen).toBe(true);
        expect(mocks.saveTeilnehmerStorage).toHaveBeenCalled();
        expect(renderSpy).toHaveBeenCalled();
        expect(mocks.analyticsTrack).toHaveBeenCalledWith("teilnehmer_toggle_uebertragen", { checked: true });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleUebertragen(3, false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).storage.nachrichten[3]).toBeUndefined();
    });

    it("init handles invalid link and missing/unknown exercises", async () => {
        const { TeilnehmerController } = await import("../../src/teilnehmer");
        const content = { innerHTML: "" };
        vi.stubGlobal("document", {
            getElementById: (id: string) => (id === "teilnehmerContent" ? content : null),
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });

        mocks.parseHash.mockReturnValueOnce({ params: [] });
        const controller1 = new TeilnehmerController({} as never);
        await controller1.init();
        expect(content.innerHTML).toContain("Ungültiger Link");

        mocks.parseHash.mockReturnValueOnce({ params: ["u1", "t1"] });
        mocks.getUebung.mockResolvedValueOnce(null);
        const controller2 = new TeilnehmerController({} as never);
        await controller2.init();
        expect(content.innerHTML).toContain("Übung nicht gefunden");

        mocks.parseHash.mockReturnValueOnce({ params: ["u1", "t1"] });
        mocks.getUebung.mockResolvedValueOnce({
            id: "u1",
            teilnehmerIds: { other: "Alpha" },
            nachrichten: {}
        });
        const controller3 = new TeilnehmerController({} as never);
        await controller3.init();
        expect(content.innerHTML).toContain("Teilnehmer nicht in dieser Übung gefunden");
    });

    it("init success renders and binds events", async () => {
        const { TeilnehmerController } = await import("../../src/teilnehmer");
        const content = { innerHTML: "" };
        const footer = { textContent: "" };
        vi.stubGlobal("document", {
            getElementById: (id: string) => {
                if (id === "teilnehmerContent") return content;
                if (id === "uebungsId") return footer;
                return null;
            },
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });

        mocks.parseHash.mockReturnValueOnce({ params: ["u1", "tid1"] });
        mocks.getUebung.mockResolvedValueOnce({
            id: "u1",
            name: "Übung",
            teilnehmerIds: { tid1: "Alpha" },
            nachrichten: { Alpha: [] }
        });
        const controller = new TeilnehmerController({} as never);
        await controller.init();

        expect(mocks.setState).toHaveBeenCalled();
        expect(mocks.renderHeader).toHaveBeenCalled();
        expect(mocks.renderNachrichten).toHaveBeenCalled();
        expect(mocks.setDocMode).toHaveBeenCalledWith("table");
        expect(mocks.bindEvents).toHaveBeenCalled();
        expect(footer.textContent).toBe("u1");
    });

    it("toggleHide updates storage and tracking", async () => {
        const controller = await makeController();
        const renderSpy = vi.spyOn(controller as never, "renderNachrichten" as never);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleHide(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).storage.hideTransmitted).toBe(true);
        expect(mocks.saveTeilnehmerStorage).toHaveBeenCalled();
        expect(renderSpy).toHaveBeenCalled();
        expect(mocks.analyticsTrack).toHaveBeenCalledWith("teilnehmer_toggle_hide_transmitted", { checked: true });
    });

    it("setDocMode tracks mode switches", async () => {
        const controller = await makeController();
        const renderDocSpy = vi.spyOn(controller as never, "renderDocPage" as never).mockResolvedValue(undefined);
        const preloadSpy = vi.spyOn(controller as never, "preloadPages" as never).mockImplementation(() => {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(controller as any, "getDocTotalPages").mockReturnValue(2);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).setDocMode("meldevordruck");

        expect(renderDocSpy).toHaveBeenCalled();
        expect(preloadSpy).toHaveBeenCalled();
        expect(mocks.analyticsTrack).toHaveBeenCalledWith("teilnehmer_set_doc_mode", { mode: "meldevordruck" });
    });

    it("downloadTeilnehmerZip creates a blob download and success toast", async () => {
        const controller = await makeController();
        mocks.generateTeilnehmerPDFsAsZip.mockResolvedValueOnce(new Blob(["zip"]));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).downloadTeilnehmerZip();

        expect(mocks.generateTeilnehmerPDFsAsZip).toHaveBeenCalled();
        expect(mocks.uiSuccess).toHaveBeenCalled();
        expect(mocks.analyticsTrack).toHaveBeenCalledWith("teilnehmer_download_zip");
    });

    it("downloadTeilnehmerZip reports errors", async () => {
        const controller = await makeController();
        mocks.generateTeilnehmerPDFsAsZip.mockRejectedValueOnce(new Error("fail"));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).downloadTeilnehmerZip();

        expect(mocks.uiError).toHaveBeenCalled();
    });

    it("toggleCurrentDocMessage toggles transmitted state and rerenders", async () => {
        const controller = await makeController();
        const renderNachrichtenSpy = vi.spyOn(controller as never, "renderNachrichten" as never);
        const renderDocSpy = vi.spyOn(controller as never, "renderDocPage" as never).mockResolvedValue(undefined);
        const invalidateSpy = vi.spyOn(controller as never, "invalidateDocCache" as never).mockImplementation(() => {});

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "meldevordruck";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPage = 2;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).storage.hideTransmitted = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).uebung.nachrichten.Alpha = [
            { id: 1, empfaenger: ["B"], nachricht: "eins" },
            { id: 2, empfaenger: ["B"], nachricht: "zwei" }
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleCurrentDocMessage();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).storage.nachrichten[2]?.uebertragen).toBe(true);
        expect(mocks.saveTeilnehmerStorage).toHaveBeenCalled();
        expect(renderNachrichtenSpy).toHaveBeenCalled();
        expect(invalidateSpy).toHaveBeenCalled();
        expect(renderDocSpy).toHaveBeenCalled();

        // second toggle removes flag again
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleCurrentDocMessage();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).storage.nachrichten[2]).toBeUndefined();
    });

    it("toggleCurrentDocMessage adjusts page when hideTransmitted is active", async () => {
        const controller = await makeController();
        const renderDocSpy = vi.spyOn(controller as never, "renderDocPage" as never).mockResolvedValue(undefined);
        vi.spyOn(controller as never, "invalidateDocCache" as never).mockImplementation(() => {});

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "nachrichtenvordruck";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPage = 2;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).storage.hideTransmitted = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).uebung.nachrichten.Alpha = [
            { id: 1, empfaenger: ["B"], nachricht: "eins" },
            { id: 2, empfaenger: ["B"], nachricht: "zwei" }
        ];

        // Mark current page message as transmitted => filtered list shrinks to 1 page
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleCurrentDocMessage();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).docPage).toBe(1);
        expect(renderDocSpy).toHaveBeenCalled();
    });

    it("setDocMode table tracks without rendering docs", async () => {
        const controller = await makeController();
        const renderDocSpy = vi.spyOn(controller as never, "renderDocPage" as never);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).setDocMode("table");

        expect(renderDocSpy).not.toHaveBeenCalled();
        expect(mocks.analyticsTrack).toHaveBeenCalledWith("teilnehmer_set_doc_mode", { mode: "table" });
    });

    it("changeDocPage respects boundaries and tracks valid changes", async () => {
        const controller = await makeController();
        const renderDocSpy = vi.spyOn(controller as never, "renderDocPage" as never).mockResolvedValue(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(controller as any, "getDocTotalPages").mockReturnValue(2);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "table";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).changeDocPage(1);
        expect(renderDocSpy).not.toHaveBeenCalled();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "meldevordruck";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPage = 2;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).changeDocPage(1);
        expect(renderDocSpy).not.toHaveBeenCalled();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPage = 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).changeDocPage(1);
        expect(renderDocSpy).toHaveBeenCalled();
        expect(mocks.analyticsTrack).toHaveBeenCalledWith("teilnehmer_change_doc_page", { mode: "meldevordruck", page: 2 });
    });

    it("getDocBlob caches rendered blobs per mode/page", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const preview = (controller as any).buildPreviewUebung();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob1 = await (controller as any).getDocBlob(preview, "meldevordruck", 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob2 = await (controller as any).getDocBlob(preview, "meldevordruck", 1);
        expect(blob2).toBe(blob1);
        expect(mocks.generateMeldevordruckPageBlob).toHaveBeenCalledTimes(1);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).getDocBlob(preview, "nachrichtenvordruck", 1);
        expect(mocks.generateNachrichtenvordruckPageBlob).toHaveBeenCalledTimes(1);
    });

    it("preloadPages queues surrounding pages and avoids table mode", async () => {
        vi.useFakeTimers();
        const controller = await makeController();
        const getDocBlobSpy = vi.spyOn(controller as never, "getDocBlob" as never).mockResolvedValue(new Blob(["x"]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(controller as any, "getDocTotalPages").mockReturnValue(3);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPage = 2;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).preloadPages("table");
        expect(getDocBlobSpy).not.toHaveBeenCalled();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).preloadPages("meldevordruck");
        await vi.runAllTimersAsync();
        expect(getDocBlobSpy).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it("initTeilnehmer shows teilnehmer area", async () => {
        const { initTeilnehmer } = await import("../../src/teilnehmer");
        const area = { style: { display: "none" } };
        const content = { innerHTML: "" };
        vi.stubGlobal("document", {
            getElementById: (id: string) => {
                if (id === "teilnehmerArea") return area;
                if (id === "teilnehmerContent") return content;
                return null;
            },
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });
        mocks.parseHash.mockReturnValue({ params: [] });
        await initTeilnehmer({} as never);
        expect(area.style.display).toBe("block");
    });

    it("covers reset/guard branches and doc mode page restore", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).uebungId = "u1";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).teilnehmerName = "Alpha";

        mocks.uiConfirm.mockReturnValueOnce(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).resetData();
        expect(mocks.clearTeilnehmerStorage).not.toHaveBeenCalled();

        mocks.uiConfirm.mockReturnValueOnce(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).currentDocUrl = "blob:x";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).resetData();
        expect(mocks.clearTeilnehmerStorage).toHaveBeenCalled();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "meldevordruck";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPage = 3;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPageByMode.meldevordruck = 2;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(controller as any, "getDocTotalPages").mockReturnValue(2);
        const renderDocSpy = vi.spyOn(controller as never, "renderDocPage" as never).mockResolvedValue(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).setDocMode("nachrichtenvordruck");
        expect(renderDocSpy).toHaveBeenCalled();
    });

    it("covers renderDocPage token mismatch and table/no-storage toggles", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "meldevordruck";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPage = 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).uebung.nachrichten.Alpha = [{ id: 1, empfaenger: ["B"], nachricht: "x" }];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getBlob = vi.spyOn(controller as any, "getDocBlob").mockResolvedValue(new Blob(["x"]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docRenderToken = 99;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).renderDocPage();
        expect(getBlob).toHaveBeenCalled();

        // toggle current message guard paths
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "table";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleCurrentDocMessage();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "meldevordruck";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPage = 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleCurrentDocMessage();
    });

    it("covers download guard and init without content", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).uebung = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).downloadTeilnehmerZip();
        expect(mocks.generateTeilnehmerPDFsAsZip).not.toHaveBeenCalled();

        const { TeilnehmerController } = await import("../../src/teilnehmer");
        vi.stubGlobal("document", {
            getElementById: () => null,
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });
        const c = new TeilnehmerController({} as never);
        await c.init();
        expect(mocks.bindEvents).not.toHaveBeenCalled();
    });

    it("covers preload in-flight skip and revoke url branch", async () => {
        vi.useFakeTimers();
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "meldevordruck";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docPage = 1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).uebung.nachrichten.Alpha = [{ id: 1, empfaenger: ["B"], nachricht: "x" }];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(controller as any, "getDocTotalPages").mockReturnValue(1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docBlobInFlight.set("meldevordruck", new Set([1]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).preloadPages("meldevordruck");
        await vi.runAllTimersAsync();
        vi.useRealTimers();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).currentDocUrl = "blob:test";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).revokeDocUrl();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).currentDocUrl).toBeNull();
    });

    it("covers toggleHide in table mode and renderDocPage guard", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "table";
        const renderDocSpy = vi.spyOn(controller as never, "renderDocPage" as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleHide(false);
        expect(renderDocSpy).not.toHaveBeenCalled();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).docMode = "meldevordruck";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).uebung = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).renderDocPage();
        expect(mocks.renderPdfPage).not.toHaveBeenCalled();
    });

    it("invokes bound callbacks from init to cover interaction paths", async () => {
        vi.useFakeTimers();
        const { TeilnehmerController } = await import("../../src/teilnehmer");
        const content = { innerHTML: "" };
        const footer = { textContent: "" };
        vi.stubGlobal("document", {
            getElementById: (id: string) => {
                if (id === "teilnehmerContent") return content;
                if (id === "uebungsId") return footer;
                return null;
            },
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });
        mocks.parseHash.mockReturnValue({ params: ["u1", "tid1"] });
        mocks.getUebung.mockResolvedValue({
            id: "u1",
            name: "Ü",
            teilnehmerIds: { tid1: "Alpha" },
            nachrichten: { Alpha: [{ id: 1, empfaenger: ["B"], nachricht: "x" }] }
        });
        const c = new TeilnehmerController({} as never);
        await c.init();
        const args = mocks.bindEvents.mock.calls.at(-1);
        expect(args).toBeTruthy();
        if (args) {
            args[0](1, true);
            args[1](true);
            args[3]("meldevordruck");
            args[4]();
            args[5]();
            args[6]();
            args[7]();
            await args[8]();
            args[9]();
        }
        await vi.runAllTimersAsync();
        expect(mocks.saveTeilnehmerStorage).toHaveBeenCalled();
        vi.useRealTimers();
    });
});
