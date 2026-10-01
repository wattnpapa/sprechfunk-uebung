import { describe, expect, it } from "vitest";
import { GenerationService } from "../../src/services/GenerationService";
import { FunkUebung } from "../../src/models/FunkUebung";
import type { FuehrungsstellenUebung } from "../../src/types/FuehrungsstellenUebung";
import type { Nachricht } from "../../src/types/Nachricht";

/**
 * Der Führungsstellen-Pfad verteilt kein Kartendeck und lost nichts: Stränge
 * gehen reihum an die konfigurierten Abschnitte, jede Nachricht behält ihre
 * Minute als X-Zeit-Slot, Empfänger ist immer die beübte Stelle. Diese Tests
 * fixieren genau das, getrennt von Zufalls- und Szenario-Modus.
 */

function baueDrehbuch(): FuehrungsstellenUebung {
    const hintergrund = "Hintergrund der Rolle für den Test.";
    return {
        slug: "test-drehbuch",
        titel: "Testlage",
        beschreibung: "Drehbuch für die Generierungstests.",
        lage: "Eine Übungslage für Tests.",
        auftrag: "Einsatzstellen führen.",
        dauerMinuten: 120,
        minAbschnitte: 2,
        uebergeordnet: {
            bezeichnung: "Führungsstab",
            hintergrund,
            nachrichten: [
                { zeit: 5, weg: "drucker", art: "auftrag", betreff: "Auftrag Nr. 1 für {{ea:s1}}", text: "Auftrag an {{el}}: Einsatzstelle 1 verstärken. Stärke 1/2/9//12.", erwartung: "An {{ea:s1}} weitergeben." },
                { zeit: 10, weg: "email", art: "information", betreff: "Wetter", text: "Dauerregen hält an.", erwartung: "Zur Kenntnis." },
                { zeit: 10, weg: "funk", art: "rueckfrage", text: "Frage: Gesamtstärke?", erwartung: "Stärken addieren und {{stab}} melden." }
            ]
        },
        straenge: ["s1", "s2", "s3", "s4"].map((key, index) => ({
            key,
            bezeichnung: `Einsatzstelle ${index + 1}`,
            hintergrund,
            nachrichten: [
                { zeit: index, weg: "funk", art: "betrieb", text: `Anmeldung ${key} von {{ea}} bei {{el}}.`, erwartung: "Quittieren." },
                // Stränge 1 und 3 melden beide in Minute 10 — bei zwei Abschnitten derselbe Absender.
                { zeit: 10, weg: "funk", art: "lagemeldung", text: `Lage ${key}: Stärke 0/1/${index + 4}//${index + 5}.`, erwartung: "Lagekarte." },
                { zeit: 60 + index, weg: "funk", art: "vollzug", text: `Vollzug ${key}.`, erwartung: "Vollzug an {{stab}}." }
            ]
        }))
    };
}

function baueUebung(unterstellt = ["EA 11", "EA 12"], seed = "fuehrungsstelle-test"): FunkUebung {
    const uebung = new FunkUebung("test");
    uebung.name = "Führungsstellen-Testübung";
    uebung.datum = new Date("2026-11-14T08:00:00.000Z");
    uebung.leitung = "Leitung Test";
    uebung.seed = seed;
    uebung.fuehrungsstelle = {
        slug: "test-drehbuch",
        beuebteStelle: "EL 10",
        uebergeordnet: "Kater Test",
        unterstellt,
        beginn: "09:00",
        stellen: { "EL 10": "Einsatzleitung", "Kater Test": "Führungsstab" }
    };
    return uebung;
}

function alleNachrichten(uebung: FunkUebung): { sender: string; nachricht: Nachricht }[] {
    return Object.entries(uebung.nachrichten).flatMap(([sender, liste]) =>
        liste.map(nachricht => ({ sender, nachricht }))
    );
}

