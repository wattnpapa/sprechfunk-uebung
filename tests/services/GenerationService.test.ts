import { describe, expect, it, vi } from "vitest";
import { GenerationService } from "../../src/services/GenerationService";
import { FunkUebung } from "../../src/models/FunkUebung";
import { zaehleBuchstabierAufgaben } from "../../src/utils/buchstabieren";

describe("GenerationService", () => {
    it("generates messages, ids, checksum and strengths", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A", "B", "C"];
        u.leitung = "L";
        u.spruecheProTeilnehmer = 3;
        u.spruecheAnAlle = 1;
        u.spruecheAnMehrere = 1;
        u.buchstabierenAn = 0;
        u.funksprueche = [
            "Meldung EINS",
            "Meldung ZWEI",
            "Meldung DREI",
            "Meldung VIER",
            "Meldung FUENF"
        ];
        u.loesungswoerter = { A: "ALFA", B: "BRAVO", C: "CHARLIE" };
        u.autoStaerkeErgaenzen = true;

        service.generate(u);

        expect(Object.keys(u.nachrichten).length).toBeGreaterThan(0);
        expect(Object.keys(u.teilnehmerIds || {}).length).toBe(3);
        expect(u.uebungCode).toMatch(/^[A-Z2-9]{6}$/);
        Object.keys(u.teilnehmerIds || {}).forEach(code => {
            expect(code).toMatch(/^[A-Z2-9]{4}$/);
        });
        expect(u.checksumme.length).toBeGreaterThan(0);
        expect(u.loesungsStaerken?.A).toBeDefined();
    });

    it("uses every funkspruch at most once while the pool is sufficient", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.anmeldungAktiv = false;
        u.teilnehmerListe = ["A", "B", "C", "D"];
        u.leitung = "L";
        u.spruecheProTeilnehmer = 5;
        u.spruecheAnAlle = 1;
        u.spruecheAnMehrere = 1;
        u.buchstabierenAn = 0;
        u.autoStaerkeErgaenzen = false;
        u.funksprueche = Array.from({ length: 40 }, (_, i) => `Spruch ${i + 1}`);

        service.generate(u);

        const alleTexte = Object.values(u.nachrichten).flat().map(n => n.nachricht);
        expect(alleTexte).toHaveLength(20);
        expect(new Set(alleTexte).size).toBe(alleTexte.length);
    });

    it("spreads repetitions evenly when the pool is smaller than the demand", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.anmeldungAktiv = false;
        u.teilnehmerListe = ["A", "B", "C", "D"];
        u.leitung = "L";
        u.spruecheProTeilnehmer = 5;
        u.spruecheAnAlle = 0;
        u.spruecheAnMehrere = 0;
        u.buchstabierenAn = 0;
        u.autoStaerkeErgaenzen = false;
        u.funksprueche = Array.from({ length: 10 }, (_, i) => `Spruch ${i + 1}`);

        service.generate(u);

        // 20 Nachrichten aus 10 Sprüchen: jeder Spruch genau zweimal, keiner öfter.
        const haeufigkeit = new Map<string, number>();
        Object.values(u.nachrichten).flat().forEach(n => {
            haeufigkeit.set(n.nachricht, (haeufigkeit.get(n.nachricht) ?? 0) + 1);
        });
        expect(haeufigkeit.size).toBe(10);
        expect([...haeufigkeit.values()].every(count => count === 2)).toBe(true);

        // Innerhalb eines Teilnehmers darf sich trotzdem nichts wiederholen.
        Object.values(u.nachrichten).forEach(liste => {
            const texte = liste.map(n => n.nachricht);
            expect(new Set(texte).size).toBe(texte.length);
        });
    });

    it("does not hand the same spelling message to several participants", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.anmeldungAktiv = false;
        u.teilnehmerListe = ["A", "B", "C"];
        u.leitung = "L";
        u.spruecheProTeilnehmer = 3;
        u.spruecheAnAlle = 0;
        u.spruecheAnMehrere = 0;
        u.buchstabierenAn = 2;
        u.autoStaerkeErgaenzen = false;
        u.funksprueche = [
            ...Array.from({ length: 9 }, (_, i) => `Normaler Spruch ${i + 1}`),
            ...Array.from({ length: 8 }, (_, i) => `Buchstabiere WORTNUMMER${i + 1}`)
        ];

        service.generate(u);

        const alleTexte = Object.values(u.nachrichten).flat().map(n => n.nachricht);
        expect(new Set(alleTexte).size).toBe(alleTexte.length);
    });

    it("updateChecksum reacts to data changes", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.name = "A";
        service.updateChecksum(u);
        const first = u.checksumme;
        u.name = "B";
        service.updateChecksum(u);
        expect(u.checksumme).not.toBe(first);
    });

    it("returns empty distribution if no messages provided", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A"];
        u.funksprueche = [];
        service.generate(u);
        expect(u.nachrichten).toEqual({});
    });

    it("covers random helper branches", () => {
        const service = new GenerationService();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((service as any).getRandomOther(["A"], "A")).toBe("A");
        const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subset = (service as any).getRandomSubsetOfOthers(["A", "B", "C", "D"], "A");
        expect(subset.length).toBeGreaterThan(0);
        randomSpy.mockRestore();
    });

    it("distributes solution words and computes strengths from text and arrays", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A", "B"];
        u.loesungswoerter = { A: "AB" };
        u.nachrichten = {
            B: [{ id: 1, empfaenger: ["A"], nachricht: "Meldung", loesungsbuchstaben: [] }],
            A: [{ id: 1, empfaenger: ["B"], nachricht: "Stärke 1/2/3", staerken: [{ fuehrer: 1, unterfuehrer: 2, helfer: 3 }] }]
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).verteileLoesungswoerterMitIndex(u);
        expect(u.nachrichten.B[0]?.loesungsbuchstaben?.length).toBeGreaterThan(0);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).berechneLoesungsStaerken(u);
        expect(u.loesungsStaerken?.A).toBeDefined();
        expect(u.loesungsStaerken?.B).toBeDefined();
    });

    it("adds missing strength messages when auto append is active", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.autoStaerkeErgaenzen = true;
        u.teilnehmerListe = ["A", "B"];
        u.nachrichten = {
            A: Array.from({ length: 10 }, (_, i) => ({
                id: i + 1,
                empfaenger: ["B"],
                nachricht: `Nachricht ${i + 1}`
            })),
            B: []
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).berechneLoesungsStaerken(u);
        const hasStaerke = u.nachrichten.A.some(n => /Aktuelle Stärke:/.test(n.nachricht));
        expect(hasStaerke).toBe(true);
    });

    it("covers shuffle fallback and special recipient distributions", () => {
        const service = new GenerationService();
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const sortSpy = vi.spyOn(Array.prototype, "sort").mockImplementation(function () {
            return this;
        });
        const list = [
            { nachricht: { empfaenger: ["Alle"] } },
            { nachricht: { empfaenger: ["B", "C"] } }
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shuffled = (service as any).shuffleSmart(list);
        expect(shuffled).toHaveLength(2);
        expect(warn).toHaveBeenCalled();
        sortSpy.mockRestore();
        warn.mockRestore();

        const u = new FunkUebung("dev");
        u.anmeldungAktiv = false;
        u.teilnehmerListe = ["A", "B", "C", "D", "E", "F", "G", "H"];
        u.leitung = "L";
        u.spruecheProTeilnehmer = 4;
        u.spruecheAnAlle = 1;
        u.spruecheAnMehrere = 2;
        u.funksprueche = ["AA", "BB", "CC", "DD", "EE", "FF", "GG", "HH"];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = (service as any).verteileNachrichtenFair(u);
        expect(Object.keys(v).length).toBe(8);
    });

    it("covers subset random branches and reuses existing short participant codes", () => {
        const service = new GenerationService();
        const random = vi.spyOn(Math, "random");
        random.mockReturnValueOnce(0.85).mockReturnValueOnce(0.2).mockReturnValueOnce(0.96).mockReturnValue(0.4);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subset = (service as any).getRandomSubsetOfOthers(["A", "B", "C", "D", "E", "F", "G", "H"], "A");
        expect(subset.length).toBeGreaterThan(0);
        random.mockRestore();

        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A"];
        u.teilnehmerIds = { AB2C: "A" };
        u.uebungCode = "C3DE45";
        u.funksprueche = ["TXT"];
        u.spruecheProTeilnehmer = 1;
        u.spruecheAnAlle = 0;
        u.spruecheAnMehrere = 0;
        u.buchstabierenAn = 0;
        service.generate(u);
        expect(Object.keys(u.teilnehmerIds)).toEqual(["AB2C"]);
        expect(u.uebungCode).toBe("C3DE45");
    });

    it("rebuilds participant id map for changed participant list", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A", "B"];
        u.teilnehmerIds = { AB2C: "A", CD34: "X" };
        u.funksprueche = ["TXT", "TXT2"];
        u.spruecheProTeilnehmer = 1;
        u.spruecheAnAlle = 0;
        u.spruecheAnMehrere = 0;
        u.buchstabierenAn = 0;

        service.generate(u);

        expect(Object.values(u.teilnehmerIds).sort()).toEqual(["A", "B"]);
        expect(Object.keys(u.teilnehmerIds)).toContain("AB2C");
    });

    it("covers strength parsing without auto append and low-message branch", () => {
        const service = new GenerationService();
        const u = new FunkUebung("dev");
        u.autoStaerkeErgaenzen = false;
        u.teilnehmerListe = ["A", "B"];
        u.nachrichten = {
            A: [{ id: 1, empfaenger: ["B"], nachricht: "Status 2/3/4/9" }],
            B: [{ id: 1, empfaenger: ["A"], nachricht: "ohne staerke" }]
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).berechneLoesungsStaerken(u);
        expect(u.loesungsStaerken?.B).toContain("/");

        const u2 = new FunkUebung("dev");
        u2.autoStaerkeErgaenzen = true;
        u2.teilnehmerListe = ["A", "B"];
        u2.nachrichten = {
            A: [{ id: 1, empfaenger: ["B"], nachricht: "kurz" }],
            B: []
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).berechneLoesungsStaerken(u2);
        expect(u2.loesungsStaerken?.A).toBeDefined();
    });

    describe("Buchstabier-Aufgaben", () => {
        const baueUebung = (funksprueche: string[], buchstabierenAn: number) => {
            const u = new FunkUebung("dev");
            u.teilnehmerListe = ["A", "B", "C"];
            u.leitung = "L";
            u.spruecheProTeilnehmer = 10;
            u.spruecheAnAlle = 0;
            u.spruecheAnMehrere = 0;
            u.buchstabierenAn = buchstabierenAn;
            u.anmeldungAktiv = false;
            u.autoStaerkeErgaenzen = false;
            u.loesungswoerter = {};
            u.funksprueche = funksprueche;
            return u;
        };

        const zaehleProTeilnehmer = (u: FunkUebung) =>
            u.teilnehmerListe.map(t =>
                zaehleBuchstabierAufgaben((u.nachrichten[t] || []).map(n => n.nachricht))
            );

        it("reduziert Buchstabier-Aufgaben, wenn die Vorlage fast nur Großschreibung enthält", () => {
            // 30 Sprüche, davon 29 mit Großwort - so wie in den echten Vorlagen.
            const sprueche = Array.from({ length: 30 }, (_, i) =>
                i === 0 ? `Meldung ${i} ohne Grossschreibung` : `Meldung ${i} an NIENBURG${i}`
            );
            const u = baueUebung(sprueche, 2);

            new GenerationService().generate(u);

            expect(zaehleProTeilnehmer(u)).toEqual([2, 2, 2]);
        });

        it("erzeugt keine Buchstabier-Aufgabe bei Einstellung 0", () => {
            const sprueche = Array.from({ length: 30 }, (_, i) => `Meldung ${i} an NIENBURG${i}`);
            const u = baueUebung(sprueche, 0);

            new GenerationService().generate(u);

            expect(zaehleProTeilnehmer(u)).toEqual([0, 0, 0]);
        });

        it("füllt auf, wenn die Vorlage kaum Großschreibung enthält", () => {
            const sprueche = Array.from({ length: 30 }, (_, i) => `Meldung ${i} an die Leitstelle`);
            const u = baueUebung(sprueche, 3);

            new GenerationService().generate(u);

            expect(zaehleProTeilnehmer(u)).toEqual([3, 3, 3]);
        });

        it("begrenzt den Zielwert auf die Anzahl der Nachrichten", () => {
            const sprueche = Array.from({ length: 30 }, (_, i) => `Meldung ${i} an die Leitstelle`);
            const u = baueUebung(sprueche, 99);

            new GenerationService().generate(u);

            expect(zaehleProTeilnehmer(u)).toEqual([10, 10, 10]);
        });

        it("lässt die Anmeldungsnachricht unangetastet", () => {
            const sprueche = Array.from({ length: 30 }, (_, i) => `Meldung ${i} an NIENBURG${i}`);
            const u = baueUebung(sprueche, 0);
            u.anmeldungAktiv = true;

            new GenerationService().generate(u);

            expect(u.nachrichten.A?.[0]?.nachricht).toBe("Ich melde mich in Ihrem Sprechfunkverkehrskreis an.");
        });
    });

    describe("Empfängergruppen bei 'an Mehrere'", () => {
        const baueGruppenUebung = (): FunkUebung => {
            const u = new FunkUebung("dev");
            u.seed = "gruppengroessen";
            u.teilnehmerListe = Array.from({ length: 20 }, (_, i) => `TN${i + 1}`);
            u.leitung = "L";
            u.spruecheProTeilnehmer = 8;
            u.spruecheAnAlle = 1;
            u.spruecheAnMehrere = 5;
            u.buchstabierenAn = 0;
            u.anmeldungAktiv = true;
            u.autoStaerkeErgaenzen = false;
            u.loesungswoerter = {};
            u.funksprueche = Array.from({ length: 200 }, (_, i) => `Meldung ${i}`);
            return u;
        };

        const gruppengroessen = (u: FunkUebung): number[] =>
            Object.values(u.nachrichten)
                .flat()
                .map(n => n.empfaenger.length)
                .filter(laenge => laenge > 1);

        it("bleibt innerhalb der übrigen Teilnehmer", () => {
            const u = baueGruppenUebung();
            const andere = u.teilnehmerListe.length - 1;

            new GenerationService().generate(u);

            const groessen = gruppengroessen(u);
            expect(groessen.length).toBeGreaterThan(0);
            groessen.forEach(groesse => {
                expect(groesse).toBeGreaterThanOrEqual(2);
                expect(groesse).toBeLessThanOrEqual(andere);
            });
        });

        it("erreicht die 85-%-Stufe, ohne immer die volle Liste zu nehmen", () => {
            const u = baueGruppenUebung();
            const andere = u.teilnehmerListe.length - 1;
            const untergrenze = Math.ceil(andere * 0.85);

            new GenerationService().generate(u);

            // Werte zwischen 85 % und 100 % sind nur über die größte Stufe
            // erreichbar. Mit vertauschten Grenzen lieferte sie ausschließlich
            // die volle Liste, dieser Bereich blieb also leer.
            const inGrossstufe = gruppengroessen(u).filter(
                groesse => groesse >= untergrenze && groesse < andere
            );
            expect(inGrossstufe.length).toBeGreaterThan(0);
        });
    });

    describe("Seed", () => {
        const baueSeedUebung = (seed?: string): FunkUebung => {
            const u = new FunkUebung("dev");
            // Name und Datum vergibt der Konstruktor zufällig bzw. aus der Uhr;
            // für den Vergleich zweier Läufe müssen sie fix sein.
            u.name = "Vergleichsübung";
            u.datum = new Date("2026-01-01T00:00:00.000Z");
            u.teilnehmerListe = ["A", "B", "C", "D"];
            u.leitung = "L";
            u.spruecheProTeilnehmer = 8;
            u.spruecheAnAlle = 1;
            u.spruecheAnMehrere = 2;
            u.buchstabierenAn = 2;
            u.anmeldungAktiv = true;
            u.autoStaerkeErgaenzen = true;
            u.loesungswoerter = { A: "ALFA", B: "BRAVO", C: "CHARLIE", D: "DELTA" };
            u.funksprueche = Array.from({ length: 40 }, (_, i) => `Meldung ${i} an NIENBURG${i}`);
            if (seed) {
                u.seed = seed;
            }
            return u;
        };

        // Der Seed selbst und die daraus abgeleiteten Codes sind Teil des
        // Ergebnisses; verglichen wird alles, was die Übung inhaltlich ausmacht.
        const ergebnis = (u: FunkUebung): string => JSON.stringify({
            nachrichten: u.nachrichten,
            teilnehmerIds: u.teilnehmerIds,
            uebungCode: u.uebungCode,
            loesungsStaerken: u.loesungsStaerken
        });

        it("erzeugt bei gleichem Seed exakt dieselbe Übung", () => {
            const a = baueSeedUebung("vergleichslauf-2026");
            const b = baueSeedUebung("vergleichslauf-2026");

            new GenerationService().generate(a);
            new GenerationService().generate(b);

            expect(ergebnis(b)).toBe(ergebnis(a));
            expect(a.checksumme).toBe(b.checksumme);
        });

        it("erzeugt bei unterschiedlichem Seed unterschiedliche Übungen", () => {
            const a = baueSeedUebung("gruppe-nord");
            const b = baueSeedUebung("gruppe-sued");

            new GenerationService().generate(a);
            new GenerationService().generate(b);

            expect(ergebnis(b)).not.toBe(ergebnis(a));
        });

        it("hinterlegt einen Seed, wenn keiner gesetzt ist", () => {
            const u = baueSeedUebung();

            new GenerationService().generate(u);

            expect(u.seed).toBeTruthy();
        });

        it("lässt sich mit dem hinterlegten Seed exakt nachstellen", () => {
            const original = baueSeedUebung();
            new GenerationService().generate(original);

            // So wird ein gemeldeter Fehler reproduziert: Seed der gespeicherten
            // Übung übernehmen und neu generieren.
            const nachgestellt = baueSeedUebung(original.seed);
            new GenerationService().generate(nachgestellt);

            expect(ergebnis(nachgestellt)).toBe(ergebnis(original));
        });

        it("bleibt über mehrere Läufe derselben Instanz deterministisch", () => {
            const service = new GenerationService();
            const a = baueSeedUebung("wiederverwendung");
            const b = baueSeedUebung("wiederverwendung");

            service.generate(a);
            service.generate(b);

            expect(ergebnis(b)).toBe(ergebnis(a));
        });
    });
});
