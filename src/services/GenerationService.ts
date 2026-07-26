import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";
import {
    enthaeltBuchstabierAufgabe,
    entferneBuchstabierAufgaben,
    erzeugeBuchstabierAufgabe
} from "../utils/buchstabieren";
import CryptoJS from "crypto-js";
import { createRandomSeed, createSeededRng, randomInt, randomIntBetween, shuffle, type Rng } from "../utils/random";

export class GenerationService {
    private static readonly SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static readonly UEBUNG_CODE_LENGTH = 6;
    private static readonly TEILNEHMER_CODE_LENGTH = 4;

    /**
     * Zufallsquelle des laufenden Generierungsvorgangs. Wird zu Beginn von
     * `generate` aus dem Seed der Übung aufgebaut.
     */
    private rng: Rng = Math.random;

    /**
     * Hauptfunktion zum Erstellen einer Übung.
     * Füllt die Nachrichten, Lösungswörter und Stärken.
     */
    public generate(uebung: FunkUebung): void {
        uebung.createDate = new Date();
        this.rng = this.erzeugeZufallsquelle(uebung);
        uebung.nachrichten = this.verteileNachrichtenFair(uebung);
        this.assignXZeitSlots(uebung);
        this.verteileLoesungswoerterMitIndex(uebung);
        this.ensureJoinCodes(uebung);

        this.updateChecksum(uebung);
        this.berechneLoesungsStaerken(uebung);
    }

    /**
     * Legt die Zufallsquelle für einen Generierungslauf fest.
     *
     * Ist an der Übung kein Seed hinterlegt, wird einer erzeugt und dort
     * gespeichert. Damit lässt sich jede Übung nachträglich exakt wiederholen –
     * für Vergleichsläufe zweier Gruppen oder um einen gemeldeten Fehler
     * nachzustellen –, ohne dass jemand vorher an das Setzen eines Seeds denken
     * muss.
     */
    private erzeugeZufallsquelle(uebung: FunkUebung): Rng {
        if (!uebung.seed) {
            uebung.seed = createRandomSeed();
        }
        return createSeededRng(uebung.seed);
    }

    private assignXZeitSlots(uebung: FunkUebung): void {
        if (uebung.spielModus !== "xZeit") {
            return;
        }

        const intervall = uebung.xZeitIntervallMinuten ?? 3;
        const startOffset = uebung.xZeitStartOffsetMinuten ?? 0;

        if (uebung.anmeldungAktiv) {
            for (const msgs of Object.values(uebung.nachrichten)) {
                const anmeldung = msgs.find(m => m.id === 1);
                if (anmeldung) {
                    anmeldung.xZeitSlot = 0;
                }
            }
        }

        const pool: Nachricht[] = [];
        for (const msgs of Object.values(uebung.nachrichten)) {
            for (const m of msgs) {
                if (uebung.anmeldungAktiv && m.id === 1) {
                    continue;
                }
                pool.push(m);
            }
        }
        pool.sort((a, b) => a.id - b.id);

        pool.forEach((m, globalIndex) => {
            m.xZeitSlot = startOffset + (globalIndex + 1) * intervall;
        });
    }

    private ensureJoinCodes(uebung: FunkUebung): void {
        if (!this.isValidShortCode(uebung.uebungCode, GenerationService.UEBUNG_CODE_LENGTH)) {
            uebung.uebungCode = this.generateShortCode(GenerationService.UEBUNG_CODE_LENGTH);
        } else {
            uebung.uebungCode = uebung.uebungCode.toUpperCase();
        }

        const existing = uebung.teilnehmerIds || {};
        const next: Record<string, string> = {};
        const used = new Set<string>();

        uebung.teilnehmerListe.forEach(name => {
            const reused = Object.entries(existing).find(([code, value]) =>
                value === name && this.isValidShortCode(code, GenerationService.TEILNEHMER_CODE_LENGTH)
            )?.[0];

            const code = reused && !used.has(reused)
                ? reused
                : this.generateUniqueShortCode(GenerationService.TEILNEHMER_CODE_LENGTH, used);

            used.add(code);
            next[code] = name;
        });

        uebung.teilnehmerIds = next;
    }

