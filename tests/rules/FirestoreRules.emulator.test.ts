import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { doc, setDoc } from "firebase/firestore";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { FunkUebung } from "../../src/models/FunkUebung";
import { FirebaseService } from "../../src/services/FirebaseService";
import { GenerationService } from "../../src/services/GenerationService";
import { parseFuehrungsstellenUebung } from "../../src/services/FuehrungsstellenUebungService";
import { toTeilnehmerLiveDoc } from "../../src/services/liveStatusMerge";
import hochwasser from "../../assets/fuehrungsstellen/hochwasser-fuehrungsstelle.json";

/**
 * Spielt firestore.rules im Firestore-Emulator gegen Dokumente durch, wie die
 * Anwendung sie wirklich schreibt. Der Vertragstest prüft nur die Feldlisten;
 * ob Firestore die Regeln überhaupt auswerten kann, sieht man erst hier.
 *
 * Firestore bricht die Auswertung nach 1000 Ausdrücken mit PERMISSION_DENIED
 * ab. Am 2026-09-30 reichte dafür ein weiteres optionales Feld, und Produktion
 * lehnte jedes Speichern ab, obwohl alle übrigen Tests grün waren (ADR 0008).
 * Deshalb prüft dieser Test zusätzlich eine Reserve: Die Regeln müssen auch
 * mit RESERVE_AUSDRUECKE zusätzlichen Ausdrücken noch unter dem Limit bleiben.
 *
 * Läuft nur mit Emulator: `npm run rules:test` (braucht Java). Ohne
 * FIRESTORE_EMULATOR_HOST wird die Suite übersprungen.
 */

const emulatorHost = process.env["FIRESTORE_EMULATOR_HOST"];
const PROJEKT = "demo-sprechfunk";
const rulesPfad = path.join(process.cwd(), "firestore.rules");

/**
 * Reserve in `&& true`-Gliedern; jedes zählt etwa drei Ausdrücke. 40 Glieder
 * entsprechen rund 120 Ausdrücken — Platz für etwa sechs weitere optionale
 * Felder (10 bis 20 Ausdrücke je Feld). Gemessen am 2026-10-01: Ein
 * vollständiges Dokument lässt rund 80 Glieder zu; mehr als etwa 80 Glieder
 * lehnt schon der Compiler als „too complex" ab.
 */
const RESERVE_AUSDRUECKE = 40;

