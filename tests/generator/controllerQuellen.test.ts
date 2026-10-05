import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    error: vi.fn(),
    info: vi.fn(),
    parse: vi.fn()
}));

vi.mock("../../src/core/UiFeedback", () => ({
    uiFeedback: { error: mocks.error, info: mocks.info }
}));
vi.mock("../../src/services/SzenarioService", () => ({
    parseSzenario: mocks.parse
}));

import {
    fetchSzenario,
    generiereSzenarioUebung,
    loadFunkspruecheFromSelectedSource,
    updateSzenarioInfo,
    warnIfSpruchPoolTooSmall
} from "../../src/generator/controllerQuellen";
import type { GeneratorController } from "../../src/generator/index";

const SLUG = "unwetter-sturm";

function baueSzenario(straenge: number) {
    return {
        slug: SLUG,
        titel: "Sturm",
        beschreibung: "Beschreibung",
        minTeilnehmer: 2,
        einleitung: [{ empfaenger: "alle", text: "a" }],
        abschluss: [],
        straenge: Array.from({ length: straenge }, () => ({ titel: "S", sprueche: [{}, {}] }))
    };
}

function baueCtrl(view: Record<string, unknown> = {}) {
    return {
        szenarioCache: new Map(),
        szenarioInfoToken: 0,
        templatesFunksprueche: { a: { text: "A", filename: "a.txt" } },
        funkUebung: {
            teilnehmerListe: ["A", "B"],
            funksprueche: [] as string[],
            verwendeteVorlagen: [] as string[],
            spruecheProTeilnehmer: 3,
            anmeldungAktiv: true
        },
        stateService: { resetLoesungswoerter: vi.fn() },
        generationService: { generate: vi.fn() },
        hinweise: { zeigeFehlerBox: vi.fn(), zeigeFeldFehler: vi.fn() },
        view: {
            getSelectedSzenario: () => SLUG,
            renderSzenarioInfo: vi.fn(),
            getSelectedSource: () => "upload",
            getSelectedTemplates: () => ["a"],
            getUploadedFile: () => undefined,
            ...view
        }
    } as unknown as GeneratorController;
}

describe("controllerQuellen", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.parse.mockImplementation(() => baueSzenario(3));
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("lädt ein Szenario einmal und nimmt es danach aus dem Cache", async () => {
        const ctrl = baueCtrl();
        const erstes = await fetchSzenario(ctrl, SLUG);
        const zweites = await fetchSzenario(ctrl, SLUG);
        expect(zweites).toBe(erstes);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("meldet unbekannte und nicht ladbare Szenarien", async () => {
        const ctrl = baueCtrl();
        await expect(fetchSzenario(ctrl, "gibt-es-nicht")).rejects.toThrow("Unbekanntes Szenario");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
        await expect(fetchSzenario(ctrl, SLUG)).rejects.toThrow("HTTP 404");
    });

    it("zeigt Beschreibung und Spanne des Szenarios", async () => {
        const ctrl = baueCtrl();
        await updateSzenarioInfo(ctrl);
        expect(ctrl.view.renderSzenarioInfo).toHaveBeenCalledWith([
            "Beschreibung",
            "Für 2 bis 3 Teilnehmer · 7 Funksprüche insgesamt."
        ]);
    });

    it("leert die Info ohne Auswahl und meldet Ladefehler", async () => {
        const ohne = baueCtrl({ getSelectedSzenario: () => "" });
        await updateSzenarioInfo(ohne);
        expect(ohne.view.renderSzenarioInfo).toHaveBeenCalledWith([]);

        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        const fehler = baueCtrl();
        await updateSzenarioInfo(fehler);
        expect(fehler.view.renderSzenarioInfo).toHaveBeenCalledWith(["Szenario konnte nicht geladen werden."]);
    });

    it("generiert ein Szenario nur bei passender Teilnehmerzahl", async () => {
        const ctrl = baueCtrl();
        expect(await generiereSzenarioUebung(ctrl)).toBe(true);
        expect(ctrl.generationService.generate).toHaveBeenCalled();

        mocks.parse.mockImplementation(() => baueSzenario(1));
        const zuViele = baueCtrl({ getSelectedSzenario: () => "hochwasser-deich" });
        expect(await generiereSzenarioUebung(zuViele)).toBe(false);
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("für 2 bis 1 Teilnehmer"));
    });

    it("bricht ohne Szenario-Auswahl oder bei Ladefehler ab", async () => {
        const ohne = baueCtrl({ getSelectedSzenario: () => "" });
        expect(await generiereSzenarioUebung(ohne)).toBe(false);
        // Eingabefehler: Kasten und Feld, kein Toast (THW-Review 2026-10-05, error-recovery P2-1).
        expect(ohne.hinweise.zeigeFehlerBox).toHaveBeenCalledWith("Bitte ein Szenario auswählen.");
        expect(mocks.error).not.toHaveBeenCalledWith("Bitte ein Szenario auswählen.");

        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        expect(await generiereSzenarioUebung(baueCtrl())).toBe(false);
    });

    it("liest Funksprüche aus einer hochgeladenen Datei", async () => {
        const ohneDatei = baueCtrl();
        expect(await loadFunkspruecheFromSelectedSource(ohneDatei)).toBe(false);

        const datei = { text: () => Promise.resolve("Eins\n eins \n\nZwei") };
        const ctrl = baueCtrl({ getUploadedFile: () => datei });
        expect(await loadFunkspruecheFromSelectedSource(ctrl)).toBe(true);
        expect(ctrl.funkUebung.funksprueche).toEqual(["Eins", "Zwei"]);
    });

    it("lädt Vorlagen und meldet fehlende oder nicht ladbare", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("X\nY") }));
        const ctrl = baueCtrl({ getSelectedSource: () => "vorlagen" });
        expect(await loadFunkspruecheFromSelectedSource(ctrl)).toBe(true);
        expect(ctrl.funkUebung.funksprueche).toEqual(["X", "Y"]);

        const leer = baueCtrl({ getSelectedSource: () => "vorlagen", getSelectedTemplates: () => [] });
        expect(await loadFunkspruecheFromSelectedSource(leer)).toBe(false);

        const fehlt = baueCtrl({ getSelectedSource: () => "vorlagen", getSelectedTemplates: () => ["b"] });
        expect(await loadFunkspruecheFromSelectedSource(fehlt)).toBe(false);

        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
        expect(await loadFunkspruecheFromSelectedSource(baueCtrl({ getSelectedSource: () => "vorlagen" }))).toBe(false);
    });

    it("warnt bei zu kleinem Spruch-Pool", () => {
        const ctrl = baueCtrl();
        ctrl.funkUebung.funksprueche = ["a"];
        warnIfSpruchPoolTooSmall(ctrl);
        expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining("Nur 1 eindeutige Funksprüche für 4"));

        mocks.info.mockClear();
        ctrl.funkUebung.funksprueche = ["a", "b", "c", "d"];
        warnIfSpruchPoolTooSmall(ctrl);
        expect(mocks.info).not.toHaveBeenCalled();
    });
});
