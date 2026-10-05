import type { FunkUebung } from "../models/FunkUebung";
import type { FirebaseService } from "../services/FirebaseService";
import { buildTeilnehmerFortschritt, type TeilnehmerFortschritt } from "../services/liveStatusMerge";
import type { TeilnehmerLiveDoc } from "../types/LiveStatus";
import type { UebungsleitungStorage } from "../types/Storage";
import type { EffektiverStatus } from "./auswertung";
import { anmeldeNachrichtKey, anmeldeZustand, type AnmeldeZustand } from "./lagebild";

/** Fortschritt je Teilnehmer aus Live-Meldungen und Bestätigungen der Leitung. */
export function buildFortschritt(
    uebung: FunkUebung,
    storage: UebungsleitungStorage | null,
    liveDocs: TeilnehmerLiveDoc[]
): Record<string, TeilnehmerFortschritt> {
    const nachrichtenProTeilnehmer = Object.entries(uebung.nachrichten ?? {})
        .reduce<Record<string, number>>((acc, [sender, msgs]) => {
            acc[sender] = msgs.length;
            return acc;
        }, {});
    return buildTeilnehmerFortschritt(
        uebung.teilnehmerListe ?? [],
        nachrichtenProTeilnehmer,
        liveDocs,
        storage?.nachrichten ?? {}
    );
}

/** Anmeldung je Teilnehmer – aus Tabelle, Anmelde-Funkspruch oder Selbstmeldung. */
export function buildAnmeldungen(
    uebung: FunkUebung,
    storage: UebungsleitungStorage,
    effektiv: EffektiverStatus
): Record<string, AnmeldeZustand> {
    return (uebung.teilnehmerListe ?? []).reduce<Record<string, AnmeldeZustand>>((acc, name) => {
        const key = anmeldeNachrichtKey(uebung, name);
        acc[name] = anmeldeZustand(storage.teilnehmer[name], key ? effektiv[key] : undefined);
        return acc;
    }, {});
}

export type LadeErgebnis =
    | { uebungId: string; uebung: FunkUebung }
    | { fehler: string; uebungId?: string };

/** Lädt die Übung aus dem Link; bei Fehlern eine Meldung mit Weiter-Weg statt leerer Karten. */
export async function ladeUebung(firebaseService: FirebaseService, uebungId: string | null): Promise<LadeErgebnis> {
    if (!uebungId) {
        return { fehler: "Im Link fehlt die Übungs-ID. Öffne die Übungsleitung über den Link aus dem Generator oder über die Liste der gespeicherten Übungen." };
    }
    let uebung: FunkUebung | null;
    try {
        uebung = await firebaseService.getUebung(uebungId);
    } catch (error) {
        console.error("Übung konnte nicht geladen werden", error);
        return {
            fehler: "Die Übung konnte nicht geladen werden – vermutlich gibt es gerade keine Verbindung. Prüfe das Netz und lade die Seite neu. Der ausgedruckte Nachrichtenplan bleibt die Rückfallebene.",
            uebungId
        };
    }
    if (!uebung) {
        return {
            fehler: "Übung nicht gefunden. Prüfe den Link – vielleicht ist er abgeschnitten, vertippt oder die Übung wurde gelöscht.",
            uebungId
        };
    }
    return { uebungId, uebung };
}
