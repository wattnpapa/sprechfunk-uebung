import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ui = vi.hoisted(() => ({ confirm: vi.fn(() => true), success: vi.fn(), error: vi.fn() }));
vi.mock("../../src/core/UiFeedback", () => ({ uiFeedback: ui }));

import { CockpitSteuerung, type CockpitHost } from "../../src/uebungsleitung/cockpitSteuerung";
import { PlanAktionen } from "../../src/uebungsleitung/aktionenPlan";
import { LeitungAktionen, type AktionenHost } from "../../src/uebungsleitung/aktionen";
import { basisWechselFrage, minutenZurueck, vergangenerBeginnFrage, vorschlagLabel } from "../../src/uebungsleitung/xZeitBasisWechsel";
import type { UebungsleitungStorage } from "../../src/types/Storage";

function leererStand(extra: Partial<UebungsleitungStorage> = {}): UebungsleitungStorage {
    return { version: 1, uebungId: "u1", lastUpdated: "", teilnehmer: {}, nachrichten: {}, ...extra };
}

const xUebung = {
    id: "u1",
    spielModus: "xZeit",
    xZeitIntervallMinuten: 1,
    teilnehmerListe: ["A"],
    datum: new Date(2026, 9, 5),
    nachrichten: { A: [
        { id: 1, empfaenger: ["B"], nachricht: "a", xZeitSlot: 0 },
        { id: 2, empfaenger: ["B"], nachricht: "b", xZeitSlot: 5 },
        { id: 3, empfaenger: ["B"], nachricht: "c", xZeitSlot: 60 }
    ] },
    fuehrungsstelle: { slug: "s", beuebteStelle: "B", uebergeordnet: "C", unterstellt: [], beginn: "19:30" }
};

function cockpitMit(storage: UebungsleitungStorage) {
    const view = {
        setCockpitVisible: vi.fn(),
        setCockpitBasisInputValue: vi.fn(),
        bindCockpitEvents: vi.fn(),
        updateCockpit: vi.fn(),
        scrollZuPlanZustand: vi.fn(),
        zeigeRueckgaengig: vi.fn()
    };
    const host: CockpitHost = {
        storage: () => storage,
        uebung: () => xUebung as never,
        effektiverStatus: () => ({}),
        teilnehmerDocs: () => [],
        save: vi.fn(),
        renderNachrichten: vi.fn(),
        view
    };
    return { cockpit: new CockpitSteuerung(host), view, host };
}

