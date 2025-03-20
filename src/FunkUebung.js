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
        this.verteileLoesungswoerterMitIndex();
    }

    getBalancedSubsetOfOthers(teilnehmerListe, sender, empfangsZaehler, letzteEmpfaenger, empfaengerHistory) {
        let andere = teilnehmerListe.filter(t => t !== sender && !letzteEmpfaenger.has(t));
    
        // Falls alle ausgeschlossen sind, nehmen wir alle außer dem Sender
        if (andere.length === 0) {
            andere = teilnehmerListe.filter(t => t !== sender);
        }
    
        // Sortiere nach Anzahl empfangener Nachrichten, um weniger Bevorzugte zu priorisieren
        andere.sort((a, b) => empfangsZaehler[a] - empfangsZaehler[b]);
    
        // Entferne Teilnehmer, die kürzlich Empfänger waren, falls möglich
        let bevorzugteEmpfaenger = andere.filter(empf => !empfaengerHistory.includes(empf));
        if (bevorzugteEmpfaenger.length > 0) {
            andere = bevorzugteEmpfaenger;
        }
    
        // Gruppengröße basierend auf Wahrscheinlichkeiten
        let zufallsGroesse;
        let zufallsWert = Math.random();
    
        if (zufallsWert < 0.8) {
            zufallsGroesse = Math.floor(Math.random() * 2) + 2; // 2 oder 3 Teilnehmer
        } else if (zufallsWert < 0.9) {
            let maxHaelfte = Math.ceil(andere.length / 2);
            zufallsGroesse = Math.floor(Math.random() * (maxHaelfte - 4 + 1)) + 4;
        } else if (zufallsWert < 0.95) {
            let minFiftyPercent = Math.ceil(andere.length * 0.5);
            let maxSeventyFivePercent = Math.ceil(andere.length * 0.75);
            zufallsGroesse = Math.floor(Math.random() * (maxSeventyFivePercent - minFiftyPercent + 1)) + minFiftyPercent;
        } else {
            let maxAchtzigFuenfPercent = Math.ceil(andere.length * 0.85);
            zufallsGroesse = Math.floor(Math.random() * (maxAchtzigFuenfPercent - andere.length + 1)) + andere.length;
        }
    
        zufallsGroesse = Math.min(zufallsGroesse, andere.length);
    
        return andere.slice(0, zufallsGroesse);
    }
    
    getBalancedOther(teilnehmerListe, sender, empfangsZaehler, letzteEmpfaenger, empfaengerHistory) {
        let andere = teilnehmerListe.filter(t => t !== sender && !letzteEmpfaenger.has(t));
    
        // Falls keine Empfänger übrig bleiben, alle Teilnehmer außer dem Sender verwenden
        if (andere.length === 0) {
            andere = teilnehmerListe.filter(t => t !== sender);
        }
    
        // Sortiere nach Anzahl empfangener Nachrichten, um Teilnehmer mit weniger Nachrichten zu bevorzugen
        andere.sort((a, b) => empfangsZaehler[a] - empfangsZaehler[b]);
    
        // Entferne Teilnehmer, die kürzlich Empfänger waren, falls möglich
        let bevorzugteEmpfaenger = andere.filter(empf => !empfaengerHistory.includes(empf));
        if (bevorzugteEmpfaenger.length > 0) {
            andere = bevorzugteEmpfaenger;
        }
    
        return andere.length > 0 ? andere[0] : teilnehmerListe.find(t => t !== sender) || sender;
    }

    verteileEmpfaengerFair() {
        const totalTeilnehmer = this.teilnehmerListe.length;
        const totalEinzelNachrichten = (this.spruecheProTeilnehmer - this.spruecheAnAlle - this.spruecheAnMehrere) * totalTeilnehmer;

        const empfaengerVerteilung = {};
        const empfangsZaehler = {};
        const empfaengerHistory = [];
        const maxHistory = 2; // Verhindert, dass Teilnehmer mehrfach hintereinander Empfänger werden

        // Initialisierung
        this.teilnehmerListe.forEach(teilnehmer => {
            empfaengerVerteilung[teilnehmer] = [];
            empfangsZaehler[teilnehmer] = 0;
        });

        // Erstelle pro Sender eine Liste der noch "zu besuchenden" Empfänger
        const empfaengerToVisit = {};
        this.teilnehmerListe.forEach(sender => {
            empfaengerToVisit[sender] = this.teilnehmerListe.filter(t => t !== sender);
        });

        let versuch = 0;
        while (versuch < totalEinzelNachrichten * 3) { // Schleife mit mehreren Versuchen
            const sender = this.teilnehmerListe[versuch % totalTeilnehmer];
            let moeglicheEmpfaenger = empfaengerToVisit[sender].filter(
                empfaenger => !empfaengerHistory.includes(empfaenger)
            );

            // Wenn leer, befülle ToVisit-Liste wieder
            if (moeglicheEmpfaenger.length === 0) {
                empfaengerToVisit[sender] = this.teilnehmerListe.filter(t => t !== sender);
                moeglicheEmpfaenger = [...empfaengerToVisit[sender]];
            }

            // Sortiere nach Empfangszaehler, um schwächere Empfänger zu bevorzugen
            moeglicheEmpfaenger.sort((a, b) => empfangsZaehler[a] - empfangsZaehler[b]);

            const empfaenger = moeglicheEmpfaenger[0];
            empfaengerVerteilung[sender].push(empfaenger);
            empfangsZaehler[empfaenger]++;

            // Entferne aus der ToVisit Liste
            empfaengerToVisit[sender] = empfaengerToVisit[sender].filter(e => e !== empfaenger);

            empfaengerHistory.push(empfaenger);
            if (empfaengerHistory.length > maxHistory) empfaengerHistory.shift();

            versuch++;
        }

        return empfaengerVerteilung;
    }

    verteileNachrichtenFair() {
        let nachrichtenVerteilung = {};
        let nachrichtenIndex = 0;

        // Berechne Verteilungen
        const anAlle = this.spruecheAnAlle;
        const anMehrere = this.spruecheAnMehrere;
        const anEinzeln = this.spruecheProTeilnehmer - 1 - anAlle - anMehrere;

        // Erstelle einen Pool für alle Nachrichten
        let alleNachrichten = [];

        this.teilnehmerListe.forEach(teilnehmer => {
            nachrichtenVerteilung[teilnehmer] = [];

            // Anmeldungsnachricht
            nachrichtenVerteilung[teilnehmer].push({
                id: 1,
                nachricht: "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.",
                empfaenger: [this.leitung]
            });

            // Nachrichten an 'Alle'
            for (let i = 0; i < anAlle; i++) {
                alleNachrichten.push({
                    sender: teilnehmer,
                    nachricht: {
                        text: this.funksprueche[nachrichtenIndex++ % this.funksprueche.length],
                        empfaenger: ["Alle"]
                    }
                });
            }

            // Nachrichten an 'Mehrere'
            for (let i = 0; i < anMehrere; i++) {
                const empfaengerGruppe = this.getRandomSubsetOfOthers(this.teilnehmerListe, teilnehmer);
                alleNachrichten.push({
                    sender: teilnehmer,
                    nachricht: {
                        text: this.funksprueche[nachrichtenIndex++ % this.funksprueche.length],
                        empfaenger: empfaengerGruppe
                    }
                });
            }

            // Einzel-Nachrichten
            for (let i = 0; i < anEinzeln; i++) {
                const empfaenger = this.getRandomOther(this.teilnehmerListe, teilnehmer);
                alleNachrichten.push({
                    sender: teilnehmer,
                    nachricht: {
                        text: this.funksprueche[nachrichtenIndex++ % this.funksprueche.length],
                        empfaenger: [empfaenger]
                    }
                });
            }
        });

        // Mische alle Nachrichten
        alleNachrichten.sort(() => Math.random() - 0.5);

        // Weisen die Nachrichten wieder zu
        let tempCounters = {};
        this.teilnehmerListe.forEach(teilnehmer => tempCounters[teilnehmer] = 2);

        alleNachrichten.forEach(entry => {
            const { sender, nachricht } = entry;
            nachrichtenVerteilung[sender].push({
                id: tempCounters[sender]++,
                nachricht: nachricht.text,
                empfaenger: nachricht.empfaenger
            });
        });

        return nachrichtenVerteilung;
    }
    
    /**
     * Mischt ein Array zufällig durch.
     */
    shuffleArray(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    shuffleSmart(nachrichtenListe) {
        let maxVersuche = 100;
        let durchmischteListe = [...nachrichtenListe];
        let istGueltig = false;
    
        for (let versuch = 0; versuch < maxVersuche; versuch++) {
            durchmischteListe.sort(() => Math.random() - 0.5);
    
            istGueltig = true;
            for (let i = 1; i < durchmischteListe.length; i++) {
                let aktuelleEmpfaenger = new Set(durchmischteListe[i].nachricht.empfaenger);
                let vorherigeEmpfaenger = new Set(durchmischteListe[i - 1].nachricht.empfaenger);
    
                if ([...aktuelleEmpfaenger].some(empf => vorherigeEmpfaenger.has(empf))) {
                    istGueltig = false;
                    break;
                }
            }
    
            if (istGueltig) {
                return durchmischteListe;
            }
        }
    
        console.warn("⚠ Konnte keine perfekte Verteilung finden. Nutze beste Lösung.");
        return durchmischteListe;
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

    verteileLoesungswoerterMitIndex() {
        // Wir gehen alle Teilnehmer durch
        Object.entries(this.loesungswoerter).forEach(([empfaenger, loesungswort]) => {
            if (loesungswort && loesungswort.length > 0) {
                const buchstabenMitIndex = loesungswort
                    .split("")
                    .map((buchstabe, index) => `${index + 1}${buchstabe}`);
 
                // Finde alle Nachrichten, die an den Empfänger gerichtet sind (von verschiedenen Absendern)
                let nachrichtenFuerEmpfaenger = [];
                Object.entries(this.nachrichten).forEach(([absender, nachrichtenListe]) => {
                    if (absender !== empfaenger) {
                        nachrichtenListe.forEach(nachricht => {
                            if (nachricht.empfaenger.includes(empfaenger) && nachricht.empfaenger.length === 1) {
                                nachrichtenFuerEmpfaenger.push(nachricht);
                            }
                        });
                    }
                });
 
                // Sortiere die Nachrichten chronologisch
                nachrichtenFuerEmpfaenger.sort((a, b) => a.id - b.id);
 
                // Bevorzuge die erste Hälfte der Nachrichten
                const ersteHaelfte = nachrichtenFuerEmpfaenger.slice(0, Math.ceil(nachrichtenFuerEmpfaenger.length / 2));
 
                // Mische die Buchstaben
                buchstabenMitIndex.sort(() => Math.random() - 0.5);
 
                // Weise die Buchstaben in der ersten Hälfte der Nachrichten zu
                buchstabenMitIndex.forEach((buchstabeMitIndex, i) => {
                    if (i < ersteHaelfte.length) {
                        ersteHaelfte[i].nachricht += ` ${buchstabeMitIndex}`;
                    } else {
                        // Falls mehr Buchstaben als Nachrichten, verteilen wir den Rest in der gesamten Liste
                        nachrichtenFuerEmpfaenger[i % nachrichtenFuerEmpfaenger.length].nachricht += ` ${buchstabeMitIndex}`;
                    }
                });
            }
        });
    }

}