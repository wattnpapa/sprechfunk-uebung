import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    error: vi.fn(),
    pdf: {
        generateAllPDFsAsZip: vi.fn(),
        generateAllTeilnehmerUebersichtPrint: vi.fn(),
        generateDrehbuchPDF: vi.fn()
    },
    lade: vi.fn()
}));

vi.mock("../../src/core/UiFeedback", () => ({ uiFeedback: { error: mocks.error } }));
vi.mock("../../src/services/pdfGeneratorLazy", () => ({ ladePdfGenerator: () => Promise.resolve(mocks.pdf) }));
vi.mock("../../src/services/FuehrungsstellenUebungService", () => ({ ladeFuehrungsstellenUebung: mocks.lade }));

import { bindEvents } from "../../src/generator/controllerBindings";
import type { GeneratorController } from "../../src/generator/index";

type Handler = (...args: never[]) => unknown;

function baueCtrl() {
    const handler: Record<string, Handler> = {};
    const merke = (name: string) => vi.fn((h: Handler) => { handler[name] = h; });
    const view = {
        bindDistributionInputs: merke("distribution"),
        bindSourceToggle: merke("source"),
        bindSzenarioChange: merke("szenario"),
        bindFuehrungsstelleChange: merke("fuehrungsstelle"),
        bindFuehrungsstellenAbschnittEvents: vi.fn((add: Handler, remove: Handler) => {
            handler["abschnittAdd"] = add;
            handler["abschnittRemove"] = remove;
        }),
        bindLoesungswortOptionChange: merke("loesungswort"),
        bindTeilnehmerEvents: vi.fn((name: Handler, stelle: Handler, del: Handler, toggle: Handler) => {
            Object.assign(handler, { name, stelle, del, toggle });
        }),
        bindAnmeldungToggle: merke("anmeldung"),
        bindNachrichtenArtToggle: merke("nachrichtenArt"),
        bindSpielModusToggle: vi.fn(),
        bindPrimaryActions: vi.fn((h: Record<string, Handler>) => Object.assign(handler, h)),
        bindQuickJoin: merke("quickJoin"),
        selectLoesungswortOption: vi.fn(),
        getSelectedSzenario: () => "",
        renderSzenarioInfo: vi.fn()
    };
    const ctrl = {
        view,
        funkUebung: { teilnehmerListe: ["A"], teilnehmerStellen: {}, anmeldungAktiv: false, nachrichtenArtAktiv: false } as Record<string, unknown>,
        teilnehmerVorFuehrungsstelle: { liste: ["X"], stellen: { X: "S" } },
        szenarioInfoToken: 0,
        loesungswortOption: "central",
        showStellenname: false,
        stateService: { resetLoesungswoerter: vi.fn() },
        hinweise: { bindAktionen: vi.fn((h: Record<string, Handler>) => Object.assign(handler, h)), bindFormularAenderung: merke("formular"), zeigeFehlerBox: vi.fn() },
        renderTeilnehmer: vi.fn(),
        updateFuehrungsstelleInfo: vi.fn().mockResolvedValue(undefined),
        aendereAbschnitte: vi.fn(),
        naechsterAbschnitt: vi.fn(() => ({ funkrufname: "", stelle: "" })),
        wechsleLoesungswortOption: vi.fn(),
        updateTeilnehmerName: vi.fn(),
        updateTeilnehmerStelle: vi.fn(),
        removeTeilnehmer: vi.fn(),
        addTeilnehmer: vi.fn(),
        startUebung: vi.fn(),
        changePage: vi.fn(),
        copyJSONToClipboard: vi.fn(),
        druckeBlattBeuebteStelle: vi.fn(),
        formularGeaendert: vi.fn(),
        profilView: { bind: vi.fn(), zeigeProfile: vi.fn(), setzeName: vi.fn() }
    };
    bindEvents(ctrl as unknown as GeneratorController);
    return { ctrl, handler: handler as Record<string, (...args: unknown[]) => unknown> };
}

