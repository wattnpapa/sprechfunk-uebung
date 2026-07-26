import { describe, expect, it } from "vitest";
import {
    buildEffektiveNachrichtenStatus,
    buildTeilnehmerFortschritt,
    earliestTimestamp,
    mergeLeitungLiveDoc,
    mergeLeitungPublicLiveDoc,
    mergeTeilnehmerLiveDoc,
    toLeitungLiveDoc,
    toLeitungPublicLiveDoc,
    toTeilnehmerLiveDoc
} from "../../src/services/liveStatusMerge";
import type { TeilnehmerStorage, UebungsleitungStorage } from "../../src/types/Storage";
import type { TeilnehmerLiveDoc } from "../../src/types/LiveStatus";

const FRUEH = "2026-07-26T10:00:00.000Z";
const SPAET = "2026-07-26T10:05:00.000Z";

function teilnehmerStorage(overrides: Partial<TeilnehmerStorage> = {}): TeilnehmerStorage {
    return {
        version: 1,
        uebungId: "u1",
        teilnehmer: "Florian 10/1",
        lastUpdated: FRUEH,
        nachrichten: {},
        hideTransmitted: false,
        ...overrides
    };
}

function leitungStorage(overrides: Partial<UebungsleitungStorage> = {}): UebungsleitungStorage {
    return {
        version: 1,
        uebungId: "u1",
        lastUpdated: FRUEH,
        teilnehmer: {},
        nachrichten: {},
        ...overrides
    };
}

describe("earliestTimestamp", () => {
    it("liefert den frühesten gültigen Zeitstempel", () => {
        expect(earliestTimestamp(SPAET, FRUEH)).toBe(FRUEH);
    });

    it("ignoriert leere und ungültige Werte", () => {
        expect(earliestTimestamp(undefined, "", "keine-zeit", SPAET)).toBe(SPAET);
        expect(earliestTimestamp(undefined, "")).toBeUndefined();
    });
});

describe("Teilnehmer-Merge", () => {
    it("übernimmt Remote-Einträge, die es lokal noch nicht gibt", () => {
        const local = teilnehmerStorage();
        const remote: TeilnehmerLiveDoc = {
            version: 1,
            teilnehmerId: "9F3K",
            teilnehmer: "Florian 10/1",
            lastUpdated: SPAET,
            nachrichten: { "7": { uebertragen: true, uebertragenUm: SPAET, geaendertUm: SPAET } }
        };

        const { merged, changed } = mergeTeilnehmerLiveDoc(local, remote);

        expect(changed).toBe(true);
        expect(merged.nachrichten["7"]?.uebertragen).toBe(true);
    });

    it("lässt jüngere lokale Änderungen gewinnen", () => {
        const local = teilnehmerStorage({
            nachrichten: { "7": { uebertragen: false, geaendertUm: SPAET } }
        });
        const remote: TeilnehmerLiveDoc = {
            version: 1,
            teilnehmerId: "9F3K",
            teilnehmer: "Florian 10/1",
            lastUpdated: FRUEH,
            nachrichten: { "7": { uebertragen: true, uebertragenUm: FRUEH, geaendertUm: FRUEH } }
        };

        const { merged, changed } = mergeTeilnehmerLiveDoc(local, remote);

        expect(changed).toBe(false);
        expect(merged.nachrichten["7"]?.uebertragen).toBe(false);
    });

    it("überträgt eine jüngere X-Zeit-Basis und entfernt sie beim Zurücksetzen", () => {
        const local = teilnehmerStorage({ xZeitBasis: "09:00", xZeitBasisGeaendertUm: FRUEH });
        const gesetzt = mergeTeilnehmerLiveDoc(local, {
            version: 1,
            teilnehmerId: "9F3K",
            teilnehmer: "Florian 10/1",
            lastUpdated: SPAET,
            nachrichten: {},
            xZeitBasis: "11:30",
            xZeitBasisGeaendertUm: SPAET
        });
        expect(gesetzt.merged.xZeitBasis).toBe("11:30");

        const geloescht = mergeTeilnehmerLiveDoc(gesetzt.merged, {
            version: 1,
            teilnehmerId: "9F3K",
            teilnehmer: "Florian 10/1",
            lastUpdated: "2026-07-26T10:09:00.000Z",
            nachrichten: {},
            xZeitBasisGeaendertUm: "2026-07-26T10:09:00.000Z"
        });
        expect(geloescht.merged.xZeitBasis).toBeUndefined();
    });

    it("bildet den lokalen Stand auf ein Live-Dokument ab", () => {
        const doc = toTeilnehmerLiveDoc(
            teilnehmerStorage({ xZeitBasis: "09:00", xZeitBasisGeaendertUm: FRUEH, hideTransmitted: true }),
            "9F3K"
        );

        expect(doc.teilnehmerId).toBe("9F3K");
        expect(doc.xZeitBasis).toBe("09:00");
        // hideTransmitted ist eine reine Ansichtseinstellung und wird nicht übertragen.
        expect(doc).not.toHaveProperty("hideTransmitted");
    });
});

