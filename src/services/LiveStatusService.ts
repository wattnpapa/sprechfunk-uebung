import type { Firestore } from "firebase/firestore";
import {
    LEITUNG_DOC_ID,
    LEITUNG_PUBLIC_DOC_ID,
    TEILNEHMER_DOC_PREFIX,
    teilnehmerDocId,
    type LeitungLiveDoc,
    type LeitungPublicLiveDoc,
    type LiveSyncState,
    type TeilnehmerLiveDoc
} from "../types/LiveStatus";
import { featureFlags } from "./featureFlags";
import {
    FirestoreBackend,
    LocalBackend,
    isLocalMockMode,
    type LiveStatusBackend,
    type MetaCallback,
    type PlainDoc,
    type Unsubscribe
} from "./liveStatusBackends";

export { sanitizeForFirestore } from "./liveStatusBackends";

const PUBLISH_DEBOUNCE_MS = 400;

/**
 * Ein `setDoc` ohne Netz lehnt im Firestore-Web-SDK nicht ab, es wartet auf die
 * Bestätigung des Servers. Bleibt sie so lange aus, gilt die Verbindung als weg.
 */
export const SCHREIB_TIMEOUT_MS = 6000;

function browserMeldetOffline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Live-Sync des Übungsstatus über `uebungen/{uebungId}/status`.
 *
 * Schreibvorgänge sind bewusst "fire and forget": Der lokale Cache bleibt die
 * Quelle für die Anzeige, damit die Übung bei Netzproblemen weiterläuft.
 *
 * Der Sync-Zustand hängt an der Bestätigung durch den Server, nicht am
 * Anstoßen eines Schreibvorgangs (THW-Review offline-resilience P0-1):
 *
 * - `live`     – der Server hat bestätigt bzw. liefert frische Daten
 * - `offline`  – Browser offline, Schreiben seit {@link SCHREIB_TIMEOUT_MS}
 *                unbestätigt oder Snapshots nur aus dem Cache; Änderungen
 *                liegen lokal und werden nachgereicht
 * - `fehler`   – der Server lehnt ab (z. B. Regeln); wird **nicht** nachgereicht
 * - `verbinde` – noch keine Antwort; `aus` – Sync deaktiviert
 */
export class LiveStatusService {
    private backend: LiveStatusBackend | null = null;
    private unsubscribers: Unsubscribe[] = [];
    private pendingWrites = new Map<string, PlainDoc>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private state: LiveSyncState = "aus";
    private stateListeners: ((state: LiveSyncState) => void)[] = [];

    /** Schreibvorgänge, die angestoßen, aber vom Server noch nicht bestätigt sind. */
    private unbestaetigt = 0;
    /** Mindestens ein unbestätigter Schreibvorgang wartet länger als der Timeout. */
    private haengt = false;
    private browserOffline = false;
    /** Abonnements, deren letzter Snapshot nur aus dem lokalen Cache kam. */
    private ausCache = new Set<number>();
    private fehler = false;
    private kontakt = false;
    private naechsteAboId = 0;
    private onBrowserOnline = () => this.setBrowserOffline(false);
    private onBrowserOffline = () => this.setBrowserOffline(true);

