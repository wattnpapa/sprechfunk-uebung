import { describe, expect, it } from "vitest";
import { GeneratorStateService } from "../../src/generator/GeneratorStateService";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("GeneratorStateService", () => {
    it("updates teilnehmer name and keeps mappings", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B"];
        uebung.teilnehmerStellen = { A: "StelleA" };
        uebung.loesungswoerter = { A: "WORT" };

        const svc = new GeneratorStateService();
        svc.updateTeilnehmerName(uebung, 0, "A2");

        expect(uebung.teilnehmerListe[0]).toBe("A2");
        expect(uebung.teilnehmerStellen?.A2).toBe("StelleA");
        expect(uebung.teilnehmerStellen?.A).toBeUndefined();
        expect(uebung.loesungswoerter?.A2).toBe("WORT");
        expect(uebung.loesungswoerter?.A).toBeUndefined();
    });

    it("ignores update when index is invalid", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        const svc = new GeneratorStateService();
        svc.updateTeilnehmerName(uebung, 5, "X");
        expect(uebung.teilnehmerListe).toEqual(["A"]);
    });

    it("no-op when name is unchanged", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        uebung.teilnehmerStellen = { A: "StelleA" };
        const svc = new GeneratorStateService();
        svc.updateTeilnehmerName(uebung, 0, "A");
        expect(uebung.teilnehmerStellen?.A).toBe("StelleA");
    });

    it("updates name even without mappings", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        uebung.teilnehmerStellen = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        uebung.loesungswoerter = undefined as any;
        const svc = new GeneratorStateService();

        svc.updateTeilnehmerName(uebung, 0, "B");
        expect(uebung.teilnehmerListe[0]).toBe("B");
    });

    it("updates empty participant placeholder and migrates mapping", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", ""];
        uebung.teilnehmerStellen = { "": "Trupp C" };

        const svc = new GeneratorStateService();
        svc.updateTeilnehmerName(uebung, 1, "C");

        expect(uebung.teilnehmerListe[1]).toBe("C");
        expect(uebung.teilnehmerStellen?.C).toBe("Trupp C");
        expect(uebung.teilnehmerStellen?.[""]).toBeUndefined();
    });

    it("removes teilnehmer and related data", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B"];
        uebung.teilnehmerStellen = { A: "StelleA" };
        uebung.loesungswoerter = { A: "WORT" };

        const svc = new GeneratorStateService();
        svc.removeTeilnehmer(uebung, 0);

        expect(uebung.teilnehmerListe).toEqual(["B"]);
        expect(uebung.teilnehmerStellen?.A).toBeUndefined();
        expect(uebung.loesungswoerter?.A).toBeUndefined();
    });

    it("removeTeilnehmer is no-op for invalid index", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        const svc = new GeneratorStateService();
        svc.removeTeilnehmer(uebung, 3);
        expect(uebung.teilnehmerListe).toEqual(["A"]);
    });

    it("removeTeilnehmer skips missing mappings", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        uebung.teilnehmerStellen = undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        uebung.loesungswoerter = undefined as any;
        const svc = new GeneratorStateService();
        svc.removeTeilnehmer(uebung, 0);
        expect(uebung.teilnehmerListe).toEqual([]);
    });

    it("sets zentrale loesungswoerter for all teilnehmer", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B"];
        const svc = new GeneratorStateService();
        svc.resetLoesungswoerter(uebung);
        svc.setZentralesLoesungswort(uebung, "X");

        expect(uebung.loesungswoerter.A).toBe("X");
        expect(uebung.loesungswoerter.B).toBe("X");
    });

    it("shuffles central word and returns it", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B"];
        const svc = new GeneratorStateService();

        const result = svc.shuffleLoesungswoerter(uebung, "central", ["Z"]);

        expect(result.error).toBeUndefined();
        expect(result.centralWord).toBe("Z");
        expect(uebung.loesungswoerter.A).toBe("Z");
        expect(uebung.loesungswoerter.B).toBe("Z");
    });

    it("returns error on central shuffle without words", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        const svc = new GeneratorStateService();

        const result = svc.shuffleLoesungswoerter(uebung, "central", []);
        expect(result.error).toBeTruthy();
    });

    it("handles individual shuffle", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A", "B", "C"];
        const svc = new GeneratorStateService();

        const result = svc.shuffleLoesungswoerter(uebung, "individual", ["X", "Y"]);
        expect(result.error).toBeUndefined();
        expect(uebung.loesungswoerter.A).toBeTruthy();
        expect(uebung.loesungswoerter.B).toBeTruthy();
        expect(uebung.loesungswoerter.C).toBeTruthy();
    });

    it("returns error for individual shuffle with empty list", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        const svc = new GeneratorStateService();

        const result = svc.shuffleLoesungswoerter(uebung, "individual", []);
        expect(result.error).toBeTruthy();
    });

    it("central shuffle handles undefined word", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        const svc = new GeneratorStateService();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = svc.shuffleLoesungswoerter(uebung, "central", [undefined as any]);
        expect(result.error).toBeUndefined();
        expect(result.centralWord).toBe("");
        expect(uebung.loesungswoerter.A).toBe("");
    });

    it("returns empty result for option none", () => {
        const uebung = new FunkUebung("test");
        const svc = new GeneratorStateService();
        const result = svc.shuffleLoesungswoerter(uebung, "none", ["X"]);
        expect(result).toEqual({});
    });

    it("skips empty words in individuelle loesungswoerter", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        const svc = new GeneratorStateService();
        svc.setIndividuelleLoesungswoerter(uebung, [""]);
        expect(uebung.loesungswoerter.A).toBeUndefined();
    });

    it("updates teilnehmer stelle and removes on empty", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        const svc = new GeneratorStateService();

        svc.updateTeilnehmerStelle(uebung, "A", "Stelle1");
        expect(uebung.teilnehmerStellen?.A).toBe("Stelle1");

        svc.updateTeilnehmerStelle(uebung, "A", "  ");
        expect(uebung.teilnehmerStellen?.A).toBeUndefined();
    });

    it("addTeilnehmer appends empty string", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = [];
        const svc = new GeneratorStateService();
        svc.addTeilnehmer(uebung);
        expect(uebung.teilnehmerListe).toEqual([""]);
    });

    it("setIndividuelleLoesungswoerter is no-op for empty list", () => {
        const uebung = new FunkUebung("test");
        uebung.teilnehmerListe = ["A"];
        const svc = new GeneratorStateService();
        svc.setIndividuelleLoesungswoerter(uebung, []);
        expect(uebung.loesungswoerter.A).toBeUndefined();
    });
});
