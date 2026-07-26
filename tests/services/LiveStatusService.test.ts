import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
    setDoc: vi.fn().mockResolvedValue(undefined),
    onSnapshot: vi.fn(() => vi.fn()),
    doc: vi.fn((...path: unknown[]) => ({ path: path.slice(1).join("/") })),
    collection: vi.fn((...path: unknown[]) => ({ path: path.slice(1).join("/") }))
}));

vi.mock("firebase/firestore", () => firestoreMocks);

/** Minimaler localStorage-Ersatz für den Mock-/E2E-Pfad. */
function installLocalStorage(initial: Record<string, string> = {}): Map<string, string> {
    const store = new Map(Object.entries(initial));
    vi.stubGlobal("localStorage", {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k)
    });
    return store;
}

function installWindow(store: Map<string, string>): void {
    const listeners = new Map<string, ((e: Event) => void)[]>();
    vi.stubGlobal("window", {
        localStorage: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, v)
        },
        addEventListener: (type: string, cb: (e: Event) => void) => {
            listeners.set(type, [...(listeners.get(type) ?? []), cb]);
        },
        removeEventListener: (type: string, cb: (e: Event) => void) => {
            listeners.set(type, (listeners.get(type) ?? []).filter(l => l !== cb));
        },
        dispatchEvent: (event: Event) => {
            (listeners.get(event.type) ?? []).forEach(cb => cb(event));
            return true;
        },
        location: { search: "" }
    });
}

async function loadService() {
    const mod = await import("../../src/services/LiveStatusService");
    const { featureFlags } = await import("../../src/services/featureFlags");
    featureFlags.resetForTests();
    return mod;
}

describe("sanitizeForFirestore", () => {
    it("entfernt undefined-Werte und leere Keys rekursiv", async () => {
        installWindow(installLocalStorage());
        const { sanitizeForFirestore } = await loadService();

        const result = sanitizeForFirestore({
            a: 1,
            b: undefined,
            "": "leer",
            nested: { c: undefined, d: "x" },
            list: [1, undefined, { e: undefined, f: 2 }]
        });

        expect(result).toEqual({ a: 1, nested: { d: "x" }, list: [1, { f: 2 }] });
    });
});

describe("LiveStatusService – Mock-Modus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("spiegelt Dokumente in den localStorage und verteilt sie an Abonnenten", async () => {
        const store = installLocalStorage({ useFirestoreEmulator: "1" });
        installWindow(store);
        vi.stubGlobal("CustomEvent", class extends Event {
            public detail: unknown;
            constructor(type: string, init?: { detail?: unknown }) {
                super(type);
                this.detail = init?.detail;
            }
        });

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService(null, "u1");
        expect(service.enabled).toBe(true);

        const empfangen: unknown[] = [];
        service.subscribeAlleTeilnehmer(docs => empfangen.push(docs));

        service.publishTeilnehmerStatus({
            version: 1,
            teilnehmerId: "9F3K",
            teilnehmer: "Florian 10/1",
            lastUpdated: "2026-07-26T10:00:00.000Z",
            nachrichten: { "1": { uebertragen: true, uebertragenUm: "2026-07-26T10:00:00.000Z" } }
        });
        await service.flush();

        const raw = store.get("sprechfunkLiveStatus:u1") ?? "{}";
        expect(JSON.parse(raw)["teilnehmer-9F3K"].teilnehmer).toBe("Florian 10/1");
        // Erster Aufruf beim Abonnieren, weiterer nach dem Schreiben.
        expect(empfangen.length).toBeGreaterThanOrEqual(2);
        expect(empfangen[empfangen.length - 1]).toEqual([
            expect.objectContaining({ teilnehmer: "Florian 10/1" })
        ]);

        service.dispose();
    });

    it("liefert nur Teilnehmer-Dokumente an subscribeAlleTeilnehmer", async () => {
        const store = installLocalStorage({
            useFirestoreEmulator: "1",
            "sprechfunkLiveStatus:u1": JSON.stringify({
                "leitung-public": { version: 1, lastUpdated: "", nachrichten: {} },
                "leitung": { version: 1, lastUpdated: "", teilnehmer: {}, nachrichtenNotizen: {} },
                "teilnehmer-9F3K": { version: 1, teilnehmerId: "9F3K", teilnehmer: "A", lastUpdated: "", nachrichten: {} }
            })
        });
        installWindow(store);

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService(null, "u1");

        let letzte: { teilnehmer: string }[] = [];
        service.subscribeAlleTeilnehmer(docs => {
            letzte = docs;
        });

        expect(letzte).toHaveLength(1);
        expect(letzte[0]?.teilnehmer).toBe("A");
        service.dispose();
    });
});

