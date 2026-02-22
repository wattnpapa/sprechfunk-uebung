import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getFirestore: vi.fn(() => ({ db: true })),
    initializeApp: vi.fn(),
    getAdminStats: vi.fn(),
    getUebungenPaged: vi.fn(),
    getUebungenSnapshot: vi.fn(),
    deleteUebung: vi.fn(),
    renderStatistik: vi.fn(),
    renderUebungsListe: vi.fn(),
    renderPaginationInfo: vi.fn(),
    renderChart: vi.fn(),
    bindListEvents: vi.fn(),
    uiError: vi.fn(),
    uiConfirm: vi.fn(() => true),
    analyticsTrack: vi.fn()
}));

vi.mock("firebase/app", () => ({ initializeApp: mocks.initializeApp }));
vi.mock("firebase/firestore", () => ({ getFirestore: mocks.getFirestore }));
vi.mock("../../src/firebase-config.js", () => ({ firebaseConfig: {} }));
vi.mock("../../src/services/FirebaseService", () => ({
    FirebaseService: class {
        getAdminStats = mocks.getAdminStats;
        getUebungenPaged = mocks.getUebungenPaged;
        getUebungenSnapshot = mocks.getUebungenSnapshot;
        deleteUebung = mocks.deleteUebung;
    }
}));
vi.mock("../../src/admin/AdminView", () => ({
    AdminView: class {
        renderStatistik = mocks.renderStatistik;
        renderUebungsListe = mocks.renderUebungsListe;
        renderPaginationInfo = mocks.renderPaginationInfo;
        renderChart = mocks.renderChart;
        bindListEvents = mocks.bindListEvents;
    }
}));
vi.mock("../../src/core/UiFeedback", () => ({
    uiFeedback: { error: mocks.uiError, confirm: mocks.uiConfirm }
}));
vi.mock("../../src/services/analytics", () => ({
    analytics: { track: mocks.analyticsTrack }
}));

