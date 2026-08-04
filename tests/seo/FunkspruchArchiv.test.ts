import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SITE_PAGES } from "../../scripts/site-pages.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reine JS-Hilfsmodule ohne Typdeklarationen, absichtlich .mjs
import {
    ARCHIV_VORLAGEN,
    baueBestand,
    funkspruchId,
    hatBuchstabieranteil,
    kategorieFuer,
    parseVorlage,
    schwierigkeitFuer,
    VORLAGEN
} from "../../scripts/lib/funkspruch-daten.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ANZAHL_ARCHIV, ANZAHL_GESAMT, ANZAHL_GESAMT_TEXT, BESTAND } from "../../scripts/lib/funkspruch-bestand.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { downloadDateiname, renderFunkspruchListe, txtInhalt } from "../../scripts/lib/funkspruch-seiten.mjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ersetzeBestandszahlen } from "../../scripts/lib/render-page.mjs";

const ROOT = path.resolve(__dirname, "..", "..");
const VORLAGEN_DIR = path.join(ROOT, "assets", "funksprueche");

interface Vorlage { datei: string; slug: string; name: string; imArchiv?: boolean }
interface Eintrag {
    id: string; text: string; vorlage: string; kategorie: string;
    organisation: string[]; schwierigkeit: string; buchstabieren: boolean; zeichen: number;
}

/**
 * Unabhängige Zählung der Quelldateien. Absichtlich nicht über das zu prüfende
 * Modul: sonst würde der Test dieselbe Annahme zweimal bestätigen.
 */
const zaehleZeilen = (datei: string): number =>
    readFileSync(path.join(VORLAGEN_DIR, datei), "utf8")
        .split(/\r?\n/)
        .filter(zeile => zeile.trim() !== "")
        .length;

describe("Bestand deckt die Quelldateien vollständig ab", () => {
    it("führt jede Datei unter assets/funksprueche/ in VORLAGEN", () => {
        const imVerzeichnis = readdirSync(VORLAGEN_DIR).filter(name => name.endsWith(".txt")).sort();
        const inRegistry = (VORLAGEN as Vorlage[]).map(vorlage => vorlage.datei).sort();
        expect(inRegistry).toEqual(imVerzeichnis);
    });

    it.each((VORLAGEN as Vorlage[]).map(vorlage => [vorlage.slug, vorlage] as const))(
        "%s enthält genau so viele Einträge wie die Quelldatei Zeilen",
        (_slug, vorlage) => {
            const eintraege = BESTAND.nachVorlage.get(vorlage.slug) as Eintrag[];
            expect(eintraege.length).toBe(zaehleZeilen(vorlage.datei));
        }
    );

    it("summiert die Einzelzählungen zur Gesamtzahl", () => {
        const summe = (VORLAGEN as Vorlage[])
            .reduce((wert, vorlage) => wert + zaehleZeilen(vorlage.datei), 0);
        expect(ANZAHL_GESAMT).toBe(summe);
    });

    it("zählt je Datei und nicht über cat, weil eine Datei ohne Zeilenumbruch endet", () => {
        // nachrichten_thw_melle.txt endet ohne \n. Über `cat *.txt` verklebt ihre
        // letzte Zeile mit der ersten der Folgedatei – die dokumentierte Zählung
        // lag deshalb um eins zu niedrig. Dieser Test hält die Ursache fest.
        const roh = readFileSync(path.join(VORLAGEN_DIR, "nachrichten_thw_melle.txt"), "utf8");
        expect(roh.endsWith("\n")).toBe(false);

        const verklebt = (VORLAGEN as Vorlage[])
            .map(vorlage => readFileSync(path.join(VORLAGEN_DIR, vorlage.datei), "utf8"))
            .join("")
            .split(/\r?\n/)
            .filter(zeile => zeile.trim() !== "")
            .length;
        expect(verklebt).toBe(ANZAHL_GESAMT - 1);
    });

    it("wirft, wenn eine Vorlage fehlt", () => {
        expect(() => baueBestand({})).toThrow(/fehlt/);
    });
});

