import { describe, expect, it } from "vitest";
import { GenerationService } from "../../src/services/GenerationService";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("Übermittlungsart Spruch/Durchsage", () => {
    const baueUebung = (): FunkUebung => {
        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A", "B", "C", "D"];
        u.leitung = "L";
        u.spruecheProTeilnehmer = 6;
        u.spruecheAnAlle = 1;
        u.spruecheAnMehrere = 1;
        u.buchstabierenAn = 0;
        u.autoStaerkeErgaenzen = false;
        u.loesungswoerter = {};
        u.funksprueche = Array.from({ length: 60 }, (_, i) => `meldung nummer ${i + 1}`);
        return u;
    };

    const alleNachrichten = (u: FunkUebung) => Object.values(u.nachrichten).flat();

    it("lässt die Art ungesetzt, solange die Option nicht aktiv ist", () => {
        const u = baueUebung();

        new GenerationService().generate(u);

        expect(alleNachrichten(u).every(n => n.art === undefined)).toBe(true);
    });

    it("kennzeichnet jede Nachricht, sobald die Option aktiv ist", () => {
        const u = baueUebung();
        u.nachrichtenArtAktiv = true;

        new GenerationService().generate(u);

        expect(alleNachrichten(u).every(n => n.art === "spruch" || n.art === "durchsage")).toBe(true);
    });

    it("macht Nachrichten mit Lösungsbuchstaben immer zum Spruch, weil mitgeschrieben werden muss", () => {
        const u = baueUebung();
        u.nachrichtenArtAktiv = true;
        u.spruchAnteilProzent = 0;
        u.loesungswoerter = { A: "ALFA", B: "BRAVO", C: "CHARLIE", D: "DELTA" };

        new GenerationService().generate(u);

        const mitLoesungsbuchstaben = alleNachrichten(u).filter(n => (n.loesungsbuchstaben?.length ?? 0) > 0);
        expect(mitLoesungsbuchstaben.length).toBeGreaterThan(0);
        expect(mitLoesungsbuchstaben.every(n => n.art === "spruch")).toBe(true);
    });

    it("macht Stärkemeldungen und Buchstabier-Aufgaben auch bei 0 % zum Spruch", () => {
        const u = baueUebung();
        u.nachrichtenArtAktiv = true;
        u.spruchAnteilProzent = 0;
        u.funksprueche = [
            "wir sind mit 1/2/9 ausgerueckt",
            "die Lage am OBJEKT ist unveraendert",
            "wir haben den treffpunkt erreicht"
        ];

        new GenerationService().generate(u);

        const sprueche = alleNachrichten(u).filter(n => n.art === "spruch");
        expect(sprueche.length).toBeGreaterThan(0);
        expect(sprueche.every(n =>
            (n.staerken?.length ?? 0) > 0 || /[A-ZÄÖÜ]{2,}/.test(n.nachricht)
        )).toBe(true);
    });

    it("erlaubt Sprüche unabhängig von der Empfängerzahl", () => {
        const u = baueUebung();
        u.nachrichtenArtAktiv = true;
        u.spruchAnteilProzent = 100;

        new GenerationService().generate(u);

        const anMehrere = alleNachrichten(u).filter(n => n.empfaenger.length > 1);
        expect(anMehrere.length).toBeGreaterThan(0);
        expect(anMehrere.every(n => n.art === "spruch")).toBe(true);
    });

    it("hält die Anmeldung formlos und meldet sie als Durchsage", () => {
        const u = baueUebung();
        u.nachrichtenArtAktiv = true;
        u.spruchAnteilProzent = 100;
        u.anmeldungAktiv = true;

        new GenerationService().generate(u);

        const anmeldungen = alleNachrichten(u).filter(n => n.id === 1);
        expect(anmeldungen.length).toBe(4);
        expect(anmeldungen.every(n => n.art === "durchsage")).toBe(true);
    });

    it("liefert bei gleichem Seed dieselbe Aufteilung", () => {
        const ersteUebung = baueUebung();
        ersteUebung.nachrichtenArtAktiv = true;
        ersteUebung.seed = "seed-fuer-artverteilung";
        new GenerationService().generate(ersteUebung);

        const zweiteUebung = baueUebung();
        zweiteUebung.nachrichtenArtAktiv = true;
        zweiteUebung.seed = "seed-fuer-artverteilung";
        new GenerationService().generate(zweiteUebung);

        expect(alleNachrichten(zweiteUebung).map(n => n.art))
            .toEqual(alleNachrichten(ersteUebung).map(n => n.art));
    });
});