describe("GenerationService Führungsstellen-Übung", () => {
    it("macht die Rollen zu Teilnehmern; die beübte Stelle sendet nichts und empfängt alles", () => {
        const uebung = baueUebung();
        new GenerationService().generateFuehrungsstelle(uebung, baueDrehbuch());

        expect(uebung.teilnehmerListe).toEqual(["EL 10", "EA 11", "EA 12", "Kater Test"]);
        expect(uebung.nachrichten["EL 10"]).toEqual([]);
        const alle = alleNachrichten(uebung);
        expect(alle).toHaveLength(3 + 4 * 3);
        alle.forEach(({ nachricht }) => expect(nachricht.empfaenger).toEqual(["EL 10"]));
        expect(uebung.spielModus).toBe("xZeit");
        expect(uebung.anmeldungAktiv).toBe(false);
        expect(uebung.szenarioSlug).toBeUndefined();
        // Stellennamen kommen nur aus der Besetzung: Auf den Vordrucken steht
        // der Stellenname des Empfängers als Anschrift, sonst der Funkrufname.
        expect(uebung.teilnehmerStellen).toEqual({ "EL 10": "Einsatzleitung", "Kater Test": "Führungsstab" });
    });

    it("bereinigt die Stellennamen: getrimmt, ohne leere Werte und ohne fremde Funkrufnamen", () => {
        const uebung = baueUebung([" EA 11 ", "EA 12"]);
        uebung.fuehrungsstelle!.stellen = { " EA 11 ": " Abschnitt Nord ", "EL 10": "  ", "Heros Fremd": "Nicht dabei" };
        new GenerationService().generateFuehrungsstelle(uebung, baueDrehbuch());
        expect(uebung.fuehrungsstelle?.stellen).toEqual({ "EA 11": "Abschnitt Nord" });
        expect(uebung.teilnehmerStellen).toEqual({ "EA 11": "Abschnitt Nord" });

        const ohne = baueUebung();
        ohne.fuehrungsstelle!.stellen = { "EL 10": "" };
        new GenerationService().generateFuehrungsstelle(ohne, baueDrehbuch());
        expect(ohne.fuehrungsstelle).not.toHaveProperty("stellen");
        expect(ohne.teilnehmerStellen).toEqual({});
    });

    it("verteilt Stränge reihum und löst die Platzhalter je Rolle auf", () => {
        const uebung = baueUebung();
        new GenerationService().generateFuehrungsstelle(uebung, baueDrehbuch());

        const ea11 = uebung.nachrichten["EA 11"] ?? [];
        expect(ea11.map(n => n.nachricht)).toContain("Anmeldung s1 von EA 11 bei EL 10.");
        expect(ea11.map(n => n.nachricht)).toContain("Anmeldung s3 von EA 11 bei EL 10.");
        const stab = uebung.nachrichten["Kater Test"] ?? [];
        expect(stab[0]?.betreff).toBe("Auftrag Nr. 1 für EA 11");
        expect(stab[0]?.erwartung).toBe("An EA 11 weitergeben.");
        expect(stab[0]?.nachricht).toContain("Auftrag an EL 10");
        expect(stab[2]?.erwartung).toBe("Stärken addieren und Kater Test melden.");
    });

    it("übernimmt Minute, Weg, Meldeart und Erwartung und entzerrt gleiche Minuten je Absender", () => {
        const uebung = baueUebung();
        new GenerationService().generateFuehrungsstelle(uebung, baueDrehbuch());

        const ea11 = uebung.nachrichten["EA 11"] ?? [];
        const slots = ea11.map(n => n.xZeitSlot);
        // s1 und s3 melden laut Drehbuch beide in Minute 10; die zweite rückt auf 11.
        expect(slots).toEqual([0, 2, 10, 11, 60, 62]);
        ea11.forEach((n, index) => expect(n.id).toBe(index + 1));
        expect(ea11[2]?.weg).toBe("funk");
        expect(ea11[2]?.meldeart).toBe("lagemeldung");
        expect(ea11[2]?.erwartung).toBe("Lagekarte.");

        const stab = uebung.nachrichten["Kater Test"] ?? [];
        expect(stab.map(n => n.weg)).toEqual(["drucker", "email", "funk"]);
        expect(stab.map(n => n.xZeitSlot)).toEqual([5, 10, 11]);
        expect(stab[0]?.meldeart).toBe("auftrag");
        // Funk-Nachrichten tragen keinen Betreff-Schlüssel — Firestore lehnt
        // undefined in der verschachtelten nachrichten-Map ab.
        alleNachrichten(uebung)
            .filter(({ nachricht }) => nachricht.weg === "funk")
            .forEach(({ nachricht }) => expect(Object.keys(nachricht)).not.toContain("betreff"));
    });

    it("nummeriert szenarioNr global entlang der entzerrten Zeitachse", () => {
        const uebung = baueUebung();
        new GenerationService().generateFuehrungsstelle(uebung, baueDrehbuch());

        const sortiert = alleNachrichten(uebung)
            .map(e => e.nachricht)
            .sort((a, b) => (a.szenarioNr ?? 0) - (b.szenarioNr ?? 0));
        sortiert.forEach((n, index) => expect(n.szenarioNr).toBe(index + 1));
        for (let i = 1; i < sortiert.length; i++) {
            expect(sortiert[i]?.xZeitSlot ?? 0).toBeGreaterThanOrEqual(sortiert[i - 1]?.xZeitSlot ?? 0);
        }
    });

    it("führt keine Soll-Stärke und verändert keine Texte", () => {
        const uebung = baueUebung();
        new GenerationService().generateFuehrungsstelle(uebung, baueDrehbuch());

        // Die Drehbücher melden laufende Stände derselben Einheit; eine Summe
        // aller Treffer wäre eine Zahl, die nirgends im Drehbuch steht.
        expect(uebung.loesungsStaerken).toEqual({});
        alleNachrichten(uebung).forEach(({ nachricht }) => {
            expect(nachricht.nachricht).not.toContain("Aktuelle Stärke:");
            expect(nachricht).not.toHaveProperty("staerken");
        });
        expect(uebung.loesungswoerter).toEqual({});
    });

    it("ist ohne Zufall reproduzierbar und vergibt Zugangscodes für alle Stellen", () => {
        const a = baueUebung();
        const b = baueUebung();
        const service = new GenerationService();
        service.generateFuehrungsstelle(a, baueDrehbuch());
        service.generateFuehrungsstelle(b, baueDrehbuch());
        expect(a.checksumme).toBe(b.checksumme);
        expect(Object.values(a.teilnehmerIds).sort()).toEqual([...a.teilnehmerListe].sort());
        expect(a.uebungCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it("trimmt Namen und übernimmt die geprüfte Rollenbesetzung in die Übung", () => {
        const uebung = baueUebung([" EA 11 ", "EA 12", ""]);
        new GenerationService().generateFuehrungsstelle(uebung, baueDrehbuch());
        expect(uebung.fuehrungsstelle?.unterstellt).toEqual(["EA 11", "EA 12"]);
        expect(uebung.fuehrungsstelle?.beginn).toBe("09:00");
    });

    it("weist unpassende Rollenbesetzungen mit klarer Meldung ab", () => {
        const service = new GenerationService();
        const drehbuch = baueDrehbuch();

        const ohne = baueUebung();
        ohne.fuehrungsstelle = undefined;
        expect(() => service.generateFuehrungsstelle(ohne, drehbuch)).toThrow(/Rollenbesetzung fehlt/);

        const falschesDrehbuch = baueUebung();
        falschesDrehbuch.fuehrungsstelle!.slug = "anderes";
        expect(() => service.generateFuehrungsstelle(falschesDrehbuch, drehbuch)).toThrow(/anderen Drehbuch/);

        expect(() => service.generateFuehrungsstelle(baueUebung(["EA 11"]), drehbuch))
            .toThrow(/für 2 bis 4 Einsatzabschnitte ausgelegt, die Übung hat 1/);
        expect(() => service.generateFuehrungsstelle(baueUebung(["1", "2", "3", "4", "5"]), drehbuch))
            .toThrow(/die Übung hat 5/);
        expect(() => service.generateFuehrungsstelle(baueUebung(["EA 11", "EL 10"]), drehbuch))
            .toThrow(/eindeutig/);

        const leer = baueUebung();
        leer.fuehrungsstelle!.beuebteStelle = "  ";
        expect(() => service.generateFuehrungsstelle(leer, drehbuch)).toThrow(/Funkrufnamen/);
    });

    it("setzt eine Führungsstellen-Übung zurück, wenn danach klassisch generiert wird", () => {
        const uebung = baueUebung();
        const service = new GenerationService();
        service.generateFuehrungsstelle(uebung, baueDrehbuch());
        uebung.funksprueche = ["Spruch eins.", "Spruch zwei.", "Spruch drei."];
        uebung.spruecheProTeilnehmer = 2;
        uebung.spruecheAnAlle = 0;
        uebung.spruecheAnMehrere = 0;
        service.generate(uebung);
        expect(uebung.fuehrungsstelle).toBeUndefined();
    });
});
