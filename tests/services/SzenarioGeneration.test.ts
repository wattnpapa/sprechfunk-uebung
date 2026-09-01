import { describe, expect, it } from "vitest";
import { GenerationService } from "../../src/services/GenerationService";
import { FunkUebung } from "../../src/models/FunkUebung";
import type { Szenario } from "../../src/types/Szenario";
import type { Nachricht } from "../../src/types/Nachricht";

/**
 * Der Szenario-Pfad verteilt kein Kartendeck, sondern ein Drehbuch: Stränge
 * werden seeded auf die Teilnehmer verteilt, die globale Erzählreihenfolge
 * (szenarioNr) verzahnt die Stränge und bewahrt die Reihenfolge innerhalb
 * jedes Strangs. Diese Tests fixieren genau diese Invarianten getrennt von
 * den Invarianten des Zufallsmodus.
 */

function baueSzenario(anzahlStraenge = 6, spruecheJeStrang = 4): Szenario {
    return {
        slug: "test-szenario",
        titel: "Testlage",
        beschreibung: "Testszenario für die Generierung.",
        lage: "Eine Übungslage für Tests.",
        minTeilnehmer: 2,
        einleitung: [
            { empfaenger: "alle", text: "Einleitung: Lage übernommen, Beginn der Übung." }
        ],
        straenge: Array.from({ length: anzahlStraenge }, (_, strangIndex) => ({
            titel: `Strang ${strangIndex + 1}`,
            sprueche: Array.from({ length: spruecheJeStrang }, (_, spruchIndex) => ({
                absender: (spruchIndex === 2 ? "partner" : "ich") as "ich" | "partner",
                empfaenger: (spruchIndex === 2 ? "ich" : "gegenstelle") as "ich" | "gegenstelle",
                text: `Strang ${strangIndex + 1}, Schritt ${spruchIndex + 1}: Lagemeldung zur Einsatzstelle.`
            }))
        })),
        abschluss: [
            { empfaenger: "alle", text: "Abschluss: Alle Einsatzstellen abgearbeitet." }
        ]
    };
}

function baueUebung(teilnehmerAnzahl = 3, seed = "szenario-test"): FunkUebung {
    const uebung = new FunkUebung("test");
    // Konstruktor würfelt Name und setzt das Tagesdatum — beides fließt in die
    // Checksumme und muss für Determinismus-Vergleiche fixiert werden.
    uebung.name = "Szenario-Testübung";
    uebung.datum = new Date("2026-08-31T10:00:00.000Z");
    uebung.teilnehmerListe = Array.from({ length: teilnehmerAnzahl }, (_, i) => `Teilnehmer ${i + 1}`);
    uebung.leitung = "Leitstelle Test";
    uebung.seed = seed;
    return uebung;
}

function alleNachrichten(uebung: FunkUebung): { sender: string; nachricht: Nachricht }[] {
    return Object.entries(uebung.nachrichten).flatMap(([sender, liste]) =>
        liste.map(nachricht => ({ sender, nachricht }))
    );
}

