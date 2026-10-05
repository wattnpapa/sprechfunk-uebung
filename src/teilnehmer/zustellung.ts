import type { LiveSyncState } from "../types/LiveStatus";
import type { ZustellInfo } from "./ansichtHelfer";
import { formatUhrzeit } from "./teilnehmerFormat";

const PREFIX = "sprechfunk:teilnehmer-zustellung";

interface GespeicherterStand {
    offen: number[];
    bestaetigtUm?: string;
}

/** Schlüssel je Übung und Teilnehmer, getrennt vom Abhak-Stand. */
export function zustellSchluessel(uebungId: string, teilnehmer: string): string {
    return `${PREFIX}:${uebungId}:${teilnehmer}`;
}

function lese(schluessel: string): GespeicherterStand {
    try {
        const raw = globalThis.localStorage?.getItem(schluessel);
        if (!raw) {
            return { offen: [] };
        }
        const daten = JSON.parse(raw) as Partial<GespeicherterStand>;
        const stand: GespeicherterStand = {
            offen: Array.isArray(daten.offen) ? daten.offen.filter(id => Number.isFinite(id)) : []
        };
        if (typeof daten.bestaetigtUm === "string") {
            stand.bestaetigtUm = daten.bestaetigtUm;
        }
        return stand;
    } catch {
        return { offen: [] };
    }
}

/**
 * Merkt sich, welche Sprüche nur auf diesem Gerät geändert sind, bis der
 * Server den Stand bestätigt hat, und wann zuletzt alles angekommen war.
 *
 * Die Anzeige je Karte („nur auf diesem Gerät“) und die Zahl im Kopf hängen
 * daran (field-user P2, offline-resilience P2-2, analog-first P3-4,
 * 2026-10-05). Der Stand überlebt ein Neuladen ohne Netz. Er ist reine
 * Anzeige dieses Geräts und geht nicht an Firestore.
 *
 * Bestätigt ist alles, sobald die Verbindung „live“ ist und der Live-Sync
 * keinen unbestätigten Schreibvorgang mehr kennt
 * (`LiveStatusService.getOffeneAenderungen() === 0`).
 */
export class ZustellVerfolgung {
    private readonly offen: Set<number>;
    private bestaetigtUm: string | undefined;

    constructor(private readonly schluessel: string) {
        const stand = lese(schluessel);
        this.offen = new Set(stand.offen);
        this.bestaetigtUm = stand.bestaetigtUm;
    }

    /** Ein Spruch wurde auf diesem Gerät geändert. */
    public merke(id: number): void {
        this.offen.add(id);
        this.speichere();
    }

    /**
     * Gleicht mit dem Live-Sync ab.
     *
     * @returns true, wenn sich die Menge der lokalen Sprüche geändert hat
     *          (die Karten müssen neu gezeichnet werden).
     */
    public pruefe(state: LiveSyncState, offeneSchreibvorgaenge: number, jetzt = new Date()): boolean {
        if (state !== "live" || offeneSchreibvorgaenge > 0) {
            return false;
        }
        const hatteOffene = this.offen.size > 0;
        if (!hatteOffene && this.bestaetigtUm) {
            return false;
        }
        this.offen.clear();
        this.bestaetigtUm = jetzt.toISOString();
        this.speichere();
        return hatteOffene;
    }

    public get nurLokal(): ReadonlySet<number> {
        return this.offen;
    }

    public info(): ZustellInfo {
        return { offen: this.offen.size, bestaetigtUm: formatUhrzeit(this.bestaetigtUm) };
    }

    /** Beim Zurücksetzen des Abhak-Stands. */
    public leeren(): void {
        this.offen.clear();
        try {
            globalThis.localStorage?.removeItem(this.schluessel);
        } catch {
            // Speicher gesperrt (privates Fenster): nur die Anzeige ist betroffen.
        }
    }

    private speichere(): void {
        const stand: GespeicherterStand = { offen: Array.from(this.offen) };
        if (this.bestaetigtUm) {
            stand.bestaetigtUm = this.bestaetigtUm;
        }
        try {
            globalThis.localStorage?.setItem(this.schluessel, JSON.stringify(stand));
        } catch {
            // Speicher gesperrt (privates Fenster): nur die Anzeige ist betroffen.
        }
    }
}
