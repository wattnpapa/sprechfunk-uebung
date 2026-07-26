import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { GenerationService } from "../../src/services/GenerationService";
import { FunkUebung } from "../../src/models/FunkUebung";
import { enthaeltBuchstabierAufgabe } from "../../src/utils/buchstabieren";
import { createSeededRng } from "../../src/utils/random";
import type { Nachricht } from "../../src/types/Nachricht";

/**
 * Property-based Tests für die Verteilungslogik.
 *
 * Der Generator trifft an sehr vielen Stellen Zufallsentscheidungen. Beispieltests
 * treffen davon immer nur einen Pfad, deshalb prüfen diese Tests Invarianten über
 * zufällig erzeugte Konfigurationen hinweg.
 *
 * Damit ein Fehlschlag reproduzierbar bleibt, wird der Seed der Übung selbst von
 * fast-check erzeugt (`uebung.seed`); das gemeldete Counterexample enthält ihn also
 * mit, und `generate` baut daraus dieselbe Zufallsquelle wie im Produktivbetrieb.
 *
 * Wird eine private Routine direkt aufgerufen, läuft `generate` nicht – dann greift
 * die Voreinstellung `Math.random`, die `mitZufall` deterministisch ersetzt.
 */

const LEITUNG = "Leitstelle Wind 10";

/** Führt `fn` mit deterministisch geseedetem `Math.random` aus. */
function mitZufall<T>(seed: number, fn: () => T): T {
    const spy = vi.spyOn(Math, "random").mockImplementation(createSeededRng(seed));
    try {
        return fn();
    } finally {
        spy.mockRestore();
    }
}

/** Zugriff auf die private Verteilungsroutine, ohne `any` zu verwenden. */
interface GenerationServiceIntern {
    verteileLoesungswoerterMitIndex(uebung: FunkUebung): void;
}

function intern(service: GenerationService): GenerationServiceIntern {
    return service as unknown as GenerationServiceIntern;
}

/** Zerlegt ein Token der Form `"12A"` in Index und Buchstabe. */
function parseToken(token: string): { index: number; buchstabe: string } {
    const treffer = /^(\d+)(.+)$/.exec(token);
    if (!treffer?.[1] || !treffer[2]) {
        throw new Error(`Unerwartetes Lösungstoken: ${JSON.stringify(token)}`);
    }
    return { index: Number(treffer[1]), buchstabe: treffer[2] };
}

/**
 * Rekonstruiert das Lösungswort so, wie es ein Teilnehmer tun würde: Er sieht nur die
 * an ihn gerichteten Nachrichten, sammelt deren Lösungsbuchstaben und sortiert sie
 * nach dem vorangestellten Index.
 */
function rekonstruiereLoesungswort(nachrichten: Nachricht[]): string {
    return nachrichten
        .flatMap(n => n.loesungsbuchstaben ?? [])
        .map(parseToken)
        .sort((a, b) => a.index - b.index)
        .map(t => t.buchstabe)
        .join("");
}

/** Alle Nachrichten, die ein Teilnehmer als alleiniger Empfänger erhält. */
function alleinAdressiert(uebung: FunkUebung, empfaenger: string): Nachricht[] {
    return Object.entries(uebung.nachrichten)
        .filter(([absender]) => absender !== empfaenger)
        .flatMap(([, liste]) => liste)
        .filter(n => n.empfaenger.length === 1 && n.empfaenger[0] === empfaenger);
}

// --- Arbitraries -----------------------------------------------------------

const seedArb = fc.integer({ min: 0, max: 0x7fffffff });

const teilnehmerArb = fc
    .integer({ min: 2, max: 10 })
    .map(anzahl => Array.from({ length: anzahl }, (_, i) => `Heros Ort ${i + 1}`));

/**
 * Erzeugt einen Vorlagen-Pool, in dem jeder Spruch ein Wort mit mindestens fünf
 * Zeichen und zwei Buchstaben enthält. Damit ist eine Buchstabier-Aufgabe immer
 * erzeugbar *und* immer entfernbar – der Zielwert ist also stets erreichbar.
 */
