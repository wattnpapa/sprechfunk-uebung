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
        nachrichten[key] = entry;
    });

    return {
        version: LIVE_STATUS_VERSION,
        lastUpdated: storage.lastUpdated,
        nachrichten
    };
}

export function toLeitungLiveDoc(storage: UebungsleitungStorage): LeitungLiveDoc {
    const nachrichtenNotizen: Record<string, LeitungNotiz> = {};
    Object.entries(storage.nachrichten).forEach(([key, status]) => {
        if (status.notiz === undefined && !status.notizGeaendertUm) {
            return;
        }
        const entry: LeitungNotiz = {};
        if (status.notiz !== undefined) {
            entry.notiz = status.notiz;
        }
        if (status.notizGeaendertUm) {
            entry.geaendertUm = status.notizGeaendertUm;
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
        nachrichten[key] = next;
        changed = true;
    });

    return { merged: { ...local, nachrichten }, changed };
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
        const localEntry = nachrichten[key];
        if (localEntry && !isNewer(remoteEntry.geaendertUm, localEntry.notizGeaendertUm)) {
            return;
        }
        const next: NachrichtenStatus = { ...localEntry };
        if (remoteEntry.notiz !== undefined) {
            next.notiz = remoteEntry.notiz;
        } else {
            delete next.notiz;
        }
        setOptional(next, "notizGeaendertUm", remoteEntry.geaendertUm);
        nachrichten[key] = next;
        notizenChanged = true;
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
    gemeldet: number;
    gesamt: number;
    letzteMeldungUm?: string;
    /** `true`, sobald der Teilnehmer überhaupt Daten gesendet hat. */
    online: boolean;
}

/**
 * Fortschritt je Teilnehmer aus den Live-Dokumenten – Basis für die
 * Nachzügler-Erkennung in der Teilnehmer-Tabelle der Übungsleitung.
 */
export function buildTeilnehmerFortschritt(
    teilnehmerListe: string[],
    nachrichtenProTeilnehmer: Record<string, number>,
    teilnehmerDocs: TeilnehmerLiveDoc[]
): Record<string, TeilnehmerFortschritt> {
    const byName = new Map<string, TeilnehmerLiveDoc>();
    teilnehmerDocs.forEach(doc => byName.set(doc.teilnehmer, doc));

    return teilnehmerListe.reduce<Record<string, TeilnehmerFortschritt>>((acc, name) => {
        const doc = byName.get(name);
        const eintraege = Object.values(doc?.nachrichten ?? {}).filter(n => n.uebertragen);
        const letzteMeldungUm = eintraege
            .map(n => n.uebertragenUm)
            .filter((v): v is string => Boolean(v))
            .sort((a, b) => timestamp(b) - timestamp(a))[0];

        const fortschritt: TeilnehmerFortschritt = {
            teilnehmer: name,
            gemeldet: eintraege.length,
            gesamt: nachrichtenProTeilnehmer[name] ?? 0,
            online: Boolean(doc)
        };
        if (letzteMeldungUm) {
            fortschritt.letzteMeldungUm = letzteMeldungUm;
        }
        acc[name] = fortschritt;
        return acc;
    }, {});
}
