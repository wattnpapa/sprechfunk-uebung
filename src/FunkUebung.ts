import { v4 as uuidv4 } from 'uuid';
import { NAMENS_POOL } from './namen-funkuebungen.js';
import type { Uebung } from './types/Uebung';
import type { Nachricht } from './types/Nachricht';
import CryptoJS from 'crypto-js';

export class FunkUebung implements Uebung {

    id: string;
    autoStaerkeErgaenzen: boolean = true;
    name: string;
    datum: Date;
    buildVersion: string;
    leitung: string;
    rufgruppe: string;
    teilnehmerListe: string[];
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
            teilnehmerStellen: this.teilnehmerStellen,
            nachrichten: this.nachrichten,
            loesungswoerter: this.loesungswoerter,
            loesungsStaerken: this.loesungsStaerken,
            spruecheProTeilnehmer: this.spruecheProTeilnehmer,
            spruecheAnAlle: this.spruecheAnAlle,
            spruecheAnMehrere: this.spruecheAnMehrere,
            buchstabierenAn: this.buchstabierenAn
        }, null, 2); // Pretty Print
    }

    erstelle() {
        this.createDate = new Date();
        this.nachrichten = this.verteileNachrichtenFair();
        this.verteileLoesungswoerterMitIndex();
        this.berechneLoesungsStaerken();
        console.log(this.loesungsStaerken);
    }

    getBalancedSubsetOfOthers(
        teilnehmerListe: string[],
        sender: string,
        empfangsZaehler: Record<string, number>,
        letzteEmpfaenger: Set<string>,
        empfaengerHistory: string[]
    ): string[] {
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

    getBalancedOther(
        teilnehmerListe: string[],
        sender: string,
        empfangsZaehler: Record<string, number>,
        letzteEmpfaenger: Set<string>,
        empfaengerHistory: string[]
    ): string {
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

        const empfaengerVerteilung: Record<string, string[]> = {};
        const empfangsZaehler: Record<string, number> = {};
        const empfaengerHistory: string[] = [];
        const maxHistory = 2; // Verhindert, dass Teilnehmer mehrfach hintereinander Empfänger werden

        // Initialisierung
        this.teilnehmerListe.forEach(teilnehmer => {
            empfaengerVerteilung[teilnehmer] = [];
            empfangsZaehler[teilnehmer] = 0;
        });

        // Erstelle pro Sender eine Liste der noch "zu besuchenden" Empfänger
        const empfaengerToVisit: Record<string, string[]> = {};
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

    verteileNachrichtenFair(): Record<string, Nachricht[]> {
        const nachrichtenVerteilung: Record<string, Nachricht[]> = {};
        let nachrichtenIndex = 0;
        // Pool entries for shuffling
        type PoolEntry = { sender: string; nachricht: { text: string; empfaenger: string[] } };
        const alleNachrichten: PoolEntry[] = [];

        // Berechne Verteilungen
        const anAlle = this.spruecheAnAlle;
        const anMehrere = this.spruecheAnMehrere;
        const anEinzeln = this.spruecheProTeilnehmer - 1 - anAlle - anMehrere;

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
        // Smarte Durchmischung, sodass Nachrichten an "Alle" oder "Mehrere" nicht hintereinander stehen
        const gemischt = this.shuffleSmart(alleNachrichten);

        // Weisen die Nachrichten wieder zu
        // Hilfsfunktion zum Prüfen, ob eine Nachricht ein buchstabierwürdiges Wort enthält
        function enthaeltBuchstabierwort(text: string): boolean {
            return text
                .split(/\s+/)
                .some(wort => wort.length > 4 && wort === wort.toUpperCase());
        }

        // Sicherstellen, dass pro Teilnehmer genügend Buchstabieraufgaben vorhanden sind
        this.teilnehmerListe.forEach(teilnehmer => {
            const nachrichten = nachrichtenVerteilung[teilnehmer].slice(1); // Ohne Anmeldung
            let aktuelleAnzahl = nachrichten.filter(n => enthaeltBuchstabierwort(n.nachricht)).length;

            if (aktuelleAnzahl < this.buchstabierenAn) {
                // Suche weitere geeignete Nachrichten im Pool
                const restlicheNachrichten = this.funksprueche.filter(spruch =>
                    enthaeltBuchstabierwort(spruch) &&
                    !nachrichten.some(n => n.nachricht === spruch)
                );

                const benoetigt = this.buchstabierenAn - aktuelleAnzahl;
                let ersetzt = 0;

                for (let i = 0; i < nachrichten.length && ersetzt < benoetigt; i++) {
                    const nachricht = nachrichten[i];
                    if (!enthaeltBuchstabierwort(nachricht.nachricht) && restlicheNachrichten.length > 0) {
                        const neuerSpruch = restlicheNachrichten.pop();
                        nachricht.nachricht = neuerSpruch!;
                        ersetzt++;
                    }
                }
            }
        });

        const tempCounters: Record<string, number> = {};
        this.teilnehmerListe.forEach(teilnehmer => tempCounters[teilnehmer] = 2);

        gemischt.forEach(entry => {
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
    shuffleArray<T>(array: T[]): T[] {
        return array.sort(() => Math.random() - 0.5);
    }

    shuffleSmart(nachrichtenListe: any[]): any[] {
        let maxVersuche = 100;
        let durchmischteListe = [...nachrichtenListe];
        let istGueltig = false;

        for (let versuch = 0; versuch < maxVersuche; versuch++) {
            durchmischteListe.sort(() => Math.random() - 0.5);

            istGueltig = true;
            for (let i = 1; i < durchmischteListe.length; i++) {
                let aktuelleEmpfaenger = durchmischteListe[i].nachricht.empfaenger;
                let vorherigeEmpfaenger = durchmischteListe[i - 1].nachricht.empfaenger;

                const beideSindAlleOderMehrere =
                    (aktuelleEmpfaenger.length > 1 || aktuelleEmpfaenger[0] === "Alle") &&
                    (vorherigeEmpfaenger.length > 1 || vorherigeEmpfaenger[0] === "Alle");

                if (beideSindAlleOderMehrere) {
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

    getFairSubsetOfOthers(
        teilnehmerListe: string[],
        sender: string,
        empfangsZaehler: Record<string, number>,
        blacklist: Set<string>
    ): string[] {
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
    getFairOther(
        teilnehmerListe: string[],
        sender: string,
        empfangsZaehler: Record<string, number>,
        blacklist: Set<string>
    ): string {
        let andere = teilnehmerListe.filter(t => t !== sender && !blacklist.has(t));

        // Sortiere nach Anzahl empfangener Nachrichten, um weniger Bevorzugte zu priorisieren
        andere.sort((a, b) => empfangsZaehler[a] - empfangsZaehler[b]);

        return andere.length > 0 ? andere[0] : teilnehmerListe.filter(t => t !== sender)[0]; // Notfall: Falls keine Alternative verfügbar
    }

    generiereNachrichten(teilnehmer: string): Nachricht[] {
        const gemischteFunksprueche: string[] = [...this.funksprueche].sort(() => 0.5 - Math.random());
        const nachrichtenVerteilung = this.verteileNachrichten(this.spruecheProTeilnehmer, this.spruecheAnAlle, this.spruecheAnMehrere);

        const nachrichten: Nachricht[] = [];

        // Erste Nachricht: Anmeldung
        nachrichten.push({
            id: 1,
            nachricht: "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.",
            empfaenger: [this.leitung]
        });

        for (let i = 0; i < this.spruecheProTeilnehmer; i++) {
            const nachrichtObj: Nachricht = {
                id: i + 2,
                nachricht: gemischteFunksprueche[i],
                empfaenger: []
            };
            if (nachrichtenVerteilung.alle.includes(i)) {
                nachrichtObj.empfaenger = ["Alle"];
            } else if (nachrichtenVerteilung.mehrere.includes(i)) {
                nachrichtObj.empfaenger = this.getRandomSubsetOfOthers(this.teilnehmerListe, teilnehmer);
            } else {
                nachrichtObj.empfaenger = [this.getRandomOther(this.teilnehmerListe, teilnehmer)];
            }
            nachrichten.push(nachrichtObj);
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
    getRandomSubsetOfOthers(teilnehmerListe: string[], aktuellerTeilnehmer: string): string[] {
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
    getRandomOther(teilnehmerListe: string[], aktuellerTeilnehmer: string): string {
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
     * @returns {{ alle: number[], mehrere: number[], einfach: number[] }}
     *    - `alle`: Array mit den Nachrichtennummern, die an "ALLE" gehen
     *    - `mehrere`: Array mit den Nachrichtennummern, die an "MEHRERE" gehen
     *    - `einfach`: Array mit den Nachrichtennummern, die an Einzel-Empfänger gehen
     */
    verteileNachrichten(
        totalMessages: number,
        anzahlAlle: number,
        anzahlMehrere: number
    ): { alle: number[]; mehrere: number[]; einfach: number[] } {
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
                let nachrichtenFuerEmpfaenger: Nachricht[] = [];
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

    /**
     * Berechnet für jeden Teilnehmer die aufsummierte taktische Stärke aus den empfangenen Nachrichten,
     * im Format "<Führer>/<Unterführer>/<Helfer>/<Gesamt>".
     * Unterstützt verschiedene Schreibweisen: 1/2/3/6, 1/2/3//6, 1/2/3.
     * Berücksichtigt auch Nachrichten an mehrere Empfänger und an "Alle".
     */
    berechneLoesungsStaerken() {
        // Falls automatische Ergänzung deaktiviert ist, nur Summen berechnen, keine Ergänzung durchführen
        if (!this.autoStaerkeErgaenzen) {
            console.log("Automatische Ergänzung von Stärkemeldungen ist deaktiviert.");
        }

        // Initialisiere Zähler für jeden Teilnehmer
        const summen: Record<string, { fuehrer: number; unterfuehrer: number; helfer: number; gesamt: number }> = {};
        this.teilnehmerListe.forEach(t => {
            summen[t] = { fuehrer: 0, unterfuehrer: 0, helfer: 0, gesamt: 0 };
        });

        // Regex für verschiedene Schreibweisen (erlaubt beliebig viele Leerzeichen und Slashes)
        const staerkeRegex = /(\d+)\s*\/+\s*(\d+)\s*\/+\s*(\d+)(?:\s*\/+\s*(\d+))?/g;

        // Iteriere über alle Nachrichten aller Absender
        Object.entries(this.nachrichten).forEach(([sender, nachrichtenListe]) => {
            nachrichtenListe.forEach(nachricht => {
                // Empfängerlogik:
                // 1. Falls "Alle" enthalten: Für jeden Teilnehmer außer Sender
                // 2. Sonst: Für alle explizit genannten Empfänger, außer Sender
                let empfaengerListe: string[] = [];
                if (nachricht.empfaenger.includes("Alle")) {
                    empfaengerListe = this.teilnehmerListe.filter(t => t !== sender);
                } else {
                    empfaengerListe = nachricht.empfaenger.filter(e => e !== sender && this.teilnehmerListe.includes(e));
                }
                // --- Erweiterung: mehrere Stärkeneinträge pro Nachricht erkennen und aufsummieren ---
                // Alle Stärkeneinträge in einer Nachricht erkennen (mehrere erlaubt)
                const staerkeMatches = Array.from(nachricht.nachricht.matchAll(staerkeRegex));
                if (staerkeMatches.length > 0) {
                    empfaengerListe.forEach(empfaenger => {
                        staerkeMatches.forEach(match => {
                            const fuehrer = parseInt(match[1], 10);
                            const unterfuehrer = parseInt(match[2], 10);
                            const helfer = parseInt(match[3], 10);
                            let gesamt: number;
                            if (typeof match[4] !== "undefined" && match[4] !== undefined) {
                                gesamt = parseInt(match[4], 10);
                            } else {
                                gesamt = fuehrer + unterfuehrer + helfer;
                            }
                            summen[empfaenger].fuehrer += fuehrer;
                            summen[empfaenger].unterfuehrer += unterfuehrer;
                            summen[empfaenger].helfer += helfer;
                            summen[empfaenger].gesamt += gesamt;
                        });
                    });
                }
            });
        });

        // Fülle this.loesungsStaerken
        this.loesungsStaerken = {};
        Object.entries(summen).forEach(([teilnehmer, werte]) => {
            this.loesungsStaerken[teilnehmer] =
                `${werte.fuehrer}/${werte.unterfuehrer}/${werte.helfer}/${werte.gesamt}`;
        });

        // --- Erweiterung: Korrektur von "0/0/0/0"-Stärken ---
        // Ergänzungslogik nur durchführen, wenn aktiviert
        if (this.autoStaerkeErgaenzen) {
            // Für alle Teilnehmer, deren Stärke "0/0/0/0" ist:
            for (const teilnehmer of this.teilnehmerListe) {
                if (this.loesungsStaerken[teilnehmer] === "0/0/0/0") {
                    // 1. Alle Nachrichten finden, die dieser Teilnehmer empfangen hat
                    const empfangeneNachrichten: { absender: string; nachricht: Nachricht }[] = [];
                    Object.entries(this.nachrichten).forEach(([absender, nachrichtenListe]) => {
                        nachrichtenListe.forEach(nachricht => {
                            if (nachricht.empfaenger.includes(teilnehmer)) {
                                empfangeneNachrichten.push({ absender, nachricht });
                            }
                        });
                    });
                    // 2. Dynamische Auswahl basierend auf Übungsgröße
                    const totalNachrichten = empfangeneNachrichten.length;

                    // Nur Nachrichten mit genau einem Empfänger berücksichtigen
                    const einzelnEmpfangene = empfangeneNachrichten.filter(e => e.nachricht.empfaenger.length === 1);

                    // Bereits vorhandene Stärkeneinträge zählen
                    const vorhandeneStaerken = einzelnEmpfangene.filter(e =>
                        /(\d+)\s*\/+\s*(\d+)\s*\/+\s*(\d+)(?:\s*\/+\s*(\d+))?/.test(e.nachricht.nachricht)
                    ).length;

                    let anzahlStaerken = 0;
                    if (totalNachrichten >= 10) {
                        const zielMindestanzahl = Math.max(2, Math.ceil(einzelnEmpfangene.length * 0.2));
                        anzahlStaerken = Math.max(0, zielMindestanzahl - vorhandeneStaerken);
                    } else if (totalNachrichten > 0) {
                        const zielMindestanzahl = 1;
                        anzahlStaerken = Math.max(0, zielMindestanzahl - vorhandeneStaerken);
                    }

                    let auszuwahlende: { absender: string; nachricht: Nachricht }[] = [];
                    if (einzelnEmpfangene.length > 0 && anzahlStaerken > 0) {
                        // Nur Nachrichten, die noch keinen Stärkeneintrag haben
                        const ohneStaerke = einzelnEmpfangene.filter(e =>
                            !/(\d+)\s*\/+\s*(\d+)\s*\/+\s*(\d+)(?:\s*\/+\s*(\d+))?/.test(e.nachricht.nachricht)
                        );
                        const gemischt = [...ohneStaerke].sort(() => Math.random() - 0.5);
                        auszuwahlende = gemischt.slice(0, anzahlStaerken);
                    }
                    // 3. Für jede gewählte Nachricht: Stärke generieren und anhängen (nur wenn Nachricht Empfänger hat)
                    for (const eintrag of auszuwahlende) {
                        if (eintrag.nachricht.empfaenger && eintrag.nachricht.empfaenger.length > 0) {
                            const fuehrer = Math.floor(Math.random() * 4);
                            const unterfuehrer = Math.floor(Math.random() * 9);
                            const helfer = Math.floor(Math.random() * 31);
                            const gesamt = fuehrer + unterfuehrer + helfer;
                            const staerkeText = `Aktuelle Stärke: ${fuehrer}/${unterfuehrer}/${helfer}/${gesamt}`;
                            eintrag.nachricht.nachricht += " " + staerkeText;
                            // Erweiterung: Stärke auch in der Empfänger-Nachrichtenliste eintragen
                            const empfaengerNachrichten = this.nachrichten[teilnehmer];
                            if (empfaengerNachrichten) {
                                const zielNachricht = empfaengerNachrichten.find(n => n.id === eintrag.nachricht.id);
                                if (zielNachricht) {
                                    zielNachricht.nachricht += " " + staerkeText;
                                }
                            }
                            // --- NEU: Stärke auch in der ursprünglichen nachrichtenListe persistieren ---
                            const senderListe = this.nachrichten[eintrag.absender];
                            if (senderListe) {
                                const senderNachricht = senderListe.find(n => n.id === eintrag.nachricht.id);
                                if (senderNachricht) {
                                    senderNachricht.nachricht = eintrag.nachricht.nachricht;
                                }
                            }
                        }
                    }
                }
            }
            // Nach Änderung: Stärke erneut berechnen für alle Teilnehmer mit "0/0/0/0"
            // (Rekursiv, aber maximal einmal, da wir jetzt Stärken hinzugefügt haben)
            let staerkenKorrigiert = false;
            for (const teilnehmer of this.teilnehmerListe) {
                if (this.loesungsStaerken[teilnehmer] === "0/0/0/0") {
                    staerkenKorrigiert = true;
                    break;
                }
            }
            if (staerkenKorrigiert) {
                // Rekursiv, aber nur einmal, da jetzt Stärken hinzugefügt wurden
                // (Endlosrekursion ist ausgeschlossen, da wir garantiert Stärken hinzufügen)
                this.berechneLoesungsStaerken();
            }
        }
    }


}
