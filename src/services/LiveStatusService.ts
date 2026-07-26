import {
    collection,
    doc,
    onSnapshot,
    setDoc,
    type DocumentData,
    type Firestore
} from "firebase/firestore";
import {
    LEITUNG_DOC_ID,
    LEITUNG_PUBLIC_DOC_ID,
    STATUS_COLLECTION,
    TEILNEHMER_DOC_PREFIX,
    teilnehmerDocId,
    type LeitungLiveDoc,
    type LeitungPublicLiveDoc,
    type LiveSyncState,
    type TeilnehmerLiveDoc
} from "../types/LiveStatus";
import { featureFlags } from "./featureFlags";

type PlainDoc = Record<string, unknown>;
type Unsubscribe = () => void;

interface LiveStatusBackend {
    write(docId: string, data: PlainDoc): Promise<void>;
    subscribeDoc(docId: string, onData: (data: PlainDoc | null) => void, onError: (e: unknown) => void): Unsubscribe;
    subscribeCollection(onData: (docs: { id: string; data: PlainDoc }[]) => void, onError: (e: unknown) => void): Unsubscribe;
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

class FirestoreBackend implements LiveStatusBackend {
    constructor(private db: Firestore, private uebungId: string) {}

    private docRef(docId: string) {
        return doc(this.db, "uebungen", this.uebungId, STATUS_COLLECTION, docId);
    }

    async write(docId: string, data: PlainDoc): Promise<void> {
        await setDoc(this.docRef(docId), sanitizeForFirestore(data) as DocumentData);
    }

    subscribeDoc(docId: string, onData: (data: PlainDoc | null) => void, onError: (e: unknown) => void): Unsubscribe {
        return onSnapshot(
            this.docRef(docId),
            snapshot => onData(snapshot.exists() ? (snapshot.data() as PlainDoc) : null),
            onError
        );
    }

    subscribeCollection(
        onData: (docs: { id: string; data: PlainDoc }[]) => void,
        onError: (e: unknown) => void
    ): Unsubscribe {
        return onSnapshot(
            collection(this.db, "uebungen", this.uebungId, STATUS_COLLECTION),
            snapshot => onData(snapshot.docs.map(d => ({ id: d.id, data: d.data() as PlainDoc }))),
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
class LocalBackend implements LiveStatusBackend {
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

    subscribeDoc(docId: string, onData: (data: PlainDoc | null) => void): Unsubscribe {
        return this.listen(() => onData(this.readAll()[docId] ?? null));
    }

    subscribeCollection(onData: (docs: { id: string; data: PlainDoc }[]) => void): Unsubscribe {
        return this.listen(() =>
            onData(Object.entries(this.readAll()).map(([id, data]) => ({ id, data })))
        );
    }
}

function isLocalMockMode(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return window.localStorage.getItem("useFirestoreEmulator") === "1";
    } catch {
        return false;
    }
}

const PUBLISH_DEBOUNCE_MS = 400;

/**
 * Live-Sync des Übungsstatus über `uebungen/{uebungId}/status`.
 *
 * Schreibvorgänge sind bewusst "fire and forget": Der lokale Cache bleibt die
 * Quelle für die Anzeige, damit die Übung bei Netzproblemen weiterläuft. Fehler
 * schlagen sich nur im Sync-Status nieder.
 */
export class LiveStatusService {
    private backend: LiveStatusBackend | null = null;
    private unsubscribers: Unsubscribe[] = [];
    private pendingWrites = new Map<string, PlainDoc>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private state: LiveSyncState = "aus";
    private stateListeners: ((state: LiveSyncState) => void)[] = [];

    constructor(db: Firestore | null, uebungId: string) {
        if (!featureFlags.isEnabled("enableLiveStatusSync") || !uebungId) {
            return;
        }
        if (isLocalMockMode()) {
            this.backend = new LocalBackend(uebungId);
            this.state = "verbinde";
            return;
        }
        if (db) {
            this.backend = new FirestoreBackend(db, uebungId);
            this.state = "verbinde";
        }
    }

    public get enabled(): boolean {
        return this.backend !== null;
    }

    public getState(): LiveSyncState {
        return this.state;
    }

    public onStateChange(listener: (state: LiveSyncState) => void): void {
        this.stateListeners.push(listener);
        listener(this.state);
    }

    private setState(state: LiveSyncState): void {
        if (this.state === state) {
            return;
        }
        this.state = state;
        this.stateListeners.forEach(l => l(state));
    }

    private handleError(error: unknown): void {
        console.warn("⚠️ Live-Sync des Übungsstatus nicht verfügbar", error);
        this.setState("fehler");
    }

    // --- Schreiben ------------------------------------------------------

    private queueWrite(docId: string, data: PlainDoc): void {
        if (!this.backend) {
            return;
        }
        this.pendingWrites.set(docId, data);
        if (this.flushTimer !== null) {
            return;
        }
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            void this.flush();
        }, PUBLISH_DEBOUNCE_MS);
    }

