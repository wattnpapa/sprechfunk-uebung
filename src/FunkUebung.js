export class FunkUebung {
    constructor() {
        
        this.datum = new Date();
        this.name = "Sprechfunkübung Blauer Wind 2025";
        this.rufgruppe = "T_OL_GOLD-1";
        this.leitung = "Heros Wind 10";

        this.funksprueche = [];

        this.nachrichten = [];

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

    updateChecksum() {
        const data = JSON.stringify({
            datum: this.datum,
            name: this.name,
            rufgruppe: this.rufgruppe,
            leitung: this.leitung,
            funksprueche: this.funksprueche,
            spruecheProTeilnehmer: this.spruecheProTeilnehmer,
            spruecheAnAlle: this.spruecheAnAlle,
            spruecheAnMehrere: this.spruecheAnMehrere,
            loesungswoerter: this.loesungswoerter,
            teilnehmerListe: this.teilnehmerListe,
            htmlSeitenTeilnehmer: this.htmlSeitenTeilnehmer
        });

        this.checksumme = md5(data);
    }

    erstelle() {
        this.teilnehmerListe.map(teilnehmer => {
            this.nachrichten[teilnehmer] = this.generiereNachrichten(teilnehmer);
        });
    }

    generiereNachrichten(teilnehmer) {
        let gemischteFunksprueche = [...this.funksprueche].sort(() => 0.5 - Math.random());
        let nachrichtenVerteilung = this.verteileNachrichten(this.spruecheProTeilnehmer, this.spruecheAnAlle, this.spruecheAnMehrere);

        let nachrichten = [];

        // Erste Nachricht: Anmeldung
        nachrichten.push({
            id: 1,
            nachricht: "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.",
            empfaenger: [this.leitung]
        });

        for (let i = 0; i < this.spruecheProTeilnehmer; i++) {
            let nachricht = {};
            nachricht.id = i + 2;
            nachricht.nachricht = gemischteFunksprueche[i];

            if (nachrichtenVerteilung.alle.includes(i)) {
                nachricht.empfaenger = ["Alle"];
            } else if (nachrichtenVerteilung.mehrere.includes(i)) {
                nachricht.empfaenger = this.getRandomSubsetOfOthers(this.teilnehmerListe, teilnehmer);
            } else {
                nachricht.empfaenger = [this.getRandomOther(this.teilnehmerListe, teilnehmer)];
            }
            
            nachrichten.push(nachricht);
        }

        return nachrichten;
    }

     /**
     * Gibt eine zufällige Liste anderer Teilnehmer zurück (mind. 2).
     * 
     * @param {string[]} teilnehmerListe - Gesamte Teilnehmerliste
     * @param {string} aktuellerTeilnehmer - Der Teilnehmer, der "sich selbst" nicht erhalten darf
     * @returns {string[]} Zufälliges Teil-Array (mindestens 2 Teilnehmer)
     */
     getRandomSubsetOfOthers(teilnehmerListe, aktuellerTeilnehmer) {
        // 1) Filter: Wer ist "nicht ich"?
        const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);
        const gesamtTeilnehmer = andere.length;

        // 2) Durchmischen
        const gemischt = [...andere].sort(() => Math.random() - 0.5);

        // 3) Gewichtete Wahrscheinlichkeitsverteilung für Gruppengröße
        const minGroesse = 2;
        const maxGroesse = gesamtTeilnehmer;

        // Berechnung einer zufälligen Größe mit einer gewichteten Verteilung:
        // Wahrscheinlichkeit für kleine Gruppen ist höher, größere Gruppen sind seltener.
        let zufallsGroesse;

        if (Math.random() < 0.7) {
            // 70% Wahrscheinlichkeit für eine Gruppe bis maximal Hälfte der Teilnehmer
            zufallsGroesse = Math.floor(Math.random() * (Math.ceil(gesamtTeilnehmer / 2) - minGroesse + 1)) + minGroesse;
        } else {
            // 30% Wahrscheinlichkeit für eine größere Gruppe bis zur gesamten Liste
            zufallsGroesse = Math.floor(Math.random() * (maxGroesse - minGroesse + 1)) + minGroesse;
        }

        // 4) Den „vorderen“ Teil (z. B. 2, 3, …) zurückgeben
        return gemischt.slice(0, zufallsGroesse);
    }

    /**
     * Gibt einen zufälligen "anderen" Teilnehmer zurück.
     *
     * @param {string[]} teilnehmerListe     - Gesamte Liste aller Teilnehmer
     * @param {string} aktuellerTeilnehmer   - Der Teilnehmer, der sich selbst nicht enthalten darf
     * @returns {string} Ein zufälliger anderer Teilnehmer
     */
    getRandomOther(teilnehmerListe, aktuellerTeilnehmer) {
        // 1) Filter: Wer ist "nicht ich"?
        const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);

        // 2) Zufälligen Index bestimmen
        const randomIndex = Math.floor(Math.random() * andere.length);

        // 3) Zurückgeben
        return andere[randomIndex];
    }

    /**
     * Verteilt zufällig Nachrichten an "ALLE" und "MEHRERE", ohne Überschneidung.
     *
     * @param {number} totalMessages - Gesamtanzahl verfügbarer Nachrichten (z.B. 0..totalMessages-1)
     * @param {number} anzahlAlle    - Wie viele Nachrichten sollen an "ALLE" gehen?
     * @param {number} anzahlMehrere - Wie viele Nachrichten sollen an "MEHRERE" gehen?
     *
     * @returns {{ alle: number[], mehrere: number[] }}
     *    - `alle`: Array mit den Nachrichtennummern, die an "ALLE" gehen
     *    - `mehrere`: Array mit den Nachrichtennummern, die an "MEHRERE" gehen
     */
    verteileNachrichten(totalMessages, anzahlAlle, anzahlMehrere) {
        // 1) Validierung: Reicht die Gesamtanzahl für die gewünschten Mengen aus?
        if (anzahlAlle + anzahlMehrere > totalMessages) {
            throw new Error(
                "Die gewünschte Anzahl für 'ALLE' und 'MEHRERE' übersteigt die Gesamtanzahl an Nachrichten."
            );
        }


        // 2) Array aller möglichen Nachrichtennummern (0, 1, 2, ..., totalMessages - 1)
        const alleNachrichten = [...Array(Number(totalMessages)).keys()];

        // 3) Zufällig mischen
        alleNachrichten.sort(() => Math.random() - 0.5);
        alleNachrichten.sort(() => Math.random() - 0.5);
        alleNachrichten.sort(() => Math.random() - 0.5);

        // 4) Aufteilen in "ALLE" und "MEHRERE", ohne Überschneidung
        const nachrichtenFuerAlle = alleNachrichten.slice(0, anzahlAlle);
        const nachrichtenFuerMehrere = alleNachrichten.slice(anzahlAlle, anzahlAlle + anzahlMehrere);
        const nachrichtenEinfach = alleNachrichten.slice(anzahlAlle + anzahlMehrere);

        return {
            alle: nachrichtenFuerAlle,
            mehrere: nachrichtenFuerMehrere,
            einfach: nachrichtenEinfach
        };
    }

}