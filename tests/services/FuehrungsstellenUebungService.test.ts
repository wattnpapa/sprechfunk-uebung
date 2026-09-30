import { describe, expect, it } from "vitest";
import {
    erlaubtePlatzhalter,
    FuehrungsstellenParseError,
    parseFuehrungsstellenUebung
} from "../../src/services/FuehrungsstellenUebungService";

/** Kleinstes gültiges Drehbuch; Tests verändern gezielt einzelne Felder. */
function gueltigesDrehbuch(): Record<string, unknown> {
    return {
        slug: "test",
        titel: "Testlage",
        beschreibung: "Beschreibung der Testlage für den Parser des Drehbuchs.",
        lage: "Lage der Testübung. ".repeat(20),
        auftrag: "Auftrag der Führungsstelle: Einsatzstellen führen und Lage melden.",
        dauerMinuten: 120,
        minAbschnitte: 2,
        uebergeordnet: {
            bezeichnung: "Führungsstab des Landkreises",
            hintergrund: "Der Stab kennt die Gesamtlage und will alle 30 Minuten eine Lagemeldung. ".repeat(3),
            nachrichten: [
                {
                    zeit: 5, weg: "drucker", art: "auftrag", betreff: "Einsatzauftrag Nr. 1",
                    text: "Absatz   eins mit  Leerraum.\n\n\n\nAbsatz zwei für {{ea:nord}}.",
                    erwartung: "Auftrag an {{ea:nord}} weitergeben und Vollzug an {{stab}} melden."
                },
                {
                    zeit: 40, weg: "email", art: "information", betreff: "Wetterwarnung",
                    text: "Der Wetterdienst warnt vor weiterem Dauerregen.",
                    erwartung: "Zur Kenntnis nehmen und an die Einsatzstellen weitergeben."
                }
            ]
        },
        straenge: [
            {
                key: "nord",
                bezeichnung: "Einsatzstelle Nord",
                hintergrund: "Zugtrupp und zwei Bergungsgruppen, Stärke 1/3/14//18, Standort Deichkilometer 4. ".repeat(2),
                nachrichten: [
                    { zeit: 0, weg: "funk", art: "betrieb", text: "Melde mich in Ihrem Sprechfunkverkehrskreis an, {{ea}} an {{el}}.", erwartung: "Anmeldung quittieren." },
                    { zeit: 20, weg: "funk", art: "lagemeldung", text: "Sickerstelle bei Deichkilometer 4,2 markiert.", erwartung: "In die Lagekarte übernehmen." }
                ]
            },
            {
                key: "sued",
                bezeichnung: "Einsatzstelle Süd",
                hintergrund: "Fachgruppe Wasserschaden/Pumpen mit zwei Pumpen, Stärke 0/2/9//11, Standort Lerchenweg. ".repeat(2),
                nachrichten: [
                    { zeit: 3, weg: "funk", art: "betrieb", text: "Melde mich in Ihrem Sprechfunkverkehrskreis an.", erwartung: "Anmeldung quittieren und Kräfteübersicht anlegen." },
                    { zeit: 60, weg: "funk", art: "anforderung", text: "Benötigen 100 m Schlauch B an der Einsatzstelle LERCHENWEG.", erwartung: "Anforderung an {{stab}} weitergeben." }
                ]
            }
        ]
    };
}

function fehlerVon(drehbuch: unknown, slug = "test"): string[] {
    try {
        parseFuehrungsstellenUebung(slug, drehbuch);
    } catch (fehler) {
        if (fehler instanceof FuehrungsstellenParseError) {
            return fehler.fehler;
        }
        throw fehler;
    }
    return [];
}

