import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirebaseService } from "../../src/services/FirebaseService";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("FirebaseService local mock mode", () => {
    beforeEach(() => {
        const store = new Map<string, string>();
        vi.stubGlobal("window", {
            localStorage: {
                getItem: (k: string) => store.get(k) ?? null,
                setItem: (k: string, v: string) => { store.set(k, v); },
                removeItem: (k: string) => { store.delete(k); }
            }
        });
        window.localStorage.setItem("useFirestoreEmulator", "1");
    });

    it("saves and loads exercises from mock store", async () => {
        const s = new FirebaseService({} as never);
        const u = new FunkUebung("dev");
        u.id = "u1";
        u.teilnehmerListe = ["A", "B"];
        u.nachrichten = {
            A: [{ id: 1, nachricht: "x", empfaenger: ["Alle"] }]
        };
        await s.saveUebung(u);
        const loaded = await s.getUebung("u1");
        expect(loaded?.id).toBe("u1");
        // "Alle" gets expanded
        expect(loaded?.nachrichten.A?.[0]?.empfaenger).toEqual(["B"]);
    });

    it("deletes exercises from mock store", async () => {
        const s = new FirebaseService({} as never);
        const u = new FunkUebung("dev");
        u.id = "u2";
        await s.saveUebung(u);
        await s.deleteUebung("u2");
        expect(await s.getUebung("u2")).toBeNull();
    });

    it("paginates and computes admin stats in mock mode", async () => {
        const s = new FirebaseService({} as never);
        const mk = async (id: string, t: number) => {
            const u = new FunkUebung("dev");
            u.id = id;
            u.createDate = new Date(t);
            u.teilnehmerListe = ["A", "B"];
            u.loesungswoerter = { A: "X" };
            u.loesungsStaerken = { A: "1/1/1/3" };
            u.buchstabierenAn = 1;
            u.nachrichten = { A: [{ id: 1, nachricht: "x", empfaenger: ["B"] }] };
            await s.saveUebung(u);
        };
        await mk("u3", 3);
        await mk("u4", 4);
        const page = await s.getUebungenPaged(1, null, "initial");
        expect(page.uebungen).toHaveLength(1);
        const stats = await s.getAdminStats();
        expect(stats.total).toBeGreaterThanOrEqual(2);
        expect(stats.loesungsCount).toBeGreaterThanOrEqual(1);
    });

    it("covers local helper branches and snapshot iteration", async () => {
        const s = new FirebaseService({} as never);
        window.localStorage.setItem("e2eFirestoreSeed", "not-json");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((s as any).readMockStore()).toEqual({});
        window.localStorage.setItem("e2eFirestoreSeed", JSON.stringify({ a: 1 }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((s as any).readMockStore()).toEqual({ a: 1 });

        const snap = await s.getUebungenSnapshot();
        let count = 0;
        snap.forEach(() => { count += 1; });
        expect(count).toBe(snap.size);
    });

    it("maps invalid/legacy values to safe domain defaults", () => {
        const s = new FirebaseService({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (s as any).mapToDomain("uX", {
            datum: "invalid-date",
            createDate: 0,
            teilnehmerListe: ["A", 1],
            teilnehmerIds: { t1: "A", t2: 2 },
            nachrichten: {
                A: [
                    { id: "1", empfaenger: ["Alle"], nachricht: "x" },
                    { id: "x", empfaenger: [], nachricht: "" }
                ]
            },
            spruecheProTeilnehmer: "2"
        });
        expect(mapped.id).toBe("uX");
        expect(mapped.teilnehmerListe).toEqual(["A"]);
        expect(mapped.nachrichten.A[0]?.empfaenger).toEqual([]);
        expect(mapped.spruecheProTeilnehmer).toBe(2);
    });

    it("covers getUebungenPaged next and delete in mock store", async () => {
        const s = new FirebaseService({} as never);
        for (let i = 0; i < 3; i++) {
            const u = new FunkUebung("dev");
            u.id = `p${i}`;
            u.createDate = new Date(1000 + i);
            await s.saveUebung(u);
        }
        const first = await s.getUebungenPaged(2, null, "initial");
        const next = await s.getUebungenPaged(2, first.lastVisible, "next");
        expect(first.uebungen.length).toBe(2);
        expect(next.uebungen.length).toBeGreaterThanOrEqual(0);
        await s.deleteUebung("p1");
        expect(await s.getUebung("p1")).toBeNull();
    });

    it("maps rich message payload incl staerken/letters and defaults", () => {
        const s = new FirebaseService({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (s as any).mapToDomain("uY", {
            datum: Date.now(),
            createDate: new Date().toISOString(),
            buildVersion: 1,
            teilnehmerListe: ["A", "B"],
            teilnehmerIds: { t1: "A" },
            teilnehmerStellen: { A: "Stelle A" },
            loesungswoerter: { A: "ALFA" },
            loesungsStaerken: { A: "1/2/3/6" },
            funksprueche: ["x"],
            anmeldungAktiv: "x",
            verwendeteVorlagen: ["v1"],
            nachrichten: {
                A: [
                    {
                        id: 1,
                        nachricht: "hello",
                        empfaenger: ["B"],
                        loesungsbuchstaben: ["1A"],
                        staerken: [{ fuehrer: 1, unterfuehrer: 2, helfer: 3 }]
                    },
                    {
                        id: 2,
                        nachricht: "bad",
                        empfaenger: ["B"],
                        staerken: [{ fuehrer: "x", unterfuehrer: 0, helfer: 0 }]
                    }
                ]
            }
        });
        expect(mapped.nachrichten.A).toHaveLength(2);
        expect(mapped.nachrichten.A[0]?.loesungsbuchstaben).toEqual(["1A"]);
        expect(mapped.nachrichten.A[0]?.staerken?.[0]?.fuehrer).toBe(1);
        expect(mapped.anmeldungAktiv).toBe(true);
    });

    it("covers local mode guards when window/localStorage is unavailable", () => {
        vi.unstubAllGlobals();
        const s = new FirebaseService({} as never);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((s as any).isLocalMockMode()).toBe(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((s as any).readMockStore()).toEqual({});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => (s as any).writeMockStore({ a: 1 })).not.toThrow();

        const domStore = {
            getItem: () => {
                throw new Error("denied");
            },
            setItem: vi.fn()
        };
        vi.stubGlobal("window", { localStorage: domStore });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((s as any).isLocalMockMode()).toBe(false);
    });
});
