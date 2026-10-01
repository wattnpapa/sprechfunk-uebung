import { describe, expect, it } from "vitest";
import { vordruckDatenAusUebung } from "../../src/pdf/vordruckDaten";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("pdf/vordruckDaten", () => {
    const uebung = new FunkUebung("dev");
    uebung.teilnehmerListe = ["EL 10", "Kater"];
    uebung.teilnehmerStellen = { Kater: "Führungsstab" };

    it("übernimmt Betreff und Weg einer Führungsstellen-Nachricht in den Vordruck", () => {
        const daten = vordruckDatenAusUebung("Kater", uebung, {
            id: 1, empfaenger: ["EL 10"], nachricht: "Sperren Sie den Mühlenkamp.", xZeitSlot: 59,
            weg: "drucker", meldeart: "auftrag", betreff: "Einsatzauftrag Nr. 3", erwartung: "Weitergeben"
        });
        expect(daten.uebermittlungsweg).toBe("telefax");
        expect(daten.inhalt).toBe("Betreff: Einsatzauftrag Nr. 3\nSperren Sie den Mühlenkamp.");
        // Die beübte Stelle hat keinen Stellennamen, ihr Funkrufname ist die Anschrift.
        expect(daten.anschriften).toEqual(["EL 10"]);
        expect(daten.nummer).toBe("X+59");

        expect(vordruckDatenAusUebung("Kater", uebung, { id: 2, empfaenger: ["EL 10"], nachricht: "Mail", weg: "email", betreff: "B" }).uebermittlungsweg).toBe("dfue");
        expect(vordruckDatenAusUebung("Kater", uebung, { id: 3, empfaenger: ["EL 10"], nachricht: "Funk", weg: "funk" }).uebermittlungsweg).toBe("funk");
    });

    it("lässt Nachrichten ohne Führungsstellen-Felder unverändert", () => {
        const daten = vordruckDatenAusUebung("EL 10", uebung, { id: 1, empfaenger: ["Kater"], nachricht: "Lage unverändert." });
        expect(daten.inhalt).toBe("Lage unverändert.");
        expect(daten.uebermittlungsweg).toBe("funk");
        expect(daten.anschriften).toEqual(["Führungsstab"]);
        expect(daten.nummer).toBe("1");
    });
});
