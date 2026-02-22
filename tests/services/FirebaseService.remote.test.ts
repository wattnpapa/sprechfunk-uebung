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
    getDocs: vi.fn()
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

    it("save/delete/paging/snapshot use firestore functions", async () => {
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
        const page1 = await s.getUebungenPaged(10, null, "initial");
        expect(page1.size).toBe(1);

        mocks.getDocs.mockResolvedValueOnce({
            docs: [{ id: "u2", data: () => ({}) }],
            size: 1
        });
        await s.getUebungenPaged(10, "last", "next");
        expect(mocks.startAfter).toHaveBeenCalled();

        mocks.getDocs.mockResolvedValueOnce({ size: 3, docs: [], forEach: vi.fn() });
        const snap = await s.getUebungenSnapshot();
        expect(snap.size).toBe(3);
    });

    it("uses initial paging query for prev direction (contract)", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        mocks.getDocs.mockResolvedValueOnce({ docs: [], size: 0 });
        await s.getUebungenPaged(5, "last", "prev");
        expect(mocks.startAfter).not.toHaveBeenCalled();
    });

    it("computes admin stats from firestore snapshot", async () => {
        const { FirebaseService } = await import("../../src/services/FirebaseService");
        const s = new FirebaseService({} as never);
        const docs = [
            {
                data: () => ({
                    teilnehmerListe: ["A", "B"],
                    loesungswoerter: { A: "X" },
                    loesungsStaerken: { A: "1/1/1/3" },
                    buchstabierenAn: 1,
                    nachrichten: { A: [{ id: 1 }] }
                })
            },
            {
                data: () => ({
                    teilnehmerListe: [],
                    loesungswoerter: {},
                    loesungsStaerken: {},
                    buchstabierenAn: 0,
                    nachrichten: {}
                })
            }
        ];
        mocks.getDocs.mockResolvedValueOnce({
            size: 2,
            forEach: (cb: (d: { data: () => unknown }) => void) => docs.forEach(cb)
        });
        const stats = await s.getAdminStats();
        expect(stats.total).toBe(2);
        expect(stats.loesungsCount).toBe(1);
        expect(stats.staerkeCount).toBe(1);
        expect(stats.buchstabierCount).toBe(1);
        expect(stats.totalSprueche).toBe(1);
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
});
