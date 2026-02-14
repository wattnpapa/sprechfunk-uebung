import { describe, expect, it } from "vitest";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("FunkUebung", () => {
    it("initializes with defaults", () => {
        const u = new FunkUebung("v1");
        expect(u.id).toBeTruthy();
        expect(u.name).toContain("Sprechfunkübung");
        expect(u.buildVersion).toBe("v1");
        expect(u.teilnehmerListe.length).toBeGreaterThan(0);
        expect(u.nachrichten).toBeTruthy();
    });

    it("updates checksum and toJson returns valid JSON", () => {
        const u = new FunkUebung("v1");
        u.updateChecksum();
        expect(u.checksumme).toBeTruthy();

        const json = u.toJson();
        const parsed = JSON.parse(json);
        expect(parsed.id).toBe(u.id);
        expect(parsed.checksumme).toBe(u.checksumme);
    });
});
