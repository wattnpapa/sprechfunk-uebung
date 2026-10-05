import type { Firestore } from "firebase/firestore";
import { saveTeilnehmerStorage } from "../services/storage";
import { TeilnehmerView } from "./TeilnehmerView";
import { FirebaseService } from "../services/FirebaseService";
import { Uebung } from "../types/Uebung";
import { TeilnehmerStorage } from "../types/Storage";
import { ladePdfGenerator } from "../services/pdfGeneratorLazy";
import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";
import { debounce } from "../utils/debounce";
import { LiveStatusService } from "../services/LiveStatusService";
import { toTeilnehmerLiveDoc } from "../services/liveStatusMerge";
import type { LeitungBestaetigung } from "../types/LiveStatus";
import type { DocMode } from "./teilnehmerEvents";
import type { ZustellVerfolgung } from "./zustellung";

/**
 * Zustand und gemeinsame Helfer des Teilnehmer-Controllers. Die Steuerung
 * ist auf mehrere Schichten verteilt (Vordruck, X-Zeit, Zugang/Live-Sync);
 * alle arbeiten auf diesem einen Zustand.
 */
export abstract class TeilnehmerControllerBasis {
    protected view: TeilnehmerView;
    protected firebaseService: FirebaseService;
    protected uebungId: string | null = null;
    protected teilnehmerId: string | null = null;
    protected uebung: Uebung | null = null;
    protected teilnehmerName: string | null = null;
    protected storage: TeilnehmerStorage | null = null;
    protected docMode: DocMode = "table";
    protected docPage = 1;
    protected currentDocUrl: string | null = null;
    protected docRenderToken = 0;
    protected docPageByMode: Record<DocMode, number> = {
        table: 1,
        meldevordruck: 1,
        nachrichtenvordruck: 1
    };
    protected docBlobInFlight = new Map<DocMode, Set<number>>();
    protected docBlobCache = new Map<DocMode, Map<number, Blob>>();
    protected preloadToken = 0;
    protected debouncedRenderNachrichten = debounce(() => this.renderNachrichten(), 140);

    /**
     * Nachricht, die gerade abgesetzt wurde. Die Ansicht zeichnet dafür den
     * Absetzstrich; der Merker wird beim nächsten Rendern verbraucht.
     */
    protected zuletztAbgesetzt: number | null = null;
    protected xZeitInterval: ReturnType<typeof setInterval> | null = null;
    protected db: Firestore;
    protected liveStatus: LiveStatusService | null = null;
    /** Bestätigungen der Übungsleitung, Key = `${funkrufname}__${nachrichtenNr}`. */
    protected leitungBestaetigungen: Record<string, LeitungBestaetigung> = {};
    /** Verbindliche X-Zeit-Basis der Übungsleitung, sobald sie eine gesetzt hat. */
    protected leitungXZeitBasis: string | null = null;
    protected disposeListener: (() => void) | null = null;
    /** Welche Sprüche nur auf diesem Gerät geändert sind (nur mit Live-Sync). */
    protected zustellung: ZustellVerfolgung | null = null;
    /**
     * Im Vordruck bei „ausblenden“: eben abgesetzte Sprüche bleiben sichtbar,
     * bis weitergeblättert wird. Sonst rückte der nächste Spruch mit seinem
     * Abhak-Knopf an dieselbe Stelle.
     */
    protected vordruckGehalten = new Set<number>();

    constructor(db: Firestore) {
        this.view = new TeilnehmerView();
        this.firebaseService = new FirebaseService(db);
        this.db = db;
    }

    /** Meldet den aktuellen lokalen Stand an die Übungsleitung. */
    protected publishStatus(): void {
        if (!this.liveStatus?.enabled || !this.storage || !this.teilnehmerId) {
            return;
        }
        this.liveStatus.publishTeilnehmerStatus(toTeilnehmerLiveDoc(this.storage, this.teilnehmerId));
    }

    protected renderNachrichten() {
        if (!this.uebung || !this.storage || !this.teilnehmerName) {
            return;
        }
        const nachrichten = this.uebung.nachrichten[this.teilnehmerName] || [];
        // Einmalig: die Quittung gehört zum auslösenden Rendern, nicht zum
        // nächsten Tastendruck im Suchfeld.
        const zuletztAbgesetzt = this.zuletztAbgesetzt;
        this.zuletztAbgesetzt = null;
        this.view.renderNachrichten(nachrichten, this.storage, {
            showXZeit: this.uebung.spielModus === "xZeit",
            ...(this.storage.xZeitBasis ? { xZeitBasis: this.storage.xZeitBasis } : {}),
            bestaetigungen: this.getEigeneBestaetigungen(),
            ...(zuletztAbgesetzt !== null ? { zuletztAbgesetzt } : {}),
            ...(this.zustellung ? { nurLokal: this.zustellung.nurLokal } : {}),
            syncZustand: this.liveStatus?.enabled ? this.liveStatus.getState() : "aus"
        });
    }

