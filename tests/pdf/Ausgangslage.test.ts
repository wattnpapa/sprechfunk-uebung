import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import pdfGenerator from "../../src/services/pdfGenerator";
import { FunkUebung } from "../../src/models/FunkUebung";
import { parseFuehrungsstellenUebung } from "../../src/services/FuehrungsstellenUebungService";

// workflow F8 (THW-Review 2026-10-04): Lage und Auftrag standen nur im
// Drehbuch, das die beübte Stelle nicht kennen darf. Das eigene Blatt darf
// keine erwarteten Reaktionen und keine Einspielungen verraten.
describe("pdf/Ausgangslage", () => {
    const root = path.resolve(__dirname, "..", "..");
    const drehbuch = parseFuehrungsstellenUebung(
        "hochwasser-fuehrungsstelle",
        JSON.parse(readFileSync(path.join(root, "assets", "fuehrungsstellen", "hochwasser-fuehrungsstelle.json"), "utf8"))
    );

    const uebung = () => {
        const u = new FunkUebung("test");
        u.name = "Stabsrahmenübung";
        u.teilnehmerListe = ["EL 10", "EA 11", "EA 12", "Kater"];
        u.fuehrungsstelle = {
            slug: drehbuch.slug, beuebteStelle: "EL 10", uebergeordnet: "Kater", unterstellt: ["EA 11", "EA 12"],
            beginn: "09:00", stellen: { "EL 10": "Einsatzleitung" }
        };
        u.nachrichten = { "EL 10": [], "EA 11": [], "EA 12": [], "Kater": [] };
        return u;
    };

    /** Text aller Inhaltsströme (Flate-komprimiert). */
    const pdfText = async (blob: Blob) => {
        const roh = Buffer.from(await blob.arrayBuffer());
        const text = roh.toString("latin1");
        const teile: string[] = [];
        const muster = /stream\r?\n/g;
        let treffer: RegExpExecArray | null;
        while ((treffer = muster.exec(text)) !== null) {
            const start = treffer.index + treffer[0].length;
            try {
                teile.push(inflateSync(roh.subarray(start, text.indexOf("endstream", start))).toString("latin1"));
            } catch {
                // kein Flate-Strom
            }
        }
        return teile.join("\n");
    };

    it("enthält Lage, Auftrag und die Funkverbindungen", async () => {
        const blob = await pdfGenerator.generateAusgangslagePDFBlob(uebung(), drehbuch);
        const text = await pdfText(blob!);
        expect(text).toContain("Ausgangslage und Auftrag");
        expect(text).toContain("EL 10 \\(Einsatzleitung\\)");
        expect(text).toContain("Kater");
        expect(text).toContain("Einsatzabschnitt 2");
        // Ein Stück der Lage selbst (Zeilenumbrüche der Tabelle umgehen).
        const lageAnfang = drehbuch.lage.split(/\s+/).slice(0, 2).join(" ");
        expect(text).toContain(lageAnfang.replace(/[()]/g, m => `\\${m}`));
    });

    it("verrät weder Erwartungen noch Einspielungen", async () => {
        const text = await pdfText((await pdfGenerator.generateAusgangslagePDFBlob(uebung(), drehbuch))!);
        expect(text).not.toMatch(/Erwartet|Drehbuch|Einspielung/);
        const ersteErwartung = drehbuch.straenge.flatMap(s => s.nachrichten).find(n => n.erwartung)?.erwartung ?? "";
        expect(ersteErwartung.length).toBeGreaterThan(10);
        expect(text).not.toContain(ersteErwartung.slice(0, 25));
    });

    it("liefert für gewöhnliche Übungen nichts", async () => {
        const u = uebung();
        delete (u as { fuehrungsstelle?: unknown }).fuehrungsstelle;
        await expect(pdfGenerator.generateAusgangslagePDFBlob(u, drehbuch)).resolves.toBeNull();
    });
});
