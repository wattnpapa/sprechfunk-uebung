import { loadUebungsleitungStorage, saveUebungsleitungStorage } from "../storage";
import { NachrichtenStatus } from "../types";

function buildNachrichtenKey(sender: string, nr: number): string {
    return `${sender}__${nr}`;
}

/**
 * Intern: Status einer Nachricht holen oder initialisieren
 */
function getStatus(
    storage: ReturnType<typeof loadUebungsleitungStorage>,
    sender: string,
    nr: number
): NachrichtenStatus {
    const key = buildNachrichtenKey(sender, nr);

    if (!storage.nachrichten[key]) {
        storage.nachrichten[key] = {};
    }

    return storage.nachrichten[key];
}

/**
 * Nachricht als „abgesetzt“ markieren
 */
export function markNachrichtAbgesetzt(
    uebungId: string,
    sender: string,
    nr: number
): void {
    const storage = loadUebungsleitungStorage(uebungId);
    const status = getStatus(storage, sender, nr);

    status.abgesetztUm = new Date().toISOString();
    status.bestaetigt = true;

    saveUebungsleitungStorage(storage);

    console.log("[STORAGE] gespeichert", storage.nachrichten[buildNachrichtenKey(sender, nr)]);
}

/**
 * Status read-only abrufen
 */
export function getNachrichtenStatusReadonly(
    uebungId: string,
    sender: string,
    nr: number
): NachrichtenStatus | undefined {
    const storage = loadUebungsleitungStorage(uebungId);
    const key = `${sender}__${nr}`;
    return storage.nachrichten[key];
}