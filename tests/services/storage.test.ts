import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearTeilnehmerStorage,
    clearUebungsleitungStorage,
    loadTeilnehmerStorage,
    loadUebungsleitungStorage,
    saveTeilnehmerStorage,
    saveUebungsleitungStorage
} from "../../src/services/storage";

const makeLocalStorage = () => {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); },
        _store: store
    };
};

describe("storage service", () => {
    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = makeLocalStorage();
    });

    it("initializes uebungsleitung storage when missing", () => {
        const storage = loadUebungsleitungStorage("u1");
        expect(storage.uebungId).toBe("u1");
        expect(storage.version).toBe(1);

        const storage2 = loadUebungsleitungStorage("u1");
        expect(storage2.uebungId).toBe("u1");
    });

    it("recovers from invalid uebungsleitung JSON", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ls = (globalThis as any).localStorage;
        ls.setItem("sprechfunk:uebungsleitung:u2", "{bad json");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const storage = loadUebungsleitungStorage("u2");

        expect(storage.uebungId).toBe("u2");
        expect(warn).toHaveBeenCalled();
    });

    it("saves and clears uebungsleitung storage", () => {
        const storage = loadUebungsleitungStorage("u3");
        storage.teilnehmer = { A: "Alpha" };
        saveUebungsleitungStorage(storage);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ls = (globalThis as any).localStorage;
        expect(ls.getItem("sprechfunk:uebungsleitung:u3")).toContain("Alpha");

        clearUebungsleitungStorage("u3");
        expect(ls.getItem("sprechfunk:uebungsleitung:u3")).toBeNull();
    });

    it("initializes teilnehmer storage when missing", () => {
        const storage = loadTeilnehmerStorage("u4", "t1");
        expect(storage.teilnehmer).toBe("t1");
        expect(storage.hideTransmitted).toBe(false);
    });

    it("recovers from invalid teilnehmer JSON", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ls = (globalThis as any).localStorage;
        ls.setItem("sprechfunk:teilnehmer:u5:t2", "{bad json");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const storage = loadTeilnehmerStorage("u5", "t2");

        expect(storage.teilnehmer).toBe("t2");
        expect(warn).toHaveBeenCalled();
    });

    it("saves and clears teilnehmer storage", () => {
        const storage = loadTeilnehmerStorage("u6", "t3");
        storage.hideTransmitted = true;
        saveTeilnehmerStorage(storage);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ls = (globalThis as any).localStorage;
        expect(ls.getItem("sprechfunk:teilnehmer:u6:t3")).toContain("true");

        clearTeilnehmerStorage("u6", "t3");
        expect(ls.getItem("sprechfunk:teilnehmer:u6:t3")).toBeNull();
    });
});
