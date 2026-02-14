import { 
    Firestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs,
    getCountFromServer,
    where,
    Timestamp,
    QuerySnapshot,
    DocumentData
} from "firebase/firestore";
import { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import { FunkUebung } from "../models/FunkUebung";

export class FirebaseService {
    constructor(private db: Firestore) {}

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
            verwendeteVorlagen: toStringArray(data.verwendeteVorlagen)
        });
        return uebung;
    }

    /**
     * Lädt eine Übung anhand ihrer ID.
     */
    async getUebung(id: string): Promise<FunkUebung | null> {
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

        await setDoc(docRef, dataToSave);
    }

    /**
     * Lädt Übungen für die Admin-Ansicht mit Paginierung.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getUebungenPaged(pageSize: number, lastVisible: any = null, direction: "next" | "prev" | "initial" = "initial") {
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
        return getDocs(collection(this.db, "uebungen"));
    }

    /**
     * Lädt Statistiken für das Admin-Dashboard.
     */
    async getAdminStats() {
        const uebungenCol = collection(this.db, "uebungen");

        // Parallele Abfragen für Performance
        const [totalSnap, loesungsSnap, staerkeSnap, buchstabierSnap] = await Promise.all([
            getCountFromServer(uebungenCol),
            getCountFromServer(query(uebungenCol, where("loesungswoerter", "!=", null))), // Check auf Existenz (nicht null)
            getCountFromServer(query(uebungenCol, where("loesungsStaerken", "!=", null))),
            getCountFromServer(query(uebungenCol, where("buchstabierenAn", ">", 0)))
        ]);

        // Für Durchschnittswerte müssen wir leider alle Dokumente laden (Firestore Limitation)
        // Optimierung: Nur benötigte Felder laden, wenn möglich (hier laden wir alles, da wir Arrays zählen müssen)
        const allDocsSnap = await getDocs(uebungenCol);
        
        let totalTeilnehmer = 0;
        let totalBytes = 0;
        let totalSprueche = 0;

        allDocsSnap.forEach(doc => {
            const data = doc.data();
            totalTeilnehmer += (data["teilnehmerListe"]?.length || 0);
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
            total: totalSnap.data().count,
            totalTeilnehmer,
            totalBytes,
            totalSprueche,
            loesungsCount: loesungsSnap.data().count,
            staerkeCount: staerkeSnap.data().count,
            buchstabierCount: buchstabierSnap.data().count
        };
    }
}