    /** Schreibt alle anstehenden Dokumente sofort. */
    public async flush(): Promise<void> {
        const backend = this.backend;
        if (!backend) {
            return;
        }
        if (this.flushTimer !== null) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        const writes = Array.from(this.pendingWrites.entries());
        this.pendingWrites.clear();

        for (const [docId, data] of writes) {
            try {
                await backend.write(docId, data);
                this.setState("live");
            } catch (error) {
                this.handleError(error);
            }
        }
    }

    public publishTeilnehmerStatus(liveDoc: TeilnehmerLiveDoc): void {
        this.queueWrite(teilnehmerDocId(liveDoc.teilnehmerId), liveDoc as unknown as PlainDoc);
    }

    public publishLeitungPublic(liveDoc: LeitungPublicLiveDoc): void {
        this.queueWrite(LEITUNG_PUBLIC_DOC_ID, liveDoc as unknown as PlainDoc);
    }

    public publishLeitungInternal(liveDoc: LeitungLiveDoc): void {
        this.queueWrite(LEITUNG_DOC_ID, liveDoc as unknown as PlainDoc);
    }

    // --- Lesen ----------------------------------------------------------

    public subscribeLeitungPublic(onDoc: (liveDoc: LeitungPublicLiveDoc | null) => void): void {
        if (!this.backend) {
            return;
        }
        this.unsubscribers.push(
            this.backend.subscribeDoc(
                LEITUNG_PUBLIC_DOC_ID,
                data => {
                    this.setState("live");
                    onDoc(data ? (data as unknown as LeitungPublicLiveDoc) : null);
                },
                error => this.handleError(error)
            )
        );
    }

    /** Eigenes Teilnehmer-Dokument – damit ein Gerätewechsel den Verlauf mitbringt. */
    public subscribeEigenenStatus(
        teilnehmerId: string,
        onDoc: (liveDoc: TeilnehmerLiveDoc | null) => void
    ): void {
        if (!this.backend) {
            return;
        }
        this.unsubscribers.push(
            this.backend.subscribeDoc(
                teilnehmerDocId(teilnehmerId),
                data => {
                    this.setState("live");
                    onDoc(data ? (data as unknown as TeilnehmerLiveDoc) : null);
                },
                error => this.handleError(error)
            )
        );
    }

    public subscribeLeitungInternal(onDoc: (liveDoc: LeitungLiveDoc | null) => void): void {
        if (!this.backend) {
            return;
        }
        this.unsubscribers.push(
            this.backend.subscribeDoc(
                LEITUNG_DOC_ID,
                data => {
                    this.setState("live");
                    onDoc(data ? (data as unknown as LeitungLiveDoc) : null);
                },
                error => this.handleError(error)
            )
        );
    }

    /**
     * Abonniert die gesamte Status-Subcollection und liefert alle Teilnehmer-Dokumente.
     * Ein einziger `onSnapshot` reicht – die Leitung braucht ohnehin alle Teilnehmer.
     */
    public subscribeAlleTeilnehmer(onDocs: (docs: TeilnehmerLiveDoc[]) => void): void {
        if (!this.backend) {
            return;
        }
        this.unsubscribers.push(
            this.backend.subscribeCollection(
                docs => {
                    this.setState("live");
                    onDocs(
                        docs
                            .filter(d => d.id.startsWith(TEILNEHMER_DOC_PREFIX))
                            .map(d => d.data as unknown as TeilnehmerLiveDoc)
                            .filter(d => typeof d.teilnehmer === "string" && d.teilnehmer.length > 0)
                    );
                },
                error => this.handleError(error)
            )
        );
    }

    public dispose(): void {
        this.unsubscribers.forEach(unsub => {
            try {
                unsub();
            } catch {
                // Abmelden darf den Seitenwechsel nie blockieren.
            }
        });
        this.unsubscribers = [];
        if (this.flushTimer !== null) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.pendingWrites.clear();
    }
}