describe("GenerationService Szenario-Modus", () => {
    it("verteilt alle Drehbuch-Sprüche und die Anmeldungen", () => {
        const szenario = baueSzenario(6, 4);
        const uebung = baueUebung(3);
        new GenerationService().generate(uebung, szenario);

        const erwartet = uebung.teilnehmerListe.length // Anmeldungen
            + szenario.einleitung.length
            + szenario.abschluss.length
            + szenario.straenge.length * 4;
        expect(alleNachrichten(uebung)).toHaveLength(erwartet);
        expect(uebung.szenarioSlug).toBe("test-szenario");
    });

    it("vergibt je Absender lückenlose ids ab 1 in Array-Reihenfolge", () => {
        const uebung = baueUebung(4);
        new GenerationService().generate(uebung, baueSzenario());

        Object.values(uebung.nachrichten).forEach(liste => {
            liste.forEach((nachricht, index) => {
                expect(nachricht.id).toBe(index + 1);
            });
            expect(liste[0]?.nachricht).toContain("melde mich");
        });
    });

    it("vergibt szenarioNr global eindeutig und bewahrt die Reihenfolge je Strang", () => {
        const szenario = baueSzenario(5, 4);
        const uebung = baueUebung(3);
        new GenerationService().generate(uebung, szenario);

        const nachrichten = alleNachrichten(uebung);
        const nummern = nachrichten.map(n => n.nachricht.szenarioNr);
        expect(nummern.every(nr => typeof nr === "number")).toBe(true);
        expect(new Set(nummern).size).toBe(nummern.length);

        // Innerhalb jedes Strangs muss die Drehbuch-Reihenfolge erhalten sein.
        const positionen = new Map<string, number>();
        nachrichten.forEach(({ nachricht }) => {
            positionen.set(nachricht.nachricht, nachricht.szenarioNr as number);
        });
        szenario.straenge.forEach(strang => {
            const folge = strang.sprueche.map(spruch => positionen.get(spruch.text));
            folge.forEach(nr => expect(typeof nr).toBe("number"));
            const sortiert = [...folge].sort((a, b) => (a as number) - (b as number));
            expect(folge).toEqual(sortiert);
        });
    });

    it("erzeugt mit gleichem Seed exakt dieselbe Übung", () => {
        const laufe = [1, 2].map(() => {
            const uebung = baueUebung(4, "vergleichslauf");
            new GenerationService().generate(uebung, baueSzenario());
            return uebung;
        });
        expect(JSON.stringify(laufe[0]?.nachrichten)).toBe(JSON.stringify(laufe[1]?.nachrichten));
        expect(laufe[0]?.checksumme).toBe(laufe[1]?.checksumme);
    });

    it("adressiert nie den Absender selbst und löst 'alle' explizit auf", () => {
        const uebung = baueUebung(5);
        new GenerationService().generate(uebung, baueSzenario());

        alleNachrichten(uebung).forEach(({ sender, nachricht }) => {
            expect(nachricht.empfaenger.length).toBeGreaterThan(0);
            expect(nachricht.empfaenger).not.toContain(sender);
            expect(nachricht.empfaenger).not.toContain("Alle");
        });
    });

    it("gibt jedem Teilnehmer mindestens einen eigenen Strang", () => {
        const szenario = baueSzenario(6, 4);
        const uebung = baueUebung(4);
        new GenerationService().generate(uebung, szenario);

        uebung.teilnehmerListe.forEach(teilnehmer => {
            const eigene = (uebung.nachrichten[teilnehmer] ?? []).filter(n => n.id > 1);
            expect(eigene.length).toBeGreaterThan(0);
        });
    });

    it("lehnt unpassende Teilnehmerzahlen ab", () => {
        const szenario = baueSzenario(4, 4);
        const zuWenig = baueUebung(1);
        expect(() => new GenerationService().generate(zuWenig, szenario)).toThrow(/1/);

        const zuViele = baueUebung(5);
        expect(() => new GenerationService().generate(zuViele, szenario)).toThrow(/5/);
    });

    it("ersetzt die Platzhalter durch echte Funkrufnamen", () => {
        const szenario = baueSzenario(4, 4);
        const spruch = szenario.straenge[0]?.sprueche[0];
        if (spruch) {
            spruch.text = "Unterstützen {{partner}} und melden an {{gegenstelle}}.";
        }
        const uebung = baueUebung(3);
        new GenerationService().generate(uebung, szenario);

        const texte = alleNachrichten(uebung).map(n => n.nachricht.nachricht);
        expect(texte.some(t => t.includes("{{"))).toBe(false);
        expect(texte.some(t => /Unterstützen Teilnehmer \d und melden an Teilnehmer \d\./.test(t))).toBe(true);
    });

    it("adressiert außer der Anmeldung nie die Übungsleitung", () => {
        [2, 3, 6].forEach(teilnehmerAnzahl => {
            const uebung = baueUebung(teilnehmerAnzahl, `leitungsfrei-${teilnehmerAnzahl}`);
            new GenerationService().generate(uebung, baueSzenario());

            alleNachrichten(uebung).forEach(({ nachricht }) => {
                if (nachricht.id === 1) {
                    expect(nachricht.empfaenger).toEqual([uebung.leitung]);
                } else {
                    expect(nachricht.empfaenger).not.toContain(uebung.leitung);
                    nachricht.empfaenger.forEach(empfaenger => {
                        expect(uebung.teilnehmerListe).toContain(empfaenger);
                    });
                }
            });
        });
    });

    it("lässt kuratierte Texte unangetastet und deaktiviert Lösungswörter samt Auto-Stärken", () => {
        const szenario = baueSzenario(4, 4);
        const uebung = baueUebung(3);
        uebung.loesungswoerter = { "Teilnehmer 1": "ALFA" };
        uebung.autoStaerkeErgaenzen = true;
        new GenerationService().generate(uebung, szenario);

        expect(uebung.loesungswoerter).toEqual({});
        expect(uebung.autoStaerkeErgaenzen).toBe(false);
        // Restwert aus dem Formular darf statHatBuchstabieren nicht verfälschen.
        expect(uebung.buchstabierenAn).toBe(0);

        const erwarteteTexte = new Set([
            "Ich melde mich in Ihrem Sprechfunkverkehrskreis an.",
            ...szenario.einleitung.map(s => s.text),
            ...szenario.abschluss.map(s => s.text),
            ...szenario.straenge.flatMap(strang => strang.sprueche.map(s => s.text))
        ]);
        alleNachrichten(uebung).forEach(({ nachricht }) => {
            expect(erwarteteTexte.has(nachricht.nachricht)).toBe(true);
            expect(nachricht.loesungsbuchstaben ?? []).toHaveLength(0);
        });
    });

    it("vergibt X-Zeit-Slots entlang der Erzählreihenfolge", () => {
        const uebung = baueUebung(3);
        uebung.spielModus = "xZeit";
        uebung.xZeitIntervallMinuten = 2;
        new GenerationService().generate(uebung, baueSzenario());

        const nachrichten = alleNachrichten(uebung).map(n => n.nachricht);
        nachrichten.forEach(nachricht => {
            expect(typeof nachricht.xZeitSlot).toBe("number");
        });

        const anmeldungen = nachrichten.filter(n => n.id === 1);
        anmeldungen.forEach(n => expect(n.xZeitSlot).toBe(0));

        const uebrige = nachrichten
            .filter(n => n.id !== 1)
            .sort((a, b) => (a.szenarioNr as number) - (b.szenarioNr as number));
        uebrige.forEach((nachricht, index) => {
            expect(nachricht.xZeitSlot).toBe((index + 1) * 2);
        });
    });
});
