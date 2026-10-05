import { beforeEach, describe, expect, it } from "vitest";
import type { GeneratorEntwurf } from "../../src/generator/GeneratorEntwurf";
import {
    bereinigeProfilName,
    entwurfAusProfil,
    erstelleProfil,
    findeProfil,
    ladeProfile,
    leseProfilDatei,
    loescheProfil,
    PROFIL_DATEI_MAX_BYTES,
    profilAlsJson,
    profilDateiname,
    PROFILE_SCHLUESSEL,
    pruefeProfil,
    speichereProfil
} from "../../src/generator/GeneratorProfile";

const baueEntwurf = (anders: Partial<GeneratorEntwurf> = {}): GeneratorEntwurf => ({
    version: 1,
    gespeichertAm: "2026-10-03T18:00:00.000Z",
    formular: {
        name: "Sprechfunkübung OBLG GA 10/2026", datum: "2026-10-03T00:00:00.000Z", rufgruppe: "DMO OV A",
        leitung: "Heros Bad Belzig 21/10",
        spruecheProTeilnehmer: 5, spruecheAnAlle: 1, spruecheAnMehrere: 2, buchstabierenAn: 3,
        anmeldungAktiv: true, autoStaerkeErgaenzen: true, nachrichtenArtAktiv: true, spruchAnteilProzent: 50,
        spielModus: "klassisch", xZeitIntervallMinuten: 3, xZeitStartOffsetMinuten: 0
    },
    quelle: "vorlagen",
    vorlagen: ["thwleer"],
    teilnehmerListe: ["Heros Bad Belzig 22/51", "Heros Brandenburg 63/63"],
    teilnehmerStellen: { "Heros Bad Belzig 22/51": "Zugtrupp" },
    loesungswortOption: "none",
    loesungswoerter: {},
    ...anders
});

const bestand = {
    vorlagen: new Set(["thwleer", "feuerwehr"]),
    szenarien: new Set(["hochwasser"]),
    fuehrungsstellen: new Set(["stab"])
};

const makeStorage = () => {
    const daten = new Map<string, string>();
    return {
        getItem: (k: string) => daten.get(k) ?? null,
        setItem: (k: string, v: string) => { daten.set(k, v); },
        removeItem: (k: string) => { daten.delete(k); }
    };
};

