import {
    collection,
    doc,
    onSnapshot,
    setDoc,
    type DocumentData,
    type Firestore
} from "firebase/firestore";
import { STATUS_COLLECTION } from "../types/LiveStatus";

export type PlainDoc = Record<string, unknown>;
export type Unsubscribe = () => void;

/**
 * Wird zu jedem Snapshot gemeldet, auch wenn sich nur die Metadaten ändern.
 * `ausCache` heißt: Firestore hat den Server nicht erreicht und liefert den
 * lokal bekannten Stand.
 */
export type MetaCallback = (ausCache: boolean) => void;

export interface LiveStatusBackend {
    write(docId: string, data: PlainDoc): Promise<void>;
    subscribeDoc(
        docId: string,
        onData: (data: PlainDoc | null) => void,
        onError: (e: unknown) => void,
        onMeta: MetaCallback
    ): Unsubscribe;
    subscribeCollection(
        onData: (docs: { id: string; data: PlainDoc }[]) => void,
        onError: (e: unknown) => void,
        onMeta: MetaCallback
    ): Unsubscribe;
}

/** Entfernt `undefined`-Werte und leere Keys rekursiv – Firestore lehnt beides ab. */
export function sanitizeForFirestore(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.filter(v => v !== undefined).map(sanitizeForFirestore);
    }
    if (value && typeof value === "object") {
        return Object.entries(value as PlainDoc).reduce<PlainDoc>((acc, [key, val]) => {
            if (val === undefined || String(key).trim() === "") {
                return acc;
            }
            acc[key] = sanitizeForFirestore(val);
            return acc;
        }, {});
    }
    return value;
}

export class FirestoreBackend implements LiveStatusBackend {
    constructor(private db: Firestore, private uebungId: string) {}

    private docRef(docId: string) {
        return doc(this.db, "uebungen", this.uebungId, STATUS_COLLECTION, docId);
    }

    async write(docId: string, data: PlainDoc): Promise<void> {
        await setDoc(this.docRef(docId), sanitizeForFirestore(data) as DocumentData);
    }

    /**
     * Mit `includeMetadataChanges`, damit ein Wechsel auf den lokalen Cache
     * (Funkloch) sichtbar wird. Reine Metadaten-Snapshots lösen kein neues
     * Rendern aus – die Daten werden nur weitergereicht, wenn sie sich ändern.
     */
    subscribeDoc(
        docId: string,
        onData: (data: PlainDoc | null) => void,
        onError: (e: unknown) => void,
        onMeta: MetaCallback
    ): Unsubscribe {
        let letzterStand: string | undefined;
        return onSnapshot(
            this.docRef(docId),
            { includeMetadataChanges: true },
            snapshot => {
                onMeta(Boolean(snapshot.metadata?.fromCache));
                const data = snapshot.exists() ? (snapshot.data() as PlainDoc) : null;
                const stand = JSON.stringify(data);
                if (stand === letzterStand) {
                    return;
                }
                letzterStand = stand;
                onData(data);
            },
            onError
        );
    }

    subscribeCollection(
        onData: (docs: { id: string; data: PlainDoc }[]) => void,
        onError: (e: unknown) => void,
        onMeta: MetaCallback
    ): Unsubscribe {
        let erster = true;
        return onSnapshot(
            collection(this.db, "uebungen", this.uebungId, STATUS_COLLECTION),
            { includeMetadataChanges: true },
            snapshot => {
                onMeta(Boolean(snapshot.metadata?.fromCache));
                const aenderungen = typeof snapshot.docChanges === "function" ? snapshot.docChanges().length : 1;
                if (!erster && aenderungen === 0) {
                    return;
                }
                erster = false;
                onData(snapshot.docs.map(d => ({ id: d.id, data: d.data() as PlainDoc })));
            },
            onError
        );
    }
}

const LOCAL_EVENT = "sprechfunk:live-status";

/**
 * Backend für den Mock-/E2E-Modus: spiegelt dieselbe Dokumentstruktur in den
 * `localStorage`. Änderungen werden über das `storage`-Event an andere Tabs und
 * über ein CustomEvent innerhalb desselben Tabs verteilt.
 */
export class LocalBackend implements LiveStatusBackend {
    private storageKey: string;

    constructor(uebungId: string) {
        this.storageKey = `sprechfunkLiveStatus:${uebungId}`;
    }

    private readAll(): Record<string, PlainDoc> {
        try {
            const raw = window.localStorage.getItem(this.storageKey);
            if (!raw) {
                return {};
            }
            const parsed = JSON.parse(raw) as unknown;
            return parsed && typeof parsed === "object" ? (parsed as Record<string, PlainDoc>) : {};
        } catch {
            return {};
        }
    }

    async write(docId: string, data: PlainDoc): Promise<void> {
        const all = this.readAll();
        all[docId] = sanitizeForFirestore(data) as PlainDoc;
        window.localStorage.setItem(this.storageKey, JSON.stringify(all));
        window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: this.storageKey }));
    }

    private listen(notify: () => void): Unsubscribe {
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === this.storageKey) {
                notify();
            }
        };
        const onLocal = (event: Event) => {
            if ((event as CustomEvent<string>).detail === this.storageKey) {
                notify();
            }
        };
        window.addEventListener("storage", onStorage);
        window.addEventListener(LOCAL_EVENT, onLocal);
        notify();
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener(LOCAL_EVENT, onLocal);
        };
    }

    /** Der localStorage ist nie „aus dem Cache“ – den Netzzustand liefert der Browser. */
    subscribeDoc(
        docId: string,
        onData: (data: PlainDoc | null) => void,
        _onError: (e: unknown) => void,
        onMeta: MetaCallback
    ): Unsubscribe {
        return this.listen(() => {
            onMeta(false);
            onData(this.readAll()[docId] ?? null);
        });
    }

    subscribeCollection(
        onData: (docs: { id: string; data: PlainDoc }[]) => void,
        _onError: (e: unknown) => void,
        onMeta: MetaCallback
    ): Unsubscribe {
        return this.listen(() => {
            onMeta(false);
            onData(Object.entries(this.readAll()).map(([id, data]) => ({ id, data })));
        });
    }
}

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
