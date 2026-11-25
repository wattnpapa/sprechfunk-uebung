import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { AENDERUNGEN, MONATE } from "../../src/core/aenderungen";
import { AenderungenDialog, monatsName, tagText } from "../../src/core/AenderungenDialog";
import { renderFooter } from "../../scripts/lib/navigation.mjs";

const root = path.resolve(__dirname, "..", "..");

describe("AENDERUNGEN", () => {
    it("steht nach Datum absteigend, ohne doppelte Tage, und jeder Monat hat seine Zusammenfassung", () => {
        const tage = AENDERUNGEN.map(a => a.datum);
        expect(tage).toEqual([...tage].sort().reverse());
        expect(new Set(tage).size).toBe(tage.length);
        for (const tag of tage) {
            expect(tag).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(Number.isNaN(Date.parse(tag))).toBe(false);
        }
        const monate = [...new Set(tage.map(t => t.slice(0, 7)))];
        expect(Object.keys(MONATE).sort()).toEqual([...monate].sort());
        // Verlauf seit der ersten Fassung.
        expect(tage[tage.length - 1]).toBe("2025-02-21");
    });

    it("hat je Tag mindestens einen Punkt, als ganzen Satz und ohne Entwickler-Jargon", () => {
        for (const eintrag of AENDERUNGEN) {
            expect(eintrag.punkte.length).toBeGreaterThan(0);
            for (const punkt of eintrag.punkte) {
                expect(punkt.trim()).toBe(punkt);
                expect(punkt).toMatch(/[.!?“]$/);
                // Keine Commit-Präfixe, Dateinamen oder Ticketnummern.
                expect(punkt).not.toMatch(/\b(feat|fix|chore|refactor)\(|\.(ts|mjs|html|css)\b|#\d+/);
            }
        }
    });
});

describe("Versionszeile im Footer", () => {
    it("steht auf der Startseite mit den Elementen, in die die App schreibt", () => {
        const footer: string = renderFooter("");
        expect(footer).toContain('id="version"');
        expect(footer).toContain('id="uebungsId"');
        expect(footer).toContain('data-bs-target="#aenderungenModal"');
        expect(footer).toContain("Was ist neu");
    });

    it("fehlt auf Inhaltsseiten, die die App nicht laden", () => {
        const footer: string = renderFooter("faq");
        expect(footer).not.toContain('id="version"');
        expect(footer).not.toContain("aenderungenModal");
    });

    it("findet in der Startseite den Dialog, den der Knopf öffnet", () => {
        const html = readFileSync(path.join(root, "src", "index.html"), "utf8");
        expect(html).toContain('id="aenderungenModal"');
        expect(html).toContain('id="aenderungenInhalt"');
        // Auch die Quelle (vor dem Postbuild) trägt beide Elemente.
        expect(html).toContain('id="version"');
        expect(html).toContain('id="uebungsId"');
    });
});

describe("AenderungenDialog", () => {
    const buehne = () => {
        const dom = new JSDOM(
            "<div id=\"aenderungenModal\"><div id=\"aenderungenInhalt\">Lädt…</div></div>"
        );
        const doc = dom.window.document;
        const modal = doc.getElementById("aenderungenModal")!;
        const inhalt = doc.getElementById("aenderungenInhalt")!;
        const oeffne = async () => {
            modal.dispatchEvent(new dom.window.Event("show.bs.modal"));
            await new Promise(fertig => setTimeout(fertig, 0));
        };
        const knopf = (text: string) =>
            [...inhalt.querySelectorAll("button")].find(b => b.textContent === text) as HTMLButtonElement;
        const monat = () => inhalt.querySelector(".aenderungen-monat")?.textContent;
        const tage = () => [...inhalt.querySelectorAll(".aenderung-tag")].map(h => h.textContent ?? "");
        return { modal, inhalt, oeffne, knopf, monat, tage };
    };

    it("formatiert Monat und Tag", () => {
        expect(monatsName("2026-11")).toBe("November 2026");
        expect(monatsName("2025-03")).toBe("März 2025");
        expect(tagText("2026-11-25")).toBe("25.11.2026");
    });

    it("zeigt zuerst den neuesten Monat mit Zusammenfassung und blättert monatsweise zurück", async () => {
        const b = buehne();
        new AenderungenDialog(async () => ({ liste: AENDERUNGEN, monate: MONATE })).init(b.modal);
        await b.oeffne();

        const neuester = AENDERUNGEN[0]!.datum;
        expect(b.monat()).toBe(monatsName(neuester.slice(0, 7)));
        expect(b.inhalt.querySelector(".aenderungen-kurz")?.textContent).toBe(MONATE[neuester.slice(0, 7)]);
        expect(b.tage()[0]).toBe(tagText(neuester));
        expect(b.knopf("← Neuer").disabled).toBe(true);

        const anzahl = new Set(AENDERUNGEN.map(a => a.datum.slice(0, 7))).size;
        expect(b.inhalt.querySelector(".aenderungen-seite")?.textContent).toBe(`1 von ${anzahl}`);

        // Bis zum ersten Monat blättern: dort ist „Älter“ gesperrt und der erste Tag steht da.
        let schritte = 0;
        while (!b.knopf("Älter →").disabled) {
            b.knopf("Älter →").click();
            schritte += 1;
        }
        expect(schritte).toBe(anzahl - 1);
        expect(b.monat()).toBe("Februar 2025");
        expect(b.tage().at(-1)).toBe("21.02.2025");
        expect(b.tage().every(t => t.endsWith(".02.2025"))).toBe(true);
    });

    it("beginnt nach dem Schließen wieder beim neuesten Monat und lädt nur einmal", async () => {
        const b = buehne();
        let geladen = 0;
        new AenderungenDialog(async () => {
            geladen += 1;
            return { liste: AENDERUNGEN, monate: MONATE };
        }).init(b.modal);
        await b.oeffne();
        b.knopf("Älter →").click();
        await b.oeffne();
        expect(b.monat()).toBe(monatsName(AENDERUNGEN[0]!.datum.slice(0, 7)));
        expect(geladen).toBe(1);
    });

    it("setzt Punkte als Text, nicht als HTML", async () => {
        const b = buehne();
        new AenderungenDialog(async () => ({
            liste: [{ datum: "2026-01-02", punkte: ["<img src=x onerror=alert(1)> Punkt."] }],
            monate: { "2026-01": "Satz." }
        })).init(b.modal);
        await b.oeffne();
        expect(b.inhalt.querySelector("img")).toBeNull();
        expect(b.inhalt.querySelector("li")?.textContent).toContain("<img");
        // Ein einzelner Monat braucht keine Blätterleiste.
        expect(b.inhalt.querySelector(".aenderungen-blaettern")).toBeNull();
    });

    it("meldet einen Ladefehler und versucht es beim nächsten Öffnen erneut", async () => {
        const b = buehne();
        let versuche = 0;
        new AenderungenDialog(async () => {
            versuche += 1;
            if (versuche === 1) {
                throw new Error("offline");
            }
            return { liste: AENDERUNGEN, monate: MONATE };
        }).init(b.modal);
        await b.oeffne();
        expect(b.inhalt.textContent).toContain("ließ sich nicht laden");
        await b.oeffne();
        expect(b.monat()).toBeTruthy();
    });

    it("tut ohne Dialog nichts", async () => {
        const dialog = new AenderungenDialog(async () => ({ liste: AENDERUNGEN, monate: MONATE }));
        dialog.init(null);
        await expect(dialog.oeffnen()).resolves.toBeUndefined();
    });
});
