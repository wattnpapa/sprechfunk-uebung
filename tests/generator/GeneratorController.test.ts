import { beforeEach, describe, expect, it, vi } from "vitest";
import pdfGenerator from "../../src/services/pdfGenerator";

vi.mock("chart.js", () => ({
    Chart: { register: vi.fn() },
    registerables: []
}));

vi.mock("../../src/core/select2-setup", () => ({
    default: () => ({
        trigger: vi.fn(),
        val: vi.fn()
    })
}));

vi.mock("../../src/services/pdfGenerator", () => ({
    default: { generateAllPDFsAsZip: vi.fn() }
}));

vi.mock("../../src/services/FirebaseService", () => ({
    FirebaseService: class {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(_db: any) {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getUebung(_id: any) { return null; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        saveUebung(_u: any) { return Promise.resolve(); }
    }
}));

vi.mock("../../src/services/GenerationService", () => ({
    GenerationService: class {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        generate(_u: any) {}
    }
}));

vi.mock("../../src/generator/GeneratorView", () => ({
    GeneratorView: class {
        render() {}
        resetBindings() {}
        bindDistributionInputs() {}
        bindSourceToggle() {}
        bindLoesungswortOptionChange() {}
        bindTeilnehmerEvents() {}
        bindAnmeldungToggle() {}
        bindPrimaryActions() {}
        setVersionInfo() {}
        populateTemplateSelect() {}
        setFormData() {}
        toggleSourceView() {}
        renderTeilnehmerSection() {}
        renderUebungResult() {}
        renderPreviewPage() {}
        updateDistributionInputs() {}
        setLoesungswortUI() {}
        copyJsonToClipboard() {}
    }
}));

const makeLocalStorage = () => {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); }
    };
};

const makeDocument = () => {
    const elements = new Map<string, { value: string }>();
    return {
        elements,
        document: {
            body: { innerHTML: "" },
            getElementById: (id: string) => elements.get(id) ?? null
        }
    };
};

const makeController = async () => {
    const { store } = await import("../../src/state/store");
    store.setState({ db: {} as unknown as import("firebase/firestore").Firestore });

    const { GeneratorController } = await import("../../src/generator/index");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (GeneratorController as any).instance = undefined;
    return GeneratorController.getInstance();
};

