import { beforeEach, describe, expect, it, vi } from "vitest";
import { FunkUebung } from "../../src/models/FunkUebung";

const mocks = vi.hoisted(() => ({
    doc: vi.fn(),
    deleteDoc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    startAfter: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(),
    getCountFromServer: vi.fn(),
    getAggregateFromServer: vi.fn(),
    count: vi.fn(),
    sum: vi.fn()
}));

vi.mock("firebase/firestore", () => ({
    doc: mocks.doc,
    deleteDoc: mocks.deleteDoc,
    getDoc: mocks.getDoc,
    setDoc: mocks.setDoc,
    collection: mocks.collection,
    query: mocks.query,
    orderBy: mocks.orderBy,
    limit: mocks.limit,
    startAfter: mocks.startAfter,
    where: mocks.where,
    getDocs: mocks.getDocs,
    getCountFromServer: mocks.getCountFromServer,
    getAggregateFromServer: mocks.getAggregateFromServer,
    count: mocks.count,
    sum: mocks.sum,
    Timestamp: class {
        private d: Date;
        constructor(d: Date) {
            this.d = d;
        }
        toDate() {
            return this.d;
        }
    }
}));

describe("FirebaseService firestore path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("window", { localStorage: { getItem: () => null } });
        mocks.doc.mockReturnValue("docRef");
        mocks.collection.mockReturnValue("colRef");
        mocks.query.mockReturnValue("queryRef");
        mocks.orderBy.mockReturnValue("orderBy");
        mocks.limit.mockReturnValue("limit");
        mocks.startAfter.mockReturnValue("startAfter");
        mocks.where.mockReturnValue("where");
        mocks.count.mockReturnValue("count");
        mocks.sum.mockReturnValue("sum");
    });

    it("getUebung returns mapped domain for existing doc and null for missing", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getDoc.mockResolvedValueOnce({
            exists: () => true,
            id: "u1",
            data: () => ({
                name: "Ü",
                datum: new Date().toISOString(),
                createDate: new Date().toISOString(),
                teilnehmerListe: ["A"],
                nachrichten: {}
            })
        });
        const found = await s.getUebung("u1");
        expect(found?.id).toBe("u1");

        mocks.getDoc.mockResolvedValueOnce({ exists: () => false });
        const missing = await s.getUebung("u2");
        expect(missing).toBeNull();
    });

    it("maps malformed firestore payload safely (contract guard)", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getDoc.mockResolvedValueOnce({
            exists: () => true,
            id: "uX",
            data: () => ({
                name: 123,
                datum: "invalid-date",
                createDate: null,
                teilnehmerListe: ["A", 99],
                teilnehmerIds: { t1: "A", t2: 2 },
                nachrichten: {
                    A: [
                        { id: "1", nachricht: "ok", empfaenger: ["Alle"] },
                        { id: "x", nachricht: "", empfaenger: [] }
                    ],
                    B: "bad"
                },
                anmeldungAktiv: "yes",
                verwendeteVorlagen: ["v1", 2]
            })
        });

        const mapped = await s.getUebung("uX");
        expect(mapped?.name).toBe("");
        expect(mapped?.teilnehmerListe).toEqual(["A"]);
        expect(mapped?.teilnehmerIds).toEqual({ t1: "A" });
        expect(mapped?.nachrichten.A?.[0]?.empfaenger).toEqual([]);
        expect(mapped?.nachrichten.B).toEqual([]);
        expect(mapped?.anmeldungAktiv).toBe(true);
        expect(mapped?.verwendeteVorlagen).toEqual(["v1"]);
    });

    it("save/delete/paging use firestore functions", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);

        const f = new FunkUebung("dev");
        f.id = "u1";
        await s.saveUebung(f);
        await s.saveUebung({ id: "u2" } as never);
        expect(mocks.setDoc).toHaveBeenCalledTimes(2);

        await s.deleteUebung("u3");
        expect(mocks.deleteDoc).toHaveBeenCalled();

        mocks.getDocs.mockResolvedValueOnce({
            docs: [{ id: "u1", data: () => ({}) }],
            size: 1
        });
        const page1 = await s.getUebungenPaged(10, null);
        expect(page1.size).toBe(1);

        mocks.getDocs.mockResolvedValueOnce({
            docs: [{ id: "u2", data: () => ({}) }],
            size: 1
        });
        await s.getUebungenPaged(10, "last");
        expect(mocks.startAfter).toHaveBeenCalledWith("last");

        mocks.getCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 3 }) });
        expect(await s.getUebungenCount()).toBe(3);
    });

    it("queries the first page without a cursor (contract)", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getDocs.mockResolvedValueOnce({ docs: [], size: 0 });
        await s.getUebungenPaged(5, null);
        expect(mocks.startAfter).not.toHaveBeenCalled();
    });

    it("loads the full list for the admin text search", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getDocs.mockResolvedValueOnce({
            docs: [
                { id: "u1", data: () => ({ name: "Alpha" }) },
                { id: "u2", data: () => ({ name: "Beta" }) }
            ],
            size: 2
        });

        const alle = await s.getAlleUebungen();
        expect(alle.map(u => u.id)).toEqual(["u1", "u2"]);
        expect(mocks.limit).not.toHaveBeenCalled();
    });

    it("uses where filter in firestore queries for only-test flag", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getDocs.mockResolvedValue({ docs: [], size: 0, forEach: vi.fn() });

        await s.getUebungenPaged(5, null, true);
        expect(mocks.where).toHaveBeenCalledWith("istStandardKonfiguration", "==", true);

        mocks.getCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });
        await s.getUebungenCount(true);
        expect(mocks.where).toHaveBeenCalledWith("istStandardKonfiguration", "==", true);
    });

    it("computes admin stats from aggregation queries without reading documents", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);

        mocks.getAggregateFromServer.mockResolvedValueOnce({
            data: () => ({ total: 2, totalTeilnehmer: 9, totalSprueche: 40, totalBytes: 2048 })
        });
        mocks.getCountFromServer
            .mockResolvedValueOnce({ data: () => ({ count: 1 }) })
            .mockResolvedValueOnce({ data: () => ({ count: 2 }) })
            .mockResolvedValueOnce({ data: () => ({ count: 3 }) });

        const stats = await s.getAdminStats();

        expect(stats).toEqual({
            total: 2,
            totalTeilnehmer: 9,
            totalSprueche: 40,
            totalBytes: 2048,
            loesungsCount: 1,
            staerkeCount: 2,
            buchstabierCount: 3
        });
        expect(mocks.getDocs).not.toHaveBeenCalled();
        expect(mocks.sum).toHaveBeenCalledWith("statTeilnehmerAnzahl");
        expect(mocks.sum).toHaveBeenCalledWith("statNachrichtenAnzahl");
        expect(mocks.sum).toHaveBeenCalledWith("statBytes");
        expect(mocks.where).toHaveBeenCalledWith("statHatLoesungswoerter", "==", true);
    });

    it("counts exercises per month via aggregation", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getCountFromServer.mockImplementation(() =>
            Promise.resolve({ data: () => ({ count: 1 }) })
        );

        const monate = await s.getUebungenMonatsCounts();

        expect(monate).toEqual(Array.from({ length: 12 }, () => 1));
        expect(mocks.getCountFromServer).toHaveBeenCalledTimes(12);
        expect(mocks.where).toHaveBeenCalledWith("statMonat", "==", 11);
        expect(mocks.where).not.toHaveBeenCalledWith("statJahr", "==", expect.anything());
        expect(mocks.getDocs).not.toHaveBeenCalled();
    });

    it("restricts the monthly aggregation to one year when asked", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getCountFromServer.mockImplementation(() =>
            Promise.resolve({ data: () => ({ count: 2 }) })
        );

        const monate = await s.getUebungenMonatsCounts(false, 2025);

        expect(monate).toEqual(Array.from({ length: 12 }, () => 2));
        expect(mocks.where).toHaveBeenCalledWith("statJahr", "==", 2025);
    });

    it("lists years with exercises starting at the earliest stored year", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        const aktuellesJahr = new Date().getFullYear();
        mocks.getDocs
            .mockResolvedValueOnce({ docs: [{ data: () => ({ statJahr: aktuellesJahr - 1 }) }] })
            .mockResolvedValueOnce({ docs: [{ data: () => ({ statJahr: aktuellesJahr - 1 }) }] });
        // Vorjahr hat Übungen, das laufende Jahr nicht.
        mocks.getCountFromServer
            .mockResolvedValueOnce({ data: () => ({ count: 4 }) })
            .mockResolvedValueOnce({ data: () => ({ count: 0 }) });

        const jahre = await s.getUebungenJahresCounts();

        expect(jahre).toEqual([{ jahr: aktuellesJahr - 1, anzahl: 4 }]);
        expect(mocks.orderBy).toHaveBeenCalledWith("statJahr", "asc");
        expect(mocks.orderBy).toHaveBeenCalledWith("statJahr", "desc");
    });

    it("includes future years when an exercise is dated ahead", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        const aktuellesJahr = new Date().getFullYear();
        mocks.getDocs
            .mockResolvedValueOnce({ docs: [{ data: () => ({ statJahr: aktuellesJahr }) }] })
            .mockResolvedValueOnce({ docs: [{ data: () => ({ statJahr: aktuellesJahr + 1 }) }] });
        mocks.getCountFromServer
            .mockResolvedValueOnce({ data: () => ({ count: 3 }) })
            .mockResolvedValueOnce({ data: () => ({ count: 1 }) });

        const jahre = await s.getUebungenJahresCounts();

        expect(jahre).toEqual([
            { jahr: aktuellesJahr, anzahl: 3 },
            { jahr: aktuellesJahr + 1, anzahl: 1 }
        ]);
        expect(mocks.where).toHaveBeenCalledWith("statJahr", "==", aktuellesJahr + 1);
    });

    it("caps the year window even when a stored date is far in the future", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        const aktuellesJahr = new Date().getFullYear();
        mocks.getDocs
            .mockResolvedValueOnce({ docs: [{ data: () => ({ statJahr: 1970 }) }] })
            .mockResolvedValueOnce({ docs: [{ data: () => ({ statJahr: 2099 }) }] });
        mocks.getCountFromServer.mockImplementation(() => Promise.resolve({ data: () => ({ count: 1 }) }));

        const jahre = await s.getUebungenJahresCounts();

        expect(jahre).toHaveLength(15);
        expect(jahre[0].jahr).toBe(aktuellesJahr);
    });

    it("keeps the year filter empty when the earliest year cannot be read", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getDocs.mockRejectedValueOnce(new Error("missing index"));

        expect(await s.getUebungenJahresCounts()).toEqual([]);
        expect(mocks.getCountFromServer).not.toHaveBeenCalled();
    });

    it("resolves join codes through firestore query", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getDocs.mockResolvedValueOnce({
            docs: [
                {
                    id: "u42",
                    data: () => ({ teilnehmerIds: { A1B2: "Alpha" } })
                }
            ]
        });

        const resolved = await s.resolveTeilnehmerJoinCodes("K7M4Q2", "a1b2");
        expect(resolved).toEqual({
            uebungId: "u42",
            teilnehmerId: "A1B2",
            teilnehmerName: "Alpha"
        });
        expect(mocks.where).toHaveBeenCalledWith("uebungCode", "==", "K7M4Q2");
    });

    it("picks the exercise that owns the participant code when exercise codes collide", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getDocs.mockResolvedValueOnce({
            docs: [
                { id: "kollision", data: () => ({ teilnehmerIds: { ZZZZ: "Fremd" } }) },
                { id: "u42", data: () => ({ teilnehmerIds: { A1B2: "Alpha" } }) }
            ]
        });

        const resolved = await s.resolveTeilnehmerJoinCodes("K7M4Q2", "A1B2");

        expect(resolved).toEqual({
            uebungId: "u42",
            teilnehmerId: "A1B2",
            teilnehmerName: "Alpha"
        });
        // limit(1) haette hier das falsche Dokument geliefert.
        expect(mocks.limit).toHaveBeenCalledWith(5);
    });

    it("reports whether an exercise code is already taken", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);

        mocks.getDocs.mockResolvedValueOnce({ docs: [{ id: "fremd" }] });
        expect(await s.isUebungCodeVergeben("k7m4q2")).toBe(true);
        expect(mocks.where).toHaveBeenCalledWith("uebungCode", "==", "K7M4Q2");

        // Die eigene Uebung zaehlt beim erneuten Speichern nicht als Kollision.
        mocks.getDocs.mockResolvedValueOnce({ docs: [{ id: "eigen" }] });
        expect(await s.isUebungCodeVergeben("K7M4Q2", "eigen")).toBe(false);

        mocks.getDocs.mockResolvedValueOnce({ docs: [] });
        expect(await s.isUebungCodeVergeben("K7M4Q2")).toBe(false);

        expect(await s.isUebungCodeVergeben("")).toBe(false);
    });
});
