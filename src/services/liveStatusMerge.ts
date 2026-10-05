import type {
    NachrichtenStatus,
    NachrichtenStatusTeilnehmer,
    TeilnehmerStatus,
    TeilnehmerStorage,
    UebungsleitungStorage
} from "../types/Storage";
import type {
    LeitungBestaetigung,
    LeitungLiveDoc,
    LeitungNotiz,
    LeitungPublicLiveDoc,
    TeilnehmerLiveDoc
} from "../types/LiveStatus";
import { LIVE_STATUS_VERSION } from "../types/LiveStatus";

/**
 * Merge-Regeln für den Live-Sync.
 *
 * Jeder Eintrag trägt einen eigenen `geaendertUm`-Zeitstempel. Beim Zusammenführen
 * von lokalem Cache und Remote-Dokument gewinnt pro Eintrag der jüngere Zeitstempel
 * (Last-Write-Wins). Dadurch überleben Offline-Änderungen, und ein Zurücksetzen wird
 * nicht durch ein veraltetes Remote-Dokument wiederbelebt – ein zurückgesetzter
 * Eintrag bleibt als `{ uebertragen: false }` erhalten statt gelöscht zu werden.
 */

function timestamp(value?: string): number {
    if (!value) {
        return 0;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/** `true`, wenn `candidate` echt jünger ist als `current`. */
function isNewer(candidate?: string, current?: string): boolean {
    return timestamp(candidate) > timestamp(current);
}

/**
 * Setzt ein optionales Feld – oder entfernt es, wenn der Wert fehlt.
 * Nötig wegen `exactOptionalPropertyTypes`.
 */
function setOptional<T, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
    if (value === undefined) {
        delete target[key];
        return;
    }
    target[key] = value;
}

/** Frühester definierter Zeitstempel – `undefined`, wenn keiner gültig ist. */
export function earliestTimestamp(...values: (string | undefined)[]): string | undefined {
    let best: string | undefined;
    values.forEach(value => {
        const ts = timestamp(value);
        if (ts === 0) {
            return;
        }
        if (best === undefined || ts < timestamp(best)) {
            best = value;
        }
    });
    return best;
}

function mergeRecords<T extends { geaendertUm?: string }>(
    local: Record<string, T>,
    remote: Record<string, T>
): { merged: Record<string, T>; changed: boolean } {
    const merged: Record<string, T> = { ...local };
    let changed = false;

    Object.entries(remote).forEach(([key, remoteEntry]) => {
        const localEntry = merged[key];
        if (!localEntry) {
            merged[key] = remoteEntry;
            changed = true;
            return;
        }
        if (isNewer(remoteEntry.geaendertUm, localEntry.geaendertUm)) {
            merged[key] = remoteEntry;
            changed = true;
        }
    });

    return { merged, changed };
}

// --- Teilnehmer ---------------------------------------------------------

export function toTeilnehmerLiveDoc(
    storage: TeilnehmerStorage,
    teilnehmerId: string
): TeilnehmerLiveDoc {
    const doc: TeilnehmerLiveDoc = {
        version: LIVE_STATUS_VERSION,
        teilnehmerId,
        teilnehmer: storage.teilnehmer,
        lastUpdated: storage.lastUpdated,
        nachrichten: storage.nachrichten
    };
    if (storage.xZeitBasis) {
        doc.xZeitBasis = storage.xZeitBasis;
    }
    if (storage.xZeitBasisGeaendertUm) {
        doc.xZeitBasisGeaendertUm = storage.xZeitBasisGeaendertUm;
    }
    return doc;
}

/**
 * Führt ein Remote-Dokument in den lokalen Teilnehmer-Cache zusammen.
 * `hideTransmitted` bleibt bewusst gerätelokal – es ist eine reine Ansichtseinstellung.
 */
export function mergeTeilnehmerLiveDoc(
    local: TeilnehmerStorage,
    remote: TeilnehmerLiveDoc
): { merged: TeilnehmerStorage; changed: boolean } {
    const { merged: nachrichten, changed } = mergeRecords<NachrichtenStatusTeilnehmer>(
        local.nachrichten,
        remote.nachrichten ?? {}
    );

    const merged: TeilnehmerStorage = { ...local, nachrichten };
    let didChange = changed;

    if (isNewer(remote.xZeitBasisGeaendertUm, local.xZeitBasisGeaendertUm)) {
        if (remote.xZeitBasis) {
            merged.xZeitBasis = remote.xZeitBasis;
        } else {
            delete merged.xZeitBasis;
        }
        setOptional(merged, "xZeitBasisGeaendertUm", remote.xZeitBasisGeaendertUm);
        didChange = true;
    }

    return { merged, changed: didChange };
}

// --- Übungsleitung ------------------------------------------------------

/**
 * Kennzeichen einer Bestätigung: „nachgetragen“ und „Zeit vom Teilnehmer“
 * gehören zu einer abgesetzten Zeile, „ausgelassen“ zu einer nicht abgesetzten.
 */
function bestaetigungsKennzeichen(status: NachrichtenStatus): Pick<LeitungBestaetigung, "nachgetragen" | "zeitVomTeilnehmer" | "ausgelassen"> {
    if (status.abgesetztUm) {
        return {
            ...(status.nachgetragen ? { nachgetragen: true } : {}),
            ...(status.zeitVomTeilnehmer ? { zeitVomTeilnehmer: true } : {})
        };
    }
    return status.ausgelassen ? { ausgelassen: true } : {};
}

export function toLeitungPublicLiveDoc(storage: UebungsleitungStorage): LeitungPublicLiveDoc {
    const nachrichten: Record<string, LeitungBestaetigung> = {};
    Object.entries(storage.nachrichten).forEach(([key, status]) => {
        if (!status.abgesetztUm && !status.statusGeaendertUm) {
            return;
        }
        const entry: LeitungBestaetigung = {};
        if (status.abgesetztUm) {
            entry.abgesetztUm = status.abgesetztUm;
        }
        if (status.statusGeaendertUm) {
            entry.geaendertUm = status.statusGeaendertUm;
        }
        nachrichten[key] = { ...entry, ...bestaetigungsKennzeichen(status) };
    });

    const doc: LeitungPublicLiveDoc = {
        version: LIVE_STATUS_VERSION,
        lastUpdated: storage.lastUpdated,
        nachrichten
    };
    if (storage.xZeitBasis) {
        doc.xZeitBasis = storage.xZeitBasis;
    }
    if (storage.xZeitBasisGeaendertUm) {
        doc.xZeitBasisGeaendertUm = storage.xZeitBasisGeaendertUm;
    }
    return doc;
}

export function toLeitungLiveDoc(storage: UebungsleitungStorage): LeitungLiveDoc {
    const nachrichtenNotizen: Record<string, LeitungNotiz> = {};
    Object.entries(storage.nachrichten).forEach(([key, status]) => {
        if (status.notiz === undefined && !status.notizGeaendertUm && !status.reaktionGeaendertUm) {
            return;
        }
        const entry: LeitungNotiz = {};
        if (status.notiz !== undefined) {
            entry.notiz = status.notiz;
        }
        if (status.notizGeaendertUm) {
            entry.geaendertUm = status.notizGeaendertUm;
        }
        if (status.reaktion) {
            entry.reaktion = status.reaktion;
        }
        if (status.reaktionGeaendertUm) {
            entry.reaktionGeaendertUm = status.reaktionGeaendertUm;
        }
        nachrichtenNotizen[key] = entry;
    });

    return {
        version: LIVE_STATUS_VERSION,
        lastUpdated: storage.lastUpdated,
        teilnehmer: storage.teilnehmer,
        nachrichtenNotizen
    };
}

export function mergeLeitungPublicLiveDoc(
    local: UebungsleitungStorage,
    remote: LeitungPublicLiveDoc
): { merged: UebungsleitungStorage; changed: boolean } {
    const nachrichten: Record<string, NachrichtenStatus> = { ...local.nachrichten };
    let changed = false;

    Object.entries(remote.nachrichten ?? {}).forEach(([key, remoteEntry]) => {
        const localEntry = nachrichten[key];
        if (localEntry && !isNewer(remoteEntry.geaendertUm, localEntry.statusGeaendertUm)) {
            return;
        }
        const next: NachrichtenStatus = { ...localEntry };
        if (remoteEntry.abgesetztUm) {
            next.abgesetztUm = remoteEntry.abgesetztUm;
        } else {
            delete next.abgesetztUm;
        }
        setOptional(next, "statusGeaendertUm", remoteEntry.geaendertUm);
        setOptional(next, "nachgetragen", remoteEntry.nachgetragen && remoteEntry.abgesetztUm ? true : undefined);
        setOptional(next, "zeitVomTeilnehmer", remoteEntry.zeitVomTeilnehmer && remoteEntry.abgesetztUm ? true : undefined);
        setOptional(next, "ausgelassen", remoteEntry.ausgelassen && !remoteEntry.abgesetztUm ? true : undefined);
        nachrichten[key] = next;
        changed = true;
    });

    const merged: UebungsleitungStorage = { ...local, nachrichten };
    // Die X-Zeit-Basis setzt ein beliebiger Leitungs-Arbeitsplatz; die jüngste gilt.
    if (isNewer(remote.xZeitBasisGeaendertUm, local.xZeitBasisGeaendertUm)) {
        setOptional(merged, "xZeitBasis", remote.xZeitBasis || undefined);
        setOptional(merged, "xZeitBasisGeaendertUm", remote.xZeitBasisGeaendertUm);
        changed = true;
    }

    return { merged, changed };
}

/**
 * Übernimmt die verbindliche X-Zeit-Basis der Übungsleitung in den
 * Teilnehmer-Cache. Eine eigene Basis des Teilnehmers bleibt nur stehen, wenn
 * er sie **nach** der letzten Vorgabe der Leitung bewusst gesetzt hat
 * (Last-Write-Wins über `xZeitBasisGeaendertUm`). Löscht die Leitung ihre
 * Vorgabe, verschwindet nur eine von ihr übernommene Basis.
 */
export function uebernehmeLeitungsBasis(
    local: TeilnehmerStorage,
    remote: Pick<LeitungPublicLiveDoc, "xZeitBasis" | "xZeitBasisGeaendertUm">
): { merged: TeilnehmerStorage; changed: boolean } {
    if (!isNewer(remote.xZeitBasisGeaendertUm, local.xZeitBasisGeaendertUm)) {
        return { merged: local, changed: false };
    }
    const merged: TeilnehmerStorage = { ...local };
    if (remote.xZeitBasis) {
        if (local.xZeitBasis === remote.xZeitBasis && local.xZeitBasisQuelle === "leitung") {
            return { merged: local, changed: false };
        }
        merged.xZeitBasis = remote.xZeitBasis;
        merged.xZeitBasisQuelle = "leitung";
        setOptional(merged, "xZeitBasisGeaendertUm", remote.xZeitBasisGeaendertUm);
        return { merged, changed: true };
    }
    if (local.xZeitBasisQuelle !== "leitung") {
        return { merged: local, changed: false };
    }
    delete merged.xZeitBasis;
    delete merged.xZeitBasisQuelle;
    setOptional(merged, "xZeitBasisGeaendertUm", remote.xZeitBasisGeaendertUm);
    return { merged, changed: true };
}

/**
 * Notiz und Reaktionsbewertung einer Zeile haben je einen eigenen
 * Zeitstempel und werden getrennt zusammengeführt (Last-Write-Wins).
 * @returns den neuen Eintrag oder `null`, wenn sich nichts ändert.
 */
function mergeNotizEintrag(localEntry: NachrichtenStatus | undefined, remoteEntry: LeitungNotiz): NachrichtenStatus | null {
    const notizNeuer = !localEntry || isNewer(remoteEntry.geaendertUm, localEntry.notizGeaendertUm);
    const reaktionNeuer = isNewer(remoteEntry.reaktionGeaendertUm, localEntry?.reaktionGeaendertUm);
    if (!notizNeuer && !reaktionNeuer) {
        return null;
    }
    const next: NachrichtenStatus = { ...localEntry };
    if (notizNeuer) {
        setOptional(next, "notiz", remoteEntry.notiz);
        setOptional(next, "notizGeaendertUm", remoteEntry.geaendertUm);
    }
    if (reaktionNeuer) {
        setOptional(next, "reaktion", remoteEntry.reaktion);
        setOptional(next, "reaktionGeaendertUm", remoteEntry.reaktionGeaendertUm);
    }
    return next;
}

export function mergeLeitungLiveDoc(
    local: UebungsleitungStorage,
    remote: LeitungLiveDoc
): { merged: UebungsleitungStorage; changed: boolean } {
    const { merged: teilnehmer, changed: teilnehmerChanged } = mergeRecords<TeilnehmerStatus>(
        local.teilnehmer,
        remote.teilnehmer ?? {}
    );

    const nachrichten: Record<string, NachrichtenStatus> = { ...local.nachrichten };
    let notizenChanged = false;

    Object.entries(remote.nachrichtenNotizen ?? {}).forEach(([key, remoteEntry]) => {
        const next = mergeNotizEintrag(nachrichten[key], remoteEntry);
        if (next) {
            nachrichten[key] = next;
            notizenChanged = true;
        }
    });

    return {
        merged: { ...local, teilnehmer, nachrichten },
        changed: teilnehmerChanged || notizenChanged
    };
}

// --- Auswertung ---------------------------------------------------------

export interface EffektiverNachrichtenStatus extends NachrichtenStatus {
    /** Zeitpunkt, zu dem der Teilnehmer die Nachricht als übertragen gemeldet hat. */
    gemeldetUm?: string;
    /** Frühester Zeitpunkt aus Teilnehmer-Meldung und Bestätigung der Leitung. */
    erledigtUm?: string;
}

/**
 * Verschmilzt die Bestätigungen der Leitung mit den Meldungen der Teilnehmer.
 *
 * Eine Nachricht gilt als erledigt, sobald eine der beiden Seiten sie markiert hat;
 * für ETA und Tempo zählt der frühere der beiden Zeitstempel.
 */
export function buildEffektiveNachrichtenStatus(
    leitungStatus: Record<string, NachrichtenStatus>,
    teilnehmerDocs: TeilnehmerLiveDoc[]
): Record<string, EffektiverNachrichtenStatus> {
    const result: Record<string, EffektiverNachrichtenStatus> = {};

    Object.entries(leitungStatus).forEach(([key, status]) => {
        result[key] = { ...status };
    });

    teilnehmerDocs.forEach(doc => {
        Object.entries(doc.nachrichten ?? {}).forEach(([nr, status]) => {
            if (!status.uebertragen || !status.uebertragenUm) {
                return;
            }
            const key = `${doc.teilnehmer}__${nr}`;
            const entry = result[key] ?? {};
            entry.gemeldetUm = status.uebertragenUm;
            result[key] = entry;
        });
    });

    Object.values(result).forEach(entry => {
        const erledigtUm = earliestTimestamp(entry.abgesetztUm, entry.gemeldetUm);
        if (erledigtUm) {
            entry.erledigtUm = erledigtUm;
        } else {
            delete entry.erledigtUm;
        }
    });

    return result;
}

export interface TeilnehmerFortschritt {
    teilnehmer: string;
    /** Vom Teilnehmer selbst als übertragen gemeldet. */
    gemeldet: number;
    /** Von der Übungsleitung als abgesetzt bestätigt. */
    bestaetigt: number;
    /** Erledigt aus einer der beiden Quellen – das ist der Fortschritt. */
    erledigt: number;
    gesamt: number;
    /** Letzte Markierung, egal ob vom Teilnehmer oder von der Leitung. */
    letzteMeldungUm?: string;
    /** Letzte Änderung am Live-Dokument des Teilnehmers – „zuletzt gesehen“. */
    zuletztGesehenUm?: string;
    /** `true`, sobald der Teilnehmer überhaupt Daten gesendet hat. */
    online: boolean;
}

/**
 * Fortschritt je Teilnehmer aus Teilnehmer-Meldungen und Bestätigungen der
 * Leitung – Basis für Fortschrittsspalte und Nachzügler-Erkennung. Beide
 * Quellen zählen, getrennt ausgewiesen (THW-Review workflow F3).
 */
export function buildTeilnehmerFortschritt(
    teilnehmerListe: string[],
    nachrichtenProTeilnehmer: Record<string, number>,
    teilnehmerDocs: TeilnehmerLiveDoc[],
    leitungStatus: Record<string, NachrichtenStatus> = {}
): Record<string, TeilnehmerFortschritt> {
    const byName = new Map<string, TeilnehmerLiveDoc>();
    teilnehmerDocs.forEach(doc => byName.set(doc.teilnehmer, doc));

    return teilnehmerListe.reduce<Record<string, TeilnehmerFortschritt>>((acc, name) => {
        const doc = byName.get(name);
        const gemeldeteNr = new Set<string>();
        const zeiten: string[] = [];
        Object.entries(doc?.nachrichten ?? {}).forEach(([nr, n]) => {
            if (!n.uebertragen) {
                return;
            }
            gemeldeteNr.add(nr);
            if (n.uebertragenUm) {
                zeiten.push(n.uebertragenUm);
            }
        });
        const prefix = `${name}__`;
        const bestaetigteNr = new Set<string>();
        Object.entries(leitungStatus).forEach(([key, status]) => {
            if (key.startsWith(prefix) && status.abgesetztUm) {
                bestaetigteNr.add(key.slice(prefix.length));
                zeiten.push(status.abgesetztUm);
            }
        });
        const erledigt = new Set([...gemeldeteNr, ...bestaetigteNr]).size;
        const letzteMeldungUm = zeiten.sort((a, b) => timestamp(b) - timestamp(a))[0];

        const fortschritt: TeilnehmerFortschritt = {
            teilnehmer: name,
            gemeldet: gemeldeteNr.size,
            bestaetigt: bestaetigteNr.size,
            erledigt,
            gesamt: nachrichtenProTeilnehmer[name] ?? 0,
            online: Boolean(doc)
        };
        if (letzteMeldungUm) {
            fortschritt.letzteMeldungUm = letzteMeldungUm;
        }
        if (doc?.lastUpdated && timestamp(doc.lastUpdated) > 0) {
            fortschritt.zuletztGesehenUm = doc.lastUpdated;
        }
        acc[name] = fortschritt;
        return acc;
    }, {});
}
