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
    renderHeader: vi.fn(),
    renderJoinForm: vi.fn(),
    bindJoinForm: vi.fn(),
    showJoinError: vi.fn(),
    renderNachrichten: vi.fn(),
    setDocMode: vi.fn(),
    bindEvents: vi.fn(),
    renderPdfPage: vi.fn().mockResolvedValue(undefined),
    setDocTransmitted: vi.fn(),
    updateLiveSyncState: vi.fn(),
    setXZeitBasisInputValue: vi.fn(),
    bindXZeitEvents: vi.fn(),
    bindFokusEvents: vi.fn(),
    renderZugangsFehler: vi.fn(),
    setResetUmfang: vi.fn(),
    zeigeRueckgaengig: vi.fn(),
    publishTeilnehmerStatus: vi.fn(),
    subscribeEigenenStatus: vi.fn(),
    subscribeLeitungPublic: vi.fn(),
    liveFlush: vi.fn().mockResolvedValue(undefined),
    liveDispose: vi.fn()
}));

vi.mock("../../src/services/LiveStatusService", () => ({
    LiveStatusService: class {
        public enabled = true;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(_db: unknown, _uebungId: string) {}
        onStateChange = (cb: (state: string) => void) => cb("live");
        publishTeilnehmerStatus = mocks.publishTeilnehmerStatus;
        subscribeEigenenStatus = mocks.subscribeEigenenStatus;
        subscribeLeitungPublic = mocks.subscribeLeitungPublic;
        flush = mocks.liveFlush;
        dispose = mocks.liveDispose;
    }
}));

