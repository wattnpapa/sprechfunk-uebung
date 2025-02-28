export class FunkUebung {
    constructor() {
        
        this.datum = new Date();
        this.name = "Sprechfunkübung Blauer Wind 2025";
        this.rufgruppe = "T_OL_GOLD-1";
        this.leitung = "Heros Wind 10";

        this.spruecheProTeilnehmer = 10;
        this.spruecheAnAlle = 3;
        this.spruecheAnMehrere = 2;

        this.loesungswoerter = {};

        this.teilnehmerListe = [
            "Heros Oldenburg 16/11",
            "Heros Oldenburg 17/12",
            "Heros Oldenburg 18/13",
            "Heros Jever 21/10",
            "Heros Leer 21/10",
            "Heros Emden 21/10",
            "Heros Wilhemshaven 21/10"
        ];

        this.htmlSeitenTeilnehmer = [];

        this.checksumme = "";
    }
}