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
    where,
    getDocs,
    getCountFromServer,
    getAggregateFromServer,
    count,
    sum,
    type QueryConstraint
} from "firebase/firestore";
import { Uebung } from "../types/Uebung";
import { FunkUebung } from "../models/FunkUebung";
import { mapUebungToDomain } from "./firestoreMapping";
import { isMissingIndexError, sanitizeDataForSave } from "./firestoreSanitize";
import {
    isLocalMockMode,
    mockAdminStats,
    mockUebungCode,
    mockJahresCounts,
    mockMonatsCounts,
    paginateEntries,
    readMockEntries,
    readMockStore,
    sortByCreateDateDesc,
    writeMockStore,
    type MockDokument,
    type MockStore
} from "./firestoreMockStore";

export class FirebaseService {
    /**
     * Übungscodes sind durch `ensureUniqueUebungCode` eindeutig. Sollte durch ein
     * Wettrennen zweier Generatoren dennoch ein Duplikat entstehen, werden mehrere
     * Treffer geladen und über den Teilnehmercode entschieden.
     */
    private static readonly JOIN_CODE_KANDIDATEN = 5;

    /** Obergrenze für den Jahresfilter, damit ein Ausreißer-Datum die Abfragen nicht sprengt. */
    private static readonly MAX_STATISTIK_JAHRE = 15;

    constructor(private db: Firestore) {}

    private isLocalMockMode(): boolean {
        return isLocalMockMode();
    }

    private readMockStore(): MockStore {
        return readMockStore();
    }

    private writeMockStore(store: MockStore): void {
        writeMockStore(store);
    }

    private mapToDomain(id: string, data: unknown): FunkUebung {
        return mapUebungToDomain(id, data);
    }

    private sanitizeDataForSave(data: unknown): Record<string, unknown> {
        return sanitizeDataForSave(data);
    }

