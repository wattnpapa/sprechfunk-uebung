import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { GenerationService } from "../../src/services/GenerationService";
import { FunkUebung } from "../../src/models/FunkUebung";
import { zaehleBuchstabierAufgaben } from "../../src/utils/buchstabieren";

/**
 * Regressionstest zum gemeldeten Fehler: Die Vorlagen enthalten von Haus aus sehr
 * unterschiedlich viele großgeschriebene Wörter (von 24/92 bis 476/500 Sprüchen).
 * Der Generator muss trotzdem exakt so viele Buchstabier-Aufgaben liefern wie eingestellt.
 */
const VORLAGEN_DIR = "assets/funksprueche";
const TEILNEHMER = ["A", "B", "C", "D", "E", "F", "G", "H"];

function ladeVorlage(datei: string): string[] {
    return readFileSync(`${VORLAGEN_DIR}/${datei}`, "utf8")
        .split("\n")
        .map(zeile => zeile.trim())
        .filter(Boolean);
}

function baueUebung(funksprueche: string[], buchstabierenAn: number): FunkUebung {
    const uebung = new FunkUebung("dev");
    uebung.teilnehmerListe = [...TEILNEHMER];
    uebung.leitung = "Leitung";
    uebung.spruecheProTeilnehmer = 50;
    uebung.spruecheAnAlle = 5;
    uebung.spruecheAnMehrere = 2;
    uebung.buchstabierenAn = buchstabierenAn;
    uebung.anmeldungAktiv = true;
    uebung.autoStaerkeErgaenzen = true;
    uebung.loesungswoerter = { A: "ALFA", B: "BRAVO", C: "CHARLIE" };
    uebung.funksprueche = funksprueche;
    return uebung;
}

describe("Buchstabier-Aufgaben in den echten Vorlagen", () => {
    const vorlagen = readdirSync(VORLAGEN_DIR).filter(datei => datei.endsWith(".txt"));

    it("findet Vorlagen zum Testen", () => {
        expect(vorlagen.length).toBeGreaterThan(0);
    });

    vorlagen.forEach(datei => {
        [0, 3, 8].forEach(ziel => {
            it(`${datei}: liefert genau ${ziel} Aufgaben pro Teilnehmer`, () => {
                const uebung = baueUebung(ladeVorlage(datei), ziel);

                new GenerationService().generate(uebung);

                // Die Anmeldungsnachricht (Index 0) zählt nicht mit.
                const proTeilnehmer = TEILNEHMER.map(teilnehmer =>
                    zaehleBuchstabierAufgaben(
                        (uebung.nachrichten[teilnehmer] || []).slice(1).map(n => n.nachricht)
                    )
                );

                expect(proTeilnehmer).toEqual(TEILNEHMER.map(() => ziel));
            });
        });
    });
});
