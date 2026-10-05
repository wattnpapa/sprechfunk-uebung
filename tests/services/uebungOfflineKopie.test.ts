import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    KeineVerbindungFehler,
    MAX_KOPIEN,
    OFFLINE_STAND_EREIGNIS,
    entferneOfflineKopie,
    istVerbindungsfehler,
    ladeOfflineKopie,
    mitVerbindungsZeitlimit,
    speichereOfflineKopie
} from "../../src/services/uebungOfflineKopie";
import { speichereMitBestaetigung } from "../../src/services/speicherBestaetigung";

// THW-Review 2026-10-05, offline P1-2 / P3-1 / P2-1.

const mocks = vi.hoisted(() => ({
    doc: vi.fn(() => "docRef"),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    collection: vi.fn(() => "colRef"),
    query: vi.fn(() => "queryRef"),
    where: vi.fn(() => "where"),
    limit: vi.fn(() => "limit")
}));

vi.mock("firebase/firestore", () => ({
    doc: mocks.doc,
    getDoc: mocks.getDoc,
    getDocs: mocks.getDocs,
    collection: mocks.collection,
    query: mocks.query,
    where: mocks.where,
    limit: mocks.limit,
    deleteDoc: vi.fn(),
    setDoc: vi.fn(),
    orderBy: vi.fn(),
    startAfter: vi.fn(),
    getCountFromServer: vi.fn(),
    getAggregateFromServer: vi.fn(),
    count: vi.fn(),
    sum: vi.fn(),
    Timestamp: class {}
}));

class SpeicherAttrappe {
    daten = new Map<string, string>();
    voll = false;
    getItem(k: string) {
        return this.daten.get(k) ?? null;
    }
    setItem(k: string, v: string) {
        if (this.voll) throw new Error("QuotaExceededError");
        this.daten.set(k, v);
    }
    removeItem(k: string) {
        this.daten.delete(k);
    }
}

const dokument = (name: string) => ({
    exists: () => true,
    id: "u1",
    data: () => ({
        name,
        datum: "2026-10-05T00:00:00.000Z",
        createDate: "2026-10-05T18:00:00.000Z",
        teilnehmerListe: ["Heros 1", "Heros 2"],
        teilnehmerIds: { A1B2: "Heros 1" },
        nachrichten: { "Heros 1": [{ id: 1, empfaenger: ["Heros 2"], nachricht: "Test" }] }
    })
});