    private isValidShortCode(code: string | undefined, length: number): boolean {
        if (!code || code.length !== length) {
            return false;
        }
        return [...code.toUpperCase()].every(char => GenerationService.SHORT_CODE_ALPHABET.includes(char));
    }

    private generateUniqueShortCode(length: number, used: Set<string>): string {
        let code = this.generateShortCode(length);
        while (used.has(code)) {
            code = this.generateShortCode(length);
        }
        return code;
    }

    /**
     * Sorgt dafür, dass der Übungscode gegenüber dem Bestand eindeutig ist.
     * Die Bestandsprüfung wird injiziert, damit dieser Service frei von
     * Firestore-Abhängigkeiten bleibt.
     *
     * @returns true, wenn ein freier Code vergeben werden konnte.
     */
    public async ensureUniqueUebungCode(
        uebung: FunkUebung,
        istVergeben: (code: string) => Promise<boolean>,
        maxVersuche = 5
    ): Promise<boolean> {
        for (let versuch = 0; versuch < maxVersuche; versuch++) {
            if (!(await istVergeben(uebung.uebungCode))) {
                return true;
            }
            uebung.uebungCode = this.generateShortCode(GenerationService.UEBUNG_CODE_LENGTH);
        }
        return !(await istVergeben(uebung.uebungCode));
    }

    /**
     * Zugangscodes stammen bewusst NICHT aus `this.rng`.
     *
     * Der Seed einer Übung wird im Übungsdokument gespeichert, und dieses
     * Dokument ist ohne Authentifizierung lesbar (siehe firestore.rules). Aus
     * einer seedbaren Quelle erzeugte Codes ließen sich damit von jedem
     * nachrechnen, der den Seed sieht. Reproduzierbar soll die
     * Nachrichtenverteilung sein, nicht die Zugangsdaten.
     */
    private generateShortCode(length: number): string {
        const alphabet = GenerationService.SHORT_CODE_ALPHABET;
        let result = "";
        for (let i = 0; i < length; i++) {
            result += alphabet[this.secureRandomIndex(alphabet.length)];
        }
        return result;
    }

