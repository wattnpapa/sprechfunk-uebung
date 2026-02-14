import { UebungsleitungStorage, TeilnehmerStorage } from "../types/Storage";

const STORAGE_PREFIX = "sprechfunk:uebungsleitung";
const TEILNEHMER_STORAGE_PREFIX = "sprechfunk:teilnehmer";

/**
 * Erzeugt den Storage-Key für eine Übung
 */
function getStorageKey(uebungId: string): string {
    return `${STORAGE_PREFIX}:${uebungId}`;
}

function getTeilnehmerStorageKey(uebungId: string, teilnehmer: string): string {
    return `${TEILNEHMER_STORAGE_PREFIX}:${uebungId}:${teilnehmer}`;
}

/**
 * Lädt den Storage für eine Übung oder initialisiert ihn
 */
export function loadUebungsleitungStorage(
    uebungId: string
): UebungsleitungStorage {
    const key = getStorageKey(uebungId);
    const raw = localStorage.getItem(key);

    if (raw) {
        try {
            return JSON.parse(raw) as UebungsleitungStorage;
        } catch (e) {
            console.warn("⚠️ Storage beschädigt, neu initialisiert", e);
        }
    }

    const initial: UebungsleitungStorage = {
        version: 1,
        uebungId,
        lastUpdated: new Date().toISOString(),
        teilnehmer: {},
        nachrichten: {}
    };

    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
}

/**
 * Speichert den aktuellen Storage-Zustand
 */
export function saveUebungsleitungStorage(
    storage: UebungsleitungStorage
): void {
    storage.lastUpdated = new Date().toISOString();
    const key = getStorageKey(storage.uebungId);
    localStorage.setItem(key, JSON.stringify(storage));
}

/**
 * Löscht den Storage einer Übung (optional, z. B. Reset)
 */
export function clearUebungsleitungStorage(uebungId: string): void {
    const key = getStorageKey(uebungId);
    localStorage.removeItem(key);
}

/**
 * Teilnehmer Storage
 */
export function loadTeilnehmerStorage(
    uebungId: string,
    teilnehmer: string
): TeilnehmerStorage {
    const key = getTeilnehmerStorageKey(uebungId, teilnehmer);
    const raw = localStorage.getItem(key);

    if (raw) {
        try {
            return JSON.parse(raw) as TeilnehmerStorage;
        } catch (e) {
            console.warn("⚠️ Teilnehmer Storage beschädigt, neu initialisiert", e);
        }
    }

    const initial: TeilnehmerStorage = {
        version: 1,
        uebungId,
        teilnehmer,
        lastUpdated: new Date().toISOString(),
        nachrichten: {},
        hideTransmitted: false
    };

    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
}

export function saveTeilnehmerStorage(
    storage: TeilnehmerStorage
): void {
    storage.lastUpdated = new Date().toISOString();
    const key = getTeilnehmerStorageKey(storage.uebungId, storage.teilnehmer);
    localStorage.setItem(key, JSON.stringify(storage));
}

export function clearTeilnehmerStorage(uebungId: string, teilnehmer: string): void {
    const key = getTeilnehmerStorageKey(uebungId, teilnehmer);
    localStorage.removeItem(key);
}