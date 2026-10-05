import type { Firestore } from "firebase/firestore";
import { LiveStatusService } from "../services/LiveStatusService";
import {
    LIVE_STATUS_VERSION,
    type LeitungLiveDoc,
    type LeitungPublicLiveDoc,
    type TeilnehmerLiveDoc
} from "../types/LiveStatus";
import type { Nachricht } from "../types/Nachricht";

/**
 * Setzt den Live-Status einer Übung zurück, nachdem sie bewusst
 * überschrieben wurde.
 *
 * Status, Anmeldungen und Notizen hängen an Nachrichtennummern. Nach dem
 * Überschreiben stehen unter denselben Nummern andere Funksprüche, die
 * Übungsleitung zeigte also abgesetzte Sprüche, die nie gefunkt wurden
 * (THW-Review 2026-10-05, destructive-action P2-1, workflow W3).
 *
 * Geschrieben werden Zurücksetz-Marker mit aktuellem Zeitstempel, wie beim
 * „Übungsstand für alle zurücksetzen“ der Übungsleitung: Ein leeres Dokument
 * gewänne den Last-Write-Wins-Merge auf den Geräten nicht. Abgedeckt sind die
 * Nachrichten der alten und der neuen Fassung, damit auch Nummern, die es
 * nur in einer von beiden gibt, sauber zurückgesetzt sind. Die Teilnehmer-
 * Dokumente bekommen ebenfalls Marker, sonst bliebe „gemeldet (TN)“ stehen.
 *
 * Die X-Zeit-Basis wird nicht angefasst: Sie ist eine Uhrzeit, kein Stand.
 */

export interface UebungsStand {
    teilnehmerListe: string[];
    teilnehmerIds?: Record<string, string>;
    nachrichten: Record<string, Nachricht[]>;
}

export interface ZuruecksetzDokumente {
    leitungPublic: LeitungPublicLiveDoc;
    leitung: LeitungLiveDoc;
    teilnehmer: TeilnehmerLiveDoc[];
}

/** Wartezeit auf die Bestätigung des Servers. */
export const ZURUECKSETZEN_BESTAETIGUNG_MS = 10000;

function nachrichtenIds(stand: UebungsStand, sender: string): number[] {
    return (stand.nachrichten?.[sender] ?? []).map(n => n.id);
}

function alleSender(alt: UebungsStand, neu: UebungsStand): string[] {
    return [...new Set([
        ...alt.teilnehmerListe, ...Object.keys(alt.nachrichten ?? {}),
        ...neu.teilnehmerListe, ...Object.keys(neu.nachrichten ?? {})
    ])].filter(name => name !== "");
}

function teilnehmerDokumente(alt: UebungsStand, neu: UebungsStand, jetzt: string): TeilnehmerLiveDoc[] {
    const codes = { ...(alt.teilnehmerIds ?? {}), ...(neu.teilnehmerIds ?? {}) };
    return Object.entries(codes).map(([code, name]) => {
        const nachrichten: TeilnehmerLiveDoc["nachrichten"] = {};
        new Set([...nachrichtenIds(alt, name), ...nachrichtenIds(neu, name)]).forEach(id => {
            nachrichten[String(id)] = { uebertragen: false, geaendertUm: jetzt };
        });
        return { version: LIVE_STATUS_VERSION, teilnehmerId: code, teilnehmer: name, lastUpdated: jetzt, nachrichten };
    });
}

export function baueZuruecksetzDokumente(alt: UebungsStand, neu: UebungsStand, jetzt: string): ZuruecksetzDokumente {
    const sender = alleSender(alt, neu);
    const bestaetigungen: LeitungPublicLiveDoc["nachrichten"] = {};
    const notizen: LeitungLiveDoc["nachrichtenNotizen"] = {};
    sender.forEach(name => {
        new Set([...nachrichtenIds(alt, name), ...nachrichtenIds(neu, name)]).forEach(id => {
            const key = `${name}__${id}`;
            bestaetigungen[key] = { geaendertUm: jetzt };
            notizen[key] = { notiz: "", geaendertUm: jetzt };
        });
    });
    const teilnehmer: LeitungLiveDoc["teilnehmer"] = {};
    sender.forEach(name => {
        teilnehmer[name] = { geaendertUm: jetzt };
    });
    return {
        leitungPublic: { version: LIVE_STATUS_VERSION, lastUpdated: jetzt, nachrichten: bestaetigungen },
        leitung: { version: LIVE_STATUS_VERSION, lastUpdated: jetzt, teilnehmer, nachrichtenNotizen: notizen },
        teilnehmer: teilnehmerDokumente(alt, neu, jetzt)
    };
}

type LiveStatusFabrik = (db: Firestore | null, uebungId: string) => Pick<
    LiveStatusService,
    "enabled" | "publishLeitungPublic" | "publishLeitungInternal" | "publishTeilnehmerStatus" | "flush" | "dispose"
>;

const standardFabrik: LiveStatusFabrik = (db, uebungId) => new LiveStatusService(db, uebungId);

/**
 * @returns `true`, wenn der Server das Zurücksetzen bestätigt hat oder es
 *          keinen Live-Status gibt; `false`, wenn die Bestätigung ausblieb.
 *          Unbestätigte Schreibvorgänge laufen im Hintergrund weiter.
 */
export async function setzeLiveStatusZurueck(
    db: Firestore | null,
    uebungId: string,
    staende: { alt: UebungsStand; neu: UebungsStand },
    fabrik: LiveStatusFabrik = standardFabrik
): Promise<boolean> {
    const live = fabrik(db, uebungId);
    if (!live.enabled) {
        return true;
    }
    try {
        const dokumente = baueZuruecksetzDokumente(staende.alt, staende.neu, new Date().toISOString());
        live.publishLeitungPublic(dokumente.leitungPublic);
        live.publishLeitungInternal(dokumente.leitung);
        dokumente.teilnehmer.forEach(doc => live.publishTeilnehmerStatus(doc));
        return await live.flush(ZURUECKSETZEN_BESTAETIGUNG_MS);
    } catch (error) {
        console.error("Live-Status konnte nicht zurückgesetzt werden:", error);
        return false;
    } finally {
        live.dispose();
    }
}
