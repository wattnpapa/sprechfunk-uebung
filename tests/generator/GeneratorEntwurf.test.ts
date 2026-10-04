import { beforeEach, describe, expect, it } from "vitest";
import { FunkUebung } from "../../src/models/FunkUebung";
import {
    ENTWURF_SCHLUESSEL,
    entwurfHatInhalt,
    type GeneratorEntwurf,
    ladeEntwurf,
    pruefeEntwurf,
    speichereEntwurf,
    verwerfeEntwurf,
    wendeEntwurfAn
} from "../../src/generator/GeneratorEntwurf";

const baueEntwurf = (anders: Partial<GeneratorEntwurf> = {}): GeneratorEntwurf => ({
    version: 1,
    gespeichertAm: "2026-10-04T18:00:00.000Z",
    formular: {
        name: "Dienstabend", datum: "2026-10-06T00:00:00.000Z", rufgruppe: "RG 1", leitung: "Heros 10",
        spruecheProTeilnehmer: 12, spruecheAnAlle: 1, spruecheAnMehrere: 2, buchstabierenAn: 0,
        anmeldungAktiv: true, autoStaerkeErgaenzen: false, nachrichtenArtAktiv: false, spruchAnteilProzent: 50,
        spielModus: "xZeit", xZeitIntervallMinuten: 4, xZeitStartOffsetMinuten: 2
    },
    quelle: "vorlagen",
    vorlagen: ["thwleer"],
    teilnehmerListe: ["Heros 21/11", ""],
    teilnehmerStellen: { "Heros 21/11": "Trupp" },
    loesungswortOption: "individual",
    loesungswoerter: { "Heros 21/11": "FUNKE" },
    ...anders
});

const makeStorage = () => {
    const daten = new Map<string, string>();
    return {
        getItem: (k: string) => daten.get(k) ?? null,
        setItem: (k: string, v: string) => { daten.set(k, v); },
        removeItem: (k: string) => { daten.delete(k); }
    };
};

describe("GeneratorEntwurf", () => {
    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = makeStorage();
    });

    it("speichert, lädt und verwirft einen Entwurf", () => {
        const entwurf = baueEntwurf();
        speichereEntwurf(entwurf);
        expect(ladeEntwurf()).toEqual(entwurf);
        verwerfeEntwurf();
        expect(ladeEntwurf()).toBeNull();
    });

    it("verwirft kaputte oder fremde Daten", () => {
        localStorage.setItem(ENTWURF_SCHLUESSEL, "{kein json");
        expect(ladeEntwurf()).toBeNull();
        expect(pruefeEntwurf({ ...baueEntwurf(), version: 2 })).toBeNull();
        expect(pruefeEntwurf({ ...baueEntwurf(), quelle: "irgendwas" })).toBeNull();
        expect(pruefeEntwurf({ ...baueEntwurf(), teilnehmerListe: [1] })).toBeNull();
        expect(pruefeEntwurf({ ...baueEntwurf(), formular: { ...baueEntwurf().formular, spruecheProTeilnehmer: "x" } })).toBeNull();
        expect(pruefeEntwurf({ ...baueEntwurf(), fuehrungsstelle: { slug: 1 } })).toBeNull();
    });

    it("übersteht gesperrten Speicher", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = {
            getItem: () => { throw new Error("gesperrt"); },
            setItem: () => { throw new Error("voll"); },
            removeItem: () => { throw new Error("gesperrt"); }
        };
        expect(() => speichereEntwurf(baueEntwurf())).not.toThrow();
        expect(ladeEntwurf()).toBeNull();
        expect(() => verwerfeEntwurf()).not.toThrow();
    });

    it("erkennt Entwürfe ohne jede Eingabe", () => {
        const leer = baueEntwurf({ teilnehmerListe: ["", ""], vorlagen: [] });
        leer.formular = { ...leer.formular, leitung: "", rufgruppe: "" };
        expect(entwurfHatInhalt(leer)).toBe(false);
        expect(entwurfHatInhalt(baueEntwurf())).toBe(true);
    });

    it("überträgt Formular, Teilnehmer und Lösungswörter auf eine Übung", () => {
        const uebung = new FunkUebung("dev");
        wendeEntwurfAn(uebung, baueEntwurf());
        expect(uebung.name).toBe("Dienstabend");
        expect(uebung.leitung).toBe("Heros 10");
        expect(uebung.spielModus).toBe("xZeit");
        expect(uebung.datum).toBeInstanceOf(Date);
        expect(uebung.verwendeteVorlagen).toEqual(["thwleer"]);
        expect(uebung.teilnehmerListe).toEqual(["Heros 21/11", ""]);
        expect(uebung.loesungswoerter).toEqual({ "Heros 21/11": "FUNKE" });
        expect(uebung.fuehrungsstelle).toBeUndefined();
    });

    it("übernimmt Szenario und Rollen nur für die gewählte Quelle", () => {
        const uebung = new FunkUebung("dev");
        wendeEntwurfAn(uebung, baueEntwurf({
            quelle: "fuehrungsstelle",
            loesungswortOption: "none",
            fuehrungsstelle: { slug: "hochwasser-fuehrungsstelle", beuebteStelle: "EL", uebergeordnet: "Stab", unterstellt: ["EA 1"] }
        }));
        expect(uebung.fuehrungsstelle?.beuebteStelle).toBe("EL");
        expect(uebung.loesungswoerter).toEqual({});
        expect(uebung.szenarioSlug).toBeUndefined();
    });
});
