import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THW-Review 2026-10-05, offline P1-4 und P2-2: offene Änderungen, letzte
 * Bestätigung und ein Abgleich mit Zeitlimit, der ohne Netz sofort ablehnt.
 */

const firestoreMocks = vi.hoisted(() => ({
    setDoc: vi.fn().mockResolvedValue(undefined),
    onSnapshot: vi.fn(() => vi.fn()),
    doc: vi.fn((...path: unknown[]) => ({ path: path.slice(1).join("/") })),
    collection: vi.fn((...path: unknown[]) => ({ path: path.slice(1).join("/") }))
}));

vi.mock("firebase/firestore", () => firestoreMocks);

function installWindow(): void {
    const store = new Map<string, string>();
    const ls = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k)
    };
    vi.stubGlobal("localStorage", ls);
    const listeners = new Map<string, ((e: Event) => void)[]>();
    vi.stubGlobal("window", {
        localStorage: ls,
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

const teilnehmerDoc = (lastUpdated: string) => ({
    version: 1, teilnehmerId: "T1", teilnehmer: "A", lastUpdated, nachrichten: {}
});

describe("LiveStatusService – Sync-Info", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
        firestoreMocks.setDoc.mockResolvedValue(undefined);
        firestoreMocks.onSnapshot.mockReturnValue(vi.fn());
    });

    it("meldet offene Änderungen und die Uhrzeit der letzten Bestätigung", async () => {
        installWindow();
        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");
        const infos: { offeneAenderungen: number; letzteBestaetigungUm?: string }[] = [];
        service.onSyncInfo(info => infos.push(info));
        expect(infos[0]?.offeneAenderungen).toBe(0);
        expect(service.getSyncInfo().letzteBestaetigungUm).toBeUndefined();

        service.publishTeilnehmerStatus(teilnehmerDoc("a"));
        expect(infos.at(-1)?.offeneAenderungen).toBe(1);

        await service.flush();
        const zuletzt = infos.at(-1);
        expect(zuletzt?.offeneAenderungen).toBe(0);
        expect(zuletzt?.letzteBestaetigungUm).toBeTruthy();
        expect(service.getSyncInfo().state).toBe("live");
        service.dispose();
    });

    it("sagt je Dokument, bis zu welchem Stand der Server bestätigt hat", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-05T19:00:00.000Z"));
        installWindow();
        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");
        expect(service.getTeilnehmerBestaetigtBis("T1")).toBeUndefined();

        service.publishTeilnehmerStatus(teilnehmerDoc("a"));
        await service.flush();
        expect(service.getTeilnehmerBestaetigtBis("T1")).toBe("2026-10-05T19:00:00.000Z");

        // Eine spätere Änderung ist erst nach ihrer eigenen Bestätigung angekommen.
        vi.setSystemTime(new Date("2026-10-05T19:05:00.000Z"));
        let bestaetigen: () => void = () => {};
        firestoreMocks.setDoc.mockImplementationOnce(() => new Promise<void>(resolve => {
            bestaetigen = resolve;
        }));
        service.publishTeilnehmerStatus(teilnehmerDoc("b"));
        const laeuft = service.flush();
        expect(service.getTeilnehmerBestaetigtBis("T1")).toBe("2026-10-05T19:00:00.000Z");
        bestaetigen();
        await laeuft;
        expect(service.getTeilnehmerBestaetigtBis("T1")).toBe("2026-10-05T19:05:00.000Z");
        service.dispose();
    });

    it("lehnt flushMitZeitlimit ohne Verbindung sofort ab und behält die Änderung", async () => {
        installWindow();
        vi.stubGlobal("navigator", { onLine: false });
        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");

        service.publishLeitungPublic({ version: 1, lastUpdated: "a", nachrichten: {} });
        await expect(service.flushMitZeitlimit(50)).resolves.toBe("offline");
        expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
        expect(service.getOffeneAenderungen()).toBe(1);
        service.dispose();
    });

    it("liefert bei Bestätigung „bestaetigt“, sonst Zeitlimit oder Fehler", async () => {
        installWindow();
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "u1");

        service.publishLeitungPublic({ version: 1, lastUpdated: "a", nachrichten: {} });
        await expect(service.flushMitZeitlimit()).resolves.toBe("bestaetigt");

        firestoreMocks.setDoc.mockImplementationOnce(() => new Promise<void>(() => {}));
        service.publishLeitungPublic({ version: 1, lastUpdated: "b", nachrichten: {} });
        await expect(service.flushMitZeitlimit(20)).resolves.toBe("zeitlimit");

        firestoreMocks.setDoc.mockRejectedValueOnce(new Error("permission-denied"));
        service.publishLeitungPublic({ version: 1, lastUpdated: "c", nachrichten: {} });
        await expect(service.flushMitZeitlimit(1000)).resolves.toBe("fehler");
        service.dispose();
    });

    it("ist ohne Backend sofort bestätigt", async () => {
        installWindow();
        const { LiveStatusService } = await loadService();
        const service = new LiveStatusService({} as never, "");
        await expect(service.flushMitZeitlimit()).resolves.toBe("bestaetigt");
    });
});