const funkspruecheArb = fc
    .array(fc.boolean(), { minLength: 15, maxLength: 40 })
    .map(flags =>
        flags.map((mitAufgabe, i) =>
            mitAufgabe
                ? `Meldung ${i + 1} erreicht Abschnitt NIENBURG${i + 1}`
                : `Meldung ${i + 1} erreicht die Leitstelle Nummer ${i + 1}`
        )
    );

const loesungswortArb = fc.stringMatching(/^[A-ZÄÖÜ]{1,14}$/);

interface Konfiguration {
    spruecheProTeilnehmer: number;
    spruecheAnAlle: number;
    spruecheAnMehrere: number;
    buchstabierenAn: number;
    anmeldungAktiv: boolean;
    autoStaerkeErgaenzen: boolean;
}

interface UebungsFall {
    seed: number;
    teilnehmerListe: string[];
    funksprueche: string[];
    konfig: Konfiguration;
    loesungswoerter: Record<string, string>;
}

const konfigArb: fc.Arbitrary<Konfiguration> = fc.record({
    spruecheProTeilnehmer: fc.integer({ min: 1, max: 12 }),
    spruecheAnAlle: fc.integer({ min: 0, max: 2 }),
    spruecheAnMehrere: fc.integer({ min: 0, max: 3 }),
    buchstabierenAn: fc.integer({ min: 0, max: 8 }),
    anmeldungAktiv: fc.boolean(),
    autoStaerkeErgaenzen: fc.boolean()
});

const uebungArb: fc.Arbitrary<UebungsFall> = fc
    .record({
        seed: seedArb,
        teilnehmerListe: teilnehmerArb,
        funksprueche: funkspruecheArb,
        konfig: konfigArb
    })
    .chain(basis =>
        fc
            // Nicht jeder Teilnehmer bekommt zwingend ein Lösungswort.
            .array(fc.option(loesungswortArb, { nil: undefined }), {
                minLength: basis.teilnehmerListe.length,
                maxLength: basis.teilnehmerListe.length
            })
            .map(woerter => {
                const loesungswoerter: Record<string, string> = {};
                basis.teilnehmerListe.forEach((teilnehmer, i) => {
                    const wort = woerter[i];
                    if (wort) {
                        loesungswoerter[teilnehmer] = wort;
                    }
                });
                return { ...basis, loesungswoerter };
            })
    );

function baueUebung(fall: UebungsFall): FunkUebung {
    const uebung = new FunkUebung("test");
    // Steuert die Zufallsquelle von `generate` – ohne gesetzten Seed würfelt der
    // Generator selbst einen aus und der Lauf wäre nicht nachstellbar.
    uebung.seed = String(fall.seed);
    uebung.leitung = LEITUNG;
    uebung.teilnehmerListe = [...fall.teilnehmerListe];
    uebung.funksprueche = [...fall.funksprueche];
    uebung.loesungswoerter = { ...fall.loesungswoerter };
    uebung.spruecheProTeilnehmer = fall.konfig.spruecheProTeilnehmer;
    uebung.spruecheAnAlle = fall.konfig.spruecheAnAlle;
    uebung.spruecheAnMehrere = fall.konfig.spruecheAnMehrere;
    uebung.buchstabierenAn = fall.konfig.buchstabierenAn;
    uebung.anmeldungAktiv = fall.konfig.anmeldungAktiv;
    uebung.autoStaerkeErgaenzen = fall.konfig.autoStaerkeErgaenzen;
    return uebung;
}

/**
 * Erwartete Nachrichtenzahl pro Teilnehmer laut Konfiguration.
 *
 * Sind Lösungswörter gesetzt, weicht ein Rundspruch zugunsten einer Trägernachricht –
 * die Summe bleibt dabei bei `spruecheProTeilnehmer`. Ohne Lösungswörter kann eine
 * überbuchte Konfiguration (an Alle + an Mehrere > Budget) die Summe überschreiten.
 */
