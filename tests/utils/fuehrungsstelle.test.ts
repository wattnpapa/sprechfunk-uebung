import { describe, expect, it } from "vitest";
import {
    ersetzeFuehrungsstellenPlatzhalter,
    formatFuehrungsstellenOffset,
    formatFuehrungsstellenUhrzeit,
    formatFuehrungsstellenZeit,
    meldeartLabel,
    renderFuehrungsstellenHinweise,
    strangAbschnittNamen,
    uebermittlungsWegBadgeClass,
    uebermittlungsWegLabel
} from "../../src/utils/fuehrungsstelle";

describe("utils/fuehrungsstelle", () => {
    it("beschriftet Wege und Meldearten, leer für unbekannte Werte", () => {
        expect(uebermittlungsWegLabel("funk")).toBe("Funk");
        expect(uebermittlungsWegLabel("drucker")).toBe("Ausdruck");
        expect(uebermittlungsWegLabel("email")).toBe("E-Mail");
        expect(uebermittlungsWegLabel(undefined)).toBe("");
        expect(uebermittlungsWegBadgeClass("drucker")).toContain("bg-warning");
        expect(uebermittlungsWegBadgeClass("email")).toContain("bg-info");
        expect(uebermittlungsWegBadgeClass("funk")).toContain("bg-secondary");
        expect(meldeartLabel("rueckfrage")).toBe("Rückfrage");
        expect(meldeartLabel("vollzug")).toBe("Vollzug");
        expect(meldeartLabel(undefined)).toBe("");
    });

    it("formatiert Minuten als Offset und als Uhrzeit ab Übungsbeginn", () => {
        expect(formatFuehrungsstellenOffset(5)).toBe("+0:05");
        expect(formatFuehrungsstellenOffset(160)).toBe("+2:40");
        expect(formatFuehrungsstellenUhrzeit(45, "09:00")).toBe("09:45");
        expect(formatFuehrungsstellenUhrzeit(90, "23:00")).toBe("00:30");
        expect(formatFuehrungsstellenUhrzeit(45, undefined)).toBeNull();
        expect(formatFuehrungsstellenUhrzeit(45, "9 Uhr")).toBeNull();
        expect(formatFuehrungsstellenZeit(45, "09:00")).toBe("+0:45 (09:45)");
        expect(formatFuehrungsstellenZeit(45, undefined)).toBe("+0:45");
    });

    it("ordnet Stränge reihum den Abschnitten zu", () => {
        const uebung = { straenge: ["a", "b", "c", "d", "e", "f"].map(key => ({ key })) };
        const namen = strangAbschnittNamen(uebung as never, { unterstellt: ["EA 11", "EA 12", "EA 13"] });
        expect(namen).toEqual({ a: "EA 11", b: "EA 12", c: "EA 13", d: "EA 11", e: "EA 12", f: "EA 13" });
    });

    it("ersetzt alle Platzhalter und lässt unbekannte Schlüssel stehen", () => {
        const konfiguration = { beuebteStelle: "EL 10", uebergeordnet: "Kater" };
        const text = "{{ea}} an {{el}}: Auftrag von {{stab}} für {{ea:nord}} und {{ea:west}}.";
        expect(ersetzeFuehrungsstellenPlatzhalter(text, konfiguration, { nord: "EA 12" }, "EA 11"))
            .toBe("EA 11 an EL 10: Auftrag von Kater für EA 12 und {{ea:west}}.");
        // Ohne eigenen Abschnitt (Stab) fällt {{ea}} auf den Stab zurück.
        expect(ersetzeFuehrungsstellenPlatzhalter("{{ea}}", konfiguration, {})).toBe("Kater");
    });

    it("übernimmt Funkrufnamen mit Dollarzeichen und Platzhaltertext unverändert", () => {
        const konfiguration = { beuebteStelle: "EL $& 10", uebergeordnet: "Kater $$ 1" };
        expect(ersetzeFuehrungsstellenPlatzhalter("An {{el}} von {{stab}}", konfiguration, {}))
            .toBe("An EL $& 10 von Kater $$ 1");
        // Ein eingesetzter Name wird nicht ein zweites Mal ersetzt.
        expect(ersetzeFuehrungsstellenPlatzhalter("{{el}} und {{stab}}", { beuebteStelle: "{{stab}}", uebergeordnet: "Stab" }, {}))
            .toBe("{{stab}} und Stab");
    });

    it("baut Kennzeichnung und erwartete Reaktion als HTML, leer ohne Führungsstellen-Felder", () => {
        expect(renderFuehrungsstellenHinweise({})).toEqual({ kopf: "", fuss: "" });
        const hinweise = renderFuehrungsstellenHinweise({
            weg: "drucker", meldeart: "auftrag", betreff: "Auftrag <1>", erwartung: "An EA 11 & Stab"
        });
        expect(hinweise.kopf).toContain("Ausdruck");
        expect(hinweise.kopf).toContain("Auftrag</span>");
        expect(hinweise.kopf).toContain("Auftrag &lt;1&gt;");
        expect(hinweise.fuss).toContain("Erwartet: An EA 11 &amp; Stab");
    });
});
