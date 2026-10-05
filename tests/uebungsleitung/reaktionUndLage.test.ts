import { afterEach, describe, expect, it, vi } from "vitest";
import {
    mitAuswertungsVermerken,
    mitReaktionsBilanz,
    reaktionsBilanz,
    reaktionsBilanzText
} from "../../src/uebungsleitung/reaktion";
import { zaehleVeralteteStatus } from "../../src/uebungsleitung/veraltet";
import { holeZurueckgesetzt, ladeAnsicht, merkeZurueckgesetzt, speichereAnsicht } from "../../src/uebungsleitung/ansicht";
import { buildAuswertungsStand, buildDebriefStorage } from "../../src/uebungsleitung/export";
import { renderLageHtml, type LageAnzeige } from "../../src/uebungsleitung/lageMarkup";
import { buildLageAnzeige, fassungVomText } from "../../src/uebungsleitung/lageAufbau";
import { buildFaelligkeit, naechsteFuerLage, waehleNaechste, zaehleFaelligkeit } from "../../src/uebungsleitung/nachrichtenplan";
import type { Faelligkeit } from "../../src/uebungsleitung/lagebild";

const plan = [
    { sender: "EA1", nr: 1, empfaenger: ["Stelle"], text: "a", erwartung: "quittieren" },
    { sender: "EA1", nr: 2, empfaenger: ["Stelle"], text: "b", erwartung: "Lagekarte" },
    { sender: "Stab", nr: 1, empfaenger: ["Stelle"], text: "c", erwartung: "Rückmeldung" },
    { sender: "Stab", nr: 2, empfaenger: ["Stelle"], text: "d", erwartung: "x" },
    { sender: "Stab", nr: 3, empfaenger: ["Stelle"], text: "e" }
];

describe("Reaktion der beübten Stelle (THW-Review 2026-10-05, command P2-1)", () => {
    const effektiv = {
        "EA1__1": { abgesetztUm: "2026-10-05T19:00:00.000Z", reaktion: "erfolgt" as const },
        "EA1__2": { abgesetztUm: "2026-10-05T19:05:00.000Z", reaktion: "abweichend" as const },
        "Stab__1": { abgesetztUm: "2026-10-05T19:02:00.000Z" },
        "Stab__2": { abgesetztUm: "2026-10-05T19:08:00.000Z" },
        "Stab__3": { abgesetztUm: "2026-10-05T19:09:00.000Z" }
    };

    it("zählt nur abgesetzte Einspielungen mit Erwartung und merkt die älteste ausstehende", () => {
        const bilanz = reaktionsBilanz(plan, effektiv);
        expect(bilanz).toEqual({ erfolgt: 1, abweichend: 1, ausgeblieben: 0, ausstehend: 2, aeltesteAusstehendSeit: "2026-10-05T19:02:00.000Z" });
        expect(reaktionsBilanzText(bilanz)).toBe("1 erfolgt · 1 abweichend · 2 ausstehend");
        expect(reaktionsBilanzText({ erfolgt: 0, abweichend: 0, ausgeblieben: 0, ausstehend: 0 })).toBe("noch nichts eingespielt");
    });

    it("schreibt Ausgelassen, Reaktion und Herkunft der Zeit als Vermerk vor die Notiz", () => {
        const vermerkt = mitAuswertungsVermerken({
            a: { ausgelassen: true },
            b: { abgesetztUm: "x", reaktion: "ausgeblieben", notiz: "Lagekarte fehlt" },
            c: { abgesetztUm: "x", zeitVomTeilnehmer: true },
            d: { abgesetztUm: "x" }
        });
        expect(vermerkt["a"]?.notiz).toBe("Bewusst ausgelassen (nicht eingespielt).");
        expect(vermerkt["b"]?.notiz).toBe("Reaktion der beübten Stelle: ausgeblieben. Lagekarte fehlt");
        expect(vermerkt["c"]?.notiz).toContain("Meldung des Teilnehmers");
        expect(vermerkt["d"]?.notiz).toBeUndefined();
    });

    it("setzt die Summe als Notiz der beübten Stelle", () => {
        const storage = { version: 1, uebungId: "u", lastUpdated: "", teilnehmer: { Stelle: { notizen: "gut" } }, nachrichten: {} };
        const bilanz = { erfolgt: 2, abweichend: 0, ausgeblieben: 1, ausstehend: 0 };
        expect(mitReaktionsBilanz(storage, "Stelle", bilanz).teilnehmer["Stelle"]?.notizen).toBe("Reaktionen: 2 erfolgt · 1 ausgeblieben. gut");
        expect(mitReaktionsBilanz(storage, undefined, bilanz)).toBe(storage);
        const ohne = { ...storage, teilnehmer: {} };
        expect(mitReaktionsBilanz(ohne, "Stelle", bilanz).teilnehmer["Stelle"]?.notizen).toBe("Reaktionen: 2 erfolgt · 1 ausgeblieben.");
    });

    it("gibt Übungsleitungs-PDF und Debrief denselben Stand", () => {
        const storage = {
            version: 1, uebungId: "u", lastUpdated: "",
            teilnehmer: { A: { angemeldetUm: "2026-10-05T19:01:00.000Z" } },
            nachrichten: { "A__1": { abgesetztUm: "2026-10-05T19:10:00.000Z", nachgetragen: true, reaktion: "erfolgt" as const } }
        };
        const stand = buildAuswertungsStand(
            { fuehrungsstelle: { slug: "s", beuebteStelle: "Stelle", uebergeordnet: "B", unterstellt: [] } as never },
            storage,
            { A: { angemeldetUm: "2026-10-05T19:10:00.000Z", quelle: "funkspruch" }, B: {} },
            { erfolgt: 1, abweichend: 0, ausgeblieben: 0, ausstehend: 0 }
        );
        expect(stand.teilnehmer["A"]?.angemeldetUm).toBe("2026-10-05T19:10:00.000Z");
        expect(stand.teilnehmer["B"]).toBeUndefined();
        expect(stand.teilnehmer["Stelle"]?.notizen).toContain("1 erfolgt");
        expect(stand.nachrichten["A__1"]?.notiz).toContain("wie erwartet erfolgt");
        expect(storage.teilnehmer.A.angemeldetUm).toBe("2026-10-05T19:01:00.000Z");

        const debrief = buildDebriefStorage(stand, { "A__1": { abgesetztUm: "x", gemeldetUm: "y", reaktion: "abweichend" } });
        expect(debrief.nachrichten["A__1"]).toMatchObject({ gemeldetUm: "y" });
        expect(debrief.nachrichten["A__1"]?.notiz).toContain("abweichend");
        expect(debrief.teilnehmer["A"]?.angemeldetUm).toBe("2026-10-05T19:10:00.000Z");

        const klassisch = buildAuswertungsStand({}, storage, {}, null);
        expect(klassisch.teilnehmer).toEqual(storage.teilnehmer);
    });
});

