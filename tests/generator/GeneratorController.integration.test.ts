import { describe, expect, it, vi, beforeEach } from "vitest";

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

describe("GeneratorController startUebung integration", () => {
    beforeEach(() => {
        // reset singleton between tests
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = makeLocalStorage();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).confirm = vi.fn(() => true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).alert = vi.fn();
    });

    it("generates and saves using templates", async () => {
        const { store } = await import("../../src/state/store");
        store.setState({ db: {} as unknown as import("firebase/firestore").Firestore });

        const { GeneratorController } = await import("../../src/generator/index");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (GeneratorController as any).instance = undefined;
        const controller = GeneratorController.getInstance();

        // stub services
        const generate = vi.fn();
        const saveUebung = vi.fn().mockResolvedValue(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).generationService = { generate };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = { saveUebung };

        // stub view
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
            getSelectedTemplates: () => ["t1"],
            getUploadedFile: () => undefined,
            getZentralesLoesungswort: () => ""
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderUebungResult = vi.fn();

        // templates and fetch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).templatesFunksprueche = {
            t1: { text: "T1", filename: "file1.txt" }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).fetch = vi.fn().mockResolvedValue({
            text: async () => "A\nB\nC"
        });

        await controller.startUebung();

        expect(generate).toHaveBeenCalled();
        expect(saveUebung).toHaveBeenCalled();
    });

    it("generates and saves using upload", async () => {
        const { store } = await import("../../src/state/store");
        store.setState({ db: {} as unknown as import("firebase/firestore").Firestore });

        const { GeneratorController } = await import("../../src/generator/index");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (GeneratorController as any).instance = undefined;
        const controller = GeneratorController.getInstance();

        const generate = vi.fn();
        const saveUebung = vi.fn().mockResolvedValue(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).generationService = { generate };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).firebaseService = { saveUebung };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderUebungResult = vi.fn();

        const file = { text: async () => "X\nY" };
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
            getUploadedFile: () => file,
            getZentralesLoesungswort: () => ""
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;

        await controller.startUebung();

        expect(generate).toHaveBeenCalled();
        expect(saveUebung).toHaveBeenCalled();
    });
});
