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
        /*this.teilnehmerListe.map(teilnehmer => {
            this.nachrichten[teilnehmer] = this.generiereNachrichten(teilnehmer);
        });*/

        this.nachrichten = this.verteileNachrichtenFair();
    }

    verteileNachrichtenFair() {
        let totalTeilnehmer = this.teilnehmerListe.length;
        let totalMessages = this.spruecheProTeilnehmer * totalTeilnehmer; // Gesamtanzahl inkl. Anmeldung
        let anzahlAnmeldung = totalTeilnehmer; // Jede Anmeldung wird als Nachricht gezählt
        let anzahlAlle = Math.floor(this.spruecheAnAlle * totalTeilnehmer);
        let anzahlMehrere = Math.floor(this.spruecheAnMehrere * totalTeilnehmer);
        let anzahlEinfach = totalMessages - anzahlAnmeldung - anzahlAlle - anzahlMehrere;
    
        let nachrichtenVerteilung = {};
        let empfangsZaehler = {}; // Zählt, wie viele Nachrichten jeder Teilnehmer bekommt
        let letzteEmpfaenger = {}; // Speichert die letzten Empfänger pro Sender (Blacklist)
        let alleNachrichten = []; // Speichert alle Nachrichten für das Mischen
    
        // **Initialisiere die Zähler und Blacklist**
        this.teilnehmerListe.forEach(teilnehmer => {
            nachrichtenVerteilung[teilnehmer] = [];
            empfangsZaehler[teilnehmer] = 0;
            letzteEmpfaenger[teilnehmer] = new Set(); // Letzte Empfänger speichern
        });
    
        let gemischteTeilnehmer = [...this.teilnehmerListe].sort(() => Math.random() - 0.5);
    
        // 1️⃣ **Anmeldung zur Übungsleitung als erste Nachricht**
        this.teilnehmerListe.forEach(teilnehmer => {
            nachrichtenVerteilung[teilnehmer].push({
                id: 1,
                nachricht: "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.",
                empfaenger: [this.leitung]
            });
        });
    
        // **Initiale Nachrichtenzählung für ID-Vergabe**
        let nachrichtenIDs = {};
        this.teilnehmerListe.forEach(teilnehmer => nachrichtenIDs[teilnehmer] = 2);
    
        // 2️⃣ **Nachrichten an "Alle" verteilen**
        for (let i = 0; i < anzahlAlle; i++) {
            let sender = gemischteTeilnehmer[i % totalTeilnehmer];
            let nachricht = {
                id: nachrichtenIDs[sender]++,
                nachricht: this.funksprueche[i % this.funksprueche.length],
                empfaenger: ["Alle"]
            };
    
            alleNachrichten.push({ sender, nachricht });
    
            // Erhöhe die Empfangszähler für alle außer dem Sender
            this.teilnehmerListe.forEach(t => {
                if (t !== sender) empfangsZaehler[t]++;
            });
        }
    
        // 3️⃣ **Nachrichten an "Mehrere" gezielt verteilen**
        for (let i = 0; i < anzahlMehrere; i++) {
            let sender = gemischteTeilnehmer[i % totalTeilnehmer];
    
            let empfaengerGruppe = this.getFairSubsetOfOthers(this.teilnehmerListe, sender, empfangsZaehler, letzteEmpfaenger[sender]);
            empfaengerGruppe.forEach(empf => empfangsZaehler[empf]++);
    
            let nachricht = {
                id: nachrichtenIDs[sender]++,
                nachricht: this.funksprueche[(anzahlAlle + i) % this.funksprueche.length],
                empfaenger: empfaengerGruppe
            };
    
            // Update Blacklist für den Sender
            letzteEmpfaenger[sender] = new Set(empfaengerGruppe);
    
            alleNachrichten.push({ sender, nachricht });
        }
    
        // 4️⃣ **Nachrichten an Einzelne gezielt verteilen**
        for (let i = 0; i < anzahlEinfach; i++) {
            let sender = gemischteTeilnehmer[i % totalTeilnehmer];
    
            let empfaenger = this.getFairOther(this.teilnehmerListe, sender, empfangsZaehler, letzteEmpfaenger[sender]);
            empfangsZaehler[empfaenger]++;
    
            let nachricht = {
                id: nachrichtenIDs[sender]++,
                nachricht: this.funksprueche[(anzahlAlle + anzahlMehrere + i) % this.funksprueche.length],
                empfaenger: [empfaenger]
            };
    
            // Update Blacklist für den Sender
            letzteEmpfaenger[sender] = new Set([empfaenger]);
    
            alleNachrichten.push({ sender, nachricht });
        }
    
        // **🔀 Finales Mischen der Nachrichten für zufällige Reihenfolge**
        alleNachrichten = this.shuffleArray(alleNachrichten);
        alleNachrichten = this.shuffleArray(alleNachrichten);
        alleNachrichten = this.shuffleArray(alleNachrichten);
        alleNachrichten = this.shuffleArray(alleNachrichten);
        alleNachrichten = this.shuffleArray(alleNachrichten);
    
        // 5️⃣ **Anmeldungen müssen als erste Nachricht bleiben**
        this.teilnehmerListe.forEach(teilnehmer => {
            let anmeldung = nachrichtenVerteilung[teilnehmer][0]; // Die erste Nachricht ist immer die Anmeldung
            let gefilterteNachrichten = alleNachrichten.filter(n => n.sender === teilnehmer).map(n => n.nachricht);
    
            // **📌 Nach dem Mischen NEU nummerieren**
            gefilterteNachrichten.forEach((msg, index) => {
                msg.id = index + 2; // Die Anmeldung bleibt ID=1, alle anderen fangen bei 2 an
            });
    
            nachrichtenVerteilung[teilnehmer] = [anmeldung, ...gefilterteNachrichten];
        });
    
        return nachrichtenVerteilung;
    }
    
    /**
     * Mischt ein Array zufällig durch.
     */
    shuffleArray(array) {
        return array.sort(() => Math.random() - 0.5);
    }
    
    getFairSubsetOfOthers(teilnehmerListe, sender, empfangsZaehler, blacklist) {
        let andere = teilnehmerListe.filter(t => t !== sender && !blacklist.has(t));
        
        // Sortiere nach Anzahl empfangener Nachrichten, um weniger Bevorzugte zu priorisieren
        andere.sort((a, b) => empfangsZaehler[a] - empfangsZaehler[b]);
    
        // Gruppengröße zufällig auswählen, aber bevorzugt aus denjenigen mit wenig Nachrichten
        let zufallsGroesse = Math.random() < 0.8 ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * (Math.ceil(andere.length / 2) - 4));
        
        return andere.slice(0, zufallsGroesse);
    }
    
    /**
     * Wählt gezielt einen Empfänger, der noch nicht genug Nachrichten erhalten hat.
     */
    getFairOther(teilnehmerListe, sender, empfangsZaehler, blacklist) {
        let andere = teilnehmerListe.filter(t => t !== sender && !blacklist.has(t));
        
        // Sortiere nach Anzahl empfangener Nachrichten, um weniger Bevorzugte zu priorisieren
        andere.sort((a, b) => empfangsZaehler[a] - empfangsZaehler[b]);
    
        return andere.length > 0 ? andere[0] : teilnehmerListe.filter(t => t !== sender)[0]; // Notfall: Falls keine Alternative verfügbar
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
    
        // 2) Durchmischen für Zufälligkeit
        const gemischt = [...andere].sort(() => Math.random() - 0.5);
    
        // 3) Wahrscheinlichkeitsverteilung für Gruppengröße
        let zufallsGroesse;
    
        let zufallsWert = Math.random();
    
        if (zufallsWert < 0.8) {
            // 80% Wahrscheinlichkeit für eine kleine Gruppe (2 oder 3 Teilnehmer)
            zufallsGroesse = Math.floor(Math.random() * 2) + 2; // 2 oder 3
        } else if (zufallsWert < 0.9) {
            // 10% Wahrscheinlichkeit für eine mittlere Gruppe (4 bis max 50% der Teilnehmer)
            let maxHaelfte = Math.ceil(gesamtTeilnehmer / 2);
            zufallsGroesse = Math.floor(Math.random() * (maxHaelfte - 4 + 1)) + 4;
        } else if (zufallsWert < 0.95) {
            // 5% Wahrscheinlichkeit für eine große Gruppe (50-75% der Teilnehmer)
            let minFiftyPercent = Math.ceil(gesamtTeilnehmer * 0.5);
            let maxSeventyFivePercent = Math.ceil(gesamtTeilnehmer * 0.75);
            zufallsGroesse = Math.floor(Math.random() * (maxSeventyFivePercent - minFiftyPercent + 1)) + minFiftyPercent;
        } else {
            // 5% Wahrscheinlichkeit für eine sehr große Gruppe (maximal 85% der Teilnehmer, aber nie alle)
            let maxAchtzigFuenfPercent = Math.ceil(gesamtTeilnehmer * 0.85);
            zufallsGroesse = Math.floor(Math.random() * (maxAchtzigFuenfPercent - gesamtTeilnehmer + 1)) + gesamtTeilnehmer;
        }
    
        // Sicherstellen, dass die Größe innerhalb des gültigen Bereichs liegt
        zufallsGroesse = Math.min(zufallsGroesse, gesamtTeilnehmer);
    
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