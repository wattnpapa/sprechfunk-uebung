import type { FunkUebung } from "../models/FunkUebung";
import { extractDatum, hasNonEmptyRecord, zaehleNachrichten } from "./firestoreSanitize";

/**
 * Lokaler Mock-Modus für E2E-Tests und Offline-Entwicklung: Die Übungen
 * liegen als JSON unter `e2eFirestoreSeed` im localStorage, aktiviert über
 * `useFirestoreEmulator = "1"`.
 */

/** Dokumente im Mock-Store haben kein festes Schema. */
export type MockStore = Record<string, unknown>;

/** Ein Eintrag des Mock-Stores, sofern er ein Objekt ist. */
export type MockDokument = Record<string, unknown> | null | undefined;

export function isLocalMockMode(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return window.localStorage.getItem("useFirestoreEmulator") === "1";
    } catch {
        return false;
    }
}

export function readMockStore(): MockStore {
    if (!isLocalMockMode() || typeof window === "undefined") {
        return {};
    }
    try {
        const raw = window.localStorage.getItem("e2eFirestoreSeed");
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") {
            return {};
        }
        return parsed as Record<string, unknown>;
    } catch {
        return {};
    }
}

export function writeMockStore(store: MockStore): void {
    if (!isLocalMockMode() || typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem("e2eFirestoreSeed", JSON.stringify(store));
}

/** Übungscode eines Mock-Dokuments in Großbuchstaben, sofern vorhanden. */
export function mockUebungCode(value: unknown): string | undefined {
    const code = (value as MockDokument)?.["uebungCode"];
    return typeof code === "string" ? code.toUpperCase() : undefined;
}

export function readMockEntries(onlyTestExercises: boolean): Record<string, unknown>[] {
    const store = readMockStore();
    return (Object.values(store) as Record<string, unknown>[]).filter(data =>
        !onlyTestExercises || Boolean(data["istStandardKonfiguration"])
    );
}

export function sortByCreateDateDesc(entries: FunkUebung[]): FunkUebung[] {
    return entries.sort((a, b) => {
        const da = new Date(a.createDate).getTime();
        const db = new Date(b.createDate).getTime();
        return db - da;
    });
}

export function paginateEntries(
    entries: FunkUebung[],
    pageSize: number,
    startAfterCursor: unknown,
    cursorKey: "__mockIndex" | "__fallbackIndex"
) {
    let start = 0;
    const index = startAfterCursor ? (startAfterCursor as Record<string, unknown>)[cursorKey] : undefined;
    if (typeof index === "number") {
        start = index + 1;
    }
    const page = entries.slice(start, start + pageSize);
    const lastIndex = start + page.length - 1;
    const visibleCursor = (() => {
        if (page.length === 0) {
            return null;
        }
        if (cursorKey === "__mockIndex") {
            return { __mockIndex: lastIndex };
        }
        return { __fallbackIndex: lastIndex };
    })();
    return {
        uebungen: page,
        lastVisible: visibleCursor,
        size: page.length
    };
}

export function mockMonatsCounts(onlyTestExercises: boolean, jahr?: number): number[] {
    const counts = Array.from({ length: 12 }, () => 0);
    readMockEntries(onlyTestExercises).forEach(data => {
        const datum = extractDatum(data["datum"]);
        if (datum && (jahr === undefined || datum.getFullYear() === jahr)) {
            const monat = datum.getMonth();
            counts[monat] = (counts[monat] ?? 0) + 1;
        }
    });
    return counts;
}

export function mockJahresCounts(onlyTestExercises: boolean): { jahr: number; anzahl: number }[] {
    const counts = new Map<number, number>();
    readMockEntries(onlyTestExercises).forEach(data => {
        const jahr = extractDatum(data["datum"])?.getFullYear();
        if (jahr !== undefined) {
            counts.set(jahr, (counts.get(jahr) ?? 0) + 1);
        }
    });
    return [...counts.entries()]
        .map(([jahr, anzahl]) => ({ jahr, anzahl }))
        .sort((a, b) => a.jahr - b.jahr);
}

export function mockAdminStats() {
    const store = readMockStore();
    const docs = Object.values(store) as Record<string, unknown>[];

    let totalTeilnehmer = 0;
    let totalBytes = 0;
    let totalSprueche = 0;
    let loesungsCount = 0;
    let staerkeCount = 0;
    let buchstabierCount = 0;

    docs.forEach(data => {
        totalTeilnehmer += ((data["teilnehmerListe"] as unknown[])?.length || 0);
        loesungsCount += hasNonEmptyRecord(data["loesungswoerter"]) ? 1 : 0;
        staerkeCount += hasNonEmptyRecord(data["loesungsStaerken"]) ? 1 : 0;
        buchstabierCount += (data["buchstabierenAn"] as number || 0) > 0 ? 1 : 0;
        totalBytes += JSON.stringify(data).length;
        totalSprueche += zaehleNachrichten(data["nachrichten"] as Record<string, unknown[]> || {});
    });

    return {
        total: docs.length,
        totalTeilnehmer,
        totalBytes,
        totalSprueche,
        loesungsCount,
        staerkeCount,
        buchstabierCount
    };
}