describe("GeneratorController", () => {
    beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = makeLocalStorage();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).confirm = vi.fn(() => true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).alert = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = makeDocument().document;
    });

    it("handleRoute loads uebung and updates UI", async () => {
        const controller = await makeController();

        const view = {
            render: vi.fn(),
            resetBindings: vi.fn(),
            bindDistributionInputs: vi.fn(),
            bindSourceToggle: vi.fn(),
            bindLoesungswortOptionChange: vi.fn(),
            bindTeilnehmerEvents: vi.fn(),
            bindAnmeldungToggle: vi.fn(),
            bindPrimaryActions: vi.fn(),
            setVersionInfo: vi.fn(),
            populateTemplateSelect: vi.fn(),
            setFormData: vi.fn(),
            toggleSourceView: vi.fn()
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderTeilnehmer = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderResultIfAvailable = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = {
            getUebung: vi.fn().mockResolvedValue({ id: "abc" })
        };

        await controller.handleRoute(["abc"]);

        expect(view.render).toHaveBeenCalled();
        expect(view.resetBindings).toHaveBeenCalled();
        expect(view.setVersionInfo).toHaveBeenCalled();
        expect(controller.funkUebung.id).toBe("abc");
    });

    it("handleRoute treats missing params as fresh exercise", async () => {
        const controller = await makeController();
        const loadUebung = vi.fn().mockResolvedValue(controller.funkUebung);
        const updateUI = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).loadUebung = loadUebung;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).updateUI = updateUI;

        await controller.handleRoute([]);

        expect(loadUebung).toHaveBeenCalledWith(null);
        expect(updateUI).toHaveBeenCalled();
    });

    it("handleRoute normalizes undefined id param to null", async () => {
        const controller = await makeController();
        const loadUebung = vi.fn().mockResolvedValue(controller.funkUebung);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).loadUebung = loadUebung;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).updateUI = vi.fn();

        await controller.handleRoute([undefined as unknown as string]);

        expect(loadUebung).toHaveBeenCalledWith(null);
    });

    it("throws when db is not initialized", async () => {
        const { store } = await import("../../src/state/store");
        store.setState({ db: null });
        const { GeneratorController } = await import("../../src/generator/index");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (GeneratorController as any).instance = undefined;

        expect(() => GeneratorController.getInstance()).toThrow("DB not initialized");
    });

    it("reuses singleton instance", async () => {
        const first = await makeController();
        const { GeneratorController } = await import("../../src/generator/index");
        const second = GeneratorController.getInstance();
        expect(second).toBe(first);
    });

    it("shuffleLoesungswoerter handles errors", async () => {
        const controller = await makeController();

        const view = {
            getSelectedLoesungswortOption: vi.fn().mockReturnValue("none")
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).stateService = {
            shuffleLoesungswoerter: vi.fn().mockReturnValue({ error: "boom" })
        };

        controller.shuffleLoesungswoerter();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).alert).toHaveBeenCalled();
    });

    it("shuffleLoesungswoerter sets central word", async () => {
        const controller = await makeController();

        const doc = makeDocument();
        doc.elements.set("zentralLoesungswortInput", { value: "" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = doc.document;

        const view = {
            getSelectedLoesungswortOption: vi.fn().mockReturnValue("central")
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).stateService = {
            shuffleLoesungswoerter: vi.fn().mockReturnValue({ centralWord: "alpha" })
        };
        const renderTeilnehmer = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderTeilnehmer = renderTeilnehmer;

        controller.shuffleLoesungswoerter();

        const input = doc.elements.get("zentralLoesungswortInput");
        expect(input?.value).toBe("alpha");
        expect(renderTeilnehmer).toHaveBeenCalledWith(false);
    });

    it("shuffleLoesungswoerter handles missing input and undefined central word", async () => {
        const controller = await makeController();
        const view = {
            getSelectedLoesungswortOption: vi.fn().mockReturnValue("central")
        };
        const renderTeilnehmer = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).stateService = {
            shuffleLoesungswoerter: vi.fn().mockReturnValue({})
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderTeilnehmer = renderTeilnehmer;

        controller.shuffleLoesungswoerter();

        expect(renderTeilnehmer).toHaveBeenCalledWith(false);
    });

    it("shuffleLoesungswoerter does not fail when central input is missing", async () => {
        const controller = await makeController();
        const doc = makeDocument();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = doc.document;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = {
            getSelectedLoesungswortOption: vi.fn().mockReturnValue("central")
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).stateService = {
            shuffleLoesungswoerter: vi.fn().mockReturnValue({ centralWord: "BETA" })
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderTeilnehmer = vi.fn();

        controller.shuffleLoesungswoerter();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).renderTeilnehmer).toHaveBeenCalledWith(false);
    });

    it("readLoesungswoerterFromView uses central option", async () => {
        const controller = await makeController();

        const view = {
            getSelectedLoesungswortOption: vi.fn().mockReturnValue("central"),
            getZentralesLoesungswort: vi.fn().mockReturnValue(" abc ")
        };
        const reset = vi.fn();
        const setZentral = vi.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).stateService = {
            resetLoesungswoerter: reset,
            setZentralesLoesungswort: setZentral
        };

        controller.readLoesungswoerterFromView();

        expect(reset).toHaveBeenCalled();
        expect(setZentral).toHaveBeenCalledWith(controller.funkUebung, "ABC");
    });

    it("readLoesungswoerterFromView uses individual option", async () => {
        const controller = await makeController();

        controller.funkUebung.teilnehmerListe = ["A", "B"];
        const doc = makeDocument();
        doc.elements.set("loesungswort-0", { value: "foo" });
        doc.elements.set("loesungswort-1", { value: " bar " });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = doc.document;

        const view = {
            getSelectedLoesungswortOption: vi.fn().mockReturnValue("individual")
        };
        const reset = vi.fn();
        const setIndividuell = vi.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).stateService = {
            resetLoesungswoerter: reset,
            setIndividuelleLoesungswoerter: setIndividuell
        };

        controller.readLoesungswoerterFromView();

        expect(reset).toHaveBeenCalled();
        expect(setIndividuell).toHaveBeenCalledWith(controller.funkUebung, ["FOO", "BAR"]);
    });

    it("readLoesungswoerterFromView skips missing individual inputs", async () => {
        const controller = await makeController();
        controller.funkUebung.teilnehmerListe = ["A", "B"];
        const doc = makeDocument();
        doc.elements.set("loesungswort-0", { value: "eins" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = doc.document;

        const setIndividuelleLoesungswoerter = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = {
            getSelectedLoesungswortOption: () => "individual"
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).stateService = {
            resetLoesungswoerter: vi.fn(),
            setIndividuelleLoesungswoerter
        };

        controller.readLoesungswoerterFromView();

        expect(setIndividuelleLoesungswoerter).toHaveBeenCalledWith(controller.funkUebung, ["EINS"]);
    });

    it("displayPage/changePage render preview pages", async () => {
        const controller = await makeController();

        const renderPreviewPage = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = { renderPreviewPage };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).previewService = {
            getAt: vi.fn().mockReturnValue("page-1"),
            change: vi.fn().mockReturnValue("page-2")
        };

        controller.displayPage(0);
        controller.changePage(1);

        expect(renderPreviewPage).toHaveBeenCalledWith("page-1");
        expect(renderPreviewPage).toHaveBeenCalledWith("page-2");
    });

    it("startUebung aborts when confirm is false and has messages", async () => {
        const controller = await makeController();

        controller.funkUebung.nachrichten = { A: [{ nachricht: "x" }] as unknown as never[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).confirm = vi.fn(() => false);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = { getFormData: vi.fn() };

        await controller.startUebung();

        expect((globalThis as any).confirm).toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).view.getFormData).not.toHaveBeenCalled();
    });

    it("startUebung proceeds when confirm is true and messages exist", async () => {
        const controller = await makeController();
        controller.funkUebung.nachrichten = { A: [{ nachricht: "x" }] as unknown as never[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).confirm = vi.fn(() => true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).fetch = vi.fn().mockResolvedValue({ text: async () => "A\nB\n" });

        const generationService = { generate: vi.fn() };
        const firebaseService = { saveUebung: vi.fn().mockResolvedValue(undefined) };
        const renderUebungResult = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).generationService = generationService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = firebaseService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderUebungResult = renderUebungResult;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = {
            getFormData: () => ({
                spruecheProTeilnehmer: 3,
                spruecheAnAlle: 0,
                spruecheAnMehrere: 0,
                buchstabierenAn: 0,
                anmeldungAktiv: false
            }),
            getSelectedLoesungswortOption: () => "none",
            getSelectedSource: () => "vorlagen",
            getSelectedTemplates: () => ["thwleer"],
            getUploadedFile: () => undefined,
            getZentralesLoesungswort: () => ""
        };

        await controller.startUebung();

        expect(generationService.generate).toHaveBeenCalled();
        expect(firebaseService.saveUebung).toHaveBeenCalledWith(controller.funkUebung);
        expect(renderUebungResult).toHaveBeenCalled();
    });

    it("startUebung requires templates selection", async () => {
        const controller = await makeController();

        const view = {
            getFormData: () => ({
                spruecheProTeilnehmer: 3,
                spruecheAnAlle: 1,
                spruecheAnMehrere: 0,
                buchstabierenAn: 0,
                anmeldungAktiv: false
            }),
            getSelectedLoesungswortOption: () => "none",
            getSelectedSource: () => "vorlagen",
            getSelectedTemplates: () => [],
            getUploadedFile: () => undefined,
            getZentralesLoesungswort: () => ""
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;

        await controller.startUebung();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).alert).toHaveBeenCalled();
    });

    it("startUebung validates missing templates", async () => {
        const controller = await makeController();

        const view = {
            getFormData: () => ({
                spruecheProTeilnehmer: 3,
                spruecheAnAlle: 1,
                spruecheAnMehrere: 0,
                buchstabierenAn: 0,
                anmeldungAktiv: false
            }),
            getSelectedLoesungswortOption: () => "none",
            getSelectedSource: () => "vorlagen",
            getSelectedTemplates: () => ["missing"],
            getUploadedFile: () => undefined,
            getZentralesLoesungswort: () => ""
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).templatesFunksprueche = {};

        await controller.startUebung();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).alert).toHaveBeenCalled();
    });

    it("startUebung upload requires file", async () => {
        const controller = await makeController();

        const view = {
            getFormData: () => ({
                spruecheProTeilnehmer: 3,
                spruecheAnAlle: 1,
                spruecheAnMehrere: 0,
                buchstabierenAn: 0,
                anmeldungAktiv: false
            }),
            getSelectedLoesungswortOption: () => "none",
            getSelectedSource: () => "upload",
            getSelectedTemplates: () => [],
            getUploadedFile: () => undefined,
            getZentralesLoesungswort: () => ""
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;

        await controller.startUebung();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).alert).toHaveBeenCalled();
    });

    it("renderResultIfAvailable only renders when messages exist", async () => {
        const controller = await makeController();
        const renderUebungResult = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderUebungResult = renderUebungResult;

        controller.funkUebung.nachrichten = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderResultIfAvailable();
        expect(renderUebungResult).not.toHaveBeenCalled();

        controller.funkUebung.nachrichten = { A: [{ nachricht: "x" }] as unknown as never[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderResultIfAvailable();
        expect(renderUebungResult).toHaveBeenCalled();
    });

    it("renderUebungResult renders stats", async () => {
        const controller = await makeController();
        controller.funkUebung.nachrichten = { A: [{ nachricht: "x" }] as unknown as never[] };

        const view = { renderUebungResult: vi.fn() };
        const statsService = {
            berechneUebungsdauer: vi.fn().mockReturnValue({ dauer: 1 }),
            berechneVerteilung: vi.fn().mockReturnValue({ verteilung: 1 })
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).statsService = statsService;

        controller.renderUebungResult();

        expect(view.renderUebungResult).toHaveBeenCalledWith(
            controller.funkUebung,
            { dauer: 1 },
            { verteilung: 1 }
        );
    });

    it("renderTeilnehmer enables stellenname when data present", async () => {
        const controller = await makeController();
        controller.funkUebung.teilnehmerStellen = { A: "Alpha" };

        const view = { renderTeilnehmerSection: vi.fn() };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;

        controller.renderTeilnehmer(false);

        expect(view.renderTeilnehmerSection).toHaveBeenCalled();
    });

    it("validateSpruchVerteilung flags invalid combinations", async () => {
        const controller = await makeController();

        controller.funkUebung.anmeldungAktiv = true;
        controller.funkUebung.spruecheAnAlle = 1;
        controller.funkUebung.spruecheAnMehrere = 1;
        controller.funkUebung.spruecheProTeilnehmer = 1;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isValid = (controller as any).validateSpruchVerteilung();

        expect(isValid).toBe(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).alert).toHaveBeenCalled();
    });

    it("loadUebung returns cached exercise when id matches", async () => {
        const controller = await makeController();
        controller.funkUebung.id = "same-id";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firebaseService = { getUebung: vi.fn() };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = firebaseService;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaded = await (controller as any).loadUebung("same-id");
        expect(loaded).toBe(controller.funkUebung);
        expect(firebaseService.getUebung).not.toHaveBeenCalled();
    });

    it("loadUebung returns new exercise for empty id", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaded = await (controller as any).loadUebung(null);
        expect(loaded).toBeDefined();
        expect(loaded).not.toBe(controller.funkUebung);
    });

    it("loadUebung fills missing teilnehmerStellen for loaded exercises", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = {
            getUebung: vi.fn().mockResolvedValue({
                id: "loaded",
                teilnehmerListe: ["A"]
            })
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaded = await (controller as any).loadUebung("loaded");
        expect(loaded.teilnehmerStellen).toEqual({});
    });

    it("loadUebung keeps existing teilnehmerStellen", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = {
            getUebung: vi.fn().mockResolvedValue({
                id: "loaded",
                teilnehmerStellen: { A: "Alpha" }
            })
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaded = await (controller as any).loadUebung("loaded");
        expect(loaded.teilnehmerStellen).toEqual({ A: "Alpha" });
    });

    it("loadUebung returns new exercise when backend returns null", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = {
            getUebung: vi.fn().mockResolvedValue(null)
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaded = await (controller as any).loadUebung("missing");
        expect(loaded).toBeDefined();
        expect(loaded.id).not.toBe("missing");
    });

    it("bindEvents handles loesungswort option 'none' without shuffle", async () => {
        const controller = await makeController();
        const bindLoesungswortOptionChange = vi.fn();
        const view = {
            bindDistributionInputs: vi.fn(),
            bindSourceToggle: vi.fn(),
            bindLoesungswortOptionChange,
            bindTeilnehmerEvents: vi.fn(),
            bindAnmeldungToggle: vi.fn(),
            bindPrimaryActions: vi.fn(),
            updateLoesungswortOptionUI: vi.fn(),
            getSelectedLoesungswortOption: vi.fn().mockReturnValue("none")
        };
        const resetLoesungswoerter = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).stateService = { resetLoesungswoerter };
        const renderTeilnehmer = vi.fn();
        const shuffleLoesungswoerter = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderTeilnehmer = renderTeilnehmer;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).shuffleLoesungswoerter = shuffleLoesungswoerter;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).bindEvents();
        const cb = bindLoesungswortOptionChange.mock.calls[0]?.[0];
        cb?.();

        expect(view.updateLoesungswortOptionUI).toHaveBeenCalled();
        expect(resetLoesungswoerter).toHaveBeenCalledWith(controller.funkUebung);
        expect(renderTeilnehmer).toHaveBeenCalledWith(false);
        expect(shuffleLoesungswoerter).not.toHaveBeenCalled();
    });

    it("bindEvents wires distribution, teilnehmer, anmeldung and primary actions", async () => {
        const controller = await makeController();
        const bindDistributionInputs = vi.fn();
        const bindLoesungswortOptionChange = vi.fn();
        const bindTeilnehmerEvents = vi.fn();
        const bindAnmeldungToggle = vi.fn();
        const bindPrimaryActions = vi.fn();
        const updateDistributionInputs = vi.fn();
        const view = {
            bindDistributionInputs,
            bindSourceToggle: vi.fn(),
            bindLoesungswortOptionChange,
            bindTeilnehmerEvents,
            bindAnmeldungToggle,
            bindPrimaryActions,
            updateDistributionInputs,
            updateLoesungswortOptionUI: vi.fn(),
            getSelectedLoesungswortOption: vi.fn().mockReturnValue("central"),
            copyJsonToClipboard: vi.fn()
        };
        const updateTeilnehmerName = vi.fn();
        const updateTeilnehmerStelle = vi.fn();
        const removeTeilnehmer = vi.fn();
        const renderTeilnehmer = vi.fn();
        const shuffleLoesungswoerter = vi.fn();
        const addTeilnehmer = vi.fn();
        const startUebung = vi.fn();
        const changePage = vi.fn();
        const copyJSONToClipboard = vi.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).updateTeilnehmerName = updateTeilnehmerName;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).updateTeilnehmerStelle = updateTeilnehmerStelle;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).removeTeilnehmer = removeTeilnehmer;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderTeilnehmer = renderTeilnehmer;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).shuffleLoesungswoerter = shuffleLoesungswoerter;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).addTeilnehmer = addTeilnehmer;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).startUebung = startUebung;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).changePage = changePage;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).copyJSONToClipboard = copyJSONToClipboard;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).bindEvents();

        const onDistribution = bindDistributionInputs.mock.calls[0]?.[0];
        onDistribution?.({ spruecheProTeilnehmer: 9 });
        expect(controller.funkUebung.spruecheProTeilnehmer).toBe(9);
        expect(updateDistributionInputs).not.toHaveBeenCalled();

        const onLoesungswortOption = bindLoesungswortOptionChange.mock.calls[0]?.[0];
        onLoesungswortOption?.();
        expect(shuffleLoesungswoerter).toHaveBeenCalled();

        const [
            onNameChange,
            onStelleChange,
            onRemove,
            onShowStellenname
        ] = bindTeilnehmerEvents.mock.calls[0] ?? [];
        onNameChange?.(1, "Bravo");
        onStelleChange?.("A", "Trupp");
        onRemove?.(2);
        onShowStellenname?.(true);
        expect(updateTeilnehmerName).toHaveBeenCalledWith(1, "Bravo");
        expect(updateTeilnehmerStelle).toHaveBeenCalledWith("A", "Trupp");
        expect(removeTeilnehmer).toHaveBeenCalledWith(2);
        expect(renderTeilnehmer).toHaveBeenCalledWith(false);

        const onAnmeldungToggle = bindAnmeldungToggle.mock.calls[0]?.[0];
        onAnmeldungToggle?.(true);
        expect(controller.funkUebung.anmeldungAktiv).toBe(true);

        const actions = bindPrimaryActions.mock.calls[0]?.[0];
        actions?.onAddTeilnehmer();
        actions?.onStartUebung();
        actions?.onChangePage(1);
        actions?.onCopyJson();
        actions?.onZipAllPdfs();
        expect(addTeilnehmer).toHaveBeenCalled();
        expect(startUebung).toHaveBeenCalled();
        expect(changePage).toHaveBeenCalledWith(1);
        expect(copyJSONToClipboard).toHaveBeenCalled();
        expect(pdfGenerator.generateAllPDFsAsZip).toHaveBeenCalledWith(controller.funkUebung);
    });

    it("copyJSONToClipboard passes serialized exercise to the view", async () => {
        const controller = await makeController();
        const copyJsonToClipboard = vi.fn();
        const toJson = vi.fn().mockReturnValue("{\"ok\":true}");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = { copyJsonToClipboard };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).funkUebung = { toJson };

        controller.copyJSONToClipboard();

        expect(copyJsonToClipboard).toHaveBeenCalledWith("{\"ok\":true}");
    });

    it("startUebung stops when template fetch fails", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error("fetch fail"));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).confirm = vi.fn(() => true);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const generationService = { generate: vi.fn() };
        const firebaseService = { saveUebung: vi.fn() };
        const renderUebungResult = vi.fn();
        const view = {
            getFormData: () => ({
                spruecheProTeilnehmer: 3,
                spruecheAnAlle: 0,
                spruecheAnMehrere: 0,
                buchstabierenAn: 0,
                anmeldungAktiv: false
            }),
            getSelectedLoesungswortOption: () => "none",
            getSelectedSource: () => "vorlagen",
            getSelectedTemplates: () => ["thwleer"],
            getUploadedFile: () => undefined,
            getZentralesLoesungswort: () => ""
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).generationService = generationService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = firebaseService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderUebungResult = renderUebungResult;
        controller.funkUebung.nachrichten = {};

        await controller.startUebung();

        expect(generationService.generate).not.toHaveBeenCalled();
        expect(firebaseService.saveUebung).not.toHaveBeenCalled();
        expect(renderUebungResult).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it("fetchBuildInfo updates buildInfo on success", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).fetch = vi.fn().mockResolvedValue({
            json: async () => ({ buildDate: "2026-01-01", runNumber: 7, commit: "abc123" })
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).fetchBuildInfo();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).buildInfo).toBe("2026-01-01-7-abc123");
    });

    it("updates, adds and removes teilnehmer via state service wrappers", async () => {
        const controller = await makeController();
        const stateService = {
            updateTeilnehmerName: vi.fn(),
            updateTeilnehmerStelle: vi.fn(),
            addTeilnehmer: vi.fn(),
            removeTeilnehmer: vi.fn()
        };
        const renderTeilnehmer = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).stateService = stateService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderTeilnehmer = renderTeilnehmer;
        controller.funkUebung.teilnehmerListe = ["A", "B", "C"];

        controller.updateTeilnehmerName(1, "Neu");
        controller.updateTeilnehmerStelle(0, "Stelle");
        controller.addTeilnehmer();
        controller.removeTeilnehmer(2);

        expect(stateService.updateTeilnehmerName).toHaveBeenCalledWith(controller.funkUebung, 1, "Neu");
        expect(stateService.updateTeilnehmerStelle).toHaveBeenCalledWith(controller.funkUebung, "A", "Stelle");
        expect(stateService.addTeilnehmer).toHaveBeenCalledWith(controller.funkUebung);
        expect(stateService.removeTeilnehmer).toHaveBeenCalledWith(controller.funkUebung, 2);
        expect(renderTeilnehmer).toHaveBeenCalledTimes(2);
    });

    it("renderTeilnehmer triggers shuffle when requested", async () => {
        const controller = await makeController();
        const renderTeilnehmerSection = vi.fn();
        const shuffleLoesungswoerter = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = { renderTeilnehmerSection };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).shuffleLoesungswoerter = shuffleLoesungswoerter;

        controller.renderTeilnehmer(true);

        expect(renderTeilnehmerSection).toHaveBeenCalled();
        expect(shuffleLoesungswoerter).toHaveBeenCalled();
    });

    it("renderTeilnehmer normalizes missing loesungswoerter for view", async () => {
        const controller = await makeController();
        const renderTeilnehmerSection = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = { renderTeilnehmerSection };
        controller.funkUebung.loesungswoerter = undefined as unknown as Record<string, string>;

        controller.renderTeilnehmer(false);

        expect(renderTeilnehmerSection).toHaveBeenCalledWith(
            controller.funkUebung.teilnehmerListe,
            controller.funkUebung.teilnehmerStellen || {},
            {},
            expect.any(Boolean)
        );
    });

    it("startUebung aborts when validateSpruchVerteilung fails", async () => {
        const controller = await makeController();
        const getFormData = vi.fn().mockReturnValue({
            spruecheProTeilnehmer: 1,
            spruecheAnAlle: 2,
            spruecheAnMehrere: 1,
            buchstabierenAn: 0,
            anmeldungAktiv: true
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = {
            getFormData,
            getSelectedLoesungswortOption: () => "none",
            getSelectedSource: () => "vorlagen",
            getSelectedTemplates: () => ["thwleer"],
            getUploadedFile: () => undefined,
            getZentralesLoesungswort: () => ""
        };
        const generationService = { generate: vi.fn() };
        const firebaseService = { saveUebung: vi.fn() };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).generationService = generationService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = firebaseService;

        await controller.startUebung();

        expect(getFormData).toHaveBeenCalled();
        expect(generationService.generate).not.toHaveBeenCalled();
        expect(firebaseService.saveUebung).not.toHaveBeenCalled();
    });

    it("validateSpruchVerteilung handles anmeldung-only lower bound", async () => {
        const controller = await makeController();
        controller.funkUebung.anmeldungAktiv = true;
        controller.funkUebung.spruecheAnAlle = -1;
        controller.funkUebung.spruecheAnMehrere = -1;
        controller.funkUebung.spruecheProTeilnehmer = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isValid = (controller as any).validateSpruchVerteilung();
        expect(isValid).toBe(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).alert).toHaveBeenCalled();
    });

    it("covers defensive missing-template throw in map callback", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).confirm = vi.fn(() => true);
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const generationService = { generate: vi.fn() };
        const firebaseService = { saveUebung: vi.fn() };
        let accessCount = 0;
        const flakyTemplates = new Proxy(
            {},
            {
                get: (_target, prop) => {
                    if (prop === "thwleer") {
                        accessCount += 1;
                        return accessCount === 1
                            ? { text: "x", filename: "assets/funksprueche/nachrichten_thw_leer.txt" }
                            : undefined;
                    }
                    return undefined;
                }
            }
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).templatesFunksprueche = flakyTemplates;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = {
            getFormData: () => ({
                spruecheProTeilnehmer: 5,
                spruecheAnAlle: 0,
                spruecheAnMehrere: 0,
                buchstabierenAn: 0,
                anmeldungAktiv: false
            }),
            getSelectedLoesungswortOption: () => "none",
            getSelectedSource: () => "vorlagen",
            getSelectedTemplates: () => ["thwleer"],
            getUploadedFile: () => undefined,
            getZentralesLoesungswort: () => ""
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).generationService = generationService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = firebaseService;

        await expect(controller.startUebung()).rejects.toThrow("Template nicht gefunden: thwleer");

        expect(generationService.generate).not.toHaveBeenCalled();
        expect(firebaseService.saveUebung).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it("createConfigFingerprint normalizes optional objects", async () => {
        const controller = await makeController();
        controller.funkUebung.loesungswoerter = undefined as unknown as Record<string, string>;
        controller.funkUebung.loesungsStaerken = undefined as unknown as Record<string, string>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (controller as any).createConfigFingerprint(controller.funkUebung);
        const parsed = JSON.parse(raw) as { loesungswoerter: Record<string, string>; loesungsStaerken: Record<string, string> };
        expect(parsed.loesungswoerter).toEqual({});
        expect(parsed.loesungsStaerken).toEqual({});
    });
});
