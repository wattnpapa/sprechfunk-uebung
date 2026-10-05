import type { EffektiverNachrichtenStatus } from "../services/liveStatusMerge";
import type { NachrichtArt } from "../types/Nachricht";
import type { Meldeart, UebermittlungsWeg } from "../types/FuehrungsstellenUebung";
import type { Faelligkeit } from "./lagebild";

export interface FlattenedNachricht {
    nr: number;
    sender: string;
    empfaenger: string[];
    text: string;
    xZeitSlot?: number;
    art?: NachrichtArt;
    /** Position in der Erzählreihenfolge einer Szenario-Übung. */
    szenarioNr?: number;
    /** Fortlaufende, eindeutige Nummer im Nachrichtenplan (1 … n). */
    planNr?: number;
    /** Führungsstellen-Übung: Weg, Meldeart, Betreff und erwartete Reaktion der beübten Stelle. */
    weg?: UebermittlungsWeg;
    meldeart?: Meldeart;
    betreff?: string;
    erwartung?: string;
}

export interface HeatmapBin {
    bucket: number;
    count: number;
}

export interface TimelineEvent {
    ts: number;
    type: "S" | "E";
    nr: number;
}

export interface TeilnehmerTimeline {
    teilnehmer: string;
    events: TimelineEvent[];
}

export type NachrichtenCallbacks = {
    onAbgesetzt: (sender: string, nr: number) => void;
    onReset: (sender: string, nr: number) => void;
    onZeitNachtragen?: (sender: string, nr: number, hhmm: string) => void;
    onNotiz: (sender: string, nr: number, val: string) => void;
    onFilterSender: (val: string) => void;
    onFilterEmpfaenger: (val: string) => void;
    onToggleHide: (val: boolean) => void;
    onFilterText: (val: string) => void;
};

export interface NachrichtenRenderOptionen {
    nachrichten: FlattenedNachricht[];
    nachrichtenStatus: Record<string, EffektiverNachrichtenStatus>;
    hideAbgesetzt: boolean;
    senderFilter: string;
    empfaengerFilter: string;
    textFilter: string;
    /** Fälligkeit je offener Zeile (X-Zeit mit verbindlicher Basis). */
    faelligkeit?: Record<string, Faelligkeit>;
    /** Soll-Uhrzeit „HH:MM“ je Zeile (X-Zeit mit verbindlicher Basis). */
    sollUhrzeit?: Record<string, string>;
    /** Zeilen, deren Rücknahme direkt nach dem Markieren noch gesperrt ist. */
    ruecknahmeGesperrt?: Set<string>;
}