describe("LiveStatusService – Firestore-Modus", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        firestoreMocks.setDoc.mockResolvedValue(undefined);
        firestoreMocks.onSnapshot.mockReturnValue(vi.fn());
    });

    it("bleibt deaktiviert, wenn das Feature-Flag aus ist", async () => {
        const store = installLocalStorage({ featureFlags: JSON.stringify({ enableLiveStatusSync: false }) });
        installWindow(store);

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");

        expect(service.enabled).toBe(false);
        expect(service.getState()).toBe("aus");
        service.publishLeitungPublic({ version: 1, lastUpdated: "", nachrichten: {} });
        await service.flush();
        expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
    });

    it("bleibt deaktiviert ohne Übungs-ID", async () => {
        installWindow(installLocalStorage());
        const { LiveStatusService } = await loadService();

        expect(new LiveStatusService({} as never, "").enabled).toBe(false);
    });

    it("schreibt in die status-Subcollection der Übung", async () => {
        installWindow(installLocalStorage());
        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");

        service.publishLeitungInternal({
            version: 1,
            lastUpdated: "2026-07-26T10:00:00.000Z",
            teilnehmer: {},
            nachrichtenNotizen: {}
        });
        await service.flush();

        expect(firestoreMocks.doc).toHaveBeenCalledWith({}, "uebungen", "u1", "status", "leitung");
        expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
        expect(service.getState()).toBe("live");
    });

    it("meldet einen Schreibfehler als Offline-Zustand statt zu werfen", async () => {
        installWindow(installLocalStorage());
        vi.spyOn(console, "warn").mockImplementation(() => {});
        firestoreMocks.setDoc.mockRejectedValueOnce(new Error("permission-denied"));

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");
        const zustaende: string[] = [];
        service.onStateChange(state => zustaende.push(state));

        service.publishLeitungPublic({ version: 1, lastUpdated: "", nachrichten: {} });
        await service.flush();

        expect(service.getState()).toBe("fehler");
        expect(zustaende).toContain("fehler");
    });

    it("fasst mehrere Schreibvorgänge auf dasselbe Dokument zusammen", async () => {
        installWindow(installLocalStorage());
        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");

        service.publishLeitungPublic({ version: 1, lastUpdated: "a", nachrichten: {} });
        service.publishLeitungPublic({ version: 1, lastUpdated: "b", nachrichten: {} });
        await service.flush();

        expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);
        expect(firestoreMocks.setDoc.mock.calls[0]?.[1]).toMatchObject({ lastUpdated: "b" });
    });

    it("reicht Snapshot-Daten an die Abonnenten durch", async () => {
        installWindow(installLocalStorage());
        const snapshots: { onNext: (snap: unknown) => void; onError: (e: unknown) => void }[] = [];
        firestoreMocks.onSnapshot.mockImplementation(
            (_ref: unknown, onNext: (snap: unknown) => void, onError: (e: unknown) => void) => {
                snapshots.push({ onNext, onError });
                return vi.fn();
            }
        );

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");

        let leitung: unknown = "unset";
        let intern: unknown = "unset";
        let eigen: unknown = "unset";
        let teilnehmer: unknown[] = [];
        service.subscribeLeitungPublic(d => {
            leitung = d;
        });
        service.subscribeLeitungInternal(d => {
            intern = d;
        });
        service.subscribeEigenenStatus("9F3K", d => {
            eigen = d;
        });
        service.subscribeAlleTeilnehmer(d => {
            teilnehmer = d;
        });

        snapshots[0]?.onNext({ exists: () => true, data: () => ({ version: 1, nachrichten: {} }) });
        snapshots[1]?.onNext({ exists: () => false });
        snapshots[2]?.onNext({ exists: () => true, data: () => ({ teilnehmer: "A" }) });
        snapshots[3]?.onNext({
            docs: [
                { id: "leitung-public", data: () => ({}) },
                { id: "teilnehmer-9F3K", data: () => ({ teilnehmer: "A" }) },
                { id: "teilnehmer-XXXX", data: () => ({}) }
            ]
        });

        expect(leitung).toMatchObject({ version: 1 });
        expect(intern).toBeNull();
        expect(eigen).toMatchObject({ teilnehmer: "A" });
        // Dokumente ohne Funkrufnamen sind unbrauchbar und werden verworfen.
        expect(teilnehmer).toEqual([{ teilnehmer: "A" }]);
        expect(service.getState()).toBe("live");
    });

    it("wechselt bei einem Snapshot-Fehler in den Offline-Zustand", async () => {
        installWindow(installLocalStorage());
        vi.spyOn(console, "warn").mockImplementation(() => {});
        let onError: ((e: unknown) => void) | undefined;
        firestoreMocks.onSnapshot.mockImplementation(
            (_ref: unknown, _onNext: unknown, handler: (e: unknown) => void) => {
                onError = handler;
                return vi.fn();
            }
        );

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");
        service.subscribeAlleTeilnehmer(() => {});
        onError?.(new Error("permission-denied"));

        expect(service.getState()).toBe("fehler");
    });

    it("überspringt Abonnements, wenn der Sync deaktiviert ist", async () => {
        const store = installLocalStorage({ featureFlags: JSON.stringify({ enableLiveStatusSync: false }) });
        installWindow(store);

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");
        service.subscribeAlleTeilnehmer(() => {});
        service.subscribeLeitungPublic(() => {});
        service.subscribeLeitungInternal(() => {});
        service.subscribeEigenenStatus("9F3K", () => {});
        service.dispose();

        expect(firestoreMocks.onSnapshot).not.toHaveBeenCalled();
    });

    it("bricht dispose nicht ab, wenn ein Abmelden fehlschlägt", async () => {
        installWindow(installLocalStorage());
        const zweites = vi.fn();
        firestoreMocks.onSnapshot
            .mockReturnValueOnce(() => {
                throw new Error("bereits abgemeldet");
            })
            .mockReturnValueOnce(zweites);

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");
        service.subscribeLeitungPublic(() => {});
        service.subscribeLeitungInternal(() => {});

        expect(() => service.dispose()).not.toThrow();
        expect(zweites).toHaveBeenCalled();
    });

    it("schreibt verzögert auch ohne expliziten flush", async () => {
        vi.useFakeTimers();
        installWindow(installLocalStorage());

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");
        service.publishLeitungPublic({ version: 1, lastUpdated: "a", nachrichten: {} });

        expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(500);
        expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1);

        service.dispose();
        vi.useRealTimers();
    });

    it("meldet sich bei dispose von allen Snapshots ab", async () => {
        installWindow(installLocalStorage());
        const unsubscribe = vi.fn();
        firestoreMocks.onSnapshot.mockReturnValue(unsubscribe);

        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");
        service.subscribeAlleTeilnehmer(() => {});
        service.subscribeLeitungPublic(() => {});
        service.subscribeEigenenStatus("9F3K", () => {});
        service.dispose();

        expect(unsubscribe).toHaveBeenCalledTimes(3);
    });
});
