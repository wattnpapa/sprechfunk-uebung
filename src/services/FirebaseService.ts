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

        const uebung = new FunkUebung(data.buildVersion || "");
        Object.assign(uebung, {
            id: id,
            name: data.name || "",
            datum: toDate(data.datum),
            createDate: toDate(data.createDate),
            buildVersion: data.buildVersion || "",
            leitung: data.leitung || "",
            rufgruppe: data.rufgruppe || "",
            teilnehmerListe: data.teilnehmerListe || [],
            teilnehmerIds: data.teilnehmerIds || {},
            teilnehmerStellen: data.teilnehmerStellen || {},
            nachrichten: data.nachrichten || {},
            spruecheProTeilnehmer: data.spruecheProTeilnehmer || 0,
            spruecheAnAlle: data.spruecheAnAlle || 0,
            spruecheAnMehrere: data.spruecheAnMehrere || 0,
            buchstabierenAn: data.buchstabierenAn || 0,
            loesungswoerter: data.loesungswoerter || {},
            loesungsStaerken: data.loesungsStaerken || {},
            checksumme: data.checksumme || "",
            funksprueche: data.funksprueche || [],
            anmeldungAktiv: data.anmeldungAktiv ?? true,
            verwendeteVorlagen: data.verwendeteVorlagen
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