describe("Veraltete Status nach dem Überschreiben (THW-Review 2026-10-05, destructive-action P2-1)", () => {
    it("zählt Status und Anmeldungen, die älter als die Fassung sind", () => {
        const fassung = new Date("2026-10-05T19:30:00.000Z");
        const anzahl = zaehleVeralteteStatus(fassung, {
            alt: { abgesetztUm: "2026-10-05T19:00:00.000Z" },
            altGemeldet: { gemeldetUm: "2026-10-05T19:10:00.000Z" },
            altAusgelassen: { ausgelassen: true, statusGeaendertUm: "2026-10-05T19:10:00.000Z" },
            knapp: { abgesetztUm: "2026-10-05T19:29:00.000Z" },
            neu: { abgesetztUm: "2026-10-05T19:40:00.000Z" },
            zurueckgesetzt: { statusGeaendertUm: "2026-10-05T19:00:00.000Z" }
        }, { A: { angemeldetUm: "2026-10-05T19:00:00.000Z" }, B: {} });
        expect(anzahl).toBe(4);
        expect(zaehleVeralteteStatus(undefined, { a: { abgesetztUm: "2020-01-01T00:00:00.000Z" } }, {})).toBe(0);
        expect(zaehleVeralteteStatus("2026-10-05T19:30:00.000Z", {}, {})).toBe(0);
    });
});

