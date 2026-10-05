import type { FunkUebung } from "../models/FunkUebung";
import type { Nachricht } from "../types/Nachricht";
import { randomInt, randomIntBetween, shuffle, type Rng } from "../utils/random";
import { balanciereBuchstabierAufgaben } from "./generationNachbearbeitung";

const ANMELDUNG_TEXT = "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.";

export interface PoolEntry {
    sender: string;
    nachricht: { text?: string; empfaenger: string[] };
}

interface FairPoolEntry extends PoolEntry {
    nachricht: { text: string; empfaenger: string[] };
}

export interface SpruchDealer {
    poolSize: number;
    draw(bereitsVerwendet: Set<string>): string | undefined;
}

/**
 * Verteilt die Funksprüche wie ein Kartenspiel: Jeder Spruch wird einmal ausgeteilt,
 * bevor überhaupt ein Spruch ein zweites Mal vorkommt. Zusätzlich bekommt kein
 * Teilnehmer denselben Spruch doppelt, solange der Pool das hergibt.
 */
export function createSpruchDealer(funksprueche: string[], rng: Rng): SpruchDealer {
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

function istSammelEmpfang(empfaenger: string[]): boolean {
    return empfaenger.length > 1 || empfaenger[0] === "Alle";
}

function folgenSammelnachrichtenAufeinander<T extends PoolEntry>(liste: T[]): boolean {
    for (let i = 1; i < liste.length; i++) {
        const aktuell = liste[i] as T;
        const vorher = liste[i - 1] as T;
        if (istSammelEmpfang(aktuell.nachricht.empfaenger) && istSammelEmpfang(vorher.nachricht.empfaenger)) {
            return true;
        }
    }
    return false;
}

/** Mischt so, dass zwei Nachrichten an Alle/Mehrere möglichst nicht direkt aufeinanderfolgen. */
export function shuffleSmart<T extends PoolEntry>(nachrichtenListe: T[], rng: Rng): T[] {
    const maxVersuche = 100;
    let durchmischteListe = [...nachrichtenListe];

    for (let versuch = 0; versuch < maxVersuche; versuch++) {
        durchmischteListe = shuffle(durchmischteListe, rng);
        if (!folgenSammelnachrichtenAufeinander(durchmischteListe)) {
            return durchmischteListe;
        }
    }

    console.warn("⚠ Konnte keine perfekte Verteilung finden. Nutze beste Lösung.");
    return durchmischteListe;
}

function zufallsGruppengroesse(gesamtTeilnehmer: number, rng: Rng): number {
    const zufallsWert = rng();
    if (zufallsWert < 0.8) {
        return randomIntBetween(2, 3, rng);
    }
    if (zufallsWert < 0.9) {
        return randomIntBetween(4, Math.ceil(gesamtTeilnehmer / 2), rng);
    }
    if (zufallsWert < 0.95) {
        return randomIntBetween(
            Math.ceil(gesamtTeilnehmer * 0.5),
            Math.ceil(gesamtTeilnehmer * 0.75),
            rng
        );
    }
    // Größte Stufe: 85 % bis alle. Vorher standen hier Unter- und
    // Obergrenze vertauscht, wodurch der Zweig immer die volle Liste ergab.
    return randomIntBetween(Math.ceil(gesamtTeilnehmer * 0.85), gesamtTeilnehmer, rng);
}

export function getRandomSubsetOfOthers(teilnehmerListe: string[], aktuellerTeilnehmer: string, rng: Rng): string[] {
    const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);
    const gesamtTeilnehmer = andere.length;
    const gemischt = shuffle(andere, rng);

    let zufallsGroesse = zufallsGruppengroesse(gesamtTeilnehmer, rng);

    // "An Mehrere" heißt mindestens zwei Empfänger. Ohne diese Untergrenze konnte der
    // 50-75-%-Zweig bei nur zwei möglichen Empfängern eine Gruppe der Größe 1 liefern –
    // die Nachricht wäre dann faktisch eine Einzelnachricht gewesen. Nur wenn es
    // überhaupt weniger als zwei andere Teilnehmer gibt, bleibt die Gruppe kleiner.
    const untergrenze = Math.min(2, gesamtTeilnehmer);
    zufallsGroesse = Math.min(Math.max(zufallsGroesse, untergrenze), gesamtTeilnehmer);
    return gemischt.slice(0, zufallsGroesse);
}

export function getRandomOther(teilnehmerListe: string[], aktuellerTeilnehmer: string, rng: Rng): string {
    const andere = teilnehmerListe.filter(t => t !== aktuellerTeilnehmer);
    if (andere.length === 0) {
        return aktuellerTeilnehmer;
    }
    const randomIndex = randomInt(andere.length, rng);
    return andere[randomIndex] ?? aktuellerTeilnehmer;
}

function brauchtTraegerNachrichten(uebung: FunkUebung): boolean {
    return Object.values(uebung.loesungswoerter || {}).some(wort => !!wort && wort.length > 0);
}

/**
 * Ermittelt, wie viele Nachrichten pro Teilnehmer an Alle, an Mehrere und einzeln gehen.
 *
 * Lösungsbuchstaben lassen sich ausschließlich über einzeln adressierte Nachrichten
 * zustellen. Lässt die Konfiguration dafür keinen Platz, bekommt die Einzelnachricht
 * Vorrang vor einem Rundspruch – sonst bliebe das Lösungswort stillschweigend
 * unzustellbar. Die Gesamtzahl der Nachrichten pro Teilnehmer bleibt unverändert.
 */