describe("controllerBindings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("window", { location: { hash: "" } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("schaltet beim Wechsel auf ein Drehbuch die Lösungswörter ab", () => {
        const { ctrl, handler } = baueCtrl();
        handler["source"]?.("fuehrungsstelle");
        expect(ctrl.view.selectLoesungswortOption).toHaveBeenCalledWith("none");
        expect(ctrl.loesungswortOption).toBe("none");
        expect(ctrl.updateFuehrungsstelleInfo).toHaveBeenCalled();
        expect(ctrl.teilnehmerVorFuehrungsstelle).not.toBeNull();

        handler["source"]?.("szenario");
        expect(ctrl.funkUebung["teilnehmerListe"]).toEqual(["X"]);
        expect(ctrl.teilnehmerVorFuehrungsstelle).toBeNull();
        expect(ctrl.view.renderSzenarioInfo).toHaveBeenCalledWith([]);
        expect(ctrl.renderTeilnehmer).toHaveBeenCalledWith(false);
    });

    it("leitet Formular- und Teilnehmerereignisse an den Controller weiter", () => {
        const { ctrl, handler } = baueCtrl();
        handler["distribution"]?.({ spruecheProTeilnehmer: 7 });
        handler["anmeldung"]?.(true);
        handler["nachrichtenArt"]?.(true);
        handler["toggle"]?.(true);
        handler["name"]?.(0, "B");
        handler["stelle"]?.(0, "S");
        handler["del"]?.(0);
        handler["abschnittAdd"]?.();
        handler["abschnittRemove"]?.(1);
        handler["fuehrungsstelle"]?.();
        handler["szenario"]?.();
        handler["loesungswort"]?.();
        handler["formular"]?.();
        expect(ctrl.funkUebung).toMatchObject({ spruecheProTeilnehmer: 7, anmeldungAktiv: true, nachrichtenArtAktiv: true });
        expect(ctrl.showStellenname).toBe(true);
        expect(ctrl.updateTeilnehmerName).toHaveBeenCalledWith(0, "B");
        expect(ctrl.updateTeilnehmerStelle).toHaveBeenCalledWith(0, "S");
        expect(ctrl.removeTeilnehmer).toHaveBeenCalledWith(0);
        expect(ctrl.aendereAbschnitte).toHaveBeenCalledTimes(2);
        const [hinzufuegen, entfernen] = ctrl.aendereAbschnitte.mock.calls.map(c => c[0] as (z: unknown[]) => unknown[]);
        expect(hinzufuegen?.([{ funkrufname: "a", stelle: "" }])).toHaveLength(2);
        expect(entfernen?.([1, 2, 3])).toEqual([1, 3]);
        expect(ctrl.updateFuehrungsstelleInfo).toHaveBeenCalled();
        expect(ctrl.wechsleLoesungswortOption).toHaveBeenCalled();
        expect(ctrl.formularGeaendert).toHaveBeenCalled();
    });

    it("öffnet den Teilnehmer-Zugang nur mit beiden Codes", () => {
        const { handler } = baueCtrl();
        handler["quickJoin"]?.("", "A1B2");
        expect(mocks.error).toHaveBeenCalledWith("Bitte Übungscode und Teilnehmercode eingeben.");
        handler["quickJoin"]?.("K7M4Q2", "A1B2");
        expect(window.location.hash).toBe("#/teilnehmer?uc=K7M4Q2&tc=A1B2");
    });

    it("verdrahtet Aktionen und Druckdaten", async () => {
        const { ctrl, handler } = baueCtrl();
        handler["onAddTeilnehmer"]?.();
        handler["onStartUebung"]?.();
        handler["onChangePage"]?.(1);
        handler["onCopyJson"]?.();
        handler["onUeberschreiben"]?.();
        handler["onBlattBeuebteStelle"]?.();
        expect(ctrl.addTeilnehmer).toHaveBeenCalled();
        expect(ctrl.startUebung).toHaveBeenCalledWith("neu");
        expect(ctrl.startUebung).toHaveBeenCalledWith("ueberschreiben");
        expect(ctrl.changePage).toHaveBeenCalledWith(1);
        expect(ctrl.copyJSONToClipboard).toHaveBeenCalled();
        expect(ctrl.druckeBlattBeuebteStelle).toHaveBeenCalled();

        await handler["onZipAllPdfs"]?.();
        await handler["onDownloadUebersichtPdf"]?.();
        expect(mocks.pdf.generateAllPDFsAsZip).toHaveBeenCalled();
        expect(mocks.pdf.generateAllTeilnehmerUebersichtPrint).toHaveBeenCalled();

        await handler["onDrehbuchPdf"]?.();
        expect(mocks.pdf.generateDrehbuchPDF).not.toHaveBeenCalled();
        ctrl.funkUebung["fuehrungsstelle"] = { slug: "x" };
        mocks.lade.mockResolvedValueOnce({ titel: "D" });
        await handler["onDrehbuchPdf"]?.();
        expect(mocks.pdf.generateDrehbuchPDF).toHaveBeenCalled();
    });

    it("meldet Fehler beim Erstellen der Druckdaten", async () => {
        const { handler } = baueCtrl();
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.pdf.generateAllPDFsAsZip.mockRejectedValueOnce(new Error("offline"));
        await handler["onZipAllPdfs"]?.();
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Druckdaten konnten nicht erstellt werden"));
    });
});
