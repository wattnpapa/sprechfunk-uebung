import type { Nachricht } from "./Nachricht";

export interface Uebung {
    id: string;
    uebungCode?: string;
    name: string;
    datum: Date;
    buildVersion: string;
    leitung: string;
    rufgruppe: string;
    teilnehmerListe: string[];
    /**
   * Mapping von kryptischer ID auf Teilnehmer-Funkrufname.
   */
    teilnehmerIds?: Record<string, string>;
    nachrichten: Record<string, Nachricht[]>;
    createDate: Date;
    loesungswoerter?: Record<string, string>;
    loesungsStaerken?: Record<string, string>;
    verwendeteVorlagen?: string[];
    /**
   * Optional: Mapping von Teilnehmer-Funkrufnamen auf Stellenname.
   * Optional für Rückwärtskompatibilität.
   */
    teilnehmerStellen?: Record<string, string>;
    spruecheProTeilnehmer: number;
    spruecheAnAlle: number;
    spruecheAnMehrere: number;
    buchstabierenAn: number;
    checksumme: string;
    funksprueche: string[];
    anmeldungAktiv: boolean;
    /**
   * Startwert des Zufallsgenerators. Derselbe Seed erzeugt bei gleichen
   * Eingaben (Teilnehmer, Vorlagen, Einstellungen) exakt dieselbe Übung.
   * Optional für Rückwärtskompatibilität mit älteren Übungen.
   */
    seed?: string;
    istStandardKonfiguration?: boolean;
    /**
   * Kennzeichnet je Nachricht, ob sie als Spruch oder Durchsage abzusetzen ist.
   * Bewusst opt-in: viele Übungen trainieren die Unterscheidung nicht.
   */
    nachrichtenArtAktiv?: boolean;
    /**
   * Anteil der Sprüche unter den Nachrichten, deren Art nicht schon durch den
   * Inhalt festgelegt ist. Nur wirksam bei `nachrichtenArtAktiv`.
   */
    spruchAnteilProzent?: number;
    spielModus?: "klassisch" | "xZeit";
    xZeitIntervallMinuten?: number;
    xZeitStartOffsetMinuten?: number;
}