describe("Kennungen sind stabil", () => {
    it("liefert für denselben Text dieselbe Kennung", () => {
        expect(funkspruchId("Sind einsatzbereit.")).toBe(funkspruchId("Sind einsatzbereit."));
    });

    it("erzeugt über zwei Läufe mit gleichem Eingang identische Kennungen", () => {
        const inhalte: Record<string, string> = {};
        for (const vorlage of VORLAGEN as Vorlage[]) {
            inhalte[vorlage.datei] = readFileSync(path.join(VORLAGEN_DIR, vorlage.datei), "utf8");
        }
        const ersterLauf = (baueBestand(inhalte).alle as Eintrag[]).map(eintrag => eintrag.id);
        const zweiterLauf = (baueBestand(inhalte).alle as Eintrag[]).map(eintrag => eintrag.id);
        expect(zweiterLauf).toEqual(ersterLauf);
    });

    it("hängt allein am Text, nicht an Vorlage oder Reihenfolge", () => {
        const [a] = parseVorlage({ slug: "eine", organisation: ["thw"] }, "Verstanden.") as Eintrag[];
        const [b] = parseVorlage({ slug: "andere", organisation: ["allgemein"] }, "Verstanden.") as Eintrag[];
        expect(a!.id).toBe(b!.id);
    });

    it("vergibt im ganzen Bestand keine Kennung doppelt", () => {
        const ids = (BESTAND.alle as Eintrag[]).map(eintrag => eintrag.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("liefert zwölf Hexzeichen", () => {
        expect(funkspruchId("Sind einsatzbereit.")).toMatch(/^[0-9a-f]{12}$/);
    });
});

describe("Ableitungen je Funkspruch", () => {
    it("übernimmt die Stufe der Vorlage, wenn sie benannt ist", () => {
        expect(schwierigkeitFuer("x".repeat(300), { schwierigkeit: "einfach" })).toBe("einfach");
    });

    it("leitet die Stufe sonst aus der Textlänge ab", () => {
        expect(schwierigkeitFuer("Sind einsatzbereit.", {})).toBe("einfach");
        expect(schwierigkeitFuer("x".repeat(120), {})).toBe("mittel");
        expect(schwierigkeitFuer("x".repeat(200), {})).toBe("schwer");
    });

    it("erkennt Wörter in Großbuchstaben als Buchstabieranteil", () => {
        expect(hatBuchstabieranteil("Neuer Standort ist TRIFTPLATZ.")).toBe(true);
        expect(hatBuchstabieranteil("Sind einsatzbereit.")).toBe(false);
    });

    it("ordnet nur bei klarem Treffer zu, sonst allgemein", () => {
        expect(kategorieFuer("Der Pegel steigt weiter.")).toBe("unwetter-hochwasser");
        expect(kategorieFuer("Erkunden Sie das Gebiet.")).toBe("erkundung");
        expect(kategorieFuer("Stärke: 0/1/1//2")).toBe("staerkemeldung");
        expect(kategorieFuer("Verstanden.")).toBe("allgemein");
    });

    it("liefert für jeden Eintrag alle Pflichtfelder", () => {
        const eintraege = parseVorlage(
            { slug: "test", organisation: ["thw"] },
            "Haben Einsatzstelle in LÖNSSTRASSE erreicht.\n\n"
        ) as Eintrag[];
        expect(eintraege).toHaveLength(1);
        expect(eintraege[0]).toMatchObject({
            text: "Haben Einsatzstelle in LÖNSSTRASSE erreicht.",
            vorlage: "test",
            organisation: ["thw"],
            buchstabieren: true,
            zeichen: 44
        });
        expect(eintraege[0]!.id).toMatch(/^[0-9a-f]{12}$/);
    });
});

describe("Öffentliches Archiv", () => {
    it("lässt die humorvolle Vorlage bewusst aus", () => {
        const slugs = (ARCHIV_VORLAGEN as Vorlage[]).map(vorlage => vorlage.slug);
        expect(slugs).not.toContain("lustig-kreativ");
        // Im Generator bleibt sie verfügbar: sie steht weiter in VORLAGEN.
        expect((VORLAGEN as Vorlage[]).map(vorlage => vorlage.slug)).toContain("lustig-kreativ");
    });

    it("führt für jede Archivvorlage genau eine Seite in der Registry", () => {
        const seiten = (SITE_PAGES as { archivVorlage?: string }[])
            .filter(seite => seite.archivVorlage !== undefined)
            .map(seite => seite.archivVorlage as string);
        expect(seiten.sort()).toEqual((ARCHIV_VORLAGEN as Vorlage[]).map(v => v.slug).sort());
    });

    it("zeigt weniger Einträge als der Generator verteilt", () => {
        expect(ANZAHL_ARCHIV).toBeLessThan(ANZAHL_GESAMT);
        expect(ANZAHL_ARCHIV).toBe(
            (ARCHIV_VORLAGEN as Vorlage[]).reduce((wert, v) => wert + zaehleZeilen(v.datei), 0)
        );
    });

    it("hält jede Archivseite über der Mindestzahl von zehn Einträgen", () => {
        for (const vorlage of ARCHIV_VORLAGEN as Vorlage[]) {
            expect((BESTAND.nachVorlage.get(vorlage.slug) as Eintrag[]).length,
                `${vorlage.slug} zu klein für eine eigene URL`).toBeGreaterThanOrEqual(10);
        }
    });
});

describe("Ausgeliefertes Markup und Download", () => {
    const beispiel: Eintrag[] = [
        {
            id: "abc123abc123", text: "Sind einsatzbereit.", vorlage: "test",
            kategorie: "allgemein", organisation: ["thw"], schwierigkeit: "einfach",
            buchstabieren: false, zeichen: 19
        },
        {
            id: "def456def456", text: "Neuer Standort ist TRIFTPLATZ.", vorlage: "test",
            kategorie: "standortmeldung", organisation: ["thw"], schwierigkeit: "einfach",
            buchstabieren: true, zeichen: 30
        }
    ];

    it("schreibt jeden Funkspruch mit stabilem Anker in die Liste", () => {
        const html = renderFunkspruchListe(beispiel);
        expect(html).toContain('id="fs-abc123abc123"');
        expect(html).toContain("Sind einsatzbereit.");
        expect(html).toContain('data-kategorie="standortmeldung"');
        // Stufe und Buchstabieranteil stehen sichtbar, nicht als Attribut:
        // 752-mal ein ungelesenes data-Attribut kostete über 20 KB Seitengröße.
        expect(html).toContain("einfach · 30 Zeichen · buchstabieren");
        expect(html).not.toContain("data-buchstabieren");
    });

    it("hält das Markup je Eintrag knapp", () => {
        // Regressionsschutz für die Seitengröße: die größte Archivseite lag mit
        // fettem Markup bei 333 KB und damit über der Grenze von 300 KB.
        // Gemessen sind 177 Zeichen Rahmen je Eintrag, davon der größte Teil die
        // sichtbare Merkmalzeile. Vor der Verschlankung waren es rund 266.
        const eintrag = { ...beispiel[0]!, text: "x".repeat(100) };
        const zeile = renderFunkspruchListe([eintrag]).split("\n")[1] ?? "";
        expect(zeile.length - 100).toBeLessThan(200);
    });

    it("maskiert Sonderzeichen im Funkspruchtext", () => {
        const html = renderFunkspruchListe([{ ...beispiel[0]!, text: 'Keller <5 m² & "nass"' }]);
        expect(html).toContain("&lt;5 m² &amp;");
        expect(html).not.toContain("<5 m²");
    });

    it("liefert den Download im Upload-Format: eine Nachricht je Zeile", () => {
        expect(txtInhalt(beispiel)).toBe("Sind einsatzbereit.\nNeuer Standort ist TRIFTPLATZ.\n");
    });

    it("erzeugt aus dem echten Bestand eine Datei ohne Leerzeilen", () => {
        for (const vorlage of ARCHIV_VORLAGEN as Vorlage[]) {
            const eintraege = BESTAND.nachVorlage.get(vorlage.slug) as Eintrag[];
            const zeilen = txtInhalt(eintraege).split("\n");
            // Letztes Element ist der abschließende Zeilenumbruch.
            expect(zeilen.pop()).toBe("");
            expect(zeilen).toHaveLength(eintraege.length);
            expect(zeilen.every(zeile => zeile.trim() !== "")).toBe(true);
        }
    });

    it("benennt die Downloads nach ihrer Vorlage", () => {
        expect(downloadDateiname("thw-lehrte")).toBe("funksprueche-thw-lehrte.txt");
    });
});

describe("Die ausgewiesene Anzahl stammt aus dem gezählten Bestand", () => {
    const leseSeite = (name: string) => readFileSync(path.join(ROOT, "src", "pages", name), "utf8");

    it("führt nirgends mehr die veraltete Zahl 1.800", () => {
        for (const name of readdirSync(path.join(ROOT, "src", "pages"))) {
            if (!name.endsWith(".html")) continue;
            expect(leseSeite(name), `${name} nennt noch 1.800`).not.toContain("1.800");
        }
        expect(readFileSync(path.join(ROOT, "src", "index.html"), "utf8")).not.toContain("1.800");
    });

    it("nennt im Titel der Übersichtsseite genau die berechnete Zahl", () => {
        const html = leseSeite("funksprueche.html");
        const titel = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "";
        const description = /<meta name="description" content="([^"]*)"/i.exec(html)?.[1] ?? "";
        expect(titel).toContain(ANZAHL_GESAMT_TEXT);
        expect(description).toContain(ANZAHL_GESAMT_TEXT);
    });

    it("löst den Platzhalter im Fließtext gegen den Bestand auf", () => {
        const ergebnis = ersetzeBestandszahlen(
            "<p>{{FUNKSPRUECHE_GESAMT}} Funksprüche, davon {{FUNKSPRUECHE_ARCHIV}} im Archiv.</p>",
            { anzahlGesamt: 1234, anzahlArchiv: 567 }
        );
        expect(ergebnis).toBe("<p>1.234 Funksprüche, davon 567 im Archiv.</p>");
    });

    it("bricht ab, wenn ein Platzhalter ohne Bestand aufgelöst werden soll", () => {
        expect(() => ersetzeBestandszahlen("<p>{{FUNKSPRUECHE_GESAMT}}</p>", null))
            .toThrow(/kein Bestand/);
    });

    it("lässt Seiten ohne Platzhalter unverändert", () => {
        expect(ersetzeBestandszahlen("<p>ohne Zahl</p>", null)).toBe("<p>ohne Zahl</p>");
    });
});
