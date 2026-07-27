import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getFirestore: vi.fn(() => ({ db: true })),
    initializeApp: vi.fn(),
    getAdminStats: vi.fn(),
    getUebungenPaged: vi.fn(),
    getAlleUebungen: vi.fn(),
    getUebungenCount: vi.fn(),
    getUebungenMonatsCounts: vi.fn(),
    deleteUebung: vi.fn(),
    renderStatistik: vi.fn(),
    renderUebungsListe: vi.fn(),
    renderPaginationInfo: vi.fn(),
    setPaginationButtons: vi.fn(),
    renderChart: vi.fn(),
    bindListEvents: vi.fn(),
    uiError: vi.fn(),
    uiConfirm: vi.fn(() => true)
}));

vi.mock("firebase/app", () => ({ initializeApp: mocks.initializeApp }));
vi.mock("firebase/firestore", () => ({ getFirestore: mocks.getFirestore }));
vi.mock("../../src/firebase-config.js", () => ({ firebaseConfig: {} }));
vi.mock("../../src/services/FirebaseService", () => ({
    FirebaseService: class {
        getAdminStats = mocks.getAdminStats;
        getUebungenPaged = mocks.getUebungenPaged;
        getAlleUebungen = mocks.getAlleUebungen;
        getUebungenCount = mocks.getUebungenCount;
        getUebungenMonatsCounts = mocks.getUebungenMonatsCounts;
        deleteUebung = mocks.deleteUebung;
    }
}));
vi.mock("../../src/admin/AdminView", () => ({
    AdminView: class {
        renderStatistik = mocks.renderStatistik;
        renderUebungsListe = mocks.renderUebungsListe;
        renderPaginationInfo = mocks.renderPaginationInfo;
        setPaginationButtons = mocks.setPaginationButtons;
        renderChart = mocks.renderChart;
        bindListEvents = mocks.bindListEvents;
    }
}));
vi.mock("../../src/core/UiFeedback", () => ({
    uiFeedback: { error: mocks.uiError, confirm: mocks.uiConfirm }
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
        mocks.getUebungenCount.mockResolvedValue(5);
        const c = new AdminController();
        c.setDb({ db: true } as never);
        await c.ladeAlleUebungen("initial");
        expect(mocks.renderUebungsListe).toHaveBeenCalled();
        expect(mocks.renderPaginationInfo).toHaveBeenCalled();
        expect(mocks.getUebungenPaged).toHaveBeenCalledWith(10, null, false);
    });

    it("delete flow removes the exercise and refreshes list", async () => {
        const { AdminController } = await import("../../src/admin/index");
        const c = new AdminController();
        c.setDb({ db: true } as never);
        const reload = vi.spyOn(c, "ladeAlleUebungen").mockResolvedValue();
        await c.loescheUebung("u1");
        expect(mocks.deleteUebung).toHaveBeenCalledWith("u1");
        expect(reload).toHaveBeenCalled();
    });

    it("supports pagination next and renders statistik chart", async () => {
        const { AdminController } = await import("../../src/admin/index");
        const c = new AdminController();
        c.setDb({ db: true } as never);
        const seite1 = Array.from({ length: 10 }, (_, i) => ({ id: `u${i}` }));
        mocks.getUebungenPaged.mockResolvedValueOnce({ uebungen: seite1, lastVisible: { __mockIndex: 9 } });
        mocks.getUebungenCount.mockResolvedValue(15);
        await c.ladeAlleUebungen("initial");
        expect(mocks.setPaginationButtons).toHaveBeenLastCalledWith(false, true);

        mocks.getUebungenPaged.mockResolvedValueOnce({
            uebungen: [{ id: "u10" }],
            lastVisible: { __mockIndex: 10 }
        });
        await c.ladeAlleUebungen("next");
        expect(mocks.renderUebungsListe).toHaveBeenCalled();
        expect(mocks.renderPaginationInfo).toHaveBeenCalled();
        expect(mocks.getUebungenPaged).toHaveBeenLastCalledWith(10, { __mockIndex: 9 }, false);
        // Letzte Seite: kein weiteres Blättern, sonst landet man auf einer leeren Seite.
        expect(mocks.setPaginationButtons).toHaveBeenLastCalledWith(true, false);

        await c.ladeAlleUebungen("next");
        expect(mocks.getUebungenPaged).toHaveBeenCalledTimes(2);

        mocks.getUebungenPaged.mockResolvedValueOnce({ uebungen: seite1, lastVisible: { __mockIndex: 9 } });
        await c.ladeAlleUebungen("prev");
        expect(mocks.getUebungenPaged).toHaveBeenLastCalledWith(10, null, false);
        expect(c.pagination.currentPage).toBe(0);

        mocks.getAdminStats.mockResolvedValueOnce({
            total: 1, totalTeilnehmer: 1, totalBytes: 1000, totalSprueche: 10,
            loesungsCount: 0, staerkeCount: 0, buchstabierCount: 0
        });
        const monatsCounts = Array.from({ length: 12 }, () => 0);
        monatsCounts[0] = 1;
        monatsCounts[1] = 1;
        mocks.getUebungenMonatsCounts.mockResolvedValueOnce(monatsCounts);
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
        mocks.getUebungenCount.mockResolvedValue(0);

        const bindCall = mocks.bindListEvents.mock.calls[0]?.[0];
        const onOnlyTestFilterChange = bindCall?.onOnlyTestFilterChange as ((checked: boolean) => void) | undefined;
        expect(typeof onOnlyTestFilterChange).toBe("function");

        onOnlyTestFilterChange?.(true);
        await Promise.resolve();
        await Promise.resolve();

        expect(mocks.getUebungenPaged).toHaveBeenCalledWith(10, null, true);
        expect(mocks.getUebungenCount).toHaveBeenCalledWith(true);
    });

    it("paginates search hits client side with full pages", async () => {
        const { AdminController } = await import("../../src/admin/index");
        const c = new AdminController();
        c.setDb({ db: true } as never);

        const alle = [
            ...Array.from({ length: 25 }, (_, i) => ({ id: `u${i}`, name: `Alpha ${i}`, rufgruppe: "R", leitung: "L" })),
            { id: "x1", name: "Beta", rufgruppe: "R", leitung: "L" }
        ];
        mocks.getAlleUebungen.mockResolvedValue(alle);

        const onSearchChange = mocks.bindListEvents.mock.calls[0]?.[0]?.onSearchChange as ((term: string) => void) | undefined;
        expect(typeof onSearchChange).toBe("function");

        onSearchChange?.("alpha");
        await vi.waitFor(() => expect(mocks.renderUebungsListe).toHaveBeenCalled());

        expect(mocks.getAlleUebungen).toHaveBeenCalledWith(false);
        expect(mocks.getUebungenPaged).not.toHaveBeenCalled();
        expect(mocks.renderUebungsListe.mock.lastCall?.[0]).toHaveLength(10);
        expect(mocks.renderPaginationInfo).toHaveBeenLastCalledWith(0, 10, 10, 25);

        await c.ladeAlleUebungen("next");
        expect(mocks.renderUebungsListe.mock.lastCall?.[0]).toHaveLength(10);
        expect(mocks.renderPaginationInfo).toHaveBeenLastCalledWith(1, 10, 10, 25);

        await c.ladeAlleUebungen("next");
        expect(mocks.renderUebungsListe.mock.lastCall?.[0]).toHaveLength(5);
        expect(mocks.setPaginationButtons).toHaveBeenLastCalledWith(true, false);

        // Der Gesamtbestand wird nur einmal geladen und danach gecacht.
        expect(mocks.getAlleUebungen).toHaveBeenCalledTimes(1);
    });

    it("returns to cursor paging when the search field is cleared", async () => {
        const { AdminController } = await import("../../src/admin/index");
        const c = new AdminController();
        c.setDb({ db: true } as never);
        mocks.getAlleUebungen.mockResolvedValue([{ id: "u1", name: "Alpha", rufgruppe: "R", leitung: "L" }]);
        mocks.getUebungenPaged.mockResolvedValue({ uebungen: [], lastVisible: null });
        mocks.getUebungenCount.mockResolvedValue(0);

        const onSearchChange = mocks.bindListEvents.mock.calls[0]?.[0]?.onSearchChange as ((term: string) => void) | undefined;
        onSearchChange?.("alpha");
        await vi.waitFor(() => expect(mocks.getAlleUebungen).toHaveBeenCalled());

        onSearchChange?.("   ");
        await vi.waitFor(() => expect(mocks.getUebungenPaged).toHaveBeenCalledWith(10, null, false));
    });
});