function erwarteteNachrichtenAnzahl(uebung: FunkUebung): number {
    const offset = uebung.anmeldungAktiv ? 1 : 0;
    const budget = uebung.spruecheProTeilnehmer - offset;
    const anAlle = Math.max(0, uebung.spruecheAnAlle);
    const anMehrere = Math.max(0, uebung.spruecheAnMehrere);
    const brauchtTraeger = Object.values(uebung.loesungswoerter).some(wort => wort.length > 0);

    if (brauchtTraeger && budget >= 1) {
        return offset + budget;
    }
    return offset + Math.max(anAlle + anMehrere, Math.max(0, budget));
}

describe("GenerationService – Invarianten der Verteilung", () => {
    beforeEach(() => {
        // shuffleSmart warnt, wenn keine perfekte Reihenfolge gefunden wird.
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("adressiert niemals den Absender selbst und liefert immer mindestens einen Empfänger", () => {
        fc.assert(
            fc.property(uebungArb, fall => {
                const uebung = baueUebung(fall);
                new GenerationService().generate(uebung);

                Object.entries(uebung.nachrichten).forEach(([absender, liste]) => {
                    liste.forEach(nachricht => {
                        expect(nachricht.empfaenger).not.toContain(absender);
                        expect(nachricht.empfaenger.length).toBeGreaterThan(0);
                        nachricht.empfaenger.forEach(empfaenger => {
                            expect(
                                empfaenger === LEITUNG || uebung.teilnehmerListe.includes(empfaenger)
                            ).toBe(true);
                        });
                    });
                });
            })
        );
    });

    it("vergibt pro Teilnehmer die konfigurierte Anzahl Nachrichten mit lückenlosen IDs", () => {
        fc.assert(
            fc.property(uebungArb, fall => {
                const uebung = baueUebung(fall);
                new GenerationService().generate(uebung);

                const erwartet = erwarteteNachrichtenAnzahl(uebung);
                expect(Object.keys(uebung.nachrichten).sort()).toEqual(
                    [...uebung.teilnehmerListe].sort()
                );

                uebung.teilnehmerListe.forEach(teilnehmer => {
                    const liste = uebung.nachrichten[teilnehmer] ?? [];
                    expect(liste).toHaveLength(erwartet);
                    expect(liste.map(n => n.id).sort((a, b) => a - b)).toEqual(
                        Array.from({ length: erwartet }, (_, i) => i + 1)
                    );
                });
            })
        );
    });

    it("trifft den Zielwert der Buchstabier-Aufgaben pro Teilnehmer", () => {
        fc.assert(
            fc.property(uebungArb, fall => {
                const uebung = baueUebung(fall);
                new GenerationService().generate(uebung);

                const start = uebung.anmeldungAktiv ? 1 : 0;
                uebung.teilnehmerListe.forEach(teilnehmer => {
                    const uebungsNachrichten = (uebung.nachrichten[teilnehmer] ?? []).slice(start);
                    const ziel = Math.max(
                        0,
                        Math.min(uebung.buchstabierenAn, uebungsNachrichten.length)
                    );
                    const tatsaechlich = uebungsNachrichten.filter(n =>
                        enthaeltBuchstabierAufgabe(n.nachricht)
                    ).length;
                    expect(tatsaechlich).toBe(ziel);
                });
            })
        );
    });

    it("lässt jeden Empfänger sein Lösungswort vollständig rekonstruieren", () => {
        let rekonstruiert = 0;

        fc.assert(
            fc.property(uebungArb, fall => {
                const uebung = baueUebung(fall);
                new GenerationService().generate(uebung);

                const budget = uebung.spruecheProTeilnehmer - (uebung.anmeldungAktiv ? 1 : 0);

                Object.entries(uebung.loesungswoerter).forEach(([empfaenger, wort]) => {
                    const eigene = alleinAdressiert(uebung, empfaenger);

                    if (eigene.length === 0) {
                        // Garantie: Ohne Trägernachricht darf niemand dastehen, solange die
                        // Konfiguration überhaupt Platz für eine zweite Nachricht lässt.
                        // Bei `spruecheProTeilnehmer <= Anmeldung` ist das arithmetisch
                        // unmöglich – nur dann ist dieser Zweig zulässig.
                        expect(budget).toBeLessThan(1);
                        return;
                    }

                    rekonstruiert++;
                    expect(rekonstruiereLoesungswort(eigene)).toBe(wort);
                });
            })
        );

        // Verhindert, dass die Eigenschaft still vakuum läuft.
        expect(rekonstruiert).toBeGreaterThan(0);
    });

    it("gibt jedem Teilnehmer gleich viele einzeln adressierte Nachrichten", () => {
        let mitEinzelnachrichten = 0;

        fc.assert(
            // Ab drei Teilnehmern haben Rundsprüche garantiert mindestens zwei Empfänger,
            // einzeln adressiert sind also genau die Einzelnachrichten.
            fc.property(uebungArb.filter(fall => fall.teilnehmerListe.length >= 3), fall => {
                const uebung = baueUebung(fall);
                new GenerationService().generate(uebung);

                const anzahlen = uebung.teilnehmerListe.map(
                    teilnehmer => alleinAdressiert(uebung, teilnehmer).length
                );
                // Exakt gleich viele – nicht nur annähernd. Mit unabhängiger Ziehung
                // (dem alten `getRandomOther`) wäre die Zahl poissonverteilt.
                expect(new Set(anzahlen).size).toBe(1);
                if ((anzahlen[0] ?? 0) > 0) {
                    mitEinzelnachrichten++;
                }
            })
        );

        // Ohne Einzelnachrichten wären alle Zähler 0 und die Prüfung wertlos.
        expect(mitEinzelnachrichten).toBeGreaterThan(0);
    });

    it("schafft Platz für eine Trägernachricht, sobald Lösungswörter gesetzt sind", () => {
        fc.assert(
            fc.property(
                uebungArb.filter(
                    fall =>
                        fall.teilnehmerListe.length >= 3 &&
                        Object.keys(fall.loesungswoerter).length > 0 &&
                        fall.konfig.spruecheProTeilnehmer - (fall.konfig.anmeldungAktiv ? 1 : 0) >= 1
                ),
                fall => {
                    const uebung = baueUebung(fall);
                    new GenerationService().generate(uebung);

                    // Auch wenn an Alle plus an Mehrere das Budget vollständig belegen würden,
                    // bleibt mindestens eine Einzelnachricht übrig.
                    uebung.teilnehmerListe.forEach(teilnehmer => {
                        expect(alleinAdressiert(uebung, teilnehmer).length).toBeGreaterThanOrEqual(1);
                    });
                    // Die Gesamtzahl der Nachrichten bleibt trotzdem unangetastet.
                    uebung.teilnehmerListe.forEach(teilnehmer => {
                        expect(uebung.nachrichten[teilnehmer]).toHaveLength(
                            erwarteteNachrichtenAnzahl(uebung)
                        );
                    });
                }
            )
        );
    });

    it("verteilt jeden Lösungsbuchstaben genau einmal und nur in Nachrichten an den Empfänger", () => {
        fc.assert(
            fc.property(uebungArb, fall => {
                const uebung = baueUebung(fall);
                new GenerationService().generate(uebung);

                Object.entries(uebung.nachrichten).forEach(([absender, liste]) => {
                    liste.forEach(nachricht => {
                        (nachricht.loesungsbuchstaben ?? []).forEach(token => {
                            // Ein Buchstabe darf nur in einer einzeln adressierten Nachricht
                            // eines anderen Absenders stecken – sonst läse ihn ein Dritter mit
                            // oder der Empfänger würde ihn selbst versenden.
                            expect(nachricht.empfaenger).toHaveLength(1);
                            const ziel = nachricht.empfaenger[0] as string;
                            expect(ziel).not.toBe(absender);
                            expect(uebung.loesungswoerter[ziel]).toBeTruthy();
                            // Der Buchstabe muss auch im Klartext der Nachricht stehen.
                            expect(nachricht.nachricht).toContain(` ${token}`);
                        });
                    });
                });

                Object.entries(uebung.loesungswoerter).forEach(([empfaenger, wort]) => {
                    const tokens = alleinAdressiert(uebung, empfaenger).flatMap(
                        n => n.loesungsbuchstaben ?? []
                    );
                    if (tokens.length === 0) {
                        return;
                    }
                    expect(new Set(tokens).size).toBe(tokens.length);
                    expect(tokens.map(t => parseToken(t).index).sort((a, b) => a - b)).toEqual(
                        Array.from({ length: wort.length }, (_, i) => i + 1)
                    );
                });
            })
        );
    });
});

// --- Direkte Absicherung von verteileLoesungswoerterMitIndex ---------------

/**
 * Szenario für den Modulo-Fallback in `verteileLoesungswoerterMitIndex`
 * (`nachrichtenFuerEmpfaenger[i % nachrichtenFuerEmpfaenger.length]`, GenerationService.ts:463).
 *
 * Der Fallback greift, sobald das Lösungswort länger ist als die erste Hälfte der
 * verfügbaren Trägernachrichten. Hier wird die Übung deshalb direkt zusammengebaut,
 * damit sich Trägeranzahl und Wortlänge unabhängig voneinander variieren lassen.
 */
const szenarioArb = fc.record({
    seed: seedArb,
    anzahlTraeger: fc.integer({ min: 0, max: 9 }),
    wortLaenge: fc.integer({ min: 1, max: 20 }),
    mitMehrfachEmpfaenger: fc.boolean(),
    mitFremdNachricht: fc.boolean(),
    mitEigenerNachricht: fc.boolean()
});

interface Szenario {
    uebung: FunkUebung;
    wort: string;
    traeger: Nachricht[];
    unbeteiligte: Nachricht[];
}

function baueSzenario(fall: {
    anzahlTraeger: number;
    wortLaenge: number;
    mitMehrfachEmpfaenger: boolean;
    mitFremdNachricht: boolean;
    mitEigenerNachricht: boolean;
}): Szenario {
    const empfaenger = "Heros Ziel 10";
    const absender = "Heros Quelle 20";
    const dritter = "Heros Dritt 30";
    const wort = "ABCDEFGHIJKLMNOPQRST".slice(0, fall.wortLaenge);

    const traeger: Nachricht[] = Array.from({ length: fall.anzahlTraeger }, (_, i) => ({
        id: i + 1,
        empfaenger: [empfaenger],
        nachricht: `Traegermeldung ${i + 1}`,
        loesungsbuchstaben: []
    }));

    const unbeteiligte: Nachricht[] = [];
    if (fall.mitMehrfachEmpfaenger) {
        // Mehrere Empfänger: darf keinen Lösungsbuchstaben bekommen.
        unbeteiligte.push({
            id: 100,
            empfaenger: [empfaenger, dritter],
            nachricht: "Rundspruch an mehrere",
            loesungsbuchstaben: []
        });
    }
    if (fall.mitFremdNachricht) {
        // Einzeln adressiert, aber an jemand anderen.
        unbeteiligte.push({
            id: 101,
            empfaenger: [dritter],
            nachricht: "Meldung an Dritte",
            loesungsbuchstaben: []
        });
    }

    // Auch die ausgehenden Nachrichten des Empfängers dürfen keine Buchstaben tragen.
    const eigene: Nachricht[] = fall.mitEigenerNachricht
        ? [{ id: 1, empfaenger: [dritter], nachricht: "Eigene Meldung", loesungsbuchstaben: [] }]
        : [];

    const uebung = new FunkUebung("test");
    uebung.leitung = LEITUNG;
    uebung.teilnehmerListe = [empfaenger, absender, dritter];
    uebung.loesungswoerter = { [empfaenger]: wort };
    uebung.nachrichten = {
        [absender]: [...traeger, ...unbeteiligte],
        [empfaenger]: eigene,
        [dritter]: []
    };

    return { uebung, wort, traeger, unbeteiligte: [...unbeteiligte, ...eigene] };
}

describe("verteileLoesungswoerterMitIndex – Modulo-Fallback", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("verteilt das gesamte Wort auf die Trägernachrichten – auch wenn es länger ist als die Trägerzahl", () => {
        fc.assert(
            fc.property(szenarioArb, fall => {
                const { uebung, wort, traeger, unbeteiligte } = baueSzenario(fall);

                mitZufall(fall.seed, () =>
                    intern(new GenerationService()).verteileLoesungswoerterMitIndex(uebung)
                );

                const tokens = traeger.flatMap(n => n.loesungsbuchstaben ?? []);

                if (traeger.length === 0) {
                    // Ohne Träger wird nichts verteilt – und nichts angefasst.
                    expect(tokens).toEqual([]);
                    unbeteiligte.forEach(n => expect(n.loesungsbuchstaben).toEqual([]));
                    return;
                }

                // Jeder Buchstabe genau einmal, Indizes lückenlos 1..n.
                expect(tokens).toHaveLength(wort.length);
                expect(new Set(tokens).size).toBe(tokens.length);
                expect(tokens.map(t => parseToken(t).index).sort((a, b) => a - b)).toEqual(
                    Array.from({ length: wort.length }, (_, i) => i + 1)
                );

                // Der Empfänger kann das Wort vollständig zusammensetzen.
                expect(rekonstruiereLoesungswort(traeger)).toBe(wort);

                // Nicht adressierte Nachrichten bleiben unberührt.
                unbeteiligte.forEach(n => expect(n.loesungsbuchstaben).toEqual([]));
            })
        );
    });

    it("schreibt jeden Buchstaben auch in den Nachrichtentext", () => {
        fc.assert(
            fc.property(szenarioArb, fall => {
                const { uebung, traeger, unbeteiligte } = baueSzenario(fall);
                const originalTexte = new Map(
                    [...traeger, ...unbeteiligte].map(n => [n, n.nachricht] as const)
                );

                mitZufall(fall.seed, () =>
                    intern(new GenerationService()).verteileLoesungswoerterMitIndex(uebung)
                );

                traeger.forEach(nachricht => {
                    const tokens = nachricht.loesungsbuchstaben ?? [];
                    const erwarteterText =
                        originalTexte.get(nachricht) + tokens.map(t => ` ${t}`).join("");
                    expect(nachricht.nachricht).toBe(erwarteterText);
                });

                unbeteiligte.forEach(nachricht => {
                    expect(nachricht.nachricht).toBe(originalTexte.get(nachricht));
                });
            })
        );
    });

    it("streut die Buchstaben gleichmäßig über die Trägernachrichten", () => {
        fc.assert(
            fc.property(
                szenarioArb.filter(fall => fall.anzahlTraeger > 0),
                fall => {
                    const { uebung, wort, traeger } = baueSzenario(fall);

                    mitZufall(fall.seed, () =>
                        intern(new GenerationService()).verteileLoesungswoerterMitIndex(uebung)
                    );

                    // Der Fallback ist eine Round-Robin-Verteilung: jede Trägernachricht
                    // bekommt floor(L/n) oder ceil(L/n) Buchstaben, keine wird überladen.
                    // (Der Sonderfall "erste Hälfte" in Zeile 461/462 liefert dasselbe
                    // Ergebnis wie der Modulo, weil dort immer i < ceil(n/2) <= n gilt.)
                    const anzahlen = traeger.map(n => (n.loesungsbuchstaben ?? []).length);
                    const untergrenze = Math.floor(wort.length / traeger.length);
                    const obergrenze = Math.ceil(wort.length / traeger.length);
                    anzahlen.forEach(anzahl => {
                        expect(anzahl).toBeGreaterThanOrEqual(untergrenze);
                        expect(anzahl).toBeLessThanOrEqual(obergrenze);
                    });

                    // Solange das Wort nicht länger ist als die Trägerzahl, bekommt jede
                    // Nachricht höchstens einen Buchstaben.
                    if (wort.length <= traeger.length) {
                        expect(Math.max(...anzahlen)).toBeLessThanOrEqual(1);
                    }
                }
            )
        );
    });
});
