import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";
import CryptoJS from "crypto-js";

export class GenerationService {

    /**
     * Hauptfunktion zum Erstellen einer Übung.
     * Füllt die Nachrichten, Lösungswörter und Stärken.
     */
    public generate(uebung: FunkUebung): void {
        uebung.createDate = new Date();
        uebung.nachrichten = this.verteileNachrichtenFair(uebung);
        this.verteileLoesungswoerterMitIndex(uebung);

        // Generiere kryptische IDs für Teilnehmer, falls noch nicht vorhanden
        if (!uebung.teilnehmerIds || Object.keys(uebung.teilnehmerIds).length === 0) {
            uebung.teilnehmerIds = {};
            const ids = uebung.teilnehmerIds;
            uebung.teilnehmerListe.forEach(t => {
                ids[this.generateUUID()] = t;
            });
        }

        this.updateChecksum(uebung);
        this.berechneLoesungsStaerken(uebung);
    }

    private generateUUID(): string {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    public updateChecksum(uebung: FunkUebung) {
        const data = JSON.stringify({
            datum: uebung.datum,
            name: uebung.name,
            rufgruppe: uebung.rufgruppe,
            leitung: uebung.leitung,
            spruecheProTeilnehmer: uebung.spruecheProTeilnehmer,
            spruecheAnAlle: uebung.spruecheAnAlle,
            spruecheAnMehrere: uebung.spruecheAnMehrere,
            buchstabierenAn: uebung.buchstabierenAn,
            loesungswoerter: uebung.loesungswoerter,
            teilnehmerListe: uebung.teilnehmerListe,
            teilnehmerIds: uebung.teilnehmerIds,
            nachrichten: uebung.nachrichten
        });

        uebung.checksumme = CryptoJS.MD5(data).toString();
    }

    private verteileNachrichtenFair(uebung: FunkUebung): Record<string, Nachricht[]> {
        const nachrichtenVerteilung: Record<string, Nachricht[]> = {};
        let nachrichtenIndex = 0;
        
        interface PoolEntry {
            sender: string; nachricht: { text: string; empfaenger: string[] } 
        }
        const alleNachrichten: PoolEntry[] = [];

        const anAlle = uebung.spruecheAnAlle;
        const anMehrere = uebung.spruecheAnMehrere;
        const anEinzeln = uebung.spruecheProTeilnehmer - 1 - anAlle - anMehrere;
        if (uebung.funksprueche.length === 0) {
            return nachrichtenVerteilung;
        }

        uebung.teilnehmerListe.forEach(teilnehmer => {
            nachrichtenVerteilung[teilnehmer] = [];

            // Anmeldungsnachricht
            if (uebung.anmeldungAktiv) {
                nachrichtenVerteilung[teilnehmer].push({
                    id: 1,
                    nachricht: "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.",
                    empfaenger: [uebung.leitung]
                });
            }

            // Nachrichten an 'Alle'
            for (let i = 0; i < anAlle; i++) {
                const spruch = uebung.funksprueche[nachrichtenIndex++ % uebung.funksprueche.length];
                if (!spruch) {
                    continue;
                }
                alleNachrichten.push({
                    sender: teilnehmer,
                    nachricht: {
                        text: spruch,
                        empfaenger: ["Alle"]
                    }
                });
            }

            // Nachrichten an 'Mehrere'
            for (let i = 0; i < anMehrere; i++) {
                const spruch = uebung.funksprueche[nachrichtenIndex++ % uebung.funksprueche.length];
                if (!spruch) {
                    continue;
                }
                const empfaengerGruppe = this.getRandomSubsetOfOthers(uebung.teilnehmerListe, teilnehmer);
                alleNachrichten.push({
                    sender: teilnehmer,
                    nachricht: {
                        text: spruch,
                        empfaenger: empfaengerGruppe
                    }
                });
            }

            // Einzel-Nachrichten
            for (let i = 0; i < anEinzeln; i++) {
                const spruch = uebung.funksprueche[nachrichtenIndex++ % uebung.funksprueche.length];
                if (!spruch) {
                    continue;
                }
                const empfaenger = this.getRandomOther(uebung.teilnehmerListe, teilnehmer);
                alleNachrichten.push({
                    sender: teilnehmer,
                    nachricht: {
                        text: spruch,
                        empfaenger: [empfaenger]
                    }
                });
            }
        });

        // Mische alle Nachrichten
        alleNachrichten.sort(() => Math.random() - 0.5);
        const gemischt = this.shuffleSmart(alleNachrichten);

        // Buchstabier-Logik
        function enthaeltBuchstabierwort(text: string): boolean {
            return text
                .split(/\s+/)
                .some(wort => wort.length > 4 && wort === wort.toUpperCase());
        }
        
        // Besser: Wir weisen erst zu und prüfen dann.
        const tempCounters: Record<string, number> = {};
        uebung.teilnehmerListe.forEach(teilnehmer => {
            tempCounters[teilnehmer] = uebung.anmeldungAktiv ? 2 : 1;
        });

        gemischt.forEach(entry => {
            const { sender, nachricht } = entry;
            if (!nachrichtenVerteilung[sender]) {
                nachrichtenVerteilung[sender] = [];
            }
            if (tempCounters[sender] === undefined) {
                tempCounters[sender] = uebung.anmeldungAktiv ? 2 : 1;
            }
            nachrichtenVerteilung[sender].push({
                id: tempCounters[sender]++,
                nachricht: nachricht.text,
                empfaenger: nachricht.empfaenger,
                loesungsbuchstaben: []
            });
        });

        // Jetzt Buchstabier-Prüfung
        uebung.teilnehmerListe.forEach(teilnehmer => {
            const start = uebung.anmeldungAktiv ? 1 : 0;
            const nachrichten = (nachrichtenVerteilung[teilnehmer] || []).slice(start);
            const aktuelleAnzahl = nachrichten.filter(n => enthaeltBuchstabierwort(n.nachricht)).length;

            if (aktuelleAnzahl < uebung.buchstabierenAn) {
                const restlicheNachrichten = uebung.funksprueche.filter(spruch =>
                    enthaeltBuchstabierwort(spruch) &&
                    !nachrichten.some(n => n.nachricht === spruch)
                );

                const benoetigt = uebung.buchstabierenAn - aktuelleAnzahl;
                let ersetzt = 0;

                for (let i = 0; i < nachrichten.length && ersetzt < benoetigt; i++) {
                    const nachricht = nachrichten[i];
                    if (!nachricht) {
                        continue;
                    }
                    if (!enthaeltBuchstabierwort(nachricht.nachricht) && restlicheNachrichten.length > 0) {
                        const neuerSpruch = restlicheNachrichten.pop();
                        if (neuerSpruch) {
                            nachricht.nachricht = neuerSpruch;
                            ersetzt++;
                        }
                    }
                }
            }
        });

        return nachrichtenVerteilung;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private shuffleSmart(nachrichtenListe: any[]): any[] {
        const maxVersuche = 100;
        const durchmischteListe = [...nachrichtenListe];
        let istGueltig = false;

        for (let versuch = 0; versuch < maxVersuche; versuch++) {
            durchmischteListe.sort(() => Math.random() - 0.5);

            istGueltig = true;
            for (let i = 1; i < durchmischteListe.length; i++) {
                const aktuelleEmpfaenger = durchmischteListe[i].nachricht.empfaenger;
                const vorherigeEmpfaenger = durchmischteListe[i - 1].nachricht.empfaenger;

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

    private getRandomSubsetOfOthers(teilnehmerListe: string[], aktuellerTeilnehmer: string): string[] {
        const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);
        const gesamtTeilnehmer = andere.length;
        const gemischt = [...andere].sort(() => Math.random() - 0.5);

        let zufallsGroesse;
        const zufallsWert = Math.random();

        if (zufallsWert < 0.8) {
            zufallsGroesse = Math.floor(Math.random() * 2) + 2; 
        } else if (zufallsWert < 0.9) {
            const maxHaelfte = Math.ceil(gesamtTeilnehmer / 2);
            zufallsGroesse = Math.floor(Math.random() * (maxHaelfte - 4 + 1)) + 4;
        } else if (zufallsWert < 0.95) {
            const minFiftyPercent = Math.ceil(gesamtTeilnehmer * 0.5);
            const maxSeventyFivePercent = Math.ceil(gesamtTeilnehmer * 0.75);
            zufallsGroesse = Math.floor(Math.random() * (maxSeventyFivePercent - minFiftyPercent + 1)) + minFiftyPercent;
        } else {
            const maxAchtzigFuenfPercent = Math.ceil(gesamtTeilnehmer * 0.85);
            zufallsGroesse = Math.floor(Math.random() * (maxAchtzigFuenfPercent - gesamtTeilnehmer + 1)) + gesamtTeilnehmer;
        }

        zufallsGroesse = Math.min(zufallsGroesse, gesamtTeilnehmer);
        return gemischt.slice(0, zufallsGroesse);
    }

    private getRandomOther(teilnehmerListe: string[], aktuellerTeilnehmer: string): string {
        const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);
        if (andere.length === 0) {
            return aktuellerTeilnehmer;
        }
        const randomIndex = Math.floor(Math.random() * andere.length);
        return andere[randomIndex] ?? aktuellerTeilnehmer;
    }

    private verteileLoesungswoerterMitIndex(uebung: FunkUebung) {
        if (!uebung.loesungswoerter) {
            return;
        }

        Object.entries(uebung.loesungswoerter).forEach(([empfaenger, loesungswort]) => {
            if (loesungswort && loesungswort.length > 0) {
                const buchstabenMitIndex = loesungswort
                    .split("")
                    .map((buchstabe, index) => `${index + 1}${buchstabe}`);

                const nachrichtenFuerEmpfaenger: Nachricht[] = [];
                Object.entries(uebung.nachrichten).forEach(([absender, nachrichtenListe]) => {
                    if (absender !== empfaenger) {
                        nachrichtenListe.forEach(nachricht => {
                            if (nachricht.empfaenger.includes(empfaenger) && nachricht.empfaenger.length === 1) {
                                nachrichtenFuerEmpfaenger.push(nachricht);
                            }
                        });
                    }
                });

                nachrichtenFuerEmpfaenger.sort((a, b) => a.id - b.id);
                if (nachrichtenFuerEmpfaenger.length === 0) {
                    return;
                }
                const ersteHaelfte = nachrichtenFuerEmpfaenger.slice(0, Math.ceil(nachrichtenFuerEmpfaenger.length / 2));
                buchstabenMitIndex.sort(() => Math.random() - 0.5);

                buchstabenMitIndex.forEach((buchstabeMitIndex, i) => {
                    const zielNachricht = i < ersteHaelfte.length
                        ? ersteHaelfte[i]
                        : nachrichtenFuerEmpfaenger[i % nachrichtenFuerEmpfaenger.length];

                    if (!zielNachricht) {
                        return;
                    }
                    zielNachricht.nachricht += ` ${buchstabeMitIndex}`;
                    if (!zielNachricht.loesungsbuchstaben) {
                        zielNachricht.loesungsbuchstaben = [];
                    }
                    zielNachricht.loesungsbuchstaben.push(buchstabeMitIndex);
                });
            }
        });
    }

    private berechneLoesungsStaerken(uebung: FunkUebung) {

        const summen: Record<string, { fuehrer: number; unterfuehrer: number; helfer: number; gesamt: number }> = {};
        uebung.teilnehmerListe.forEach(t => {
            summen[t] = { fuehrer: 0, unterfuehrer: 0, helfer: 0, gesamt: 0 };
        });

        const staerkeRegex = /(\d{1,3})\s*\/+\s*(\d{1,3})\s*\/+\s*(\d{1,3})(?:\s*\/+\s*(\d{1,3}))?/g;

        Object.entries(uebung.nachrichten).forEach(([sender, nachrichtenListe]) => {
            nachrichtenListe.forEach(nachricht => {
                let empfaengerListe: string[] = [];
                if (nachricht.empfaenger.includes("Alle")) {
                    empfaengerListe = uebung.teilnehmerListe.filter(t => t !== sender);
                } else {
                    empfaengerListe = nachricht.empfaenger.filter(e => e !== sender && uebung.teilnehmerListe.includes(e));
                }

                if (nachricht.staerken && nachricht.staerken.length > 0) {
                    nachricht.staerken.forEach(({ fuehrer, unterfuehrer, helfer }) => {
                        const gesamt = fuehrer + unterfuehrer + helfer;
                        empfaengerListe.forEach(empfaenger => {
                            if (summen[empfaenger]) {
                                summen[empfaenger].fuehrer += fuehrer;
                                summen[empfaenger].unterfuehrer += unterfuehrer;
                                summen[empfaenger].helfer += helfer;
                                summen[empfaenger].gesamt += gesamt;
                            }
                        });
                    });
                } else {
                    const staerkeMatches = Array.from(
                        nachricht.nachricht.matchAll(staerkeRegex)
                    );

                    if (staerkeMatches.length > 0) {
                        if (!nachricht.staerken) {
                            nachricht.staerken = [];
                        }

                        staerkeMatches.forEach(match => {
                            const fuehrerStr = match[1];
                            const unterfuehrerStr = match[2];
                            const helferStr = match[3];
                            if (!fuehrerStr || !unterfuehrerStr || !helferStr) {
                                return;
                            }
                            const fuehrer = parseInt(fuehrerStr, 10);
                            const unterfuehrer = parseInt(unterfuehrerStr, 10);
                            const helfer = parseInt(helferStr, 10);

                            if (!nachricht.staerken) {
                                nachricht.staerken = [];
                            }
                            nachricht.staerken.push({ fuehrer, unterfuehrer, helfer });

                            const gesamt = fuehrer + unterfuehrer + helfer;

                            empfaengerListe.forEach(empfaenger => {
                                if (summen[empfaenger]) {
                                    summen[empfaenger].fuehrer += fuehrer;
                                    summen[empfaenger].unterfuehrer += unterfuehrer;
                                    summen[empfaenger].helfer += helfer;
                                    summen[empfaenger].gesamt += gesamt;
                                }
                            });
                        });
                    }
                }
            });
        });

        uebung.loesungsStaerken = {};
        Object.entries(summen).forEach(([teilnehmer, werte]) => {
            if (uebung.loesungsStaerken) {
                uebung.loesungsStaerken[teilnehmer] =
                    `${werte.fuehrer}/${werte.unterfuehrer}/${werte.helfer}/${werte.gesamt}`;
            }
        });

        if (uebung.autoStaerkeErgaenzen && uebung.loesungsStaerken) {
            let staerkenHinzugefuegt = false;
            for (const teilnehmer of uebung.teilnehmerListe) {
                if (uebung.loesungsStaerken[teilnehmer] === "0/0/0/0") {
                    const empfangeneNachrichten: { absender: string; nachricht: Nachricht }[] = [];
                    Object.entries(uebung.nachrichten).forEach(([absender, nachrichtenListe]) => {
                        nachrichtenListe.forEach(nachricht => {
                            if (nachricht.empfaenger.includes(teilnehmer)) {
                                empfangeneNachrichten.push({ absender, nachricht });
                            }
                        });
                    });

                    const totalNachrichten = empfangeneNachrichten.length;
                    const einzelnEmpfangene = empfangeneNachrichten.filter(e => e.nachricht.empfaenger.length === 1);
                    
                     
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
                        const ohneStaerke = einzelnEmpfangene.filter(e =>
                            !/(\d+)\s*\/+\s*(\d+)\s*\/+\s*(\d+)(?:\s*\/+\s*(\d+))?/.test(e.nachricht.nachricht)
                        );
                        const gemischt = [...ohneStaerke].sort(() => Math.random() - 0.5);
                        auszuwahlende = gemischt.slice(0, anzahlStaerken);
                    }

                    for (const eintrag of auszuwahlende) {
                        if (eintrag.nachricht.empfaenger && eintrag.nachricht.empfaenger.length > 0) {
                            const fuehrer = Math.floor(Math.random() * 4);
                            const unterfuehrer = Math.floor(Math.random() * 9);
                            const helfer = Math.floor(Math.random() * 31);
                            const gesamt = fuehrer + unterfuehrer + helfer;
                            const staerkeText = `Aktuelle Stärke: ${fuehrer}/${unterfuehrer}/${helfer}/${gesamt}`;
                            eintrag.nachricht.nachricht += " " + staerkeText;
                            eintrag.nachricht.staerken = [{ fuehrer, unterfuehrer, helfer }];
                            
                            // Update in original list (referenced)
                            staerkenHinzugefuegt = true;
                        }
                    }
                }
            }
            
            if (staerkenHinzugefuegt) {
                // Recalculate once
                this.berechneLoesungsStaerken(uebung);
            }
        }
    }
}