describe("Ansicht je Gerät (THW-Review 2026-10-05, command P3-3)", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("merkt Ausblenden und Einklappen und übersteht fehlenden Speicher", () => {
        const store = new Map<string, string>();
        const speicher = {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, v),
            removeItem: (k: string) => void store.delete(k)
        };
        vi.stubGlobal("localStorage", speicher);
        vi.stubGlobal("sessionStorage", speicher);
        expect(ladeAnsicht()).toEqual({ hideAbgesetzt: false, teilnehmerEingeklappt: false });
        speichereAnsicht({ hideAbgesetzt: true, teilnehmerEingeklappt: true });
        expect(ladeAnsicht()).toEqual({ hideAbgesetzt: true, teilnehmerEingeklappt: true });

        merkeZurueckgesetzt("u1", new Date("2026-10-05T19:05:00.000Z"));
        expect(holeZurueckgesetzt("u2")).toBeNull();
        merkeZurueckgesetzt("u1", new Date("2026-10-05T19:05:00.000Z"));
        expect(holeZurueckgesetzt("u1")).toBe("2026-10-05T19:05:00.000Z");
        expect(holeZurueckgesetzt("u1")).toBeNull();

        const kaputt = { getItem: () => { throw new Error("gesperrt"); }, setItem: () => { throw new Error("gesperrt"); }, removeItem: () => {} };
        vi.stubGlobal("localStorage", kaputt);
        vi.stubGlobal("sessionStorage", kaputt);
        expect(ladeAnsicht()).toEqual({ hideAbgesetzt: false, teilnehmerEingeklappt: false });
        expect(() => speichereAnsicht({ hideAbgesetzt: true, teilnehmerEingeklappt: false })).not.toThrow();
        expect(() => merkeZurueckgesetzt("u1")).not.toThrow();
        expect(holeZurueckgesetzt("u1")).toBeNull();
    });
});

const f = (zustand: Faelligkeit["zustand"], sollMs = 0): Faelligkeit => ({ zustand, sollMs, minuten: 1 });

describe("Als Nächstes und Rückstand (THW-Review 2026-10-05, command P2-2, P3-1)", () => {
    it("zeigt neben der ältesten überfälligen Zeile die gerade fälligen", () => {
        const offene = [1, 2, 3, 4, 5].map(nr => ({ sender: "A", nr }));
        const faelligkeit = {
            "A__1": f("ueberfaellig"), "A__2": f("ueberfaellig"), "A__3": f("ueberfaellig"),
            "A__4": f("faellig"), "A__5": f("spaeter")
        };
        expect(waehleNaechste(offene, faelligkeit, 3).map(n => n.nr)).toEqual([1, 4, 5]);
        expect(waehleNaechste(offene, {}, 2).map(n => n.nr)).toEqual([1, 2]);
        expect(zaehleFaelligkeit(faelligkeit)).toEqual({ ueberfaellig: 3, faellig: 1 });
    });

    it("lässt ausgelassene Zeilen aus Fälligkeit und „Als Nächstes“ heraus und nennt die Absender-Nummer", () => {
        const nachrichten = [
            { sender: "A", nr: 1, empfaenger: ["B"], text: "x", xZeitSlot: 0, planNr: 1 },
            { sender: "A", nr: 2, empfaenger: ["B"], text: "y", xZeitSlot: 1, planNr: 2 }
        ];
        const effektiv = { "A__1": { ausgelassen: true } };
        const faelligkeit = buildFaelligkeit(nachrichten, effektiv, 0, { intervallMinuten: 1, jetztMs: 10 * 60000 });
        expect(Object.keys(faelligkeit)).toEqual(["A__2"]);
        const naechste = naechsteFuerLage(nachrichten, effektiv, faelligkeit);
        expect(naechste).toHaveLength(1);
        expect(naechste[0]).toMatchObject({ planNr: 2, absNr: 2 });
    });
});