describe("X-Zeit-Basis ändern (THW-Review 2026-10-05, destructive-action P1-1, workflow W1)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 5, 21, 7, 0));
        ui.confirm.mockReset().mockReturnValue(true);
        vi.stubGlobal("window", { addEventListener: vi.fn() });
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("formuliert Rückfragen mit alter und neuer Zeit und dem Abstand", () => {
        expect(basisWechselFrage({ alt: "09:00", neu: "21:02", ueberfaelligVorher: 16, ueberfaelligNachher: 0 }))
            .toContain("09:00 → 21:02");
        expect(basisWechselFrage({ alt: "09:00", neu: "", ueberfaelligVorher: 1, ueberfaelligNachher: 0 })).toContain("keine Basis");
        expect(vergangenerBeginnFrage("19:30", 97, 44)).toContain("liegt 97 Minuten zurück");
        expect(minutenZurueck("19:30", new Date())).toBe(97);
        expect(minutenZurueck("kaputt", new Date())).toBeNull();
        expect(vorschlagLabel("19:30", new Date())).toBe("19:30 übernehmen (liegt 97 min zurück)");
        expect(vorschlagLabel("21:05", new Date())).toBe("21:05 übernehmen");
    });

    it("setzt die erste Basis ohne Rückfrage und bietet Rückgängig an", () => {
        const storage = leererStand();
        const { cockpit, view, host } = cockpitMit(storage);
        cockpit.aendereBasis("21:05", "jetzt");
        expect(ui.confirm).not.toHaveBeenCalled();
        expect(storage.xZeitBasis).toBe("21:05");
        expect(host.save).toHaveBeenCalled();
        expect(view.zeigeRueckgaengig.mock.calls[0]?.[0]).toContain("– → 21:05");
        view.zeigeRueckgaengig.mock.calls[0]?.[1]();
        expect(storage.xZeitBasis).toBeUndefined();
    });

    it("fragt vor dem Ersetzen einer gesetzten Basis nach und lässt sie bei Abbruch stehen", () => {
        const storage = leererStand({ xZeitBasis: "21:00" });
        const { cockpit, view } = cockpitMit(storage);
        ui.confirm.mockReturnValueOnce(false);
        cockpit.aendereBasis("21:07", "jetzt");
        expect(ui.confirm.mock.calls[0]?.[0]).toContain("21:00 → 21:07");
        expect(storage.xZeitBasis).toBe("21:00");
        expect(view.setCockpitBasisInputValue).toHaveBeenLastCalledWith("21:00");

        cockpit.aendereBasis("21:07", "eingabe");
        expect(storage.xZeitBasis).toBe("21:07");
        view.zeigeRueckgaengig.mock.calls.at(-1)?.[1]();
        expect(storage.xZeitBasis).toBe("21:00");
        // Dieselbe Basis noch einmal: nichts passiert.
        ui.confirm.mockClear();
        cockpit.aendereBasis("21:00", "eingabe");
        expect(ui.confirm).not.toHaveBeenCalled();
    });

    it("übernimmt einen weit zurückliegenden Beginn nur nach Rückfrage und bietet „jetzt starten“ an", () => {
        const storage = leererStand();
        const { cockpit } = cockpitMit(storage);
        ui.confirm.mockReturnValueOnce(false).mockReturnValueOnce(true);
        cockpit.aendereBasis("19:30", "vorschlag");
        expect(ui.confirm.mock.calls[0]?.[0]).toContain("liegt 97 Minuten zurück");
        expect(ui.confirm.mock.calls[0]?.[0]).toContain("sofort 3 Einspielungen überfällig");
        expect(ui.confirm.mock.calls[1]?.[0]).toContain("jetzt starten (X-Zeit-Basis 21:07)");
        expect(storage.xZeitBasis).toBe("21:07");

        const zweiter = leererStand();
        const c2 = cockpitMit(zweiter).cockpit;
        ui.confirm.mockReset().mockReturnValue(false);
        c2.aendereBasis("19:30", "vorschlag");
        expect(zweiter.xZeitBasis).toBeUndefined();

        ui.confirm.mockReset().mockReturnValue(true);
        c2.aendereBasis("19:30", "vorschlag");
        expect(zweiter.xZeitBasis).toBe("19:30");
    });

    it("übernimmt einen nahen Beginn ohne Rückfrage und zeigt im Cockpit „Neu starten“", () => {
        const storage = leererStand();
        const { cockpit, view } = cockpitMit(storage);
        cockpit.aendereBasis("21:06", "vorschlag");
        expect(ui.confirm).not.toHaveBeenCalled();
        cockpit.update();
        const anzeige = view.updateCockpit.mock.calls.at(-1)?.[0];
        expect(anzeige.basisGesetzt).toBe(true);
        expect(anzeige.hinterPlan).toEqual({ ueberfaellig: 0, faellig: 1 });
        expect(anzeige.vorschlagLabel).toBe("19:30 übernehmen (liegt 97 min zurück)");
    });

    it("startet den Ticker nur im X-Zeit-Modus und hält ihn wieder an", () => {
        const storage = leererStand({ xZeitBasis: "21:00" });
        const { cockpit, view, host } = cockpitMit(storage);
        cockpit.init();
        expect(view.setCockpitVisible).toHaveBeenCalledWith(true);
        expect(view.setCockpitBasisInputValue).toHaveBeenCalledWith("21:00");
        const [onEingabe, onJetzt, onVorschlag, onBadge] = view.bindCockpitEvents.mock.calls[0] as ((v?: string) => void)[];
        onBadge?.();
        expect(view.scrollZuPlanZustand).toHaveBeenCalledWith("ueberfaellig");
        ui.confirm.mockReturnValue(false);
        onJetzt?.();
        onEingabe?.("21:01");
        onVorschlag?.("21:02");
        expect(storage.xZeitBasis).toBe("21:00");
        vi.advanceTimersByTime(61000);
        expect(host.renderNachrichten).toHaveBeenCalled();
        cockpit.stop();
        cockpit.remoteBasisUebernommen();
        expect(view.setCockpitBasisInputValue).toHaveBeenLastCalledWith("21:00");
    });
});