describe("parseFuehrungsstellenUebung", () => {
    it("übernimmt ein gültiges Drehbuch und vereinheitlicht Leerraum zeilenweise", () => {
        const uebung = parseFuehrungsstellenUebung("test", gueltigesDrehbuch());
        expect(uebung.slug).toBe("test");
        expect(uebung.minAbschnitte).toBe(2);
        expect(uebung.straenge.map(s => s.key)).toEqual(["nord", "sued"]);
        const auftrag = uebung.uebergeordnet.nachrichten[0];
        // Absätze bleiben (höchstens eine Leerzeile), Leerraum innerhalb der Zeile wird zusammengezogen.
        expect(auftrag?.text).toBe("Absatz eins mit Leerraum.\n\nAbsatz zwei für {{ea:nord}}.");
        expect(auftrag?.betreff).toBe("Einsatzauftrag Nr. 1");
        expect(uebung.straenge[0]?.nachrichten[0]).not.toHaveProperty("betreff");
    });

    it("wirft bei einer Nicht-Objekt-Wurzel", () => {
        expect(() => parseFuehrungsstellenUebung("test", "nein")).toThrow(FuehrungsstellenParseError);
    });

    it("sammelt alle Fehler eines Drehbuchs auf einmal", () => {
        const drehbuch = gueltigesDrehbuch();
        const stab = drehbuch["uebergeordnet"] as { nachrichten: Record<string, unknown>[] };
        const straenge = drehbuch["straenge"] as { key: string; nachrichten: Record<string, unknown>[] }[];
        delete stab.nachrichten[0]!["betreff"];                       // drucker ohne Betreff
        stab.nachrichten[1]!["weg"] = "brieftaube";                   // unbekannter Weg
        stab.nachrichten[1]!["text"] = "Text mit {{ea:west}}.";       // unbekannter Strang-Schlüssel
        straenge[0]!.nachrichten[0]!["betreff"] = "Nicht bei Funk";   // Betreff bei Funk
        straenge[0]!.nachrichten[1]!["zeit"] = 500;                    // außerhalb der Dauer
        straenge[1]!.nachrichten[0]!["zeit"] = 70;                     // unsortiert (70 vor 60)
        straenge[1]!.nachrichten[1]!["weg"] = "email";                 // Strang nicht über Funk …
        straenge[1]!.nachrichten[1]!["betreff"] = "Als Mail";          // … aber sonst gültig
        straenge[1]!.key = "Süd Ost";                                  // ungültiger Schlüssel
        drehbuch["minAbschnitte"] = 5;                                 // mehr als Stränge

        const fehler = fehlerVon(drehbuch, "anderer-slug");
        const gesamt = fehler.join("\n");
        expect(gesamt).toContain("entspricht nicht dem erwarteten Slug");
        expect(gesamt).toContain("uebergeordnet.nachrichten[0].betreff fehlt");
        expect(gesamt).toContain("uebergeordnet.nachrichten[1]: weg muss");
        expect(gesamt).toContain("unbekannter Platzhalter");
        expect(gesamt).toContain("betreff ist nur bei drucker und email");
        expect(gesamt).toContain("zeit muss eine ganze Minute zwischen 0 und 120");
        expect(gesamt).toContain("aufsteigend sortieren");
        expect(gesamt).toContain("Stränge senden nur über funk");
        expect(gesamt).toContain("key fehlt oder enthält andere Zeichen");
        expect(gesamt).toContain("minAbschnitte (5) übersteigt die Stranganzahl (2)");
        expect(fehler.length).toBeGreaterThanOrEqual(10);
    });

    it("lehnt doppelte Strang-Schlüssel, fehlende Nachrichten und zu lange Funktexte ab", () => {
        const drehbuch = gueltigesDrehbuch();
        const straenge = drehbuch["straenge"] as { key: string; nachrichten: Record<string, unknown>[] }[];
        straenge[1]!.key = "nord";
        straenge[0]!.nachrichten[0]!["text"] = "x".repeat(301);
        (drehbuch["uebergeordnet"] as Record<string, unknown>)["nachrichten"] = [];
        const gesamt = fehlerVon(drehbuch).join("\n");
        expect(gesamt).toContain("key \"nord\" ist doppelt");
        expect(gesamt).toContain("länger als 300 Zeichen");
        expect(gesamt).toContain("uebergeordnet: nachrichten fehlt oder ist leer");
    });

    it("verlangt Dauer, Rollen und Stränge", () => {
        const gesamt = fehlerVon({ slug: "test", titel: "T" }).join("\n");
        expect(gesamt).toContain("dauerMinuten");
        expect(gesamt).toContain("uebergeordnet fehlt");
        expect(gesamt).toContain("straenge\" fehlt oder ist leer");
        expect(gesamt).toContain("minAbschnitte");
    });

    it("kennt {{ea}} nur innerhalb von Strängen", () => {
        expect(erlaubtePlatzhalter(["nord"], true)).toEqual(["{{el}}", "{{stab}}", "{{ea}}", "{{ea:nord}}"]);
        expect(erlaubtePlatzhalter(["nord"], false)).toEqual(["{{el}}", "{{stab}}", "{{ea:nord}}"]);
        const drehbuch = gueltigesDrehbuch();
        (drehbuch["uebergeordnet"] as { nachrichten: Record<string, unknown>[] }).nachrichten[1]!["text"] = "Für {{ea}}.";
        expect(fehlerVon(drehbuch).join("\n")).toContain("uebergeordnet.nachrichten[1].text: unbekannter Platzhalter");
    });
});
