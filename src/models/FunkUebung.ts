import { v4 as uuidv4 } from "uuid";
import { NAMENS_POOL } from "../data/namen-funkuebungen";
import type { Uebung } from "../types/Uebung";
import type { Nachricht } from "../types/Nachricht";
import CryptoJS from "crypto-js";

export class FunkUebung implements Uebung {

    id: string;
    autoStaerkeErgaenzen = true;
    name: string;
    datum: Date;
    buildVersion: string;
    leitung: string;
    rufgruppe: string;
    teilnehmerListe: string[];
    teilnehmerIds: Record<string, string>;
    teilnehmerStellen?: Record<string, string>;
    nachrichten: Record<string, Nachricht[]>;
    createDate: Date;
    spruecheProTeilnehmer: number;
    spruecheAnAlle: number;
    spruecheAnMehrere: number;
    buchstabierenAn: number;
    loesungswoerter: Record<string, string>;
    loesungsStaerken: Record<string, string>;
    checksumme: string;
    funksprueche: string[];
    anmeldungAktiv = true;
    verwendeteVorlagen?: string[];

    constructor(buildVersion: string) {
        this.id = uuidv4();

        this.createDate = new Date();

        const jahr = new Date().getFullYear();
        const zufallsName = `${NAMENS_POOL[Math.floor(Math.random() * NAMENS_POOL.length)]} ${jahr}`;
        this.name = `Sprechfunkübung ${zufallsName}`;

        this.rufgruppe = "T_OL_GOLD-1";
        this.leitung = "Heros Wind 10";
        this.buildVersion = buildVersion;
        this.datum = new Date();

        this.nachrichten = {};

        this.spruecheProTeilnehmer = 10;
        this.spruecheAnAlle = 1;
        this.spruecheAnMehrere = 3;
        this.buchstabierenAn = 5;

        this.loesungswoerter = {};
        this.loesungsStaerken = {};

        this.teilnehmerListe = [
            "Heros Oldenburg 16/11",
            "Heros Oldenburg 17/12",
            "Heros Oldenburg 18/13",
            "Heros Jever 21/10",
            "Heros Leer 21/10",
            "Heros Emden 21/10",
            "Heros Wilhemshaven 21/10"
        ];

        this.checksumme = "";
        this.funksprueche = [];
        this.anmeldungAktiv = true;
        this.teilnehmerIds = {};
    }

    updateChecksum() {
        const data = JSON.stringify({
            datum: this.datum,
            name: this.name,
            rufgruppe: this.rufgruppe,
            leitung: this.leitung,
            spruecheProTeilnehmer: this.spruecheProTeilnehmer,
            spruecheAnAlle: this.spruecheAnAlle,
            spruecheAnMehrere: this.spruecheAnMehrere,
            buchstabierenAn: this.buchstabierenAn,
            loesungswoerter: this.loesungswoerter,
            teilnehmerListe: this.teilnehmerListe,
            teilnehmerIds: this.teilnehmerIds,
            nachrichten: this.nachrichten
        });

        this.checksumme = CryptoJS.MD5(data).toString();
    }

    toJson() {
        this.updateChecksum();
        return JSON.stringify({
            id: this.id,
            checksumme: this.checksumme,
            createDate: this.createDate,
            name: this.name,
            datum: this.datum,
            rufgruppe: this.rufgruppe,
            leitung: this.leitung,
            buildVersion: this.buildVersion,
            teilnehmerListe: this.teilnehmerListe,
            teilnehmerIds: this.teilnehmerIds,
            teilnehmerStellen: this.teilnehmerStellen,
            nachrichten: this.nachrichten,
            loesungswoerter: this.loesungswoerter,
            loesungsStaerken: this.loesungsStaerken,
            spruecheProTeilnehmer: this.spruecheProTeilnehmer,
            spruecheAnAlle: this.spruecheAnAlle,
            spruecheAnMehrere: this.spruecheAnMehrere,
            buchstabierenAn: this.buchstabierenAn,
            anmeldungAktiv: this.anmeldungAktiv,
            verwendeteVorlagen: this.verwendeteVorlagen
        }, null, 2); // Pretty Print
    }
}
