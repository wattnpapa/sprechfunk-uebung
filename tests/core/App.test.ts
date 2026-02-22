import { beforeEach, describe, expect, it, vi } from "vitest";

const setupGlobals = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    };
};

const mockFirebaseClient = (db: unknown = {}) => {
    vi.doMock("../../src/services/firebaseClient", () => ({ initFirebaseClient: vi.fn(() => db) }));
};

describe("App", () => {
    beforeEach(() => {
        vi.resetModules();
        setupGlobals();
    });

    it("initializes core components and exposes globals", async () => {
        vi.doMock("../../src/uebungsleitung", () => ({ initUebungsleitung: vi.fn() }));
        vi.doMock("../../src/teilnehmer", () => ({ initTeilnehmer: vi.fn() }));
        vi.doMock("../../src/admin/index", () => ({ admin: { ladeAlleUebungen: vi.fn(), renderUebungsStatistik: vi.fn(), setDb: vi.fn() } }));
        vi.doMock("../../src/generator", () => ({ GeneratorController: { getInstance: () => ({ handleRoute: vi.fn() }) } }));
        vi.doMock("../../src/services/pdfGenerator", () => ({ default: {} }));
        vi.doMock("../../src/firebase-config.js", () => ({ firebaseConfig: {} }));

        const setState = vi.fn();
        vi.doMock("../../src/state/store", () => ({ store: { setState } }));

        const applyAppMode = vi.fn();
        const initModals = vi.fn();
        const initGlobalListeners = vi.fn();
        vi.doMock("../../src/core/AppView", () => ({ AppView: class { initModals = initModals; initGlobalListeners = initGlobalListeners; applyAppMode = applyAppMode; } }));
        vi.doMock("../../src/core/NatoClock", () => ({ NatoClock: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/ThemeManager", () => ({ ThemeManager: class { init = vi.fn(); } }));

        const subscribe = vi.fn((cb: () => void) => { cb(); return () => {}; });
        const parseHash = vi.fn().mockReturnValue({ mode: "generator", params: [] });
        vi.doMock("../../src/core/router", () => ({ router: { subscribe, parseHash } }));
        mockFirebaseClient({});

        const { App } = await import("../../src/core/App");
        const app = new App();
        app.init();

        expect(setState).toHaveBeenCalledWith({ db: {} });
        expect(initModals).toHaveBeenCalled();
        expect(initGlobalListeners).toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).window.pdfGenerator).toBeDefined();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).window.admin).toBeDefined();
    });

    it("routes to admin handler", async () => {
        const admin = { ladeAlleUebungen: vi.fn(), renderUebungsStatistik: vi.fn(), setDb: vi.fn(), db: null as unknown };
        vi.doMock("../../src/admin/index", () => ({ admin }));
        vi.doMock("../../src/uebungsleitung", () => ({ initUebungsleitung: vi.fn() }));
        vi.doMock("../../src/teilnehmer", () => ({ initTeilnehmer: vi.fn() }));
        vi.doMock("../../src/generator", () => ({ GeneratorController: { getInstance: () => ({ handleRoute: vi.fn() }) } }));
        vi.doMock("../../src/services/pdfGenerator", () => ({ default: {} }));
        vi.doMock("../../src/firebase-config.js", () => ({ firebaseConfig: {} }));
        vi.doMock("../../src/state/store", () => ({ store: { setState: vi.fn() } }));
        vi.doMock("../../src/core/AppView", () => ({ AppView: class { applyAppMode = vi.fn(); initModals = vi.fn(); initGlobalListeners = vi.fn(); } }));
        vi.doMock("../../src/core/NatoClock", () => ({ NatoClock: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/ThemeManager", () => ({ ThemeManager: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/router", () => ({
            router: {
                subscribe: (cb: () => void) => { cb(); return () => {}; },
                parseHash: () => ({ mode: "admin", params: [] })
            }
        }));
        mockFirebaseClient({ db: true });

        const { App } = await import("../../src/core/App");
        const app = new App();
        app.init();

        expect(admin.ladeAlleUebungen).toHaveBeenCalled();
        expect(admin.renderUebungsStatistik).toHaveBeenCalled();
    });

    it("routes to uebungsleitung and teilnehmer modes", async () => {
        const initUebungsleitung = vi.fn();
        const initTeilnehmer = vi.fn();
        vi.doMock("../../src/uebungsleitung", () => ({ initUebungsleitung }));
        vi.doMock("../../src/teilnehmer", () => ({ initTeilnehmer }));
        vi.doMock("../../src/admin/index", () => ({ admin: { ladeAlleUebungen: vi.fn(), renderUebungsStatistik: vi.fn(), setDb: vi.fn() } }));
        vi.doMock("../../src/generator", () => ({ GeneratorController: { getInstance: () => ({ handleRoute: vi.fn() }) } }));
        vi.doMock("../../src/services/pdfGenerator", () => ({ default: {} }));
        vi.doMock("../../src/firebase-config.js", () => ({ firebaseConfig: {} }));
        vi.doMock("../../src/state/store", () => ({ store: { setState: vi.fn() } }));
        vi.doMock("../../src/core/AppView", () => ({ AppView: class { applyAppMode = vi.fn(); initModals = vi.fn(); initGlobalListeners = vi.fn(); } }));
        vi.doMock("../../src/core/NatoClock", () => ({ NatoClock: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/ThemeManager", () => ({ ThemeManager: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/router", () => ({
            router: {
                subscribe: (cb: () => void) => { cb(); return () => {}; },
                parseHash: () => ({ mode: "uebungsleitung", params: ["u1"] })
            }
        }));
        mockFirebaseClient({});

        const { App } = await import("../../src/core/App");
        const app = new App();
        app.init();

        expect(initUebungsleitung).toHaveBeenCalled();

        vi.resetModules();
        setupGlobals();
        vi.doMock("../../src/uebungsleitung", () => ({ initUebungsleitung: vi.fn() }));
        vi.doMock("../../src/teilnehmer", () => ({ initTeilnehmer }));
        vi.doMock("../../src/admin/index", () => ({ admin: { ladeAlleUebungen: vi.fn(), renderUebungsStatistik: vi.fn(), setDb: vi.fn() } }));
        vi.doMock("../../src/generator", () => ({ GeneratorController: { getInstance: () => ({ handleRoute: vi.fn() }) } }));
        vi.doMock("../../src/services/pdfGenerator", () => ({ default: {} }));
        vi.doMock("../../src/firebase-config.js", () => ({ firebaseConfig: {} }));
        vi.doMock("../../src/state/store", () => ({ store: { setState: vi.fn() } }));
        vi.doMock("../../src/core/AppView", () => ({ AppView: class { applyAppMode = vi.fn(); initModals = vi.fn(); initGlobalListeners = vi.fn(); } }));
        vi.doMock("../../src/core/NatoClock", () => ({ NatoClock: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/ThemeManager", () => ({ ThemeManager: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/router", () => ({
            router: {
                subscribe: (cb: () => void) => { cb(); return () => {}; },
                parseHash: () => ({ mode: "teilnehmer", params: [] })
            }
        }));
        mockFirebaseClient({});

        const { App: App2 } = await import("../../src/core/App");
        const app2 = new App2();
        app2.init();

        expect(initTeilnehmer).toHaveBeenCalled();
    });

    it("warns and aborts routing when db is missing", async () => {
        vi.doMock("../../src/uebungsleitung", () => ({ initUebungsleitung: vi.fn() }));
        vi.doMock("../../src/teilnehmer", () => ({ initTeilnehmer: vi.fn() }));
        vi.doMock("../../src/admin/index", () => ({ admin: { ladeAlleUebungen: vi.fn(), renderUebungsStatistik: vi.fn(), setDb: vi.fn() } }));
        vi.doMock("../../src/generator", () => ({ GeneratorController: { getInstance: () => ({ handleRoute: vi.fn() }) } }));
        vi.doMock("../../src/services/pdfGenerator", () => ({ default: {} }));
        vi.doMock("../../src/firebase-config.js", () => ({ firebaseConfig: {} }));
        vi.doMock("../../src/state/store", () => ({ store: { setState: vi.fn() } }));
        const applyAppMode = vi.fn();
        vi.doMock("../../src/core/AppView", () => ({ AppView: class { applyAppMode = applyAppMode; initModals = vi.fn(); initGlobalListeners = vi.fn(); } }));
        vi.doMock("../../src/core/NatoClock", () => ({ NatoClock: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/ThemeManager", () => ({ ThemeManager: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/router", () => ({
            router: {
                subscribe: vi.fn(),
                parseHash: vi.fn().mockReturnValue({ mode: "generator", params: [] })
            }
        }));
        mockFirebaseClient({});

        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { App } = await import("../../src/core/App");
        const app = new App();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (app as any).handleRoute();

        expect(warn).toHaveBeenCalled();
        expect(applyAppMode).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it("does not initialize uebungsleitung without id", async () => {
        const initUebungsleitung = vi.fn();
        vi.doMock("../../src/uebungsleitung", () => ({ initUebungsleitung }));
        vi.doMock("../../src/teilnehmer", () => ({ initTeilnehmer: vi.fn() }));
        vi.doMock("../../src/admin/index", () => ({ admin: { ladeAlleUebungen: vi.fn(), renderUebungsStatistik: vi.fn(), setDb: vi.fn() } }));
        vi.doMock("../../src/generator", () => ({ GeneratorController: { getInstance: () => ({ handleRoute: vi.fn() }) } }));
        vi.doMock("../../src/services/pdfGenerator", () => ({ default: {} }));
        vi.doMock("../../src/firebase-config.js", () => ({ firebaseConfig: {} }));
        vi.doMock("../../src/state/store", () => ({ store: { setState: vi.fn() } }));
        vi.doMock("../../src/core/AppView", () => ({ AppView: class { applyAppMode = vi.fn(); initModals = vi.fn(); initGlobalListeners = vi.fn(); } }));
        vi.doMock("../../src/core/NatoClock", () => ({ NatoClock: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/ThemeManager", () => ({ ThemeManager: class { init = vi.fn(); } }));
        vi.doMock("../../src/core/router", () => ({
            router: {
                subscribe: (cb: () => void) => { cb(); return () => {}; },
                parseHash: () => ({ mode: "uebungsleitung", params: [] })
            }
        }));
        mockFirebaseClient({});

        const { App } = await import("../../src/core/App");
        const app = new App();
        app.init();

        expect(initUebungsleitung).not.toHaveBeenCalled();
    });
});