vi.mock("../../src/teilnehmer/TeilnehmerView", () => ({
    TeilnehmerView: class {
        renderJoinForm = mocks.renderJoinForm;
        bindJoinForm = mocks.bindJoinForm;
        showJoinError = mocks.showJoinError;
        renderHeader = mocks.renderHeader;
        renderNachrichten = mocks.renderNachrichten;
        setDocMode = mocks.setDocMode;
        bindEvents = mocks.bindEvents;
        renderPdfPage = mocks.renderPdfPage;
        setDocTransmitted = mocks.setDocTransmitted;
        updateLiveSyncState = mocks.updateLiveSyncState;
        setXZeitBasisInputValue = mocks.setXZeitBasisInputValue;
        bindXZeitEvents = mocks.bindXZeitEvents;
        bindFokusEvents = mocks.bindFokusEvents;
        renderZugangsFehler = mocks.renderZugangsFehler;
        setResetUmfang = mocks.setResetUmfang;
        zeigeRueckgaengig = mocks.zeigeRueckgaengig;
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleUebertragen(3, false);
        // Zurückgesetzt wird als Marker gespeichert, nicht gelöscht – sonst würde der
        // Live-Sync den Eintrag aus einem älteren Remote-Stand wiederbeleben.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).storage.nachrichten[3].uebertragen).toBe(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).storage.nachrichten[3].geaendertUm).toBeTruthy();
    });

    it("init handles join mode and missing/unknown exercises", async () => {
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
        expect(mocks.renderJoinForm).toHaveBeenCalled();
        expect(mocks.bindJoinForm).toHaveBeenCalled();

        mocks.parseHash.mockReturnValueOnce({ params: ["u1", "t1"] });
        mocks.getUebung.mockResolvedValueOnce(null);
        const controller2 = new TeilnehmerController({} as never);
        await controller2.init();
        // Fehlerseiten sind keine Sackgasse: sie zeigen das Code-Formular.
        expect(mocks.renderZugangsFehler).toHaveBeenLastCalledWith(expect.stringContaining("Übung nicht gefunden"));
        expect(mocks.bindJoinForm).toHaveBeenCalledTimes(2);

        mocks.parseHash.mockReturnValueOnce({ params: ["u1", "t1"] });
        mocks.getUebung.mockResolvedValueOnce({
            id: "u1",
            uebungCode: "K7M4Q2",
            teilnehmerIds: { other: "Alpha" },
            nachrichten: {}
        });
        const controller3 = new TeilnehmerController({} as never);
        await controller3.init();
        // Der Übungscode ist bekannt und wird vorbelegt.
        expect(mocks.renderZugangsFehler).toHaveBeenLastCalledWith(
            expect.stringContaining("Teilnehmer nicht in dieser Übung gefunden"), "K7M4Q2"
        );
        expect(mocks.bindJoinForm).toHaveBeenCalledTimes(3);

        // Ladefehler (z. B. ohne Netz) führt ebenfalls zum Formular mit Hinweis.
        mocks.parseHash.mockReturnValueOnce({ params: ["u1", "t1"] });
        mocks.getUebung.mockRejectedValueOnce(new Error("client is offline"));
        const controller4 = new TeilnehmerController({} as never);
        await controller4.init();
        expect(mocks.renderZugangsFehler).toHaveBeenLastCalledWith(expect.stringContaining("nicht geladen"));
    });

    it("öffnet einen geteilten Link mit beiden Codes direkt und ersetzt den Verlaufseintrag", async () => {
        const { TeilnehmerController } = await import("../../src/teilnehmer");
        vi.stubGlobal("document", {
            getElementById: (id: string) => (id === "teilnehmerContent" ? { innerHTML: "" } : null),
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });
        const replace = vi.fn();
        vi.stubGlobal("window", {
            addEventListener: vi.fn(),
            location: { hash: "#/teilnehmer?uc=k7m4q2&tc=a1b2", replace }
        });
        mocks.parseHash.mockReturnValueOnce({ params: [] });
        const controller = new TeilnehmerController({} as never);
        const resolve = vi.fn().mockResolvedValue({ uebungId: "u1", teilnehmerId: "A1B2", teilnehmerName: "Alpha" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = { resolveTeilnehmerJoinCodes: resolve };

        await controller.init();

        expect(resolve).toHaveBeenCalledWith("K7M4Q2", "A1B2");
        expect(replace).toHaveBeenCalledWith("#/teilnehmer/u1/A1B2");
    });

    it("zeigt bei geteiltem Link mit falschen Codes das vorbelegte Formular samt Fehler", async () => {
        const { TeilnehmerController } = await import("../../src/teilnehmer");
        vi.stubGlobal("document", {
            getElementById: (id: string) => (id === "teilnehmerContent" ? { innerHTML: "" } : null),
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });
        const replace = vi.fn();
        vi.stubGlobal("window", {
            addEventListener: vi.fn(),
            location: { hash: "#/teilnehmer?uc=k7m4q2&tc=zzzz", replace }
        });
        mocks.parseHash.mockReturnValueOnce({ params: [] });
        const controller = new TeilnehmerController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = { resolveTeilnehmerJoinCodes: vi.fn().mockResolvedValue(null) };

        await controller.init();

        expect(mocks.renderJoinForm).toHaveBeenCalledWith("K7M4Q2", "ZZZZ");
        expect(mocks.showJoinError).toHaveBeenCalledWith(expect.stringContaining("nicht gefunden"));
        expect(replace).not.toHaveBeenCalled();
    });

    it("meldet einen Verbindungsfehler beim Prüfen der Codes verständlich", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = { resolveTeilnehmerJoinCodes: vi.fn().mockRejectedValue(new Error("offline")) };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).resolveJoinAndNavigate("ABC123", "A1B2");
        expect(mocks.showJoinError).toHaveBeenCalledWith(expect.stringContaining("Internetverbindung"));
    });

    it("init prefills join form from hash query parameters", async () => {
        const { TeilnehmerController } = await import("../../src/teilnehmer");
        const content = { innerHTML: "" };
        vi.stubGlobal("document", {
            getElementById: (id: string) => (id === "teilnehmerContent" ? content : null),
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });
        vi.stubGlobal("window", {
            addEventListener: vi.fn(),
            location: { hash: "#/teilnehmer?uc=k7m4q2&tc=a1b2", replace: vi.fn() }
        });
        mocks.parseHash.mockReturnValueOnce({ params: [] });

        const controller = new TeilnehmerController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = { resolveTeilnehmerJoinCodes: vi.fn().mockResolvedValue(null) };
        await controller.init();

        expect(mocks.renderJoinForm).toHaveBeenCalledWith("K7M4Q2", "A1B2");
    });

    it("resolveJoinAndNavigate validates and routes by join codes", async () => {
        const controller = await makeController();
        const resolve = vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ uebungId: "u1", teilnehmerId: "A1B2", teilnehmerName: "Alpha" });
        const hashState = { hash: "" };
        vi.stubGlobal("window", {
            addEventListener: vi.fn(),
            location: hashState
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = { resolveTeilnehmerJoinCodes: resolve };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).resolveJoinAndNavigate("", "");
        expect(mocks.showJoinError).toHaveBeenCalled();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).resolveJoinAndNavigate("ABC", "1234");
        expect(mocks.showJoinError).toHaveBeenCalled();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).resolveJoinAndNavigate("ABC123", "1234");
        expect(mocks.showJoinError).toHaveBeenCalledWith(expect.stringContaining("nicht gefunden"));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).resolveJoinAndNavigate("ABC123", "A1B2");
        expect(hashState.hash).toBe("#/teilnehmer/u1/A1B2");
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
        // Beschriftung des Zurücksetzens folgt der echten Reichweite (Live-Sync aktiv).
        expect(mocks.setResetUmfang).toHaveBeenCalledWith(true);
    });

    it("macht den Fokus-Modus auf schmalen Geräten zum Standard, ohne eine eigene Wahl zu überschreiben", async () => {
        const { TeilnehmerController } = await import("../../src/teilnehmer");
        vi.stubGlobal("document", {
            getElementById: (id: string) => (id === "teilnehmerContent" ? { innerHTML: "" } : null),
            createElement: () => ({ href: "", download: "", click: vi.fn() }),
            body: { appendChild: vi.fn(), removeChild: vi.fn() }
        });
        vi.stubGlobal("window", {
            addEventListener: vi.fn(),
            location: { reload: vi.fn() },
            matchMedia: () => ({ matches: true })
        });
        const uebung = {
            id: "u1", name: "Ü", spielModus: "xZeit",
            teilnehmerIds: { tid1: "Alpha" }, nachrichten: { Alpha: [] }
        };
        const leer = () => ({ version: 1, uebungId: "u1", teilnehmer: "Alpha", lastUpdated: "", nachrichten: {}, hideTransmitted: false });

        mocks.parseHash.mockReturnValueOnce({ params: ["u1", "tid1"] });
        mocks.getUebung.mockResolvedValueOnce(uebung);
        const storage: { fokusModus?: boolean } = leer();
        mocks.loadTeilnehmerStorage.mockReturnValueOnce(storage);
        await new TeilnehmerController({} as never).init();
        expect(storage.fokusModus).toBe(true);

        mocks.parseHash.mockReturnValueOnce({ params: ["u1", "tid1"] });
        mocks.getUebung.mockResolvedValueOnce(uebung);
        const eigeneWahl = { ...leer(), fokusModus: false };
        mocks.loadTeilnehmerStorage.mockReturnValueOnce(eigeneWahl);
        await new TeilnehmerController({} as never).init();
        expect(eigeneWahl.fokusModus).toBe(false);

        // Ohne X-Zeit gibt es keine Fälligkeit, also keinen Fokus-Standard.
        mocks.parseHash.mockReturnValueOnce({ params: ["u1", "tid1"] });
        mocks.getUebung.mockResolvedValueOnce({ ...uebung, spielModus: undefined });
        const klassisch: { fokusModus?: boolean } = leer();
        mocks.loadTeilnehmerStorage.mockReturnValueOnce(klassisch);
        await new TeilnehmerController({} as never).init();
        expect(klassisch.fokusModus).toBeUndefined();

        // Das Zurücknehmen im Fokus-Modus ist verdrahtet.
        const fokusArgs = mocks.bindFokusEvents.mock.calls.at(-1);
        expect(fokusArgs?.[2]).toBeTypeOf("function");
    });

    it("bietet nach jedem Statuswechsel Rückgängig an und stellt die alte Absetzzeit wieder her", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = controller as any;
        c.storage.nachrichten[4] = { uebertragen: true, uebertragenUm: "2026-10-04T18:00:00.000Z", geaendertUm: "2026-10-04T18:00:00.000Z" };

        c.toggleUebertragen(4, false);
        expect(c.storage.nachrichten[4].uebertragen).toBe(false);
        expect(mocks.zeigeRueckgaengig).toHaveBeenLastCalledWith("Spruch 4 wieder offen.", expect.any(Function));

        const undo = mocks.zeigeRueckgaengig.mock.calls.at(-1)?.[1] as () => void;
        undo();
        expect(c.storage.nachrichten[4].uebertragen).toBe(true);
        expect(c.storage.nachrichten[4].uebertragenUm).toBe("2026-10-04T18:00:00.000Z");
        expect(c.storage.nachrichten[4].geaendertUm > "2026-10-04T18:00:00.000Z").toBe(true);

        c.toggleUebertragen(5, true);
        expect(mocks.zeigeRueckgaengig).toHaveBeenLastCalledWith("Spruch 5 als abgesetzt markiert.", expect.any(Function));
        (mocks.zeigeRueckgaengig.mock.calls.at(-1)?.[1] as () => void)();
        expect(c.storage.nachrichten[5]).toMatchObject({ uebertragen: false });
    });

    it("lässt im Vordruck auch den ersten Spruch abhaken", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = controller as any;
        vi.spyOn(c, "renderDocPage").mockResolvedValue(undefined);
        c.docMode = "meldevordruck";
        c.docPage = 1;
        c.uebung.nachrichten.Alpha = [{ id: 1, empfaenger: ["B"], nachricht: "eins" }];

        c.toggleCurrentDocMessage();

        expect(c.storage.nachrichten[1]?.uebertragen).toBe(true);
        expect(mocks.zeigeRueckgaengig).toHaveBeenCalled();
    });

    it("nennt im Rückfragetext Anzahl und Reichweite, in Du-Form", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = controller as any;
        c.uebungId = "u1";
        c.storage.nachrichten = { 1: { uebertragen: true }, 2: { uebertragen: true }, 3: { uebertragen: false } };
        mocks.uiConfirm.mockReturnValueOnce(false);
        c.liveStatus = { enabled: true };
        c.resetData();
        const text = mocks.uiConfirm.mock.calls.at(-1)?.[0] as string;
        expect(text).toContain("alle 2 als abgesetzt markierten");
        expect(text).toContain("Übungsleitung");
        expect(text).not.toMatch(/\bSie\b|\bIhr/);

        mocks.uiConfirm.mockReturnValueOnce(false);
        c.liveStatus = null;
        c.resetData();
        expect(mocks.uiConfirm.mock.calls.at(-1)?.[0]).toContain("nur dieses Gerät");
    });

    it("behandelt das Vordruck-Fenster als eigenen Schritt im Verlauf", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = controller as any;
        vi.spyOn(c, "renderDocPage").mockResolvedValue(undefined);
        vi.spyOn(c, "preloadPages").mockImplementation(() => {});
        const listeners: Record<string, () => void> = {};
        const verlauf = { pushState: vi.fn(), back: vi.fn() };
        vi.stubGlobal("window", {
            history: verlauf,
            addEventListener: (name: string, cb: () => void) => { listeners[name] = cb; },
            location: { reload: vi.fn() }
        });

        await c.setDocMode("meldevordruck");
        expect(verlauf.pushState).toHaveBeenCalledTimes(1);
        // Wechsel zwischen den Vordrucken legt keinen weiteren Eintrag an.
        await c.setDocMode("nachrichtenvordruck");
        expect(verlauf.pushState).toHaveBeenCalledTimes(1);

        // Zurück am Gerät schließt das Fenster, ohne erneut zurückzugehen.
        listeners["popstate"]?.();
        await Promise.resolve();
        expect(c.docMode).toBe("table");
        expect(verlauf.back).not.toHaveBeenCalled();

        // Schließen per Knopf nimmt den eigenen Verlaufseintrag wieder weg.
        await c.setDocMode("meldevordruck");
        await c.setDocMode("table");
        expect(verlauf.back).toHaveBeenCalledTimes(1);
    });

    it("toggleHide updates storage", async () => {
        const controller = await makeController();
        const renderSpy = vi.spyOn(controller as never, "renderNachrichten" as never);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleHide(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).storage.hideTransmitted).toBe(true);
        expect(mocks.saveTeilnehmerStorage).toHaveBeenCalled();
        expect(renderSpy).toHaveBeenCalled();
    });

    it("setDocMode renders and preloads the selected mode", async () => {
        const controller = await makeController();
        const renderDocSpy = vi.spyOn(controller as never, "renderDocPage" as never).mockResolvedValue(undefined);
        const preloadSpy = vi.spyOn(controller as never, "preloadPages" as never).mockImplementation(() => {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.spyOn(controller as any, "getDocTotalPages").mockReturnValue(2);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).setDocMode("meldevordruck");

        expect(renderDocSpy).toHaveBeenCalled();
        expect(preloadSpy).toHaveBeenCalled();
    });

    it("downloadTeilnehmerZip creates a blob download and success toast", async () => {
        const controller = await makeController();
        mocks.generateTeilnehmerPDFsAsZip.mockResolvedValueOnce(new Blob(["zip"]));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).downloadTeilnehmerZip();

        expect(mocks.generateTeilnehmerPDFsAsZip).toHaveBeenCalled();
        expect(mocks.uiSuccess).toHaveBeenCalled();
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

        // second toggle clears the flag again (as a reset marker, not by deleting)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).toggleCurrentDocMessage();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).storage.nachrichten[2].uebertragen).toBe(false);
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

    it("setDocMode table skips rendering docs", async () => {
        const controller = await makeController();
        const renderDocSpy = vi.spyOn(controller as never, "renderDocPage" as never);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).setDocMode("table");

        expect(renderDocSpy).not.toHaveBeenCalled();
    });

    it("changeDocPage respects boundaries and renders valid changes", async () => {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).docPage).toBe(2);
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
        const { initTeilnehmer } = await import("../../src/teilnehmer/init");
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

describe("TeilnehmerController – gemeinsame X-Zeit", () => {
    const SPAET = "2026-10-04T17:30:00.000Z";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function xZeitController(storage: any) {
        const { TeilnehmerController } = await import("../../src/teilnehmer");
        const c = new TeilnehmerController({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const intern = c as any;
        intern.uebung = { spielModus: "xZeit", nachrichten: { A: [] } };
        intern.teilnehmerName = "A";
        intern.teilnehmerId = "T1";
        intern.storage = storage;
        intern.liveStatus = { enabled: true, publishTeilnehmerStatus: mocks.publishTeilnehmerStatus };
        return intern;
    }

    const hinweis = { id: "", className: "", textContent: "" };

    beforeEach(() => {
        vi.clearAllMocks();
        hinweis.textContent = "";
        const input = { parentElement: { appendChild: vi.fn() } };
        vi.stubGlobal("document", {
            getElementById: (id: string) => {
                if (id === "xZeitBasisInput") return input;
                if (id === "xZeitBasisHerkunft") return hinweis;
                return null;
            },
            createElement: () => hinweis
        });
    });

    it("übernimmt die Basis der Übungsleitung ohne eigenes Zutun", async () => {
        const c = await xZeitController({ nachrichten: {}, xZeitBasis: "19:18", xZeitBasisGeaendertUm: "2026-10-04T17:00:00.000Z" });

        c.uebernehmeXZeitDerLeitung({ version: 1, lastUpdated: SPAET, nachrichten: {}, xZeitBasis: "19:30", xZeitBasisGeaendertUm: SPAET });

        expect(c.storage.xZeitBasis).toBe("19:30");
        expect(c.storage.xZeitBasisQuelle).toBe("leitung");
        expect(mocks.setXZeitBasisInputValue).toHaveBeenCalledWith("19:30");
        expect(mocks.saveTeilnehmerStorage).toHaveBeenCalled();
        expect(mocks.publishTeilnehmerStatus).toHaveBeenCalled();
        expect(hinweis.textContent).toContain("von der Übungsleitung gesetzt");
        c.stopXZeitTicker();
    });

    it("verlangt für eine eigene Basis neben der Vorgabe eine bewusste Bestätigung", async () => {
        const c = await xZeitController({ nachrichten: {}, xZeitBasis: "19:30", xZeitBasisGeaendertUm: SPAET, xZeitBasisQuelle: "leitung" });
        c.leitungXZeitBasis = "19:30";

        mocks.uiConfirm.mockReturnValueOnce(false);
        c.setXZeitBasis("19:40");
        expect(c.storage.xZeitBasis).toBe("19:30");
        expect(mocks.setXZeitBasisInputValue).toHaveBeenCalledWith("19:30");

        mocks.uiConfirm.mockReturnValueOnce(true);
        c.setXZeitBasis("19:40");
        expect(c.storage.xZeitBasis).toBe("19:40");
        expect(c.storage.xZeitBasisQuelle).toBe("eigen");
        expect(hinweis.textContent).toContain("Eigene Basis 19:40");

        // Dieselbe Uhrzeit wie die Leitung braucht keine Rückfrage.
        mocks.uiConfirm.mockClear();
        c.setXZeitBasis("19:30");
        expect(mocks.uiConfirm).not.toHaveBeenCalled();
        expect(c.storage.xZeitBasisQuelle).toBe("leitung");
        c.stopXZeitTicker();
    });

    it("ignoriert die Vorgabe außerhalb des X-Zeit-Modus und weist ohne Basis auf die Leitung hin", async () => {
        const c = await xZeitController({ nachrichten: {} });
        c.uebernehmeXZeitDerLeitung(null);
        expect(hinweis.textContent).toContain("Warte auf die X-Zeit der Übungsleitung");

        c.uebung.spielModus = "klassisch";
        c.uebernehmeXZeitDerLeitung({ version: 1, lastUpdated: SPAET, nachrichten: {}, xZeitBasis: "19:30", xZeitBasisGeaendertUm: SPAET });
        expect(c.storage.xZeitBasis).toBeUndefined();
    });
});