function aktionsHost(storage: UebungsleitungStorage, uebung: unknown = xUebung): AktionenHost & { undo: ReturnType<typeof vi.fn> } {
    const undo = vi.fn();
    return {
        storage: () => storage,
        uebung: () => uebung as never,
        effektiverStatus: () => storage.nachrichten,
        save: vi.fn(),
        debouncedSave: vi.fn(),
        renderTeilnehmer: vi.fn(),
        renderNachrichten: vi.fn(),
        zeigeRueckgaengig: undo,
        schliesseRueckgaengig: vi.fn(),
        undo
    };
}

describe("Auslassen und Reaktion (THW-Review 2026-10-05, command P2-1/P2-2)", () => {
    it("lässt eine offene Einspielung aus, öffnet sie wieder und macht es rückgängig", () => {
        const storage = leererStand({ nachrichten: { "A__1": { notiz: "n" } } });
        const host = aktionsHost(storage);
        const plan = new PlanAktionen(host);

        plan.auslassen("A", 1);
        expect(storage.nachrichten["A__1"]).toMatchObject({ ausgelassen: true, notiz: "n" });
        expect(storage.nachrichten["A__1"]?.statusGeaendertUm).toBeTruthy();
        expect(host.schliesseRueckgaengig).toHaveBeenCalled();
        expect(host.undo.mock.calls[0]?.[0]).toContain("ausgelassen");

        plan.auslassen("A", 1);
        expect(host.undo).toHaveBeenCalledTimes(1);

        plan.wiederOeffnen("A", 1);
        expect(storage.nachrichten["A__1"]?.ausgelassen).toBeUndefined();
        host.undo.mock.calls[1]?.[1]();
        expect(storage.nachrichten["A__1"]?.ausgelassen).toBe(true);
        host.undo.mock.calls[0]?.[1]();
        expect(storage.nachrichten["A__1"]?.ausgelassen).toBeUndefined();
    });

    it("lässt abgesetzte Zeilen nicht aus", () => {
        const storage = leererStand({ nachrichten: { "A__1": { abgesetztUm: "x" } } });
        const host = aktionsHost(storage);
        new PlanAktionen(host).auslassen("A", 1);
        expect(storage.nachrichten["A__1"]?.ausgelassen).toBeUndefined();
        expect(host.save).not.toHaveBeenCalled();
        new PlanAktionen(aktionsHost(null as never)).auslassen("A", 1);
    });

    it("bewertet die Reaktion und hebt sie mit einem zweiten Klick auf", () => {
        const storage = leererStand();
        const host = aktionsHost(storage);
        const plan = new PlanAktionen(host);
        plan.setzeReaktion("A", 1, "abweichend");
        expect(storage.nachrichten["A__1"]).toMatchObject({ reaktion: "abweichend" });
        const erster = storage.nachrichten["A__1"]?.reaktionGeaendertUm;
        expect(erster).toBeTruthy();
        plan.setzeReaktion("A", 1, "erfolgt");
        expect(storage.nachrichten["A__1"]?.reaktion).toBe("erfolgt");
        plan.setzeReaktion("A", 1, "erfolgt");
        expect(storage.nachrichten["A__1"]?.reaktion).toBeUndefined();
        expect(host.save).toHaveBeenCalledTimes(3);
        new PlanAktionen(aktionsHost(null as never)).setzeReaktion("A", 1, "erfolgt");
    });
});

