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
    Timestamp
} from "firebase/firestore";
import { Uebung } from "../types/Uebung";
import { FunkUebung } from "../FunkUebung";

export class FirebaseService {
    constructor(private db: Firestore) {}

    /**
     * Wandelt ein Firestore-Dokument in ein sauberes Uebung-Objekt um (Domain-Modell).
     */
    private mapToDomain(id: string, data: any): Uebung {
        return {
            ...data,
            id: id,
            datum: this.convertToDate(data.datum),
            createDate: this.convertToDate(data.createDate),
            teilnehmerIds: data.teilnehmerIds || {},
            teilnehmerStellen: data.teilnehmerStellen || {},
            loesungswoerter: data.loesungswoerter || {},
            loesungsStaerken: data.loesungsStaerken || {},
            nachrichten: data.nachrichten || {}
        };
    }

    private convertToDate(value: any): Date {
        if (value instanceof Timestamp) {
            return value.toDate();
        }
        if (typeof value === "string" || typeof value === "number") {
            const d = new Date(value);
            return isNaN(d.getTime()) ? new Date() : d;
        }
        return value instanceof Date ? value : new Date();
    }

    /**
     * Lädt eine Übung anhand ihrer ID.
     */
    async getUebung(id: string): Promise<Uebung | null> {
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
        
        // Falls es ein FunkUebung-Objekt ist, nutzen wir dessen toJson (welches Checksummen berechnet)
        // ansonsten ein normales Objekt-Mapping.
        let dataToSave: any;
        if (uebung instanceof FunkUebung) {
            dataToSave = JSON.parse(uebung.toJson());
        } else {
            dataToSave = { ...uebung };
        }

        await setDoc(docRef, dataToSave);
    }

    /**
     * Lädt Übungen für die Admin-Ansicht mit Paginierung.
     */
    async getUebungenPaged(pageSize: number, lastVisible: any = null, direction: 'next' | 'prev' | 'initial' = 'initial') {
        const uebungCol = collection(this.db, "uebungen");
        let q;

        if (direction === "next" && lastVisible) {
            q = query(uebungCol, orderBy("createDate", "desc"), startAfter(lastVisible), limit(pageSize));
        } else {
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

    /**
     * Lädt Statistiken für das Admin-Dashboard.
     */
    async getAdminStats() {
        const uebungenCol = collection(this.db, "uebungen");

        const [totalSnap, loesungsSnap, staerkeSnap, buchstabierSnap, allDocs] = await Promise.all([
            getCountFromServer(uebungenCol),
            getCountFromServer(query(uebungenCol, where("loesungswoerter", "!=", null))),
            getCountFromServer(query(uebungenCol, where("loesungsStaerken", "!=", null))),
            getCountFromServer(query(uebungenCol, where("buchstabierenAn", ">", 0))),
            getDocs(uebungenCol)
        ]);

        const total = totalSnap.data().count;
        let totalTeilnehmer = 0;
        let totalBytes = 0;
        let totalSprueche = 0;

        allDocs.forEach((doc) => {
            const data = doc.data();
            totalTeilnehmer += data.teilnehmerListe?.length || 0;
            totalBytes += JSON.stringify(data).length;
            totalSprueche += Object.values(data.nachrichten || {}).flat().length;
        });

        return {
            total,
            totalTeilnehmer,
            totalBytes,
            totalSprueche,
            loesungsCount: loesungsSnap.data().count,
            staerkeCount: staerkeSnap.data().count,
            buchstabierCount: buchstabierSnap.data().count
        };
    }
}
