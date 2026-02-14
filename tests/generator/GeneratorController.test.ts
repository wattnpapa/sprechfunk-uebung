import { beforeEach, describe, expect, it, vi } from "vitest";

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

    it("renderUebungResult renders preview and stats", async () => {
        const controller = await makeController();
        controller.funkUebung.nachrichten = { A: [{ nachricht: "x" }] as unknown as never[] };

        const view = { renderUebungResult: vi.fn() };
        const previewService = { generate: vi.fn(), getAt: vi.fn().mockReturnValue("page") };
        const statsService = {
            berechneUebungsdauer: vi.fn().mockReturnValue({ dauer: 1 }),
            berechneVerteilung: vi.fn().mockReturnValue({ verteilung: 1 })
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).previewService = previewService;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).statsService = statsService;

        controller.renderUebungResult();

        expect(previewService.generate).toHaveBeenCalled();
        expect(view.renderUebungResult).toHaveBeenCalledWith(
            controller.funkUebung,
            "page",
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
});