    constructor(db: Firestore | null, uebungId: string) {
        if (!featureFlags.isEnabled("enableLiveStatusSync") || !uebungId) {
            return;
        }
        if (isLocalMockMode()) {
            this.backend = new LocalBackend(uebungId);
        } else if (db) {
            this.backend = new FirestoreBackend(db, uebungId);
        }
        if (!this.backend) {
            return;
        }
        this.browserOffline = browserMeldetOffline();
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("online", this.onBrowserOnline);
            window.addEventListener("offline", this.onBrowserOffline);
        }
        this.state = this.berechneZustand();
    }

    public get enabled(): boolean {
        return this.backend !== null;
    }

    public getState(): LiveSyncState {
        return this.state;
    }

    /** Anzahl der Dokumente, die noch nicht beim Server angekommen sind. */
    public getOffeneAenderungen(): number {
        return this.unbestaetigt + this.pendingWrites.size;
    }

    public onStateChange(listener: (state: LiveSyncState) => void): void {
        this.stateListeners.push(listener);
        listener(this.state);
    }

    private berechneZustand(): LiveSyncState {
        if (!this.backend) {
            return "aus";
        }
        if (this.fehler) {
            return "fehler";
        }
        if (this.browserOffline || this.haengt || this.ausCache.size > 0) {
            return "offline";
        }
        return this.kontakt ? "live" : "verbinde";
    }

    private aktualisiereZustand(): void {
        const state = this.berechneZustand();
        if (this.state === state) {
            return;
        }
        this.state = state;
        this.stateListeners.forEach(l => l(state));
    }

    private setBrowserOffline(offline: boolean): void {
        this.browserOffline = offline;
        this.aktualisiereZustand();
        if (!offline && this.pendingWrites.size > 0) {
            void this.flush();
        }
    }

    private handleError(error: unknown): void {
        console.warn("⚠️ Live-Sync des Übungsstatus nicht verfügbar", error);
        this.fehler = true;
        this.aktualisiereZustand();
    }

    /** Frische Antwort vom Server (bzw. vom Mock): ein früherer Fehler ist vorbei. */
    private bestaetigt(): void {
        this.fehler = false;
        this.kontakt = true;
        this.aktualisiereZustand();
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

    private async schreibe(backend: LiveStatusBackend, docId: string, data: PlainDoc): Promise<boolean> {
        this.unbestaetigt++;
        const timer = setTimeout(() => {
            this.haengt = true;
            this.aktualisiereZustand();
        }, SCHREIB_TIMEOUT_MS);
        try {
            await backend.write(docId, data);
            this.bestaetigt();
            return true;
        } catch (error) {
            this.handleError(error);
            return false;
        } finally {
            clearTimeout(timer);
            this.unbestaetigt--;
            if (this.unbestaetigt === 0) {
                this.haengt = false;
            }
            this.aktualisiereZustand();
        }
    }

    /**
     * Schreibt alle anstehenden Dokumente sofort.
     *
     * @param timeoutMs Wartet höchstens so lange auf die Bestätigung des Servers.
     * @returns `true`, wenn alle Dokumente bestätigt wurden; `false` bei Fehler
     *          oder wenn die Bestätigung bis zum Timeout ausblieb. Unbestätigte
     *          Schreibvorgänge laufen im Hintergrund weiter.
     */
    public async flush(timeoutMs?: number): Promise<boolean> {
        const backend = this.backend;
        if (!backend) {
            return true;
        }
        if (this.flushTimer !== null) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        const writes = Array.from(this.pendingWrites.entries());
        this.pendingWrites.clear();

        const alle = Promise.all(writes.map(([docId, data]) => this.schreibe(backend, docId, data)))
            .then(ergebnisse => ergebnisse.every(Boolean));
        if (timeoutMs === undefined) {
            return alle;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        const abgelaufen = new Promise<boolean>(resolve => {
            timer = setTimeout(() => resolve(false), timeoutMs);
        });
        try {
            return await Promise.race([alle, abgelaufen]);
        } finally {
            clearTimeout(timer);
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

    /** Meta-Rückruf je Abonnement: merkt sich, ob es gerade nur Cache-Daten sieht. */
    private metaFuer(): MetaCallback {
        const id = this.naechsteAboId++;
        return ausCache => {
            if (ausCache) {
                this.ausCache.add(id);
                this.aktualisiereZustand();
                return;
            }
            this.ausCache.delete(id);
            this.bestaetigt();
        };
    }

    private abonniereDoc<T>(docId: string, onDoc: (liveDoc: T | null) => void): void {
        if (!this.backend) {
            return;
        }
        this.unsubscribers.push(
            this.backend.subscribeDoc(
                docId,
                data => onDoc(data ? (data as unknown as T) : null),
                error => this.handleError(error),
                this.metaFuer()
            )
        );
    }

    public subscribeLeitungPublic(onDoc: (liveDoc: LeitungPublicLiveDoc | null) => void): void {
        this.abonniereDoc(LEITUNG_PUBLIC_DOC_ID, onDoc);
    }

    /** Eigenes Teilnehmer-Dokument – damit ein Gerätewechsel den Verlauf mitbringt. */
    public subscribeEigenenStatus(
        teilnehmerId: string,
        onDoc: (liveDoc: TeilnehmerLiveDoc | null) => void
    ): void {
        this.abonniereDoc(teilnehmerDocId(teilnehmerId), onDoc);
    }

    public subscribeLeitungInternal(onDoc: (liveDoc: LeitungLiveDoc | null) => void): void {
        this.abonniereDoc(LEITUNG_DOC_ID, onDoc);
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
                    onDocs(
                        docs
                            .filter(d => d.id.startsWith(TEILNEHMER_DOC_PREFIX))
                            .map(d => d.data as unknown as TeilnehmerLiveDoc)
                            .filter(d => typeof d.teilnehmer === "string" && d.teilnehmer.length > 0)
                    );
                },
                error => this.handleError(error),
                this.metaFuer()
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
        if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
            window.removeEventListener("online", this.onBrowserOnline);
            window.removeEventListener("offline", this.onBrowserOffline);
        }
    }
}