    /**
     * Gleichverteilter Zufallsindex aus der Web-Crypto-API.
     * Bytes oberhalb des größten Vielfachen von `obergrenze` werden verworfen,
     * damit kein Modulo-Bias entsteht (Rejection Sampling).
     */
    private secureRandomIndex(obergrenze: number): number {
        const crypto = globalThis.crypto;
        if (!crypto || typeof crypto.getRandomValues !== "function") {
            throw new Error(
                "Zugangscodes erfordern crypto.getRandomValues; diese Umgebung stellt die Web-Crypto-API nicht bereit."
            );
        }

        const maxWert = 256 - (256 % obergrenze);
        const puffer = new Uint8Array(1);
        let wert = maxWert;
        while (wert >= maxWert) {
            crypto.getRandomValues(puffer);
            wert = puffer[0] ?? maxWert;
        }

        return wert % obergrenze;
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

        interface PoolEntry {
            sender: string; nachricht: { text: string; empfaenger: string[] }
        }
        const alleNachrichten: PoolEntry[] = [];

        const anAlle = Math.max(0, uebung.spruecheAnAlle);
        const anMehrere = Math.max(0, uebung.spruecheAnMehrere);
        const anmeldungsOffset = uebung.anmeldungAktiv ? 1 : 0;
        const anEinzeln = Math.max(0, uebung.spruecheProTeilnehmer - anmeldungsOffset - anAlle - anMehrere);
        if (uebung.funksprueche.length === 0) {
            return nachrichtenVerteilung;
        }

        const dealer = this.createSpruchDealer(uebung.funksprueche, this.rng);
        if (dealer.poolSize === 0) {
            return nachrichtenVerteilung;
        }

        uebung.teilnehmerListe.forEach(teilnehmer => {
            nachrichtenVerteilung[teilnehmer] = [];
            const bereitsVerwendet = new Set<string>();

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
                const spruch = dealer.draw(bereitsVerwendet);
                if (!spruch) {
                    continue;
                }
                bereitsVerwendet.add(spruch);
                alleNachrichten.push({
                    sender: teilnehmer,
                    nachricht: {
                        text: spruch,
                        empfaenger: uebung.teilnehmerListe.filter(t => t !== teilnehmer)
                    }
                });
            }

            // Nachrichten an 'Mehrere'
            for (let i = 0; i < anMehrere; i++) {
                const spruch = dealer.draw(bereitsVerwendet);
                if (!spruch) {
                    continue;
                }
                bereitsVerwendet.add(spruch);
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
                const spruch = dealer.draw(bereitsVerwendet);
                if (!spruch) {
                    continue;
                }
                bereitsVerwendet.add(spruch);
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
        const gemischt = this.shuffleSmart(alleNachrichten);

        // Zuerst zuweisen, danach die Buchstabier-Aufgaben auf den Zielwert bringen.
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

        this.balanciereBuchstabierAufgaben(uebung, nachrichtenVerteilung);

        return nachrichtenVerteilung;
    }

    /**
     * Bringt die Anzahl der Buchstabier-Aufgaben pro Teilnehmer auf den eingestellten
     * Zielwert `uebung.buchstabierenAn`.
     *
     * Die Vorlagen enthalten von Haus aus sehr unterschiedlich viele großgeschriebene
     * Wörter, deshalb reicht reines Auswählen nicht aus:
     * - Zu viele Aufgaben: überzählige Sprüche werden in Normalschreibweise überführt.
     * - Zu wenige Aufgaben: bevorzugt wird ein noch gar nicht vergebener Spruch mit
     *   Großschreibung eingesetzt; ist keiner mehr übrig, wird im vorhandenen Spruch ein
     *   Wort großgeschrieben. Beides hält die Sprüche über alle Teilnehmer hinweg eindeutig.
     *
     * Die Anmeldungsnachricht bleibt außen vor.
     */
    private balanciereBuchstabierAufgaben(
        uebung: FunkUebung,
        nachrichtenVerteilung: Record<string, Nachricht[]>
    ): void {
        const start = uebung.anmeldungAktiv ? 1 : 0;

        // Verhindert, dass ein nachträglich eingesetzter Buchstabier-Spruch
        // bei mehreren Teilnehmern landet.
        const globalVergeben = new Set<string>();
        Object.values(nachrichtenVerteilung).forEach(liste =>
            liste.forEach(n => globalVergeben.add(n.nachricht))
        );

        uebung.teilnehmerListe.forEach(teilnehmer => {
            const nachrichten = (nachrichtenVerteilung[teilnehmer] || []).slice(start);
            const ziel = Math.max(0, Math.min(uebung.buchstabierenAn, nachrichten.length));

            const mitAufgabe: Nachricht[] = [];
            const ohneAufgabe: Nachricht[] = [];
            nachrichten.forEach(nachricht => {
                (enthaeltBuchstabierAufgabe(nachricht.nachricht) ? mitAufgabe : ohneAufgabe).push(nachricht);
            });

            if (mitAufgabe.length > ziel) {
                // Zufällige Auswahl, damit die verbleibenden Aufgaben über die Übung verteilt bleiben.
                const ueberzaehlig = this.shuffle(mitAufgabe).slice(ziel);
                ueberzaehlig.forEach(nachricht => {
                    nachricht.nachricht = entferneBuchstabierAufgaben(nachricht.nachricht);
                });
                return;
            }

            if (mitAufgabe.length < ziel) {
                const ersatzSprueche = this.shuffle(
                    uebung.funksprueche.filter(spruch =>
                        enthaeltBuchstabierAufgabe(spruch) && !globalVergeben.has(spruch)
                    )
                );

                let benoetigt = ziel - mitAufgabe.length;
                for (const nachricht of this.shuffle(ohneAufgabe)) {
                    if (benoetigt === 0) {
                        break;
                    }

                    const ersatz = ersatzSprueche.pop();
                    if (ersatz) {
                        nachricht.nachricht = ersatz;
                        globalVergeben.add(ersatz);
                        benoetigt--;
                        continue;
                    }

                    const umgeschrieben = erzeugeBuchstabierAufgabe(nachricht.nachricht);
                    if (umgeschrieben) {
                        nachricht.nachricht = umgeschrieben;
                        globalVergeben.add(umgeschrieben);
                        benoetigt--;
                    }
                }
            }
        });
    }

    private shuffle<T>(liste: T[]): T[] {
        return shuffle(liste, this.rng);
    }

    /**
     * Verteilt die Funksprüche wie ein Kartenspiel: Jeder Spruch wird einmal ausgeteilt,
     * bevor überhaupt ein Spruch ein zweites Mal vorkommt. Zusätzlich bekommt kein
     * Teilnehmer denselben Spruch doppelt, solange der Pool das hergibt.
     */
    private createSpruchDealer(funksprueche: string[], rng: Rng): { poolSize: number; draw(bereitsVerwendet: Set<string>): string | undefined } {
        const eindeutig = [...new Set(
            funksprueche.map(spruch => spruch.trim()).filter(spruch => spruch.length > 0)
        )];
        const mischen = (): string[] => shuffle(eindeutig, rng);
        const deck: string[] = mischen();

        return {
            poolSize: eindeutig.length,
            draw(bereitsVerwendet: Set<string>): string | undefined {
                if (eindeutig.length === 0) {
                    return undefined;
                }
                let index = deck.findIndex(spruch => !bereitsVerwendet.has(spruch));
                if (index < 0) {
                    // Deck aufgebraucht (oder Rest liegt bereits bei diesem Teilnehmer):
                    // frisch gemischten Nachschub anhängen, damit Restsprüche nicht verfallen.
                    deck.push(...mischen());
                    index = deck.findIndex(spruch => !bereitsVerwendet.has(spruch));
                }
                if (index < 0) {
                    // Teilnehmer hat bereits jeden verfügbaren Spruch – Wiederholung unvermeidbar.
                    index = 0;
                }
                return deck.splice(index, 1)[0];
            }
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private shuffleSmart(nachrichtenListe: any[]): any[] {
        const maxVersuche = 100;
        let durchmischteListe = [...nachrichtenListe];

        for (let versuch = 0; versuch < maxVersuche; versuch++) {
            durchmischteListe = shuffle(durchmischteListe, this.rng);

            let istGueltig = true;
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
        const gemischt = shuffle(andere, this.rng);

        let zufallsGroesse;
        const zufallsWert = this.rng();

        if (zufallsWert < 0.8) {
            zufallsGroesse = randomIntBetween(2, 3, this.rng);
        } else if (zufallsWert < 0.9) {
            zufallsGroesse = randomIntBetween(4, Math.ceil(gesamtTeilnehmer / 2), this.rng);
        } else if (zufallsWert < 0.95) {
            zufallsGroesse = randomIntBetween(
                Math.ceil(gesamtTeilnehmer * 0.5),
                Math.ceil(gesamtTeilnehmer * 0.75),
                this.rng
            );
        } else {
            // Größte Stufe: 85 % bis alle. Vorher standen hier Unter- und
            // Obergrenze vertauscht, wodurch der Zweig immer die volle Liste ergab.
            zufallsGroesse = randomIntBetween(Math.ceil(gesamtTeilnehmer * 0.85), gesamtTeilnehmer, this.rng);
        }

        zufallsGroesse = Math.min(zufallsGroesse, gesamtTeilnehmer);
        return gemischt.slice(0, zufallsGroesse);
    }

    private getRandomOther(teilnehmerListe: string[], aktuellerTeilnehmer: string): string {
        const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);
        if (andere.length === 0) {
            return aktuellerTeilnehmer;
        }
        const randomIndex = randomInt(andere.length, this.rng);
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

                shuffle(buchstabenMitIndex, this.rng).forEach((buchstabeMitIndex, i) => {
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
                        const gemischt = shuffle(ohneStaerke, this.rng);
                        auszuwahlende = gemischt.slice(0, anzahlStaerken);
                    }

                    for (const eintrag of auszuwahlende) {
                        if (eintrag.nachricht.empfaenger && eintrag.nachricht.empfaenger.length > 0) {
                            const fuehrer = randomInt(4, this.rng);
                            const unterfuehrer = randomInt(9, this.rng);
                            const helfer = randomInt(31, this.rng);
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
