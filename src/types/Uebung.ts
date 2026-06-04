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
    istStandardKonfiguration?: boolean;
    spielModus?: "klassisch" | "xZeit";
    xZeitIntervallMinuten?: number;
    xZeitStartOffsetMinuten?: number;
}
