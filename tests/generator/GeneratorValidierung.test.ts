import { describe, expect, it } from "vitest";
import {
    MAX_SPRUECHE_PRO_TEILNEHMER,
    MELDUNG_DOPPELTE_NAMEN,
    MELDUNG_KEIN_TEILNEHMER,
    funkrufnameSchluessel,
    pruefeFuehrungsstellenRollen,
    pruefeKopfdaten,
    pruefeTeilnehmerListe,
    pruefeVerteilung,
    pruefeXZeit
} from "../../src/generator/GeneratorValidierung";

describe("GeneratorValidierung", () => {
    it("vergleicht Funkrufnamen ohne Groß-/Kleinschreibung und Leerraum", () => {
        expect(funkrufnameSchluessel("  Heros  Oldenburg 21/11 ")).toBe(funkrufnameSchluessel("heros oldenburg 21/11"));
    });

    it("meldet eine leere Teilnehmerliste am ersten Feld", () => {
        const ergebnis = pruefeTeilnehmerListe(["", "  "]);
        expect(ergebnis.meldung).toBe(MELDUNG_KEIN_TEILNEHMER);
        expect(ergebnis.fehler.map(f => f.feld)).toEqual(["teilnehmer-0"]);
    });

    it("markiert alle Zeilen doppelter Namen, auch bei anderer Schreibweise", () => {
        const ergebnis = pruefeTeilnehmerListe(["Heros Oldenburg 21/11", "", "Florian 1", "heros  oldenburg 21/11 "]);
        expect(ergebnis.meldung).toBe(MELDUNG_DOPPELTE_NAMEN);
        expect(ergebnis.fehler.map(f => f.feld)).toEqual(["teilnehmer-0", "teilnehmer-3"]);
        expect(ergebnis.fehler[0]?.text).toContain("Zeile 4");
    });

    it("liefert getrimmte Namen ohne leere Zeilen", () => {
        const ergebnis = pruefeTeilnehmerListe([" A ", "", "B"]);
        expect(ergebnis).toEqual({ namen: ["A", "B"], fehler: [], meldung: "" });
    });

    it("begrenzt Funksprüche pro Teilnehmer und verlangt ganze Zahlen ab 1", () => {
        const basis = { spruecheAnAlle: 0, spruecheAnMehrere: 0, anmeldungAktiv: false };
        expect(pruefeVerteilung({ ...basis, spruecheProTeilnehmer: 9999 })[0]?.text)
            .toContain(`Höchstens ${MAX_SPRUECHE_PRO_TEILNEHMER}`);
        expect(pruefeVerteilung({ ...basis, spruecheProTeilnehmer: 0 })[0]?.feld).toBe("spruecheProTeilnehmer");
        expect(pruefeVerteilung({ ...basis, spruecheProTeilnehmer: 2.5 })).toHaveLength(1);
        expect(pruefeVerteilung({ ...basis, spruecheProTeilnehmer: MAX_SPRUECHE_PRO_TEILNEHMER })).toEqual([]);
    });

    it("prüft Prozentfelder und die Mindestsumme", () => {
        const fehler = pruefeVerteilung({
            spruecheProTeilnehmer: 10, spruecheAnAlle: 1, spruecheAnMehrere: 1, anmeldungAktiv: true,
            prozent: { prozentAnAlle: -20, prozentAnMehrere: 150, prozentAnBuchstabieren: undefined }
        });
        expect(fehler.map(f => f.feld)).toEqual(["prozentAnAlle", "prozentAnMehrere"]);

        const summe = pruefeVerteilung({ spruecheProTeilnehmer: 2, spruecheAnAlle: 1, spruecheAnMehrere: 1, anmeldungAktiv: true });
        expect(summe[0]?.text).toContain("3 Funksprüche");
    });

    it("verlangt den Funkrufnamen der Leitung", () => {
        expect(pruefeKopfdaten({ leitung: "  " })[0]?.feld).toBe("leitung");
        expect(pruefeKopfdaten({ leitung: "Heros 10" })).toEqual([]);
    });

    it("prüft Intervall und Start-Offset nur im X-Zeit-Modus", () => {
        expect(pruefeXZeit({ aktiv: false, intervall: 0 })).toEqual([]);
        expect(pruefeXZeit({ aktiv: true, intervall: 0, startOffset: -1 }).map(f => f.feld))
            .toEqual(["xZeitIntervallMinuten", "xZeitStartOffsetMinuten"]);
        expect(pruefeXZeit({ aktiv: true, intervall: 3, startOffset: 0 })).toEqual([]);
    });

    it("verlangt eigene Funkrufnamen für alle Rollen der Führungsstellen-Übung", () => {
        const fehler = pruefeFuehrungsstellenRollen({ beuebteStelle: "EL 10", uebergeordnet: "", unterstellt: ["ea 1", "EA 1 "] });
        expect(fehler.map(f => f.feld)).toEqual(["fuehrungsstelleUebergeordnet", "abschnitt-1"]);
        expect(pruefeFuehrungsstellenRollen({ beuebteStelle: "A", uebergeordnet: "B", unterstellt: ["", "C"] })[0]?.text)
            .toContain("Zeile mit ×");
    });
});