    private readAlleUebungenLocal(onlyTestExercises: boolean): FunkUebung[] {
        const store = this.readMockStore();
        let allEntries = Object.entries(store).map(([id, data]) => this.mapToDomain(id, data));
        if (onlyTestExercises) {
            allEntries = allEntries.filter(entry => entry.istStandardKonfiguration === true);
        }
        return sortByCreateDateDesc(allEntries);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getUebungenPagedLocal(pageSize: number, startAfterCursor: any, onlyTestExercises: boolean) {
        const allEntries = this.readAlleUebungenLocal(onlyTestExercises);
        return paginateEntries(allEntries, pageSize, startAfterCursor, "__mockIndex");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async getUebungenPagedRemote(pageSize: number, startAfterCursor: any, onlyTestExercises: boolean) {
        const uebungCol = collection(this.db, "uebungen");
        const constraints = [];
        if (onlyTestExercises) {
            constraints.push(where("istStandardKonfiguration", "==", true));
        }
        constraints.push(orderBy("createDate", "desc"));
        if (startAfterCursor) {
            constraints.push(startAfter(startAfterCursor));
        }
        constraints.push(limit(pageSize));
        const q = query(uebungCol, ...constraints);

        try {
            const snapshot = await getDocs(q);
            return {
                uebungen: snapshot.docs.map(doc => this.mapToDomain(doc.id, doc.data())),
                lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
                size: snapshot.size
            };
        } catch (error) {
            if (!(onlyTestExercises && isMissingIndexError(error))) {
                throw error;
            }
            const all = sortByCreateDateDesc(await this.readAlleUebungenRemoteUnfiltered(true));
            return paginateEntries(all, pageSize, startAfterCursor, "__fallbackIndex");
        }
    }

    /**
     * Vollscan der Collection — nur als Fallback bzw. für die Textsuche gedacht,
     * weil er im Gegensatz zur Seiten-Query alle Dokumente liest.
     */
    private async readAlleUebungenRemoteUnfiltered(onlyTestExercises: boolean): Promise<FunkUebung[]> {
        const allSnap = await getDocs(collection(this.db, "uebungen"));
        const all = allSnap.docs.map(doc => this.mapToDomain(doc.id, doc.data()));
        return onlyTestExercises ? all.filter(entry => entry.istStandardKonfiguration === true) : all;
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

    async resolveTeilnehmerJoinCodes(
        uebungCodeRaw: string,
        teilnehmerCodeRaw: string
    ): Promise<{ uebungId: string; teilnehmerId: string; teilnehmerName: string } | null> {
        const uebungCode = uebungCodeRaw.trim().toUpperCase();
        const teilnehmerCode = teilnehmerCodeRaw.trim().toUpperCase();
        if (!uebungCode || !teilnehmerCode) {
            return null;
        }

        if (this.isLocalMockMode()) {
            const store = this.readMockStore();
            const kandidaten = Object.entries(store).filter(([, value]) => mockUebungCode(value) === uebungCode);
            for (const [uebungId, data] of kandidaten) {
                const treffer = this.matchTeilnehmerCode((data as MockDokument)?.["teilnehmerIds"], teilnehmerCode);
                if (treffer) {
                    return { uebungId, ...treffer };
                }
            }
            return null;
        }

        const q = query(
            collection(this.db, "uebungen"),
            where("uebungCode", "==", uebungCode),
            limit(FirebaseService.JOIN_CODE_KANDIDATEN)
        );
        const snapshot = await getDocs(q);

        for (const docSnap of snapshot.docs) {
            const treffer = this.matchTeilnehmerCode(docSnap.data()["teilnehmerIds"], teilnehmerCode);
            if (treffer) {
                return { uebungId: docSnap.id, ...treffer };
            }
        }

        return null;
    }

    private matchTeilnehmerCode(
        teilnehmerIdsRoh: unknown,
        teilnehmerCode: string
    ): { teilnehmerId: string; teilnehmerName: string } | null {
        if (!teilnehmerIdsRoh || typeof teilnehmerIdsRoh !== "object") {
            return null;
        }
        const teilnehmerIds = teilnehmerIdsRoh as Record<string, unknown>;
        const matchedEntry = Object.entries(teilnehmerIds).find(([code]) => code.toUpperCase() === teilnehmerCode);
        if (!matchedEntry || typeof matchedEntry[1] !== "string") {
            return null;
        }
        return { teilnehmerId: matchedEntry[0], teilnehmerName: matchedEntry[1] };
    }

    /**
     * Prüft, ob ein Übungscode bereits im Bestand vergeben ist.
     * `exceptId` schließt die eigene Übung aus, damit erneutes Speichern
     * einer bestehenden Übung den Code behält.
     */
    async isUebungCodeVergeben(codeRaw: string, exceptId?: string): Promise<boolean> {
        const code = (codeRaw || "").trim().toUpperCase();
        if (!code) {
            return false;
        }

        if (this.isLocalMockMode()) {
            const store = this.readMockStore();
            return Object.entries(store).some(([id, value]) =>
                id !== exceptId && mockUebungCode(value) === code
            );
        }

        const q = query(
            collection(this.db, "uebungen"),
            where("uebungCode", "==", code),
            limit(2)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.some(docSnap => docSnap.id !== exceptId);
    }

    /**
     * Speichert eine Übung.
     */
    async saveUebung(uebung: FunkUebung | Uebung): Promise<void> {
        if (this.isLocalMockMode()) {
            const id = uebung.id;
            const store = this.readMockStore();
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
            const store = this.readMockStore();
             
            delete store[id];
            this.writeMockStore(store);
            return;
        }
        await deleteDoc(doc(this.db, "uebungen", id));
    }

    /**
     * Lädt eine Seite der Admin-Übungsliste. Der Cursor zeigt auf das letzte
     * Dokument der vorhergehenden Seite; `null` liefert die erste Seite. Die
     * aufrufende Seite hält die Cursor je Seitenindex, damit auch "Vorherige"
     * ohne Vollscan funktioniert.
     */
    async getUebungenPaged(
        pageSize: number,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        startAfterCursor: any = null,
        onlyTestExercises = false
    ) {
        if (this.isLocalMockMode()) {
            return this.getUebungenPagedLocal(pageSize, startAfterCursor, onlyTestExercises);
        }
        return this.getUebungenPagedRemote(pageSize, startAfterCursor, onlyTestExercises);
    }

    /**
     * Lädt alle Übungen (nach `createDate` absteigend). Firestore kann keine
     * Teilstring-Suche, deshalb braucht die Volltextsuche der Admin-Ansicht den
     * kompletten Bestand; der Aufrufer cached das Ergebnis.
     */
    async getAlleUebungen(onlyTestExercises = false): Promise<FunkUebung[]> {
        if (this.isLocalMockMode()) {
            return this.readAlleUebungenLocal(onlyTestExercises);
        }
        try {
            const snapshot = await getDocs(
                this.buildUebungenQuery(onlyTestExercises, orderBy("createDate", "desc"))
            );
            return snapshot.docs.map(doc => this.mapToDomain(doc.id, doc.data()));
        } catch (error) {
            if (!(onlyTestExercises && isMissingIndexError(error))) {
                throw error;
            }
            return sortByCreateDateDesc(await this.readAlleUebungenRemoteUnfiltered(true));
        }
    }

    /**
     * Anzahl der Übungen — als Aggregation, ohne die Dokumente zu laden.
     */
    async getUebungenCount(onlyTestExercises = false): Promise<number> {
        if (this.isLocalMockMode()) {
            return readMockEntries(onlyTestExercises).length;
        }
        const snapshot = await getCountFromServer(this.buildUebungenQuery(onlyTestExercises));
        return snapshot.data().count;
    }

    /**
     * Übungen je Kalendermonat (Index 0 = Januar) für das Admin-Diagramm.
     * Nutzt zwölf Count-Aggregationen über `statMonat` statt eines Vollscans.
     * Ohne `jahr` werden alle Jahrgänge im selben Monat zusammengezählt.
     * Übungen ohne `statMonat` (Altbestand vor dem Backfill) fehlen im Diagramm.
     */
    async getUebungenMonatsCounts(onlyTestExercises = false, jahr?: number): Promise<number[]> {
        if (this.isLocalMockMode()) {
            return mockMonatsCounts(onlyTestExercises, jahr);
        }

        const jahresFilter = jahr === undefined ? [] : [where("statJahr", "==", jahr)];
        const monate = Array.from({ length: 12 }, (_, monat) => monat);
        return Promise.all(monate.map(async monat => {
            const snapshot = await getCountFromServer(
                this.buildUebungenQuery(onlyTestExercises, where("statMonat", "==", monat), ...jahresFilter)
            );
            return snapshot.data().count;
        }));
    }

    /**
     * Jahre mit gespeicherten Übungen samt Anzahl — Datengrundlage für den
     * Jahresfilter des Admin-Diagramms. Das früheste Jahr kostet einen einzelnen
     * Dokument-Read, danach zählt je Jahr eine Aggregation.
     */
    async getUebungenJahresCounts(onlyTestExercises = false): Promise<{ jahr: number; anzahl: number }[]> {
        if (this.isLocalMockMode()) {
            return mockJahresCounts(onlyTestExercises);
        }

        const aktuellesJahr = new Date().getFullYear();
        const [fruehestes, spaetestes] = await Promise.all([
            this.getRandUebungsJahr("asc"),
            this.getRandUebungsJahr("desc")
        ]);
        if (fruehestes === undefined || spaetestes === undefined) {
            return [];
        }
        // Vordatierte Übungen (Planung fürs nächste Jahr) gehören ins Diagramm,
        // sonst weist der Abgleich sie fälschlich als "ohne Statistikfelder" aus.
        // Ein verrutschtes Datum (etwa 1970 oder 2099) darf trotzdem keine
        // hundert Abfragen auslösen: das Fenster bleibt auf MAX_STATISTIK_JAHRE
        // begrenzt und endet frühestens im laufenden Jahr.
        const bis = Math.min(Math.max(aktuellesJahr, spaetestes), aktuellesJahr + FirebaseService.MAX_STATISTIK_JAHRE - 1);
        const von = Math.max(fruehestes, bis - (FirebaseService.MAX_STATISTIK_JAHRE - 1));
        const jahre = Array.from({ length: bis - von + 1 }, (_, i) => von + i);

        const counts = await Promise.all(jahre.map(async jahr => {
            const snapshot = await getCountFromServer(
                this.buildUebungenQuery(onlyTestExercises, where("statJahr", "==", jahr))
            );
            return { jahr, anzahl: snapshot.data().count };
        }));
        return counts.filter(eintrag => eintrag.anzahl > 0);
    }

    /**
     * Älteste (`asc`) bzw. jüngste (`desc`) Übung mit `statJahr`. Dokumente ohne
     * das Feld stehen nicht im Index und bleiben deshalb unberücksichtigt; fehlt
     * der Index ganz, liefert die Methode `undefined` und der Jahresfilter bleibt leer.
     */
    private async getRandUebungsJahr(richtung: "asc" | "desc"): Promise<number | undefined> {
        try {
            const snapshot = await getDocs(
                query(collection(this.db, "uebungen"), orderBy("statJahr", richtung), limit(1))
            );
            const jahr = snapshot.docs[0]?.data()["statJahr"];
            return typeof jahr === "number" ? jahr : undefined;
        } catch (error) {
            console.warn(`${richtung === "asc" ? "Frühestes" : "Spätestes"} Übungsjahr konnte nicht ermittelt werden:`, error);
            return undefined;
        }
    }

    private buildUebungenQuery(onlyTestExercises: boolean, ...zusatz: QueryConstraint[]) {
        const constraints = [...zusatz];
        if (onlyTestExercises) {
            constraints.push(where("istStandardKonfiguration", "==", true));
        }
        return query(collection(this.db, "uebungen"), ...constraints);
    }

    /**
     * Lädt Statistiken für das Admin-Dashboard.
     *
     * Im Firestore-Pfad ausschließlich über Aggregations-Queries auf den
     * denormalisierten `stat*`-Feldern (siehe `buildStatistikFelder`), damit
     * nicht die komplette Collection heruntergeladen wird. Dokumente, die vor
     * Einführung dieser Felder gespeichert wurden, fehlen in den Summen, bis
     * `scripts/backfill-stat-felder.mjs` gelaufen ist.
     */
    async getAdminStats() {
        if (this.isLocalMockMode()) {
            return mockAdminStats();
        }
        const uebungenCol = collection(this.db, "uebungen");

        const [summen, loesungsCount, staerkeCount, buchstabierCount] = await Promise.all([
            getAggregateFromServer(uebungenCol, {
                total: count(),
                totalTeilnehmer: sum("statTeilnehmerAnzahl"),
                totalSprueche: sum("statNachrichtenAnzahl"),
                totalBytes: sum("statBytes")
            }),
            this.countWhereFlag("statHatLoesungswoerter"),
            this.countWhereFlag("statHatLoesungsStaerken"),
            this.countWhereFlag("statHatBuchstabieren")
        ]);

        const werte = summen.data();

        return {
            total: werte.total,
            totalTeilnehmer: werte.totalTeilnehmer,
            totalBytes: werte.totalBytes,
            totalSprueche: werte.totalSprueche,
            loesungsCount,
            staerkeCount,
            buchstabierCount
        };
    }

    private async countWhereFlag(feld: string): Promise<number> {
        const snapshot = await getCountFromServer(
            query(collection(this.db, "uebungen"), where(feld, "==", true))
        );
        return snapshot.data().count;
    }
}