function speicherAbbild(uebung: FunkUebung): Record<string, unknown> {
    vi.stubGlobal("window", { localStorage: { getItem: () => null } });
    const service = new FirebaseService({} as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (service as any).sanitizeDataForSave(JSON.parse(uebung.toJson()));
}

/** Klassische Übung mit jedem optionalen Feld, das der Generator schreiben kann. */
function klassischeUebung(teilnehmer: number): Record<string, unknown> {
    const uebung = new FunkUebung("v1");
    uebung.name = "Klassische Übung";
    uebung.leitung = "Heros Musterstadt 10";
    uebung.rufgruppe = "TBZ";
    uebung.teilnehmerListe = Array.from({ length: teilnehmer }, (_, i) => `Heros Ort${i + 1} 21/10`);
    uebung.teilnehmerStellen = Object.fromEntries(uebung.teilnehmerListe.map(t => [t, `Stelle ${t}`]));
    uebung.funksprueche = Array.from({ length: 400 }, (_, i) => `Funkspruch ${i + 1} mit Text für die Übung.`);
    uebung.spruecheProTeilnehmer = 10;
    uebung.spruecheAnAlle = 1;
    uebung.spruecheAnMehrere = 2;
    uebung.buchstabierenAn = 2;
    uebung.spielModus = "xZeit";
    uebung.xZeitIntervallMinuten = 3;
    uebung.xZeitStartOffsetMinuten = 5;
    uebung.loesungswoerter = Object.fromEntries(uebung.teilnehmerListe.map(t => [t, "ALFA"]));
    uebung.verwendeteVorlagen = ["thwleer"];
    uebung.anmeldungAktiv = true;
    uebung.nachrichtenArtAktiv = true;
    new GenerationService().generate(uebung);
    uebung.id = `klassisch-${teilnehmer}`;
    uebung.istStandardKonfiguration = false;
    // Nicht gleichzeitig mit klassischer Verteilung möglich, aber als Feld
    // erlaubt — für den schlimmsten Fall mitzählen.
    uebung.szenarioSlug = "unwetter-sturm";
    return speicherAbbild(uebung);
}

/** Führungsstellen-Übung mit der größten erlaubten Rollenbesetzung. */
function fuehrungsstellenUebung(): Record<string, unknown> {
    const drehbuch = parseFuehrungsstellenUebung("hochwasser-fuehrungsstelle", hochwasser);
    const abschnitte = drehbuch.straenge.map((_, i) => `Heros Musterstadt 2${i + 1}/10`);
    const uebung = new FunkUebung("v1");
    uebung.name = "Führungsstellen-Übung";
    uebung.leitung = "Heros Musterstadt 10";
    uebung.rufgruppe = "TBZ";
    uebung.xZeitIntervallMinuten = 3;
    uebung.xZeitStartOffsetMinuten = 0;
    uebung.fuehrungsstelle = {
        slug: "hochwasser-fuehrungsstelle",
        beuebteStelle: "Heros Musterstadt 10",
        uebergeordnet: "Kater Musterstadt",
        unterstellt: abschnitte,
        beginn: "09:00",
        stellen: Object.fromEntries(
            ["Heros Musterstadt 10", "Kater Musterstadt", ...abschnitte].map(name => [name, `Stelle ${name}`])
        )
    };
    new GenerationService().generateFuehrungsstelle(uebung, drehbuch);
    uebung.id = "fuehrungsstelle";
    uebung.istStandardKonfiguration = false;
    return speicherAbbild(uebung);
}

function minimaleUebung(): Record<string, unknown> {
    const uebung = new FunkUebung("v1");
    uebung.id = "minimal";
    uebung.uebungCode = "K7M4Q2";
    return speicherAbbild(uebung);
}

/** Hängt `glieder` mal `true &&` an den Anfang von istGueltigeUebung — dieselbe Kette, die jedes Speichern durchläuft. */
function mitReserve(rules: string, glieder: number): string {
    const anker = "function istGueltigeUebung(daten) {\n  return ";
    expect(rules, "Anker für die Reserve-Messung nicht in firestore.rules").toContain(anker);
    return rules.replace(anker, `${anker}${"true\n         && ".repeat(glieder)}`);
}

describe.skipIf(!emulatorHost)("firestore.rules im Emulator", () => {
    const rules = readFileSync(rulesPfad, "utf-8");
    const [host, port] = (emulatorHost ?? "127.0.0.1:8080").split(":");
    const dokumente: Record<string, Record<string, unknown>> = {
        "klassisch, 10 Teilnehmer": klassischeUebung(10),
        "klassisch, 100 Teilnehmer": klassischeUebung(100),
        "Führungsstellen-Übung, 6 Abschnitte": fuehrungsstellenUebung(),
        minimal: minimaleUebung()
    };
    let env: RulesTestEnvironment | undefined;

    async function umgebung(regeln: string): Promise<RulesTestEnvironment> {
        await env?.cleanup();
        env = await initializeTestEnvironment({
            projectId: PROJEKT,
            firestore: { rules: regeln, host: host ?? "127.0.0.1", port: Number(port ?? 8080) }
        });
        await env.clearFirestore();
        return env;
    }

    async function schreibe(umg: RulesTestEnvironment, daten: Record<string, unknown>, id = daten["id"] as string): Promise<void> {
        await setDoc(doc(umg.unauthenticatedContext().firestore(), "uebungen", id), daten);
    }

    beforeAll(async () => {
        await umgebung(rules);
    });

    afterAll(async () => {
        await env?.cleanup();
    });

    it.each(Object.keys(dokumente))("erlaubt das Speichern: %s", async (name) => {
        await expect(schreibe(env as RulesTestEnvironment, dokumente[name] as Record<string, unknown>)).resolves.toBeUndefined();
    });

    it("erlaubt das Überschreiben derselben Übung (update)", async () => {
        const daten = dokumente["klassisch, 10 Teilnehmer"] as Record<string, unknown>;
        await schreibe(env as RulesTestEnvironment, daten);
        await expect(schreibe(env as RulesTestEnvironment, { ...daten, name: "Umbenannt" })).resolves.toBeUndefined();
    });

    it("lehnt unbekannte Felder und fremde Dokument-IDs ab", async () => {
        const daten = dokumente["klassisch, 10 Teilnehmer"] as Record<string, unknown>;
        await expect(schreibe(env as RulesTestEnvironment, { ...daten, unbekannt: 1 })).rejects.toThrow(/permission|PERMISSION/i);
        await expect(schreibe(env as RulesTestEnvironment, daten, "andere-id")).rejects.toThrow(/permission|PERMISSION/i);
    });

    it("erlaubt die Statusdokumente des Live-Syncs", async () => {
        const jetzt = "2026-07-26T10:00:00.000Z";
        const status = toTeilnehmerLiveDoc({
            version: 1,
            uebungId: "klassisch-10",
            teilnehmer: "Heros Ort1 21/10",
            lastUpdated: jetzt,
            nachrichten: { "1": { uebertragen: true, uebertragenUm: jetzt, geaendertUm: jetzt } },
            hideTransmitted: false,
            xZeitBasis: "09:00",
            xZeitBasisGeaendertUm: jetzt
        }, "A1B2");
        const db = (env as RulesTestEnvironment).unauthenticatedContext().firestore();
        await expect(setDoc(doc(db, "uebungen", "klassisch-10", "status", "teilnehmer-A1B2"), status)).resolves.toBeUndefined();
    });

    it(`bleibt mit ${RESERVE_AUSDRUECKE} zusätzlichen Gliedern unter dem Ausdrucks-Limit`, async () => {
        const umg = await umgebung(mitReserve(rules, RESERVE_AUSDRUECKE));
        for (const [name, daten] of Object.entries(dokumente)) {
            await expect(schreibe(umg, daten), `${name}: Reserve aufgebraucht — Regeln verschlanken (ADR 0008)`)
                .resolves.toBeUndefined();
        }
    });
});
