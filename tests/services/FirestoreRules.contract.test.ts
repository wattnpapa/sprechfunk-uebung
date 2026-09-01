import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FirebaseService } from "../../src/services/FirebaseService";
import { FunkUebung } from "../../src/models/FunkUebung";
import {
    toLeitungLiveDoc,
    toLeitungPublicLiveDoc,
    toTeilnehmerLiveDoc
} from "../../src/services/liveStatusMerge";

/**
 * firestore.rules lässt über `hasOnly(erlaubteFelder())` nur bekannte Felder zu.
 * Wird ein neues Feld persistiert, ohne die Liste zu pflegen, weist Firestore
 * jedes Speichern zurück — und zwar erst in Produktion. Dieser Test zieht den
 * Fehler nach vorne.
 */
const rulesPfad = path.join(process.cwd(), "firestore.rules");
const rulesQuelltext = readFileSync(rulesPfad, "utf-8");

function leseFeldliste(funktionsName: string): string[] {
    const block = new RegExp(`function ${funktionsName}\\(\\)\\s*{\\s*return \\[([^\\]]*)\\]`, "m")
        .exec(rulesQuelltext);
    if (!block?.[1]) {
        throw new Error(`Feldliste ${funktionsName}() nicht in firestore.rules gefunden`);
    }
    return [...block[1].matchAll(/'([^']+)'/g)].map(treffer => treffer[1] as string);
}

function baueVollstaendigeUebung(): FunkUebung {
    const u = new FunkUebung("dev");
    u.id = "u1";
    u.uebungCode = "K7M4Q2";
    u.teilnehmerListe = ["Heros Jever 21/10", "Heros Leer 21/10"];
    u.teilnehmerIds = { A1B2: "Heros Jever 21/10", C3D4: "Heros Leer 21/10" };
    u.teilnehmerStellen = { "Heros Jever 21/10": "Stelle A" };
    u.nachrichten = {
        "Heros Jever 21/10": [{ id: 1, nachricht: "x", empfaenger: ["Heros Leer 21/10"] }]
    };
    u.loesungswoerter = { "Heros Jever 21/10": "ALFA" };
    u.loesungsStaerken = { "Heros Jever 21/10": "1/2/3/6" };
    u.verwendeteVorlagen = ["vorlage-1"];
    u.istStandardKonfiguration = true;
    u.spielModus = "xZeit";
    u.xZeitIntervallMinuten = 3;
    u.xZeitStartOffsetMinuten = 0;
    u.szenarioSlug = "unwetter-sturm";
    u.seed = "vergleichslauf-2026";
    return u;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function speicherAbbild(uebung: FunkUebung): Record<string, any> {
    vi.stubGlobal("window", { localStorage: { getItem: () => null } });
    const service = new FirebaseService({} as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (service as any).sanitizeDataForSave(JSON.parse(uebung.toJson()));
}

describe("firestore.rules Feldvertrag", () => {
    it("erlaubt jedes Feld, das FirebaseService tatsächlich speichert", () => {
        const gespeichert = speicherAbbild(baueVollstaendigeUebung());
        const erlaubt = leseFeldliste("erlaubteFelder");

        const nichtErlaubt = Object.keys(gespeichert).filter(feld => !erlaubt.includes(feld));
        expect(nichtErlaubt).toEqual([]);
    });

    it("führt keine Felder, die gar nicht mehr geschrieben werden", () => {
        const gespeichert = speicherAbbild(baueVollstaendigeUebung());
        const erlaubt = leseFeldliste("erlaubteFelder");

        const ueberfluessig = erlaubt.filter(feld => !(feld in gespeichert));
        expect(ueberfluessig).toEqual([]);
    });

    it("verlangt nur Felder als Pflicht, die auch minimal befüllte Übungen schreiben", () => {
        const minimal = new FunkUebung("dev");
        minimal.id = "u2";
        minimal.uebungCode = "K7M4Q2";
        const gespeichert = speicherAbbild(minimal);

        const pflicht = leseFeldliste("pflichtFelder");
        const fehlend = pflicht.filter(feld => !(feld in gespeichert));
        expect(fehlend).toEqual([]);
    });

    it("erlaubt jedes Feld, das der Live-Sync in die status-Subcollection schreibt", () => {
        const jetzt = "2026-07-26T10:00:00.000Z";
        const teilnehmerDoc = toTeilnehmerLiveDoc({
            version: 1,
            uebungId: "u1",
            teilnehmer: "Heros Jever 21/10",
            lastUpdated: jetzt,
            nachrichten: { "1": { uebertragen: true, uebertragenUm: jetzt, geaendertUm: jetzt } },
            hideTransmitted: false,
            xZeitBasis: "09:00",
            xZeitBasisGeaendertUm: jetzt
        }, "A1B2");
        const leitungStorage = {
            version: 1,
            uebungId: "u1",
            lastUpdated: jetzt,
            teilnehmer: { "Heros Jever 21/10": { angemeldetUm: jetzt, geaendertUm: jetzt } },
            nachrichten: {
                "Heros Jever 21/10__1": {
                    abgesetztUm: jetzt,
                    statusGeaendertUm: jetzt,
                    notiz: "n",
                    notizGeaendertUm: jetzt
                }
            }
        };

        const erlaubt = leseFeldliste("erlaubteStatusFelder");
        const geschrieben = new Set([
            ...Object.keys(teilnehmerDoc),
            ...Object.keys(toLeitungPublicLiveDoc(leitungStorage)),
            ...Object.keys(toLeitungLiveDoc(leitungStorage))
        ]);

        const nichtErlaubt = [...geschrieben].filter(feld => !erlaubt.includes(feld));
        expect(nichtErlaubt).toEqual([]);
        // Umgekehrt keine Karteileichen in der Regel-Allowlist.
        expect(erlaubt.filter(feld => !geschrieben.has(feld))).toEqual([]);
    });

    it("lässt genau die bekannten Statusdokumente zu", () => {
        expect(rulesQuelltext).toContain("match /status/{statusId}");
        expect(rulesQuelltext).toContain("statusId == 'leitung-public'");
        expect(rulesQuelltext).toContain("^teilnehmer-[A-Za-z0-9]{1,32}$");
    });

    it("dokumentiert das Sicherheitsmodell und sperrt fremde Collections", () => {
        expect(rulesQuelltext).toContain("match /uebungen/{uebungId}");
        expect(rulesQuelltext).toMatch(/match \/\{document=\*\*\}\s*{\s*allow read, write: if false;/);
        // Restrisiken müssen benannt bleiben, solange es keine Authentifizierung gibt.
        expect(rulesQuelltext).toContain("Bekannte Restrisiken");
    });
});