describe("Leitungs-Merge", () => {
    it("trennt Bestätigungen von internen Notizen", () => {
        const storage = leitungStorage({
            teilnehmer: { "Florian 10/1": { notizen: "intern", geaendertUm: FRUEH } },
            nachrichten: {
                "Florian 10/1__1": {
                    abgesetztUm: FRUEH,
                    statusGeaendertUm: FRUEH,
                    notiz: "intern",
                    notizGeaendertUm: FRUEH
                }
            }
        });

        const oeffentlich = toLeitungPublicLiveDoc(storage);
        const intern = toLeitungLiveDoc(storage);

        expect(oeffentlich.nachrichten["Florian 10/1__1"]?.abgesetztUm).toBe(FRUEH);
        expect(JSON.stringify(oeffentlich)).not.toContain("intern");
        expect(intern.nachrichtenNotizen["Florian 10/1__1"]?.notiz).toBe("intern");
        expect(intern.teilnehmer["Florian 10/1"]?.notizen).toBe("intern");
    });

    it("übernimmt ein jüngeres Zurücksetzen der Bestätigung", () => {
        const local = leitungStorage({
            nachrichten: { "A__1": { abgesetztUm: FRUEH, statusGeaendertUm: FRUEH, notiz: "bleibt" } }
        });

        const { merged, changed } = mergeLeitungPublicLiveDoc(local, {
            version: 1,
            lastUpdated: SPAET,
            nachrichten: { "A__1": { geaendertUm: SPAET } }
        });

        expect(changed).toBe(true);
        expect(merged.nachrichten["A__1"]?.abgesetztUm).toBeUndefined();
        // Die Notiz gehört zum internen Dokument und darf dabei nicht verloren gehen.
        expect(merged.nachrichten["A__1"]?.notiz).toBe("bleibt");
    });

    it("führt interne Notizen und Teilnehmerdaten zusammen", () => {
        const local = leitungStorage({
            teilnehmer: { "A": { notizen: "alt", geaendertUm: FRUEH } }
        });

        const { merged, changed } = mergeLeitungLiveDoc(local, {
            version: 1,
            lastUpdated: SPAET,
            teilnehmer: { "A": { notizen: "neu", geaendertUm: SPAET } },
            nachrichtenNotizen: { "A__1": { notiz: "Funkspruch wiederholt", geaendertUm: SPAET } }
        });

        expect(changed).toBe(true);
        expect(merged.teilnehmer["A"]?.notizen).toBe("neu");
        expect(merged.nachrichten["A__1"]?.notiz).toBe("Funkspruch wiederholt");
    });
});

describe("buildEffektiveNachrichtenStatus", () => {
    const teilnehmerDocs: TeilnehmerLiveDoc[] = [
        {
            version: 1,
            teilnehmerId: "9F3K",
            teilnehmer: "A",
            lastUpdated: SPAET,
            nachrichten: {
                "1": { uebertragen: true, uebertragenUm: FRUEH, geaendertUm: FRUEH },
                "2": { uebertragen: false, geaendertUm: SPAET }
            }
        }
    ];

    it("zählt den früheren Zeitpunkt aus Meldung und Bestätigung", () => {
        const result = buildEffektiveNachrichtenStatus(
            { "A__1": { abgesetztUm: SPAET } },
            teilnehmerDocs
        );

        expect(result["A__1"]?.gemeldetUm).toBe(FRUEH);
        expect(result["A__1"]?.erledigtUm).toBe(FRUEH);
    });

    it("gilt auch ohne Bestätigung der Leitung als erledigt", () => {
        const result = buildEffektiveNachrichtenStatus({}, teilnehmerDocs);

        expect(result["A__1"]?.erledigtUm).toBe(FRUEH);
        expect(result["A__1"]?.abgesetztUm).toBeUndefined();
    });

    it("ignoriert zurückgesetzte Meldungen", () => {
        const result = buildEffektiveNachrichtenStatus({}, teilnehmerDocs);

        expect(result["A__2"]).toBeUndefined();
    });

    it("lässt Einträge ohne jede Markierung unerledigt", () => {
        const result = buildEffektiveNachrichtenStatus({ "A__9": { notiz: "nur Notiz" } }, []);

        expect(result["A__9"]?.erledigtUm).toBeUndefined();
    });
});

describe("buildTeilnehmerFortschritt", () => {
    it("meldet Teilnehmer ohne Live-Dokument als offline", () => {
        const result = buildTeilnehmerFortschritt(["A", "B"], { A: 3, B: 2 }, []);

        expect(result["A"]?.online).toBe(false);
        expect(result["A"]?.gemeldet).toBe(0);
        expect(result["A"]?.gesamt).toBe(3);
    });

    it("zählt übertragene Nachrichten und die letzte Meldung", () => {
        const result = buildTeilnehmerFortschritt(["A"], { A: 3 }, [
            {
                version: 1,
                teilnehmerId: "9F3K",
                teilnehmer: "A",
                lastUpdated: SPAET,
                nachrichten: {
                    "1": { uebertragen: true, uebertragenUm: FRUEH, geaendertUm: FRUEH },
                    "2": { uebertragen: true, uebertragenUm: SPAET, geaendertUm: SPAET },
                    "3": { uebertragen: false, geaendertUm: SPAET }
                }
            }
        ]);

        expect(result["A"]?.online).toBe(true);
        expect(result["A"]?.gemeldet).toBe(2);
        expect(result["A"]?.letzteMeldungUm).toBe(SPAET);
    });
});
