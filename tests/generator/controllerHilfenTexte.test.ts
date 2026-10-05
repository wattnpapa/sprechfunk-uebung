import { describe, expect, it } from "vitest";
import {
    erfolgsText,
    nameFuerNeueUebung,
    rueckfrageText,
    speicherFehlerText,
    ZeitlimitFehler
} from "../../src/generator/controllerHilfen";

describe("Texte und Namen beim erneuten Generieren (THW-Review 2026-10-05)", () => {
    it("hängt bei unverändertem Namen einen Zähler an (error-recovery P2-2)", () => {
        expect(nameFuerNeueUebung("Dienstabend", "Dienstabend")).toBe("Dienstabend (2)");
        expect(nameFuerNeueUebung("Dienstabend (2)", "Dienstabend (2)")).toBe("Dienstabend (3)");
        expect(nameFuerNeueUebung(" Dienstabend ", "Dienstabend")).toBe("Dienstabend (2)");
        // Selbst umbenannt oder leer: Der Name bleibt, wie er ist.
        expect(nameFuerNeueUebung("Dienstabend Gruppe B", "Dienstabend")).toBe("Dienstabend Gruppe B");
        expect(nameFuerNeueUebung("", "Dienstabend")).toBe("");
    });

    it("nennt beim Überschreiben das Zurücksetzen des Übungsstands", () => {
        const text = rueckfrageText("Abend");
        expect(text).toContain("„Abend“ überschreiben?");
        expect(text).toContain("Übungsstand wird für alle zurückgesetzt");
        expect(text).toContain("Übungsleitung als PDF");
        expect(rueckfrageText("")).toContain("„ohne Namen“");
    });

    it("sagt nach dem Zeitlimit ehrlich, dass das Speichern noch ankommen kann (offline-resilience P2-1)", () => {
        const neu = speicherFehlerText(new ZeitlimitFehler("Zeitlimit"), false);
        expect(neu).toContain("Speichern nicht bestätigt");
        expect(neu).toContain("kann noch ankommen");
        expect(neu).toContain("Gib noch keine Links weiter");
        expect(neu).not.toContain("wurde nicht gespeichert");

        const ueberschrieben = speicherFehlerText(new ZeitlimitFehler("Zeitlimit"), true);
        expect(ueberschrieben).toContain("zuletzt bestätigten Fassung");
        expect(ueberschrieben).not.toContain("Es wurde nichts verändert");

        // Ein abgelehnter Schreibvorgang ist wirklich nicht gespeichert.
        expect(speicherFehlerText(new Error("permission-denied"), true))
            .toContain("Die Übung wurde nicht gespeichert. Prüfe die Internetverbindung. Es wurde nichts verändert");
    });

    it("meldet Erfolg und ein unbestätigtes Zurücksetzen getrennt", () => {
        expect(erfolgsText("neu", "K7M4Q2")).toContain("Neue Übung angelegt (Übungscode K7M4Q2)");
        expect(erfolgsText("ueberschreiben", "K7M4Q2")).toContain("Übungsstand ist für alle zurückgesetzt");
        expect(erfolgsText("ueberschreiben", "K7M4Q2", false)).toContain("noch nicht bestätigt");
    });
});
