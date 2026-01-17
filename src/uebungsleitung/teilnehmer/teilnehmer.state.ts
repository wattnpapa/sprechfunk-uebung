// src/uebungsleitung/teilnehmer/teilnehmer.state.ts

import { UebungsleitungStorage, TeilnehmerStatus } from "../../types";
import {
    loadUebungsleitungStorage,
    saveUebungsleitungStorage
} from "../../storage";

/**
 * Holt (oder initialisiert) den Status eines Teilnehmers
 */
function getTeilnehmerStatus(
    storage: UebungsleitungStorage,
    teilnehmerName: string
): TeilnehmerStatus {
    if (!storage.teilnehmer[teilnehmerName]) {
        storage.teilnehmer[teilnehmerName] = {};
    }
    return storage.teilnehmer[teilnehmerName];
}

/**
 * Teilnehmer bei der Übungsleitung anmelden (Zeit setzen)
 */
export function markTeilnehmerAngemeldet(
    uebungId: string,
    teilnehmerName: string
): void {
    const storage = loadUebungsleitungStorage(uebungId);
    const status = getTeilnehmerStatus(storage, teilnehmerName);

    status.angemeldetUm = new Date().toISOString();

    saveUebungsleitungStorage(storage);
}

/**
 * Lösungswort als übermittelt markieren
 */
export function setLoesungswortGesendet(
    uebungId: string,
    teilnehmerName: string,
    loesungswort: string
): void {
    const storage = loadUebungsleitungStorage(uebungId);
    const status = getTeilnehmerStatus(storage, teilnehmerName);

    status.loesungswortGesendet = loesungswort;

    saveUebungsleitungStorage(storage);
}

/**
 * Stärkemeldung als übermittelt markieren
 */
export function setStaerkeGesendet(
    uebungId: string,
    teilnehmerName: string,
    staerke: string
): void {
    const storage = loadUebungsleitungStorage(uebungId);
    const status = getTeilnehmerStatus(storage, teilnehmerName);

    status.staerkeGesendet = staerke;

    saveUebungsleitungStorage(storage);
}

/**
 * Notiz zu einem Teilnehmer speichern
 */

export function updateTeilnehmerNotiz(
    uebungId: string,
    teilnehmerName: string,
    notiz: string
): void {
    const storage = loadUebungsleitungStorage(uebungId);
    const status = getTeilnehmerStatus(storage, teilnehmerName);

    status.notizen = notiz;

    saveUebungsleitungStorage(storage);
}

/**
 * Empfangenes Lösungswort speichern (wie Notizen)
 */
export function updateTeilnehmerLoesungswort(
    uebungId: string,
    teilnehmerName: string,
    value: string
): void {
    const storage = loadUebungsleitungStorage(uebungId);
    const status = getTeilnehmerStatus(storage, teilnehmerName);

    status.loesungswortGesendet = value;

    saveUebungsleitungStorage(storage);
}

/**
 * Empfangene Teilstärke (Index 0..3) speichern (wie Notizen)
 */
export function updateTeilnehmerTeilstaerke(
    uebungId: string,
    teilnehmerName: string,
    index: number,
    value: string
): void {
    const storage = loadUebungsleitungStorage(uebungId);
    const status = getTeilnehmerStatus(storage, teilnehmerName);

    status.teilstaerken ??= [];
    status.teilstaerken[index] = value;

    saveUebungsleitungStorage(storage);
}

/**
 * Teilnehmerstatus auslesen (read-only)
 */
export function getTeilnehmerStatusReadonly(
    uebungId: string,
    teilnehmerName: string
): TeilnehmerStatus | undefined {
    const storage = loadUebungsleitungStorage(uebungId);
    return storage.teilnehmer[teilnehmerName];
}