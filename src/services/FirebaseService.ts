import { 
    Firestore, 
    doc, 
    deleteDoc,
    getDoc, 
    setDoc, 
    collection, 
    query, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs,
    Timestamp,
    QuerySnapshot,
    DocumentData
} from "firebase/firestore";
import { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import { FunkUebung } from "../models/FunkUebung";

export class FirebaseService {
    constructor(private db: Firestore) {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private cleanupRecordKeys(obj: any): Record<string, unknown> {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
            return {};
        }
        return Object.fromEntries(
            Object.entries(obj).filter(([key, value]) => String(key).trim() !== "" && value !== undefined)
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private sanitizeDataForSave(data: any): Record<string, unknown> {
        if (!data || typeof data !== "object") {
            return {};
        }

        const cleaned = { ...data } as Record<string, unknown>;
        const teilnehmerListe = Array.isArray(cleaned["teilnehmerListe"])
            ? (cleaned["teilnehmerListe"] as unknown[])
                .map(t => typeof t === "string" ? t.trim() : "")
                .filter((t): t is string => t.length > 0)
            : [];

        cleaned["teilnehmerListe"] = teilnehmerListe;

        cleaned["nachrichten"] = this.cleanupRecordKeys(cleaned["nachrichten"]);
        cleaned["loesungsStaerken"] = this.cleanupRecordKeys(cleaned["loesungsStaerken"]);
        cleaned["loesungswoerter"] = this.cleanupRecordKeys(cleaned["loesungswoerter"]);
        cleaned["teilnehmerIds"] = this.cleanupRecordKeys(cleaned["teilnehmerIds"]);
        cleaned["teilnehmerStellen"] = this.cleanupRecordKeys(cleaned["teilnehmerStellen"]);

        Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === undefined) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete cleaned[key];
            }
        });

        return cleaned;
    }

    private isLocalMockMode(): boolean {
        if (typeof window === "undefined") {
            return false;
        }
        try {
            return window.localStorage.getItem("useFirestoreEmulator") === "1";
        } catch {
            return false;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readMockStore(): Record<string, any> {
        if (!this.isLocalMockMode() || typeof window === "undefined") {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private writeMockStore(store: Record<string, any>): void {
        if (!this.isLocalMockMode() || typeof window === "undefined") {
            return;
        }
        window.localStorage.setItem("e2eFirestoreSeed", JSON.stringify(store));
    }

    /**
     * Wandelt ein Firestore-Dokument in ein sauberes Uebung-Objekt um (Domain-Modell).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private mapToDomain(id: string, data: any): FunkUebung {
        // Helper function to safely convert dates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toDate = (val: any): Date => {
            if (val instanceof Timestamp) {
                return val.toDate();
            }
            if (typeof val === "string" || typeof val === "number") {
                const d = new Date(val);
                return isNaN(d.getTime()) ? new Date() : d;
            }
            return val instanceof Date ? val : new Date();
        };

        const toStringArray = (val: unknown): string[] => {
            if (!Array.isArray(val)) {
                return [];
            }
            return val.filter(v => typeof v === "string") as string[];
        };

        const toRecordString = (val: unknown): Record<string, string> => {
            if (!val || typeof val !== "object") {
                return {};
            }
            return Object.entries(val as Record<string, unknown>)
                .filter(([, v]) => typeof v === "string")
                .reduce<Record<string, string>>((acc, [k, v]) => {
                    acc[k] = v as string;
                    return acc;
                }, {});
        };

        const toNumber = (val: unknown, fallback = 0): number => {
            if (typeof val === "number" && Number.isFinite(val)) {
                return val;
            }
            if (typeof val === "string" && val.trim() !== "") {
                const parsed = Number(val);
                return Number.isFinite(parsed) ? parsed : fallback;
            }
            return fallback;
        };

        const parseNachricht = (val: unknown): Nachricht | null => {
            if (!val || typeof val !== "object") {
                return null;
            }
            const obj = val as Record<string, unknown>;
            const id = toNumber(obj["id"], NaN);
            const nachricht = typeof obj["nachricht"] === "string" ? obj["nachricht"] : "";
            const empfaenger = toStringArray(obj["empfaenger"]);
            if (!Number.isFinite(id) || !nachricht || empfaenger.length === 0) {
                return null;
            }
            const loesungsbuchstaben = Array.isArray(obj["loesungsbuchstaben"])
                ? (obj["loesungsbuchstaben"] as unknown[]).filter(v => typeof v === "string") as string[]
                : undefined;
            const staerken = Array.isArray(obj["staerken"])
                ? (obj["staerken"] as unknown[])
                    .map(s => {
                        if (!s || typeof s !== "object") {
                            return null;
                        }
                        const st = s as Record<string, unknown>;
                        const fuehrer = toNumber(st["fuehrer"], NaN);
                        const unterfuehrer = toNumber(st["unterfuehrer"], NaN);
                        const helfer = toNumber(st["helfer"], NaN);
                        if (!Number.isFinite(fuehrer) || !Number.isFinite(unterfuehrer) || !Number.isFinite(helfer)) {
                            return null;
                        }
                        return { fuehrer, unterfuehrer, helfer };
                    })
                    .filter(Boolean) as { fuehrer: number; unterfuehrer: number; helfer: number }[]
                : undefined;

            const base: Nachricht = {
                id,
                empfaenger,
                nachricht
            };
            if (loesungsbuchstaben && loesungsbuchstaben.length > 0) {
                base.loesungsbuchstaben = loesungsbuchstaben;
            }
            if (staerken && staerken.length > 0) {
                base.staerken = staerken;
            }
            return base;
        };

        const toNachrichtenRecord = (val: unknown): Record<string, Nachricht[]> => {
            if (!val || typeof val !== "object") {
                return {};
            }
            const entries = Object.entries(val as Record<string, unknown>);
            return entries.reduce<Record<string, Nachricht[]>>((acc, [sender, list]) => {
                if (!Array.isArray(list)) {
                    acc[sender] = [];
                    return acc;
                }
                acc[sender] = list
                    .map(parseNachricht)
                    .filter((n): n is Nachricht => n !== null);
                return acc;
            }, {});
        };

        const uebung = new FunkUebung(typeof data.buildVersion === "string" ? data.buildVersion : "");
        Object.assign(uebung, {
            id: id,
            name: typeof data.name === "string" ? data.name : "",
            datum: toDate(data.datum),
            createDate: toDate(data.createDate),
            buildVersion: typeof data.buildVersion === "string" ? data.buildVersion : "",
            leitung: typeof data.leitung === "string" ? data.leitung : "",
            rufgruppe: typeof data.rufgruppe === "string" ? data.rufgruppe : "",
            teilnehmerListe: toStringArray(data.teilnehmerListe),
            teilnehmerIds: toRecordString(data.teilnehmerIds),
            teilnehmerStellen: toRecordString(data.teilnehmerStellen),
            nachrichten: toNachrichtenRecord(data.nachrichten),
            spruecheProTeilnehmer: toNumber(data.spruecheProTeilnehmer, 0),
            spruecheAnAlle: toNumber(data.spruecheAnAlle, 0),
            spruecheAnMehrere: toNumber(data.spruecheAnMehrere, 0),
            buchstabierenAn: toNumber(data.buchstabierenAn, 0),
            loesungswoerter: toRecordString(data.loesungswoerter),
            loesungsStaerken: toRecordString(data.loesungsStaerken),
            checksumme: typeof data.checksumme === "string" ? data.checksumme : "",
            funksprueche: toStringArray(data.funksprueche),
            anmeldungAktiv: typeof data.anmeldungAktiv === "boolean" ? data.anmeldungAktiv : true,
            verwendeteVorlagen: toStringArray(data.verwendeteVorlagen),
            istStandardKonfiguration: typeof data.istStandardKonfiguration === "boolean" ? data.istStandardKonfiguration : false
        });

        // Legacy-Daten kompatibel machen: "Alle" immer in explizite Empfängerliste auflösen.
        Object.entries(uebung.nachrichten || {}).forEach(([sender, list]) => {
            list.forEach(n => {
                if (n.empfaenger.includes("Alle")) {
                    n.empfaenger = uebung.teilnehmerListe.filter(t => t !== sender);
                }
            });
        });
        return uebung;
    }

    /**
     * Lädt eine Übung anhand ihrer ID.
     */
    async getUebung(id: string): Promise<FunkUebung | null> {
        if (this.isLocalMockMode()) {
            const store = this.readMockStore();
            const data = store[id];
            return data ? this.mapToDomain(id, data) : null;
        }
        const docRef = doc(this.db, "uebungen", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return this.mapToDomain(docSnap.id, docSnap.data());
        }
        return null;
    }

    /**
     * Speichert eine Übung.
     */
    async saveUebung(uebung: FunkUebung | Uebung): Promise<void> {
        if (this.isLocalMockMode()) {
            const id = uebung.id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const store = this.readMockStore() as Record<string, any>;
            if (uebung instanceof FunkUebung) {
                store[id] = JSON.parse(uebung.toJson());
            } else {
                store[id] = { ...uebung };
            }
            this.writeMockStore(store);
            return;
        }
        const id = uebung.id;
        const docRef = doc(this.db, "uebungen", id);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let dataToSave: any;
        if (uebung instanceof FunkUebung) {
            // FunkUebung hat eine toJson Methode, die wir nutzen sollten
            // Aber setDoc erwartet ein Objekt, keinen JSON-String.
            // toJson gibt einen String zurück, also parsen wir ihn wieder.
            dataToSave = JSON.parse(uebung.toJson());
        } else {
            // Bei einem reinen Interface-Objekt müssen wir sicherstellen, dass Dates korrekt sind
            // Firestore kann Date-Objekte direkt speichern.
            dataToSave = { ...uebung };
        }

        await setDoc(docRef, this.sanitizeDataForSave(dataToSave));
    }

    async deleteUebung(id: string): Promise<void> {
        if (this.isLocalMockMode()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const store = this.readMockStore() as Record<string, any>;
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete store[id];
            this.writeMockStore(store);
            return;
        }
        await deleteDoc(doc(this.db, "uebungen", id));
    }

    /**
     * Lädt Übungen für die Admin-Ansicht mit Paginierung.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getUebungenPaged(pageSize: number, lastVisible: any = null, direction: "next" | "prev" | "initial" = "initial") {
        if (this.isLocalMockMode()) {
            const store = this.readMockStore();
            const allEntries = Object.entries(store).map(([id, data]) => this.mapToDomain(id, data));
            allEntries.sort((a, b) => {
                const da = new Date(a.createDate).getTime();
                const db = new Date(b.createDate).getTime();
                return db - da;
            });

            let start = 0;
            if (direction === "next" && lastVisible && typeof lastVisible.__mockIndex === "number") {
                start = lastVisible.__mockIndex + 1;
            }
            const page = allEntries.slice(start, start + pageSize);
            const lastIndex = start + page.length - 1;

            return {
                uebungen: page,
                lastVisible: page.length > 0 ? { __mockIndex: lastIndex } : null,
                size: page.length
            };
        }
        const uebungCol = collection(this.db, "uebungen");
        let q;

        if (direction === "next" && lastVisible) {
            q = query(uebungCol, orderBy("createDate", "desc"), startAfter(lastVisible), limit(pageSize));
        } else {
            // Initial oder Prev (Prev ist hier vereinfacht als Reset implementiert, echte Prev-Logik bräuchte endBefore)
            q = query(uebungCol, orderBy("createDate", "desc"), limit(pageSize));
        }

        const snapshot = await getDocs(q);
        const uebungen = snapshot.docs.map(doc => this.mapToDomain(doc.id, doc.data()));
        
        return {
            uebungen,
            lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
            size: snapshot.size
        };
    }

    async getUebungenSnapshot(): Promise<QuerySnapshot<DocumentData>> {
        if (this.isLocalMockMode()) {
            const store = this.readMockStore();
            const entries = Object.entries(store);
            const docs = entries.map(([id, data]) => ({
                id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: () => data as any
            }));
            const snapshot = {
                size: docs.length,
                docs,
                forEach: (cb: (doc: { id: string; data: () => DocumentData }) => void) => {
                    docs.forEach(cb);
                }
            };
            return snapshot as unknown as QuerySnapshot<DocumentData>;
        }
        return getDocs(collection(this.db, "uebungen"));
    }

    /**
     * Lädt Statistiken für das Admin-Dashboard.
     */
    async getAdminStats() {
        if (this.isLocalMockMode()) {
            const store = this.readMockStore();
            const docs = Object.values(store) as Record<string, unknown>[];

            const hasNonEmptyRecord = (val: unknown): boolean => {
                if (!val || typeof val !== "object") {
                    return false;
                }
                return Object.keys(val as Record<string, unknown>).length > 0;
            };

            let totalTeilnehmer = 0;
            let totalBytes = 0;
            let totalSprueche = 0;
            let loesungsCount = 0;
            let staerkeCount = 0;
            let buchstabierCount = 0;

            docs.forEach(data => {
                totalTeilnehmer += ((data["teilnehmerListe"] as unknown[])?.length || 0);
                if (hasNonEmptyRecord(data["loesungswoerter"])) {
                    loesungsCount++;
                }
                if (hasNonEmptyRecord(data["loesungsStaerken"])) {
                    staerkeCount++;
                }
                if ((data["buchstabierenAn"] as number || 0) > 0) {
                    buchstabierCount++;
                }
                totalBytes += JSON.stringify(data).length;
                const nachrichten = data["nachrichten"] as Record<string, unknown[]> || {};
                Object.values(nachrichten).forEach(msgs => {
                    if (Array.isArray(msgs)) {
                        totalSprueche += msgs.length;
                    }
                });
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
        const uebungenCol = collection(this.db, "uebungen");
        const allDocsSnap = await getDocs(uebungenCol);
        
        const hasNonEmptyRecord = (val: unknown): boolean => {
            if (!val || typeof val !== "object") {
                return false;
            }
            return Object.keys(val as Record<string, unknown>).length > 0;
        };

        let totalTeilnehmer = 0;
        let totalBytes = 0;
        let totalSprueche = 0;
        let loesungsCount = 0;
        let staerkeCount = 0;
        let buchstabierCount = 0;

        allDocsSnap.forEach(doc => {
            const data = doc.data();
            totalTeilnehmer += (data["teilnehmerListe"]?.length || 0);
            if (hasNonEmptyRecord(data["loesungswoerter"])) {
                loesungsCount++;
            }
            if (hasNonEmptyRecord(data["loesungsStaerken"])) {
                staerkeCount++;
            }
            if ((data["buchstabierenAn"] || 0) > 0) {
                buchstabierCount++;
            }
            // Grobe Schätzung der Größe
            totalBytes += JSON.stringify(data).length;
            // Anzahl Nachrichten zählen
            const nachrichten = data["nachrichten"] || {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.values(nachrichten).forEach((msgs: any) => {
                if (Array.isArray(msgs)) {
                    totalSprueche += msgs.length;
                }
            });
        });

        return {
            total: allDocsSnap.size,
            totalTeilnehmer,
            totalBytes,
            totalSprueche,
            loesungsCount,
            staerkeCount,
            buchstabierCount
        };
    }
}