describe("Aktionen der Leitung – Nachtrag THW-Review 2026-10-05", () => {
    const anmeldeUebung = {
        ...xUebung,
        anmeldungAktiv: true,
        nachrichten: { A: [{ id: 1, empfaenger: ["B"], nachricht: "Anmeldung" }, { id: 2, empfaenger: ["B"], nachricht: "x" }] }
    };

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 8, 20, 0));
    });
    afterEach(() => vi.useRealTimers());

    it("zieht die Anmeldezeit bei einer Zeitkorrektur des Anmeldespruchs mit (analog P2-1)", () => {
        const storage = leererStand({ teilnehmer: { A: { angemeldetUm: new Date(2026, 9, 5, 19, 0).toISOString() } } });
        const host = aktionsHost(storage, anmeldeUebung);
        new LeitungAktionen(host).zeitNachtragen("A", 1, "19:10");
        expect(storage.nachrichten["A__1"]?.abgesetztUm).toBe(new Date(2026, 9, 5, 19, 10).toISOString());
        expect(storage.teilnehmer["A"]?.angemeldetUm).toBe(new Date(2026, 9, 5, 19, 10).toISOString());
        expect(host.schliesseRueckgaengig).toHaveBeenCalled();

        // Ein anderer Spruch ändert die Anmeldung nicht.
        new LeitungAktionen(host).zeitNachtragen("A", 2, "19:20");
        expect(storage.teilnehmer["A"]?.angemeldetUm).toBe(new Date(2026, 9, 5, 19, 10).toISOString());
        // Und der Nachtrag landet am Übungstag, nicht heute.
        expect(storage.nachrichten["A__2"]?.abgesetztUm).toBe(new Date(2026, 9, 5, 19, 20).toISOString());
    });

    it("kennzeichnet die Sammelbestätigung als Zeit vom Teilnehmer (analog P3-1)", () => {
        const storage = leererStand({ nachrichten: { "A__2": { ausgelassen: true } } });
        const host = aktionsHost(storage, anmeldeUebung);
        host.effektiverStatus = () => ({ "A__2": { gemeldetUm: "2026-10-05T19:00:00.000Z", ausgelassen: true } });
        ui.success.mockClear();
        new LeitungAktionen(host).gemeldeteBestaetigen();
        expect(storage.nachrichten["A__2"]).toMatchObject({ abgesetztUm: "2026-10-05T19:00:00.000Z", zeitVomTeilnehmer: true });
        expect(storage.nachrichten["A__2"]?.ausgelassen).toBeUndefined();
        expect(ui.success.mock.calls[0]?.[0]).toContain("Meldezeit des Teilnehmers");
    });

    it("schließt die alte Rückgängig-Leiste bei jeder neuen Statusaktion (error-recovery P3-2)", () => {
        const storage = leererStand({ nachrichten: { "A__2": { ausgelassen: true, zeitVomTeilnehmer: true } } });
        const host = aktionsHost(storage, anmeldeUebung);
        const aktionen = new LeitungAktionen(host);
        aktionen.markNachrichtAbgesetzt("A", 2);
        expect(storage.nachrichten["A__2"]?.ausgelassen).toBeUndefined();
        expect(storage.nachrichten["A__2"]?.zeitVomTeilnehmer).toBeUndefined();
        aktionen.markAngemeldet("A");
        aktionen.anmeldungZuruecknehmen("A");
        vi.advanceTimersByTime(2000);
        aktionen.resetNachricht("A", 2);
        expect(host.schliesseRueckgaengig).toHaveBeenCalledTimes(4);
    });
});
