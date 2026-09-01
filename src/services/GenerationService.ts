import { FunkUebung } from "../models/FunkUebung";
import { Nachricht } from "../types/Nachricht";
import {
    enthaeltBuchstabierAufgabe,
    entferneBuchstabierAufgaben,
    erzeugeBuchstabierAufgabe
} from "../utils/buchstabieren";
import { createRandomSeed, createSeededRng, randomInt, randomIntBetween, shuffle, type Rng } from "../utils/random";
import {
    szenarioMaxTeilnehmer,
    type Szenario,
    type SzenarioEmpfaenger
} from "../types/Szenario";

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
     *
     * Mit `szenario` werden die Nachrichten nicht zufällig verteilt, sondern
     * aus dem Drehbuch des Szenarios erzeugt. Lösungswörter, Buchstabier-
     * Balancierung und Auto-Stärkemeldungen entfallen dann bewusst: Sie
     * schreiben Nachrichtentexte um bzw. hängen Inhalte an, was kuratierte
     * Szenariotexte zerstören würde.
     */
    public generate(uebung: FunkUebung, szenario?: Szenario): void {
        uebung.createDate = new Date();
        this.rng = this.erzeugeZufallsquelle(uebung);
        if (szenario) {
            uebung.szenarioSlug = szenario.slug;
            uebung.loesungswoerter = {};
            uebung.autoStaerkeErgaenzen = false;
            // Ohne Balancierung entstehen keine gezielten Buchstabier-Aufgaben;
            // ein Restwert aus dem Formular würde statHatBuchstabieren verfälschen.
            uebung.buchstabierenAn = 0;
            uebung.nachrichten = this.verteileNachrichtenNachSzenario(uebung, szenario);
        } else {
            uebung.szenarioSlug = undefined;
            uebung.nachrichten = this.verteileNachrichtenFair(uebung);
        }
        this.assignXZeitSlots(uebung);
        this.verteileLoesungswoerterMitIndex(uebung);
        this.ensureJoinCodes(uebung);

        this.updateChecksum(uebung);
        this.berechneLoesungsStaerken(uebung);
        // Erst hier, weil die Art von `staerken` und `loesungsbuchstaben` abhängt
        // und beide vorher gefüllt werden.
        this.markiereNachrichtenArt(uebung);
    }

    /**
     * Vermerkt je Nachricht, ob sie als Spruch oder als Durchsage abzusetzen ist.
     *
     * Zwingend Spruch sind Nachrichten mit mitschreibpflichtigem Inhalt:
     * Lösungsbuchstaben, Stärkemeldungen und Buchstabier-Aufgaben gehen
     * verloren, wenn die Gegenstelle sie nicht in den Vordruck aufnimmt. Die
     * An-/Abmeldung ist formlos und damit Durchsage. Alle übrigen Nachrichten
     * verteilt `spruchAnteilProzent`.
     *
     * Die Empfängerzahl spielt bewusst keine Rolle – auch eine Nachricht an
     * alle oder an mehrere kann ein Spruch sein.
     */
    private markiereNachrichtenArt(uebung: FunkUebung): void {
        if (!uebung.nachrichtenArtAktiv) {
            return;
        }

        const anteil = Math.min(100, Math.max(0, uebung.spruchAnteilProzent ?? 50));

        Object.values(uebung.nachrichten).forEach(nachrichtenListe => {
            const frei: Nachricht[] = [];

            nachrichtenListe.forEach(nachricht => {
                if (this.istZwingendSpruch(nachricht)) {
                    nachricht.art = "spruch";
                    return;
                }
                nachricht.art = "durchsage";
                const istAnmeldung = uebung.anmeldungAktiv && nachricht.id === 1;
                if (!istAnmeldung) {
                    frei.push(nachricht);
                }
            });

            // Pro Teilnehmer aufteilen statt je Nachricht zu würfeln, damit der
            // eingestellte Anteil auch bei wenigen Nachrichten eingehalten wird.
            const zielSprueche = Math.round((frei.length * anteil) / 100);
            shuffle(frei, this.rng)
                .slice(0, zielSprueche)
                .forEach(nachricht => {
                    nachricht.art = "spruch";
                });
        });
    }

    /**
     * Nachrichten, deren Inhalt die Gegenstelle zum Mitschreiben zwingt und die
     * deshalb unabhängig vom eingestellten Anteil immer Spruch sind.
     */
    private istZwingendSpruch(nachricht: Nachricht): boolean {
        return (nachricht.loesungsbuchstaben?.length ?? 0) > 0
            || (nachricht.staerken?.length ?? 0) > 0
            || enthaeltBuchstabierAufgabe(nachricht.nachricht);
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
        // Im Szenario-Modus bestimmt die globale Erzählreihenfolge die Slots,
        // im Zufallsmodus wie bisher die Runden-Reihenfolge über die ids.
        pool.sort((a, b) => (a.szenarioNr ?? a.id) - (b.szenarioNr ?? b.id));

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

    /**
     * Die Formel liegt im Modell, weil `toJson()` vor dem Speichern ohnehin
     * dort nachrechnet. Zwei Kopien würden früher oder später auseinanderlaufen.
     */
    public updateChecksum(uebung: FunkUebung) {
        uebung.updateChecksum();
    }

    private verteileNachrichtenFair(uebung: FunkUebung): Record<string, Nachricht[]> {
        const nachrichtenVerteilung: Record<string, Nachricht[]> = {};

        interface PoolEntry {
            sender: string; nachricht: { text: string; empfaenger: string[] }
        }
        const alleNachrichten: PoolEntry[] = [];

        const { anAlle, anMehrere, anEinzeln } = this.ermittleVerteilungsMengen(uebung);
        if (uebung.funksprueche.length === 0) {
            return nachrichtenVerteilung;
        }

        const dealer = this.createSpruchDealer(uebung.funksprueche, this.rng);
        if (dealer.poolSize === 0) {
            return nachrichtenVerteilung;
        }

        const einzelEmpfaenger = this.verteileEinzelEmpfaenger(uebung.teilnehmerListe, anEinzeln);

        uebung.teilnehmerListe.forEach((teilnehmer, teilnehmerIndex) => {
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
            const eigeneEmpfaenger = einzelEmpfaenger[teilnehmerIndex] ?? [];
            for (let i = 0; i < anEinzeln; i++) {
                const spruch = dealer.draw(bereitsVerwendet);
                if (!spruch) {
                    continue;
                }
                bereitsVerwendet.add(spruch);
                const empfaenger = eigeneEmpfaenger[i]
                    ?? this.getRandomOther(uebung.teilnehmerListe, teilnehmer);
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
     * Erzeugt die Nachrichten aus einem Szenario-Drehbuch statt aus dem
     * Zufallspool.
     *
     * Skalierung auf die variable Teilnehmerzahl: Die Handlungsstränge des
     * Szenarios werden (seeded) gemischt und reihum an die Teilnehmer
     * vergeben — bei wenigen Teilnehmern übernimmt jeder mehrere Stränge,
     * höchstens gibt es so viele Teilnehmer wie Stränge. Je Strang wird ein
     * Partner zugelost. Die Stränge laufen anschließend zeitlich verzahnt
     * (seeded gemischte globale Reihenfolge, die die Reihenfolge innerhalb
     * jedes Strangs bewahrt) — wie parallele Einsatzstellen derselben Lage.
     *
     * `id` bleibt wie im Zufallsmodus die lückenlose Sende-Reihenfolge je
     * Absender (Anmeldung = 1); zusätzlich erhält jede Nachricht mit
     * `szenarioNr` die global eindeutige Erzählposition, nach der die
     * senderübergreifenden Ansichten sortieren.
     */
    private verteileNachrichtenNachSzenario(
        uebung: FunkUebung,
        szenario: Szenario
    ): Record<string, Nachricht[]> {
        const teilnehmer = uebung.teilnehmerListe;
        const anzahl = teilnehmer.length;
        const minTeilnehmer = Math.max(2, szenario.minTeilnehmer);
        const maxTeilnehmer = szenarioMaxTeilnehmer(szenario);
        if (anzahl < minTeilnehmer || anzahl > maxTeilnehmer) {
            throw new Error(
                `Szenario "${szenario.titel}" ist für ${minTeilnehmer} bis ${maxTeilnehmer} ` +
                `Teilnehmer ausgelegt, die Übung hat ${anzahl}.`
            );
        }

        // Stränge seeded mischen und reihum an die Teilnehmer vergeben; die
        // Teilnehmer-Reihenfolge wird ebenfalls gemischt, damit nicht immer
        // die ersten Namen der Liste die meisten Stränge bekommen. Mit der
        // Übungsleitung wird nicht kommuniziert — Meldungen eines Strangs
        // empfängt eine je Strang fest zugeloste Gegenstelle (anderer
        // Teilnehmer), bevorzugt jemand Drittes neben dem Partner.
        const rotation = this.shuffle(teilnehmer);
        const instanzen = this.shuffle(szenario.straenge).map((strang, index) => {
            const ich = rotation[index % anzahl] as string;
            const andere = teilnehmer.filter(t => t !== ich);
            const partner = andere[randomInt(andere.length, this.rng)] ?? ich;
            const dritte = andere.filter(t => t !== partner);
            const gegenstelle = dritte.length > 0
                ? dritte[randomInt(dritte.length, this.rng)] ?? partner
                : partner;
            return { ich, partner, gegenstelle, sprueche: strang.sprueche };
        });

        const aufloesenEmpfaenger = (
            empfaenger: SzenarioEmpfaenger,
            sender: string,
            ich: string,
            partner: string,
            gegenstelle: string
        ): string[] => {
            switch (empfaenger) {
                case "gegenstelle":
                    // Bei zwei Teilnehmern kann die Gegenstelle der Partner und
                    // damit der Sender selbst sein — dann empfängt der Inhaber.
                    return [gegenstelle !== sender ? gegenstelle : ich];
                case "alle":
                    return teilnehmer.filter(t => t !== sender);
                case "ich":
                    return [ich];
                case "partner":
                    return [partner];
            }
        };
        const aufloesenText = (text: string, ich: string, partner: string, gegenstelle: string): string =>
            text
                .replace(/\{\{ich\}\}/g, ich)
                .replace(/\{\{partner\}\}/g, partner)
                .replace(/\{\{gegenstelle\}\}/g, gegenstelle);

        const ereignisse: { sender: string; empfaenger: string[]; text: string }[] = [];

        // Rahmensprüche: Absender rotieren über die gemischte Teilnehmerfolge.
        szenario.einleitung.forEach((spruch, index) => {
            const sender = rotation[index % anzahl] as string;
            ereignisse.push({
                sender,
                empfaenger: aufloesenEmpfaenger(spruch.empfaenger, sender, sender, sender, sender),
                text: aufloesenText(spruch.text, sender, sender, sender)
            });
        });

        // Verzahnung: Multimenge der Strang-Indizes mischen — das ergibt eine
        // gleichverteilte globale Reihenfolge, in der jeder Strang seine
        // interne Spruch-Reihenfolge behält.
        const folge = this.shuffle(
            instanzen.flatMap((instanz, index) => instanz.sprueche.map(() => index))
        );
        const zeiger = instanzen.map(() => 0);
        folge.forEach(index => {
            const instanz = instanzen[index];
            if (!instanz) {
                return;
            }
            const spruch = instanz.sprueche[zeiger[index] ?? 0];
            zeiger[index] = (zeiger[index] ?? 0) + 1;
            if (!spruch) {
                return;
            }
            const sender = spruch.absender === "partner" ? instanz.partner : instanz.ich;
            ereignisse.push({
                sender,
                empfaenger: aufloesenEmpfaenger(
                    spruch.empfaenger, sender, instanz.ich, instanz.partner, instanz.gegenstelle
                ),
                text: aufloesenText(spruch.text, instanz.ich, instanz.partner, instanz.gegenstelle)
            });
        });

        szenario.abschluss.forEach((spruch, index) => {
            const sender = rotation[(szenario.einleitung.length + index) % anzahl] as string;
            ereignisse.push({
                sender,
                empfaenger: aufloesenEmpfaenger(spruch.empfaenger, sender, sender, sender, sender),
                text: aufloesenText(spruch.text, sender, sender, sender)
            });
        });

        const verteilung: Record<string, Nachricht[]> = {};
        const zaehler: Record<string, number> = {};
        let szenarioNr = 1;
        teilnehmer.forEach(t => {
            verteilung[t] = [];
            zaehler[t] = 1;
        });
        if (uebung.anmeldungAktiv) {
            teilnehmer.forEach(t => {
                verteilung[t]?.push({
                    id: 1,
                    nachricht: "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.",
                    empfaenger: [uebung.leitung],
                    szenarioNr: szenarioNr++
                });
                zaehler[t] = 2;
            });
        }
        ereignisse.forEach(ereignis => {
            const naechsteId = zaehler[ereignis.sender] ?? 1;
            zaehler[ereignis.sender] = naechsteId + 1;
            verteilung[ereignis.sender]?.push({
                id: naechsteId,
                nachricht: ereignis.text,
                empfaenger: ereignis.empfaenger,
                szenarioNr: szenarioNr++
            });
        });

        return verteilung;
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

        // "An Mehrere" heißt mindestens zwei Empfänger. Ohne diese Untergrenze konnte der
        // 50-75-%-Zweig bei nur zwei möglichen Empfängern eine Gruppe der Größe 1 liefern –
        // die Nachricht wäre dann faktisch eine Einzelnachricht gewesen. Nur wenn es
        // überhaupt weniger als zwei andere Teilnehmer gibt, bleibt die Gruppe kleiner.
        const untergrenze = Math.min(2, gesamtTeilnehmer);
        zufallsGroesse = Math.min(Math.max(zufallsGroesse, untergrenze), gesamtTeilnehmer);
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

    /**
     * Ermittelt, wie viele Nachrichten pro Teilnehmer an Alle, an Mehrere und einzeln gehen.
     *
     * Lösungsbuchstaben lassen sich ausschließlich über einzeln adressierte Nachrichten
     * zustellen. Lässt die Konfiguration dafür keinen Platz, bekommt die Einzelnachricht
     * Vorrang vor einem Rundspruch – sonst bliebe das Lösungswort stillschweigend
     * unzustellbar. Die Gesamtzahl der Nachrichten pro Teilnehmer bleibt unverändert.
     */
    private ermittleVerteilungsMengen(
        uebung: FunkUebung
    ): { anAlle: number; anMehrere: number; anEinzeln: number } {
        const anmeldungsOffset = uebung.anmeldungAktiv ? 1 : 0;
        const budget = uebung.spruecheProTeilnehmer - anmeldungsOffset;
        let anAlle = Math.max(0, uebung.spruecheAnAlle);
        let anMehrere = Math.max(0, uebung.spruecheAnMehrere);

        if (budget >= 1 && this.brauchtTraegerNachrichten(uebung)) {
            let ueberhang = anAlle + anMehrere - (budget - 1);
            while (ueberhang > 0 && anMehrere > 0) {
                anMehrere--;
                ueberhang--;
            }
            while (ueberhang > 0 && anAlle > 0) {
                anAlle--;
                ueberhang--;
            }
        }

        return { anAlle, anMehrere, anEinzeln: Math.max(0, budget - anAlle - anMehrere) };
    }

    private brauchtTraegerNachrichten(uebung: FunkUebung): boolean {
        return Object.values(uebung.loesungswoerter || {}).some(wort => !!wort && wort.length > 0);
    }

    /**
     * Wählt die Empfänger der Einzelnachrichten so, dass jeder Teilnehmer exakt gleich
     * viele erhält.
     *
     * Zuvor zog `getRandomOther` für jede Nachricht unabhängig einen Empfänger. Die
     * Empfangszahl war dadurch poissonverteilt: Bei wenigen Einzelnachrichten ging
     * regelmäßig ein Teilnehmer leer aus – sein Lösungswort blieb dann unzustellbar,
     * weil `verteileLoesungswoerterMitIndex` keine Trägernachricht findet.
     *
     * Deshalb wird die Empfängerliste als Multimenge aufgebaut (jeder Teilnehmer genau
     * `proTeilnehmer` mal), gemischt und anschließend werden Selbstadressierungen durch
     * Tausch aufgelöst. Ein Tausch verschiebt nur Positionen, die Mengen – und damit die
     * exakte Gleichverteilung – bleiben erhalten.
     */
    private verteileEinzelEmpfaenger(teilnehmerListe: string[], proTeilnehmer: number): string[][] {
        if (teilnehmerListe.length === 0 || proTeilnehmer <= 0) {
            return teilnehmerListe.map(() => []);
        }
        if (teilnehmerListe.length === 1) {
            // Einzelner Teilnehmer: Selbstadressierung ist unvermeidbar.
            const allein = teilnehmerListe[0] as string;
            return [Array.from({ length: proTeilnehmer }, () =>
                this.getRandomOther(teilnehmerListe, allein)
            )];
        }

        const senderProSlot = teilnehmerListe.flatMap(t => Array<string>(proTeilnehmer).fill(t));
        const empfaengerProSlot = this.shuffle(senderProSlot);

        for (let i = 0; i < empfaengerProSlot.length; i++) {
            const sender = senderProSlot[i] as string;
            if (empfaengerProSlot[i] !== sender) {
                continue;
            }
            // Ein Slot, der weder an den eigenen Sender adressiert ist noch von ihm stammt.
            // Bei mindestens zwei Teilnehmern gibt es davon immer einen.
            const tausch = empfaengerProSlot.findIndex(
                (empfaenger, k) => k !== i && empfaenger !== sender && senderProSlot[k] !== sender
            );
            if (tausch < 0) {
                continue;
            }
            empfaengerProSlot[i] = empfaengerProSlot[tausch] as string;
            empfaengerProSlot[tausch] = sender;
        }

        return teilnehmerListe.map((_, index) =>
            empfaengerProSlot.slice(index * proTeilnehmer, (index + 1) * proTeilnehmer)
        );
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