describe("GeneratorProfile", () => {
    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = makeStorage();
    });

    it("speichert Profile nach Namen, ersetzt gleichnamige und löscht sie wieder", () => {
        expect(ladeProfile()).toEqual([]);
        expect(speichereProfil(erstelleProfil("OV Bad Belzig", baueEntwurf()))).toBe(true);
        expect(speichereProfil(erstelleProfil("Kreisübung", baueEntwurf({ vorlagen: [] })))).toBe(true);
        expect(ladeProfile().map(p => p.name)).toEqual(["Kreisübung", "OV Bad Belzig"]);

        // Gleicher Name in anderer Schreibweise ersetzt statt zu verdoppeln.
        speichereProfil(erstelleProfil("ov bad belzig", baueEntwurf({ teilnehmerListe: ["Heros 1"] })));
        expect(ladeProfile()).toHaveLength(2);
        expect(findeProfil("OV BAD BELZIG")?.entwurf.teilnehmerListe).toEqual(["Heros 1"]);

        expect(loescheProfil("Kreisübung")).toBe(true);
        expect(loescheProfil("gibt es nicht")).toBe(false);
        expect(ladeProfile().map(p => p.name)).toEqual(["ov bad belzig"]);
    });

    it("überspringt kaputte Einträge und übersteht gesperrten Speicher", () => {
        localStorage.setItem(PROFILE_SCHLUESSEL, "{kein json");
        expect(ladeProfile()).toEqual([]);
        localStorage.setItem(PROFILE_SCHLUESSEL, JSON.stringify([
            erstelleProfil("Gut", baueEntwurf()),
            { typ: "sprechfunk-uebung-profil", version: 1, name: "Kaputt", gespeichertAm: "x", entwurf: { version: 1 } }
        ]));
        expect(ladeProfile().map(p => p.name)).toEqual(["Gut"]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = {
            getItem: () => { throw new Error("gesperrt"); },
            setItem: () => { throw new Error("voll"); }
        };
        expect(ladeProfile()).toEqual([]);
        expect(speichereProfil(erstelleProfil("X", baueEntwurf()))).toBe(false);
    });

    it("bereinigt Namen und baut einen sicheren Dateinamen", () => {
        expect(bereinigeProfilName("  OV   Bad\tBelzig  ")).toBe("OV Bad Belzig");
        expect(bereinigeProfilName("x".repeat(200))).toHaveLength(80);
        expect(profilDateiname("Grundausbildung Übung/Größe")).toBe("sprechfunk-profil-grundausbildung-uebung-groesse.json");
        expect(profilDateiname("???")).toBe("sprechfunk-profil-ohne-namen.json");
    });

    it("liest eine exportierte Profildatei wieder ein, alle Spielmodi eingeschlossen", () => {
        const entwuerfe = [
            baueEntwurf(),
            baueEntwurf({ formular: { ...baueEntwurf().formular, spielModus: "xZeit", xZeitIntervallMinuten: 4 } }),
            baueEntwurf({ quelle: "szenario", szenarioSlug: "hochwasser" }),
            baueEntwurf({ quelle: "upload" }),
            baueEntwurf({
                quelle: "fuehrungsstelle",
                fuehrungsstelle: {
                    slug: "stab", beuebteStelle: "Heros 10", uebergeordnet: "Kater",
                    unterstellt: ["Heros 21", "Heros 22"], beginn: "18:00", stellen: { "Heros 10": "Einsatzleitung" }
                }
            }),
            baueEntwurf({ loesungswortOption: "individual", loesungswoerter: { "Heros Bad Belzig 22/51": "FUNKE" } })
        ];
        for (const entwurf of entwuerfe) {
            const profil = erstelleProfil("Test", entwurf);
            const ergebnis = leseProfilDatei(profilAlsJson(profil));
            expect(ergebnis).toEqual({ ok: true, profil });
        }
        // Mit Byte-Order-Mark, wie manche Editoren speichern.
        expect(leseProfilDatei("﻿" + profilAlsJson(erstelleProfil("BOM", baueEntwurf()))).ok).toBe(true);
    });

    it("weist fremde, kaputte und zu große Dateien mit verständlicher Meldung ab", () => {
        const fehler = (text: string) => {
            const e = leseProfilDatei(text);
            return e.ok ? "" : e.fehler;
        };
        expect(fehler("kein json")).toContain("kein gültiges JSON");
        expect(fehler(JSON.stringify({ name: "Übung" }))).toContain("kein Profil");
        expect(fehler(JSON.stringify({ ...erstelleProfil("X", baueEntwurf()), version: 2 }))).toContain("anderen Version");
        expect(fehler(JSON.stringify({ ...erstelleProfil("X", baueEntwurf()), entwurf: { version: 1 } }))).toContain("beschädigt");
        expect(fehler(JSON.stringify({ ...erstelleProfil("X", baueEntwurf()), name: "   " }))).toContain("beschädigt");
        expect(fehler(" ".repeat(PROFIL_DATEI_MAX_BYTES + 1))).toContain("zu groß");
        expect(pruefeProfil(null)).toBeNull();
    });

    it("setzt ein vergangenes Datum auf heute und lässt ein künftiges stehen", () => {
        const heute = new Date(2026, 9, 5, 9, 30);
        const alt = entwurfAusProfil(erstelleProfil("X", baueEntwurf()), bestand, heute);
        expect(alt.entwurf.formular.datum).toBe(heute.toISOString());
        expect(alt.entfernt).toEqual([]);

        const kuenftig = new Date(2026, 9, 12).toISOString();
        const neu = entwurfAusProfil(
            erstelleProfil("X", baueEntwurf({ formular: { ...baueEntwurf().formular, datum: kuenftig } })),
            bestand,
            heute
        );
        expect(neu.entwurf.formular.datum).toBe(kuenftig);
        expect(neu.entwurf.formular.rufgruppe).toBe("DMO OV A");
    });

    it("lässt Vorlagen, Szenarien und Drehbücher weg, die es nicht mehr gibt", () => {
        const profil = erstelleProfil("X", baueEntwurf({
            vorlagen: ["thwleer", "weg"],
            szenarioSlug: "alt",
            fuehrungsstelle: { slug: "verschwunden", beuebteStelle: "Heros 10", uebergeordnet: "Kater", unterstellt: ["Heros 21"] }
        }));
        const { entwurf, entfernt } = entwurfAusProfil(profil, bestand);
        expect(entwurf.vorlagen).toEqual(["thwleer"]);
        expect(entwurf.szenarioSlug).toBeUndefined();
        expect(entwurf.fuehrungsstelle).toEqual({ slug: "", beuebteStelle: "Heros 10", uebergeordnet: "Kater", unterstellt: ["Heros 21"] });
        expect(entfernt).toEqual(["Vorlage „weg“", "Szenario „alt“", "Drehbuch „verschwunden“"]);
        // Das gespeicherte Profil selbst bleibt unverändert.
        expect(profil.entwurf.vorlagen).toEqual(["thwleer", "weg"]);
    });
});