    /** Bestätigungen der Leitung, umgeschlüsselt auf die eigene Nachrichten-ID. */
    private getEigeneBestaetigungen(): Record<string, LeitungBestaetigung> {
        if (!this.teilnehmerName) {
            return {};
        }
        const prefix = `${this.teilnehmerName}__`;
        return Object.entries(this.leitungBestaetigungen).reduce<Record<string, LeitungBestaetigung>>(
            (acc, [key, value]) => {
                if (key.startsWith(prefix) && value.abgesetztUm) {
                    acc[key.slice(prefix.length)] = value;
                }
                return acc;
            },
            {}
        );
    }

    protected startXZeitTicker(): void {
        this.stopXZeitTicker();
        this.xZeitInterval = setInterval(() => {
            if (!this.uebung || !this.storage || !this.teilnehmerName || !this.storage.xZeitBasis) {
                return;
            }
            const nachrichten = this.uebung.nachrichten[this.teilnehmerName] || [];
            this.view.updateXZeitCountdown(nachrichten, this.storage, this.storage.xZeitBasis);
        }, 1000);
    }

    protected stopXZeitTicker(): void {
        if (this.xZeitInterval !== null) {
            clearInterval(this.xZeitInterval);
            this.xZeitInterval = null;
        }
    }

    /**
     * Setzt den Übertragungsstatus. Ein Zurücksetzen wird als `uebertragen: false`
     * gespeichert statt gelöscht, damit der Live-Sync es nicht durch ein älteres
     * Remote-Dokument wieder überschreibt.
     */
    protected setUebertragen(id: number, uebertragen: boolean): void {
        if (!this.storage) {
            return;
        }
        // Nur das Absetzen bekommt eine Quittung; das Zurücknehmen ist eine
        // Korrektur und keine Meldung, die durchs Netz geht.
        this.zuletztAbgesetzt = uebertragen ? id : null;
        const now = new Date().toISOString();
        this.storage.nachrichten[id] = uebertragen
            ? { uebertragen: true, uebertragenUm: now, geaendertUm: now }
            : { uebertragen: false, geaendertUm: now };
        saveTeilnehmerStorage(this.storage);
        this.zustellung?.merke(id);
        this.publishStatus();
    }

    protected getVisibleNachrichten(): Nachricht[] {
        if (!this.uebung || !this.storage || !this.teilnehmerName) {
            return [];
        }
        const all = this.uebung.nachrichten[this.teilnehmerName] || [];
        if (!this.storage.hideTransmitted) {
            return all;
        }
        return all.filter(n => !this.storage?.nachrichten[n.id]?.uebertragen || this.vordruckGehalten.has(n.id));
    }

    protected getDocTotalPages(): number {
        if (!this.uebung || !this.teilnehmerName) {
            return 1;
        }
        const visible = this.getVisibleNachrichten();
        return Math.max(1, visible.length);
    }

    protected buildPreviewUebung(): FunkUebung | null {
        if (!this.uebung || !this.teilnehmerName) {
            return null;
        }
        const visible = this.getVisibleNachrichten();
        const preview = { ...this.uebung } as FunkUebung;
        preview.nachrichten = { ...this.uebung.nachrichten, [this.teilnehmerName]: visible };
        return preview;
    }

    protected invalidateDocCache() {
        this.preloadToken += 1;
        this.docBlobInFlight.clear();
        this.docBlobCache.clear();
    }

    protected revokeDocUrl() {
        if (this.currentDocUrl) {
            URL.revokeObjectURL(this.currentDocUrl);
            this.currentDocUrl = null;
        }
    }

    protected async getDocBlob(previewUebung: FunkUebung, mode: DocMode, page: number): Promise<Blob> {
        const modeCache = this.docBlobCache.get(mode) ?? new Map<number, Blob>();
        this.docBlobCache.set(mode, modeCache);
        const cached = modeCache.get(page);
        if (cached) {
            return cached;
        }
        const pdfGenerator = await ladePdfGenerator();
        const blob = mode === "meldevordruck"
            ? await pdfGenerator.generateMeldevordruckPageBlob({
                funkUebung: previewUebung,
                teilnehmer: this.teilnehmerName as string,
                page
            })
            : await pdfGenerator.generateNachrichtenvordruckPageBlob({
                funkUebung: previewUebung,
                teilnehmer: this.teilnehmerName as string,
                page
            });
        modeCache.set(page, blob);
        return blob;
    }
}
