import { describe, expect, it, vi } from "vitest";
import { GenerationService } from "../../src/services/GenerationService";
import { FunkUebung } from "../../src/models/FunkUebung";

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
        expect(u.checksumme.length).toBeGreaterThan(0);
        expect(u.loesungsStaerken?.A).toBeDefined();
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

    it("handles UUID fallback and random helper branches", () => {
        const service = new GenerationService();
        vi.stubGlobal("crypto", undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uuid = (service as any).generateUUID();
        expect(uuid).toHaveLength(36);
        vi.unstubAllGlobals();

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

    it("covers subset random branches and existing ids in generate", () => {
        const service = new GenerationService();
        const random = vi.spyOn(Math, "random");
        random.mockReturnValueOnce(0.85).mockReturnValueOnce(0.2).mockReturnValueOnce(0.96).mockReturnValue(0.4);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subset = (service as any).getRandomSubsetOfOthers(["A", "B", "C", "D", "E", "F", "G", "H"], "A");
        expect(subset.length).toBeGreaterThan(0);
        random.mockRestore();

        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A"];
        u.teilnehmerIds = { fixed: "A" };
        u.funksprueche = ["TXT"];
        u.spruecheProTeilnehmer = 1;
        u.spruecheAnAlle = 0;
        u.spruecheAnMehrere = 0;
        u.buchstabierenAn = 0;
        service.generate(u);
        expect(Object.keys(u.teilnehmerIds)).toEqual(["fixed"]);
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
});