describe("AdminController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("window", { open: vi.fn() });
        vi.stubGlobal("document", {
            getElementById: () => ({ textContent: "" })
        });
    });

    it("loads and maps admin stats", async () => {
        const { AdminController } = await import("../../src/admin/index");
        mocks.getAdminStats.mockResolvedValue({
            total: 2, totalTeilnehmer: 4, totalBytes: 2048, totalSprueche: 20,
            loesungsCount: 1, staerkeCount: 1, buchstabierCount: 1
        });
        const c = new AdminController();
        c.setDb({ db: true } as never);
        await c.ladeAdminStatistik();
        expect(mocks.renderStatistik).toHaveBeenCalled();
    });

    it("handles stats error", async () => {
        const { AdminController } = await import("../../src/admin/index");
        mocks.getAdminStats.mockRejectedValue(new Error("quota"));
        const c = new AdminController();
        c.setDb({ db: true } as never);
        await c.ladeAdminStatistik();
        expect(mocks.uiError).toHaveBeenCalled();
    });

    it("loads paged exercises and updates list", async () => {
        const { AdminController } = await import("../../src/admin/index");
        mocks.getUebungenPaged.mockResolvedValue({ uebungen: [{ buildVersion: "v1" }], lastVisible: null });
        mocks.getUebungenSnapshot.mockResolvedValue({ size: 5 });
        const c = new AdminController();
        c.setDb({ db: true } as never);
        await c.ladeAlleUebungen("initial");
        expect(mocks.renderUebungsListe).toHaveBeenCalled();
        expect(mocks.renderPaginationInfo).toHaveBeenCalled();
        expect(mocks.getUebungenPaged).toHaveBeenCalledWith(10, null, "initial", false);
    });

    it("delete flow tracks analytics and refreshes list", async () => {
        const { AdminController } = await import("../../src/admin/index");
        const c = new AdminController();
        c.setDb({ db: true } as never);
        const reload = vi.spyOn(c, "ladeAlleUebungen").mockResolvedValue();
        await c.loescheUebung("u1");
        expect(mocks.deleteUebung).toHaveBeenCalledWith("u1");
        expect(mocks.analyticsTrack).toHaveBeenCalledWith("admin_delete_uebung");
        expect(reload).toHaveBeenCalled();
    });

    it("supports pagination next and renders statistik chart", async () => {
        const { AdminController } = await import("../../src/admin/index");
        const c = new AdminController();
        c.setDb({ db: true } as never);
        mocks.getUebungenPaged.mockResolvedValueOnce({
            uebungen: [{ id: "u1" }],
            lastVisible: { __mockIndex: 0 }
        });
        await c.ladeAlleUebungen("next");
        expect(mocks.renderUebungsListe).toHaveBeenCalled();
        expect(mocks.renderPaginationInfo).toHaveBeenCalled();
        expect(mocks.getUebungenPaged).toHaveBeenCalledWith(10, null, "next", false);

        mocks.getAdminStats.mockResolvedValueOnce({
            total: 1, totalTeilnehmer: 1, totalBytes: 1000, totalSprueche: 10,
            loesungsCount: 0, staerkeCount: 0, buchstabierCount: 0
        });
        mocks.getUebungenSnapshot.mockResolvedValueOnce({
            forEach: (cb: (d: { data: () => { datum: string } }) => void) => {
                cb({ data: () => ({ datum: "2026-01-02T00:00:00Z" }) });
                cb({ data: () => ({ datum: { toDate: () => new Date("2026-02-03T00:00:00Z") } }) });
                cb({ data: () => ({ datum: "invalid" }) });
            }
        });
        await c.renderUebungsStatistik();
        expect(mocks.renderChart).toHaveBeenCalled();
    });

    it("handles open handlers, deletion cancel/error and setDb", async () => {
        const { AdminController } = await import("../../src/admin/index");
        const c = new AdminController();
        c.setDb({ db: true } as never);
        c.uebungAnschauen("u7");
        c.offeneUebungsleitung("u8");
        expect(window.open).toHaveBeenCalledWith("#/generator/u7", "_blank");
        expect(window.open).toHaveBeenCalledWith("#/uebungsleitung/u8", "_blank");

        mocks.uiConfirm.mockReturnValueOnce(false);
        await c.loescheUebung("u9");
        expect(mocks.deleteUebung).not.toHaveBeenCalledWith("u9");

        mocks.uiConfirm.mockReturnValueOnce(true);
        mocks.deleteUebung.mockRejectedValueOnce(new Error("nope"));
        await c.loescheUebung("u9");
        expect(mocks.uiError).toHaveBeenCalled();

        c.setDb({ other: true } as never);
        mocks.getAdminStats.mockResolvedValueOnce({
            total: 0, totalTeilnehmer: 0, totalBytes: 0, totalSprueche: 0,
            loesungsCount: 0, staerkeCount: 0, buchstabierCount: 0
        });
        await c.ladeAdminStatistik();
        expect(mocks.renderStatistik).toHaveBeenCalled();
    });

    it("uses firebase query filtering when only-test checkbox is enabled", async () => {
        const { AdminController } = await import("../../src/admin/index");
        const c = new AdminController();
        c.setDb({ db: true } as never);
        mocks.getUebungenPaged.mockResolvedValue({ uebungen: [], lastVisible: null });
        mocks.getUebungenSnapshot.mockResolvedValue({ size: 0 });

        const bindCall = mocks.bindListEvents.mock.calls[0];
        const onOnlyTestFilterChange = bindCall?.[3] as ((checked: boolean) => void) | undefined;
        expect(typeof onOnlyTestFilterChange).toBe("function");

        onOnlyTestFilterChange?.(true);
        await Promise.resolve();
        await Promise.resolve();

        expect(mocks.getUebungenPaged).toHaveBeenCalledWith(10, null, "initial", true);
        expect(mocks.getUebungenSnapshot).toHaveBeenCalledWith(true);
    });
});
