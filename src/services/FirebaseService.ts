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
    Timestamp,
    type QueryConstraint
} from "firebase/firestore";
import { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import { FunkUebung } from "../models/FunkUebung";

export class FirebaseService {
    /**
     * Übungscodes sind durch `ensureUniqueUebungCode` eindeutig. Sollte durch ein
     * Wettrennen zweier Generatoren dennoch ein Duplikat entstehen, werden mehrere
     * Treffer geladen und über den Teilnehmercode entschieden.
     */
    private static readonly JOIN_CODE_KANDIDATEN = 5;

    constructor(private db: Firestore) {}

    private isMissingIndexError(error: unknown): boolean {
        if (!error || typeof error !== "object") {
            return false;
        }
        const maybe = error as { code?: string; message?: string; customData?: { serverResponse?: string } };
        const code = typeof maybe.code === "string" ? maybe.code : "";
        if (code === "failed-precondition" || code.endsWith("/failed-precondition")) {
            return true;
        }
        const message = typeof maybe.message === "string" ? maybe.message.toLowerCase() : "";
        if (message.includes("requires an index") || message.includes("create_composite")) {
            return true;
        }
        const serverResponse = typeof maybe.customData?.serverResponse === "string"
            ? maybe.customData.serverResponse.toLowerCase()
            : "";
        return serverResponse.includes("requires an index") || serverResponse.includes("create_composite");
    }

    private hasNonEmptyRecord(val: unknown): boolean {
        if (!val || typeof val !== "object") {
            return false;
        }
        return Object.keys(val as Record<string, unknown>).length > 0;
    }

    private sortByCreateDateDesc(entries: FunkUebung[]): FunkUebung[] {
        return entries.sort((a, b) => {
            const da = new Date(a.createDate).getTime();
            const db = new Date(b.createDate).getTime();
            return db - da;
        });
    }

    private paginateEntries(
        entries: FunkUebung[],
        pageSize: number,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        startAfterCursor: any,
        cursorKey: "__mockIndex" | "__fallbackIndex"
    ) {
        let start = 0;
        if (startAfterCursor && typeof startAfterCursor[cursorKey] === "number") {
            start = startAfterCursor[cursorKey] + 1;
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

    private readAlleUebungenLocal(onlyTestExercises: boolean): FunkUebung[] {
        const store = this.readMockStore();
        let allEntries = Object.entries(store).map(([id, data]) => this.mapToDomain(id, data));
        if (onlyTestExercises) {
            allEntries = allEntries.filter(entry => entry.istStandardKonfiguration === true);
        }
        return this.sortByCreateDateDesc(allEntries);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getUebungenPagedLocal(pageSize: number, startAfterCursor: any, onlyTestExercises: boolean) {
        const allEntries = this.readAlleUebungenLocal(onlyTestExercises);
        return this.paginateEntries(allEntries, pageSize, startAfterCursor, "__mockIndex");
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
            if (!(onlyTestExercises && this.isMissingIndexError(error))) {
                throw error;
            }
            const all = this.sortByCreateDateDesc(await this.readAlleUebungenRemoteUnfiltered(true));
            return this.paginateEntries(all, pageSize, startAfterCursor, "__fallbackIndex");
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
        cleaned["uebungCode"] = typeof cleaned["uebungCode"] === "string"
            ? cleaned["uebungCode"].trim().toUpperCase()
            : "";

        cleaned["nachrichten"] = this.cleanupRecordKeys(cleaned["nachrichten"]);
        cleaned["loesungsStaerken"] = this.cleanupRecordKeys(cleaned["loesungsStaerken"]);
        cleaned["loesungswoerter"] = this.cleanupRecordKeys(cleaned["loesungswoerter"]);
        cleaned["teilnehmerIds"] = this.cleanupRecordKeys(cleaned["teilnehmerIds"]);
        cleaned["teilnehmerStellen"] = this.cleanupRecordKeys(cleaned["teilnehmerStellen"]);

        Object.assign(cleaned, this.buildStatistikFelder(cleaned));

        Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === undefined) {

                delete cleaned[key];
            }
        });

        return cleaned;
    }

    /**
     * Denormalisierte Kennzahlen, damit das Admin-Dashboard über
     * Aggregations-Queries auswerten kann, statt jedes Dokument zu laden.
     * Werden bei jedem Speichern neu berechnet.
     */
    private buildStatistikFelder(cleaned: Record<string, unknown>): Record<string, unknown> {
        const teilnehmerListe = Array.isArray(cleaned["teilnehmerListe"]) ? cleaned["teilnehmerListe"] : [];
        const nachrichten = (cleaned["nachrichten"] || {}) as Record<string, unknown>;

        let nachrichtenAnzahl = 0;
        Object.values(nachrichten).forEach(msgs => {
            if (Array.isArray(msgs)) {
                nachrichtenAnzahl += msgs.length;
            }
        });

        const monat = this.extractMonat(cleaned["datum"]);

        return {
            statTeilnehmerAnzahl: teilnehmerListe.length,
            statNachrichtenAnzahl: nachrichtenAnzahl,
            // Grobe Schätzung der Dokumentgröße, wie bisher im Admin-Dashboard ausgewiesen.
            statBytes: JSON.stringify(cleaned).length,
            statHatLoesungswoerter: this.hasNonEmptyRecord(cleaned["loesungswoerter"]),
            statHatLoesungsStaerken: this.hasNonEmptyRecord(cleaned["loesungsStaerken"]),
            statHatBuchstabieren: Number(cleaned["buchstabierenAn"] || 0) > 0,
            // undefined bei unlesbarem Datum -> Feld wird verworfen, Übung taucht
            // dann nicht im Monatsdiagramm auf.
            statMonat: monat
        };
    }

    private extractMonat(rohwert: unknown): number | undefined {
        if (!rohwert) {
            return undefined;
        }
        const maybeTimestamp = rohwert as { toDate?: () => Date };
        const datum = typeof maybeTimestamp.toDate === "function"
            ? maybeTimestamp.toDate()
            : new Date(rohwert as string | number | Date);
        if (!(datum instanceof Date) || isNaN(datum.getTime())) {
            return undefined;
        }
        return datum.getMonth();
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
            const xZeitSlot = typeof obj["xZeitSlot"] === "number" && Number.isFinite(obj["xZeitSlot"])
                ? obj["xZeitSlot"]
                : undefined;
            if (xZeitSlot !== undefined) {
                base.xZeitSlot = xZeitSlot;
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
            uebungCode: typeof data.uebungCode === "string" ? data.uebungCode.toUpperCase() : "",
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
            seed: typeof data.seed === "string" ? data.seed : undefined,
            verwendeteVorlagen: toStringArray(data.verwendeteVorlagen),
            istStandardKonfiguration: typeof data.istStandardKonfiguration === "boolean" ? data.istStandardKonfiguration : false,
            spielModus: data.spielModus === "xZeit" ? "xZeit" : undefined,
            xZeitIntervallMinuten: typeof data.xZeitIntervallMinuten === "number" ? data.xZeitIntervallMinuten : undefined,
            xZeitStartOffsetMinuten: typeof data.xZeitStartOffsetMinuten === "number" ? data.xZeitStartOffsetMinuten : undefined
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
            const kandidaten = Object.entries(store).filter(([, value]) =>
                typeof value?.uebungCode === "string" && value.uebungCode.toUpperCase() === uebungCode
            );
            for (const [uebungId, data] of kandidaten) {
                const treffer = this.matchTeilnehmerCode(data?.teilnehmerIds, teilnehmerCode);
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
                id !== exceptId
                && typeof value?.uebungCode === "string"
                && value.uebungCode.toUpperCase() === code
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
            if (!(onlyTestExercises && this.isMissingIndexError(error))) {
                throw error;
            }
            return this.sortByCreateDateDesc(await this.readAlleUebungenRemoteUnfiltered(true));
        }
    }

    /**
     * Anzahl der Übungen — als Aggregation, ohne die Dokumente zu laden.
     */
    async getUebungenCount(onlyTestExercises = false): Promise<number> {
        if (this.isLocalMockMode()) {
            return this.readMockEntries(onlyTestExercises).length;
        }
        const snapshot = await getCountFromServer(this.buildUebungenQuery(onlyTestExercises));
        return snapshot.data().count;
    }

    /**
     * Übungen je Kalendermonat (Index 0 = Januar) für das Admin-Diagramm.
     * Nutzt zwölf Count-Aggregationen über `statMonat` statt eines Vollscans.
     * Übungen ohne `statMonat` (Altbestand vor dem Backfill) fehlen im Diagramm.
     */
    async getUebungenMonatsCounts(onlyTestExercises = false): Promise<number[]> {
        if (this.isLocalMockMode()) {
            const counts = Array.from({ length: 12 }, () => 0);
            this.readMockEntries(onlyTestExercises).forEach(data => {
                const monat = this.extractMonat(data["datum"]);
                if (monat !== undefined) {
                    counts[monat] = (counts[monat] ?? 0) + 1;
                }
            });
            return counts;
        }

        const monate = Array.from({ length: 12 }, (_, monat) => monat);
        return Promise.all(monate.map(async monat => {
            const snapshot = await getCountFromServer(
                this.buildUebungenQuery(onlyTestExercises, where("statMonat", "==", monat))
            );
            return snapshot.data().count;
        }));
    }

    private buildUebungenQuery(onlyTestExercises: boolean, ...zusatz: QueryConstraint[]) {
        const constraints = [...zusatz];
        if (onlyTestExercises) {
            constraints.push(where("istStandardKonfiguration", "==", true));
        }
        return query(collection(this.db, "uebungen"), ...constraints);
    }

    private readMockEntries(onlyTestExercises: boolean): Record<string, unknown>[] {
        const store = this.readMockStore();
        return (Object.values(store) as Record<string, unknown>[]).filter(data =>
            !onlyTestExercises || Boolean(data["istStandardKonfiguration"])
        );
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
            const store = this.readMockStore();
            const docs = Object.values(store) as Record<string, unknown>[];

            let totalTeilnehmer = 0;
            let totalBytes = 0;
            let totalSprueche = 0;
            let loesungsCount = 0;
            let staerkeCount = 0;
            let buchstabierCount = 0;

            docs.forEach(data => {
                totalTeilnehmer += ((data["teilnehmerListe"] as unknown[])?.length || 0);
                if (this.hasNonEmptyRecord(data["loesungswoerter"])) {
                    loesungsCount++;
                }
                if (this.hasNonEmptyRecord(data["loesungsStaerken"])) {
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