export function ermittleVerteilungsMengen(
    uebung: FunkUebung
): { anAlle: number; anMehrere: number; anEinzeln: number } {
    const anmeldungsOffset = uebung.anmeldungAktiv ? 1 : 0;
    const budget = uebung.spruecheProTeilnehmer - anmeldungsOffset;
    let anAlle = Math.max(0, uebung.spruecheAnAlle);
    let anMehrere = Math.max(0, uebung.spruecheAnMehrere);

    if (budget >= 1 && brauchtTraegerNachrichten(uebung)) {
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
export function verteileEinzelEmpfaenger(teilnehmerListe: string[], proTeilnehmer: number, rng: Rng): string[][] {
    if (teilnehmerListe.length === 0 || proTeilnehmer <= 0) {
        return teilnehmerListe.map(() => []);
    }
    if (teilnehmerListe.length === 1) {
        // Einzelner Teilnehmer: Selbstadressierung ist unvermeidbar.
        const allein = teilnehmerListe[0] as string;
        return [Array.from({ length: proTeilnehmer }, () =>
            getRandomOther(teilnehmerListe, allein, rng)
        )];
    }

    const senderProSlot = teilnehmerListe.flatMap(t => Array<string>(proTeilnehmer).fill(t));
    const empfaengerProSlot = shuffle(senderProSlot, rng);
    loeseSelbstadressierungAuf(senderProSlot, empfaengerProSlot);

    return teilnehmerListe.map((_, index) =>
        empfaengerProSlot.slice(index * proTeilnehmer, (index + 1) * proTeilnehmer)
    );
}

function loeseSelbstadressierungAuf(senderProSlot: string[], empfaengerProSlot: string[]): void {
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
}

interface SpruchZiehung {
    dealer: SpruchDealer;
    bereitsVerwendet: Set<string>;
    pool: FairPoolEntry[];
    sender: string;
}

/** Zieht `anzahl` Sprüche; `empfaengerFuer(i)` liefert die Empfänger des i-ten Spruchs. */
function ziehe(ziehung: SpruchZiehung, anzahl: number, empfaengerFuer: (i: number) => string[]): void {
    for (let i = 0; i < anzahl; i++) {
        const spruch = ziehung.dealer.draw(ziehung.bereitsVerwendet);
        if (!spruch) {
            continue;
        }
        ziehung.bereitsVerwendet.add(spruch);
        ziehung.pool.push({
            sender: ziehung.sender,
            nachricht: { text: spruch, empfaenger: empfaengerFuer(i) }
        });
    }
}

function weiseZu(
    uebung: FunkUebung,
    gemischt: FairPoolEntry[],
    nachrichtenVerteilung: Record<string, Nachricht[]>
): void {
    // Zuerst zuweisen, danach die Buchstabier-Aufgaben auf den Zielwert bringen.
    const startId = uebung.anmeldungAktiv ? 2 : 1;
    const tempCounters: Record<string, number> = {};
    uebung.teilnehmerListe.forEach(teilnehmer => {
        tempCounters[teilnehmer] = startId;
    });

    gemischt.forEach(({ sender, nachricht }) => {
        const liste = nachrichtenVerteilung[sender] ?? [];
        nachrichtenVerteilung[sender] = liste;
        const id = tempCounters[sender] ?? startId;
        tempCounters[sender] = id + 1;
        liste.push({
            id,
            nachricht: nachricht.text,
            empfaenger: nachricht.empfaenger,
            loesungsbuchstaben: []
        });
    });
}

/** Zufallsmodus: verteilt den Spruchpool fair auf alle Teilnehmer. */
export function verteileNachrichtenFair(uebung: FunkUebung, rng: Rng): Record<string, Nachricht[]> {
    const nachrichtenVerteilung: Record<string, Nachricht[]> = {};
    const alleNachrichten: FairPoolEntry[] = [];

    const { anAlle, anMehrere, anEinzeln } = ermittleVerteilungsMengen(uebung);
    if (uebung.funksprueche.length === 0) {
        return nachrichtenVerteilung;
    }

    const dealer = createSpruchDealer(uebung.funksprueche, rng);
    if (dealer.poolSize === 0) {
        return nachrichtenVerteilung;
    }

    const liste = uebung.teilnehmerListe;
    const einzelEmpfaenger = verteileEinzelEmpfaenger(liste, anEinzeln, rng);

    liste.forEach((teilnehmer, teilnehmerIndex) => {
        nachrichtenVerteilung[teilnehmer] = uebung.anmeldungAktiv
            ? [{ id: 1, nachricht: ANMELDUNG_TEXT, empfaenger: [uebung.leitung] }]
            : [];
        const ziehung: SpruchZiehung = { dealer, bereitsVerwendet: new Set<string>(), pool: alleNachrichten, sender: teilnehmer };
        const eigeneEmpfaenger = einzelEmpfaenger[teilnehmerIndex] ?? [];

        ziehe(ziehung, anAlle, () => liste.filter(t => t !== teilnehmer));
        ziehe(ziehung, anMehrere, () => getRandomSubsetOfOthers(liste, teilnehmer, rng));
        ziehe(ziehung, anEinzeln, i => [eigeneEmpfaenger[i] ?? getRandomOther(liste, teilnehmer, rng)]);
    });

    weiseZu(uebung, shuffleSmart(alleNachrichten, rng), nachrichtenVerteilung);
    balanciereBuchstabierAufgaben(uebung, nachrichtenVerteilung, rng);

    return nachrichtenVerteilung;
}