describe("Lagezeile (THW-Review 2026-10-05)", () => {
    const basisLage: LageAnzeige = {
        teilnehmer: [{ teilnehmer: "A", offen: 2, gesamt: 3, nurGemeldet: 1 }],
        naechste: [{ planNr: 4, absNr: 2, sender: "A", empfaenger: ["B"], faelligkeit: { zustand: "ueberfaellig", sollMs: new Date(2026, 9, 5, 19, 30).getTime(), minuten: 12 } }],
        zuBestaetigen: 1,
        hideAbgesetzt: false,
        ueberfaellig: 12,
        faellig: 2,
        jetztMs: new Date(2026, 9, 5, 19, 45).getTime()
    };

    it("nennt Rückstand in einer Zahl mit der Aufteilung und erklärt „gemeldet“", () => {
        const html = renderLageHtml(basisLage);
        expect(html).toContain("12 überfällig, 2 jetzt fällig – zur ersten");
        expect(html).toContain("Nr. 4 · A (Abs.-Nr. 2) → B · 19:30 · überfällig 12 min");
        expect(html).toContain("mit Meldezeit des Teilnehmers");
        expect(html).toContain("„Gemeldet“ heißt: der Teilnehmer hat abgehakt.");
        expect(html).not.toContain("lage-verbindung");
        expect(renderLageHtml({ ...basisLage, ueberfaellig: 0, faellig: 2 })).toContain("data-ziel=\"faellig\"");
        expect(renderLageHtml({ ...basisLage, ueberfaellig: 0, faellig: 0 })).not.toContain("zur ersten");
    });

    it("zeigt Verbindungsverlust oben, mit wartenden Änderungen und letzter Bestätigung", () => {
        const html = renderLageHtml({
            ...basisLage,
            verbindung: { state: "offline", offen: 2, letzteBestaetigungUm: new Date(2026, 9, 5, 19, 7).toISOString() }
        });
        expect(html).toContain("Keine Verbindung");
        expect(html).toContain("2 Änderungen warten.");
        expect(html).toContain("Zuletzt vom Server bestätigt: 19:07.");
        expect(renderLageHtml({ ...basisLage, verbindung: { state: "fehler", offen: 1 } })).toContain("lehnt Änderungen ab");
        expect(renderLageHtml({ ...basisLage, verbindung: { state: "offline", offen: 1 } })).toContain("1 Änderung warten.");
        expect(renderLageHtml({ ...basisLage, verbindung: { state: "live", offen: 0 } })).not.toContain("lage-verbindung");
    });

    it("warnt vor Status aus einer älteren Fassung und fasst die Reaktionen zusammen", () => {
        const html = renderLageHtml({
            ...basisLage,
            veraltet: { anzahl: 3, fassungVom: "05.10. um 19:30" },
            reaktionen: { erfolgt: 1, abweichend: 0, ausgeblieben: 1, ausstehend: 2, aeltesteAusstehendSeit: new Date(2026, 9, 5, 19, 39).toISOString() }
        });
        expect(html).toContain("am 05.10. um 19:30 neu verteilt. 3 gesetzte Status");
        expect(html).toContain("data-action=\"zu-zuruecksetzen\"");
        expect(html).toContain("1 erfolgt · 1 ausgeblieben · 2 ausstehend (älteste ausstehend seit 6 min)");
    });

    it("baut die Lage aus Plan, Status und Verbindung", () => {
        const lage = buildLageAnzeige({
            uebung: { createDate: new Date("2026-10-05T19:30:00.000Z"), fuehrungsstelle: { slug: "s" } as never },
            teilnehmerStatus: {},
            nachrichten: plan,
            effektiv: { "EA1__1": { abgesetztUm: "2026-10-05T19:00:00.000Z", erledigtUm: "2026-10-05T19:00:00.000Z" } },
            faelligkeit: { "EA1__2": f("ueberfaellig"), "Stab__1": f("faellig") },
            hideAbgesetzt: true,
            syncInfo: { state: "offline", offeneAenderungen: 1, letzteBestaetigungUm: "2026-10-05T19:00:00.000Z" },
            jetztMs: 0
        });
        expect(lage.ueberfaellig).toBe(1);
        expect(lage.faellig).toBe(1);
        expect(lage.reaktionen?.ausstehend).toBe(1);
        expect(lage.veraltet?.anzahl).toBe(1);
        expect(lage.verbindung).toEqual({ state: "offline", offen: 1, letzteBestaetigungUm: "2026-10-05T19:00:00.000Z" });

        const ohne = buildLageAnzeige({
            uebung: { createDate: new Date("2026-10-05T18:00:00.000Z") } as never,
            teilnehmerStatus: {},
            nachrichten: plan,
            effektiv: {},
            faelligkeit: {},
            hideAbgesetzt: false,
            syncInfo: { state: "live", offeneAenderungen: 0 },
            jetztMs: 0
        });
        expect(ohne.reaktionen).toBeNull();
        expect(ohne.veraltet).toBeNull();
        expect(ohne.verbindung).toEqual({ state: "live", offen: 0 });
        expect(fassungVomText(undefined)).toBe("–");
        expect(fassungVomText(new Date(2026, 9, 5, 19, 3))).toBe("05.10. um 19:03");
    });
});