describe("Offline-Kopie der Übung", () => {
    let speicher: SpeicherAttrappe;
    let ereignisse: Event[];

    beforeEach(() => {
        vi.clearAllMocks();
        speicher = new SpeicherAttrappe();
        ereignisse = [];
        vi.stubGlobal("localStorage", speicher);
        vi.stubGlobal("window", {
            localStorage: { getItem: () => null },
            dispatchEvent: (e: Event) => {
                ereignisse.push(e);
                return true;
            }
        });
        vi.stubGlobal("navigator", { onLine: true });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("speichert höchstens MAX_KOPIEN Übungen, die zuletzt geöffnete gewinnt", () => {
        ["a", "b", "c", "d"].forEach((id, i) => speichereOfflineKopie(id, JSON.stringify({ id }), new Date(2026, 9, 5, 21, i)));
        expect(ladeOfflineKopie("a")).toBeNull();
        expect(ladeOfflineKopie("d")?.daten).toEqual({ id: "d" });
        expect(ladeOfflineKopie("d")?.stand.getMinutes()).toBe(3);
        expect([...speicher.daten.keys()].filter(k => !k.endsWith("index"))).toHaveLength(MAX_KOPIEN);
        entferneOfflineKopie("d");
        expect(ladeOfflineKopie("d")).toBeNull();
    });

    it("bleibt bei vollem oder kaputtem Speicher still", () => {
        speicher.voll = true;
        expect(() => speichereOfflineKopie("a", "{}")).not.toThrow();
        expect(ladeOfflineKopie("a")).toBeNull();
        speicher.voll = false;
        speicher.daten.set("sprechfunk:uebung-offline:x", "{kaputt");
        expect(ladeOfflineKopie("x")).toBeNull();
    });

    it("erkennt Verbindungsfehler, aber nicht „verboten“ oder „gibt es nicht“", () => {
        expect(istVerbindungsfehler(new KeineVerbindungFehler())).toBe(true);
        expect(istVerbindungsfehler({ code: "unavailable", message: "x" })).toBe(true);
        expect(istVerbindungsfehler(new Error("Failed to get document because the client is offline."))).toBe(true);
        expect(istVerbindungsfehler({ code: "permission-denied", message: "Missing or insufficient permissions." })).toBe(false);
        vi.stubGlobal("navigator", { onLine: false });
        expect(istVerbindungsfehler(new Error("irgendwas"))).toBe(true);
    });

    it("mitVerbindungsZeitlimit gibt nach Ablauf mit KeineVerbindungFehler auf", async () => {
        vi.useFakeTimers();
        const ergebnis = mitVerbindungsZeitlimit(new Promise(() => undefined), 1000).catch(e => e);
        await vi.advanceTimersByTimeAsync(1001);
        expect(await ergebnis).toBeInstanceOf(KeineVerbindungFehler);
    });

    describe("FirebaseService.getUebung", () => {
        it("legt nach dem Laden eine Kopie ab und zeigt sie ohne Netz mit Hinweis", async () => {
            const { FirebaseService } = await import("../../src/services/FirebaseService");
            const s = new FirebaseService({} as never);
            mocks.getDoc.mockResolvedValueOnce(dokument("Abendübung"));
            const online = await s.getUebung("u1");
            expect(online?.name).toBe("Abendübung");
            expect(ladeOfflineKopie("u1")).not.toBeNull();

            vi.stubGlobal("navigator", { onLine: false });
            const offline = await s.getUebung("u1");
            expect(offline?.name).toBe("Abendübung");
            expect(offline?.nachrichten).toEqual(online?.nachrichten);
            expect(offline?.teilnehmerIds).toEqual({ A1B2: "Heros 1" });
            expect(mocks.getDoc).toHaveBeenCalledTimes(1);
            expect(ereignisse.map(e => e.type)).toEqual([OFFLINE_STAND_EREIGNIS]);
        });

        it("fällt bei einem Verbindungsfehler auf die Kopie zurück", async () => {
            const { FirebaseService } = await import("../../src/services/FirebaseService");
            const s = new FirebaseService({} as never);
            mocks.getDoc.mockResolvedValueOnce(dokument("Abendübung"));
            await s.getUebung("u1");
            mocks.getDoc.mockRejectedValueOnce(Object.assign(new Error("client is offline"), { code: "unavailable" }));
            expect((await s.getUebung("u1"))?.name).toBe("Abendübung");
        });

        it("wartet mit Kopie nicht ewig auf schwaches Netz", async () => {
            const { FirebaseService } = await import("../../src/services/FirebaseService");
            const s = new FirebaseService({} as never);
            mocks.getDoc.mockResolvedValueOnce(dokument("Abendübung"));
            await s.getUebung("u1");
            vi.useFakeTimers();
            mocks.getDoc.mockReturnValueOnce(new Promise(() => undefined));
            const laden = s.getUebung("u1");
            await vi.advanceTimersByTimeAsync(6100);
            expect((await laden)?.name).toBe("Abendübung");
        });

        it("meldet ohne Kopie „keine Verbindung“ statt eines rohen Fehlers; andere Fehler bleiben", async () => {
            const { FirebaseService } = await import("../../src/services/FirebaseService");
            const s = new FirebaseService({} as never);
            mocks.getDoc.mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "unavailable" }));
            await expect(s.getUebung("neu")).rejects.toBeInstanceOf(KeineVerbindungFehler);
            const verboten = Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
            mocks.getDoc.mockRejectedValueOnce(verboten);
            await expect(s.getUebung("neu")).rejects.toBe(verboten);
        });

        it("entfernt die Kopie, wenn die Übung gelöscht wurde", async () => {
            const { FirebaseService } = await import("../../src/services/FirebaseService");
            const s = new FirebaseService({} as never);
            mocks.getDoc.mockResolvedValueOnce(dokument("Abendübung"));
            await s.getUebung("u1");
            mocks.getDoc.mockResolvedValueOnce({ exists: () => false });
            expect(await s.getUebung("u1")).toBeNull();
            expect(ladeOfflineKopie("u1")).toBeNull();
        });
    });

    describe("FirebaseService.resolveTeilnehmerJoinCodes", () => {
        it("ein leeres Ergebnis aus dem Cache heißt „keine Verbindung“, nicht „nicht gefunden“", async () => {
            const { FirebaseService } = await import("../../src/services/FirebaseService");
            const s = new FirebaseService({} as never);
            mocks.getDocs.mockResolvedValueOnce({ docs: [], metadata: { fromCache: true } });
            await expect(s.resolveTeilnehmerJoinCodes("K7M4Q2", "A1B2")).rejects.toBeInstanceOf(KeineVerbindungFehler);
            mocks.getDocs.mockResolvedValueOnce({ docs: [], metadata: { fromCache: false } });
            await expect(s.resolveTeilnehmerJoinCodes("K7M4Q2", "A1B2")).resolves.toBeNull();
            mocks.getDocs.mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "unavailable" }));
            await expect(s.resolveTeilnehmerJoinCodes("K7M4Q2", "A1B2")).rejects.toBeInstanceOf(KeineVerbindungFehler);
        });
    });
});

describe("speichereMitBestaetigung (offline P2-1)", () => {
    afterEach(() => vi.useRealTimers());

    it("meldet „bestätigt“, wenn der Server rechtzeitig antwortet", async () => {
        await expect(speichereMitBestaetigung(() => Promise.resolve(), 1000)).resolves.toEqual({ status: "bestaetigt" });
    });

    it("meldet nach dem Zeitlimit „ausstehend“ und reicht die spätere Bestätigung nach", async () => {
        vi.useFakeTimers();
        let bestaetigen: (() => void) | undefined;
        const ergebnis = speichereMitBestaetigung(() => new Promise<void>(r => { bestaetigen = r; }), 1000);
        await vi.advanceTimersByTimeAsync(1001);
        const e = await ergebnis;
        expect(e.status).toBe("ausstehend");
        bestaetigen!();
        await expect(e.status === "ausstehend" ? e.spaeter : null).resolves.toBeUndefined();
    });

    it("wirft einen sofortigen Serverfehler weiter – dann ist sicher nichts gespeichert", async () => {
        await expect(speichereMitBestaetigung(() => Promise.reject(new Error("permission-denied")), 1000)).rejects.toThrow("permission-denied");
    });
});
