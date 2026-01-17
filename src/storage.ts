import { UebungsleitungStorage } from "./types";

const STORAGE_PREFIX = "sprechfunk:uebungsleitung";

/**
 * Erzeugt den Storage-Key für eine Übung
 */
function getStorageKey(uebungId: string): string {
    return `${STORAGE_PREFIX}:${uebungId}`;
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