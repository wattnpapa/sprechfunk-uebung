import { describe, expect, it } from "vitest";
import { funkspruchQuelleMerkmal, spielModusMerkmal } from "../../src/admin/uebungsMerkmale";

describe("spielModusMerkmal", () => {
    it("zeigt Übungen ohne gespeicherten Modus als klassisch", () => {
        expect(spielModusMerkmal({})).toEqual({ label: "Klassisch" });
        expect(spielModusMerkmal({ spielModus: "klassisch" })).toEqual({ label: "Klassisch" });
    });

    it("zeigt X-Zeit samt Intervall im Tooltip", () => {
        expect(spielModusMerkmal({ spielModus: "xZeit", xZeitIntervallMinuten: 10 }))
            .toEqual({ label: "X-Zeit", detail: "Intervall: 10 Minuten" });
        expect(spielModusMerkmal({ spielModus: "xZeit" })).toEqual({ label: "X-Zeit" });
    });
});

describe("funkspruchQuelleMerkmal", () => {
    it("erkennt Szenario-Übungen und löst den Titel auf", () => {
        expect(funkspruchQuelleMerkmal({ szenarioSlug: "unwetter-sturm" }))
            .toEqual({ label: "Szenario", detail: "Sturmtief über dem Landkreis" });
    });

    it("fällt bei unbekanntem Szenario auf den Slug zurück", () => {
        expect(funkspruchQuelleMerkmal({ szenarioSlug: "geloescht" }))
            .toEqual({ label: "Szenario", detail: "geloescht" });
    });

    it("hat das Szenario Vorrang vor gespeicherten Vorlagen", () => {
        expect(funkspruchQuelleMerkmal({ szenarioSlug: "unwetter-sturm", verwendeteVorlagen: ["thwleer"] }).label)
            .toBe("Szenario");
    });

    it("nennt Vorlagen mit Anzahl und Anzeigenamen", () => {
        expect(funkspruchQuelleMerkmal({ verwendeteVorlagen: ["thwleer"] }))
            .toEqual({ label: "Vorlage", detail: "Funksprüche THW Leer" });
        expect(funkspruchQuelleMerkmal({ verwendeteVorlagen: ["thwleer", "unbekannt"] }))
            .toEqual({ label: "Vorlagen (2)", detail: "Funksprüche THW Leer\nunbekannt" });
    });

    it("wertet fehlende oder leere Vorlagen als eigene Funksprüche", () => {
        expect(funkspruchQuelleMerkmal({})).toEqual({ label: "Eigene" });
        expect(funkspruchQuelleMerkmal({ verwendeteVorlagen: [] })).toEqual({ label: "Eigene" });
    });
});
