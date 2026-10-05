import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Profile im Generator: aktuelle Eingaben speichern, wieder laden (auch aus
 * einer gespeicherten Übung heraus), als Datei exportieren und importieren.
 */

const mocks = vi.hoisted(() => ({
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    confirm: vi.fn(() => true),
    lade: vi.fn(),
    zip: vi.fn()
}));

vi.mock("../../src/core/chart", () => ({ Chart: { register: vi.fn() } }));
vi.mock("../../src/core/UiFeedback", () => ({
    uiFeedback: { error: mocks.error, info: mocks.info, success: mocks.success, confirm: mocks.confirm }
}));
vi.mock("../../src/services/pdfGeneratorLazy", () => ({
    ladePdfGenerator: () => Promise.resolve({ generateAllPDFsAsZip: mocks.zip })
}));
vi.mock("../../src/services/FuehrungsstellenUebungService", () => ({
    ladeFuehrungsstellenUebung: mocks.lade
}));
vi.mock("../../src/services/FirebaseService", () => ({
    FirebaseService: class {
        getUebung() { return null; }
        saveUebung() { return Promise.resolve(); }
        isUebungCodeVergeben() { return Promise.resolve(false); }
    }
}));
vi.mock("../../src/generator/GeneratorView", () => ({
    GeneratorView: class {}
}));

const makeStorage = () => {
    const daten = new Map<string, string>();
    return {
        daten,
        getItem: (k: string) => daten.get(k) ?? null,
        setItem: (k: string, v: string) => { daten.set(k, v); },
        removeItem: (k: string) => { daten.delete(k); }
    };
};

function baueView(overrides: Record<string, unknown> = {}) {
    return {
        render: vi.fn(),
        resetBindings: vi.fn(),
        bindDistributionInputs: vi.fn(),
        bindSourceToggle: vi.fn(),
        bindSzenarioChange: vi.fn(),
        bindFuehrungsstelleChange: vi.fn(),
        bindFuehrungsstellenAbschnittEvents: vi.fn(),
        bindLoesungswortOptionChange: vi.fn(),
        bindTeilnehmerEvents: vi.fn(),
        bindAnmeldungToggle: vi.fn(),
        bindNachrichtenArtToggle: vi.fn(),
        bindSpielModusToggle: vi.fn(),
        bindPrimaryActions: vi.fn(),
        bindQuickJoin: vi.fn(),
        setVersionInfo: vi.fn(),
        populateTemplateSelect: vi.fn(),
        populateSzenarioSelect: vi.fn(),
        populateFuehrungsstelleSelect: vi.fn(),
        setFuehrungsstellenRollen: vi.fn(),
        setFormData: vi.fn(),
        setSelectedSource: vi.fn(),
        selectLoesungswortOption: vi.fn(),
        updateLoesungswortOptionUI: vi.fn(),
        renderTeilnehmerSection: vi.fn(),
        renderUebungResult: vi.fn(),
        toggleFuehrungsstelleDownloads: vi.fn(),
        getFormData: () => ({
            leitung: "Heros 10",
            spruecheProTeilnehmer: 4,
            spruecheAnAlle: 0,
            spruecheAnMehrere: 0,
            buchstabierenAn: 0,
            anmeldungAktiv: false,
            datum: new Date(2026, 9, 6)
        }),
        getSelectedSource: () => "vorlagen",
        getSelectedTemplates: () => ["thwleer"],
        getSelectedSzenario: () => "",
        getSelectedFuehrungsstelle: () => "",
        getFuehrungsstellenRollen: () => ({ beuebteStelle: "", uebergeordnet: "", unterstellt: [] }),
        getSelectedLoesungswortOption: () => "none",
        getZentralesLoesungswort: () => "",
        getUploadedFile: () => undefined,
        ...overrides
    };
}

function baueHinweise() {
    return {
        entferneFeldFehler: vi.fn(),
        zeigeFeldFehler: vi.fn(),
        zeigeFehlerBox: vi.fn(),
        setzeBeschaeftigt: vi.fn(),
        zeigeModus: vi.fn(),
        markiereErgebnisVeraltet: vi.fn(),
        zeigeEntwurfHinweis: vi.fn(),
        zeigeEntferntHinweis: vi.fn(),
        aktualisiereStatusleiste: vi.fn(),
        setzeDauer: vi.fn(),
        bindAktionen: vi.fn(),
        zeigeBeuebteStelle: vi.fn(),
        bindFormularAenderung: vi.fn()
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Beliebig = any;

async function makeController() {
    const { store } = await import("../../src/state/store");
    store.setState({ db: {} as unknown as import("firebase/firestore").Firestore });
    const { GeneratorController } = await import("../../src/generator/index");
    (GeneratorController as Beliebig).instance = undefined;
    const controller = GeneratorController.getInstance() as Beliebig;
    controller.view = baueView();
    controller.hinweise = baueHinweise();
    controller.generationService = {
        generate: vi.fn((u: Beliebig) => {
            u.nachrichten = { [u.teilnehmerListe[0]]: [{ id: 1, empfaenger: ["x"], nachricht: "neu" }] };
            u.uebungCode = u.uebungCode || "NEU123";
        }),
        ensureUniqueUebungCode: vi.fn().mockResolvedValue(true)
    };
    controller.firebaseService = {
        getUebung: vi.fn().mockResolvedValue(null),
        saveUebung: vi.fn().mockResolvedValue(undefined),
        isUebungCodeVergeben: vi.fn().mockResolvedValue(false)
    };
    controller.funkUebung.teilnehmerListe = ["Heros 21/11", "Heros 22/11"];
    controller.funkUebung.leitung = "Heros 10";
    return controller;
}

function profilView() {
    return { bind: vi.fn(), zeigeProfile: vi.fn(), setzeName: vi.fn(), oeffne: vi.fn(), herunterladen: vi.fn() };
}

const PROFIL_ENTWURF = {
    version: 1,
    gespeichertAm: "2026-10-03T18:00:00.000Z",
    formular: {
        name: "Sprechfunkübung OBLG GA 10/2026", datum: "2026-10-03T00:00:00.000Z", rufgruppe: "DMO OV A",
        leitung: "Heros Bad Belzig 21/10",
        spruecheProTeilnehmer: 5, spruecheAnAlle: 1, spruecheAnMehrere: 2, buchstabierenAn: 3,
        anmeldungAktiv: true, autoStaerkeErgaenzen: true, nachrichtenArtAktiv: true, spruchAnteilProzent: 50,
        spielModus: "xZeit", xZeitIntervallMinuten: 4, xZeitStartOffsetMinuten: 2
    },
    quelle: "vorlagen",
    vorlagen: ["thwleer", "gibt-es-nicht"],
    teilnehmerListe: ["Heros Bad Belzig 22/51", "Heros Brandenburg 63/63"],
    teilnehmerStellen: { "Heros Bad Belzig 22/51": "Zugtrupp" },
    loesungswortOption: "none",
    loesungswoerter: {}
};

const profilDatei = (name = "OV Bad Belzig", entwurf: unknown = PROFIL_ENTWURF) => ({
    text: () => Promise.resolve(JSON.stringify({
        typ: "sprechfunk-uebung-profil", version: 1, name, gespeichertAm: "2026-10-03T18:00:00.000Z", entwurf
    }))
});

describe("Generator-Profile", () => {
    let storage: ReturnType<typeof makeStorage>;
    let pushState: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.confirm.mockReturnValue(true);
        storage = makeStorage();
        pushState = vi.fn();
        vi.stubGlobal("localStorage", storage);
        vi.stubGlobal("document", { body: { innerHTML: "" }, getElementById: () => null });
        vi.stubGlobal("window", {
            location: { hash: "#/generator/alt-id", hostname: "localhost" },
            history: { state: null, replaceState: vi.fn(), pushState }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    async function controllerMitProfilen() {
        const controller = await makeController();
        controller.profilView = profilView();
        controller.renderTeilnehmer = vi.fn();
        return controller;
    }

    it("speichert die aktuellen Eingaben unter einem Namen und fragt vor dem Überschreiben", async () => {
        const { profilSpeichern } = await import("../../src/generator/controllerProfile");
        const controller = await controllerMitProfilen();

        profilSpeichern(controller, "   ");
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Namen"));

        profilSpeichern(controller, "  OV  Bad Belzig ");
        const gespeichert = JSON.parse(storage.getItem("generatorProfile:v1") ?? "[]");
        expect(gespeichert).toHaveLength(1);
        expect(gespeichert[0].name).toBe("OV Bad Belzig");
        expect(gespeichert[0].entwurf.formular.leitung).toBe("Heros 10");
        expect(gespeichert[0].entwurf.teilnehmerListe).toEqual(["Heros 21/11", "Heros 22/11"]);
        expect(controller.profilView.zeigeProfile).toHaveBeenCalledWith([expect.objectContaining({ name: "OV Bad Belzig" })], "OV Bad Belzig");
        expect(mocks.confirm).not.toHaveBeenCalled();

        mocks.confirm.mockReturnValue(false);
        profilSpeichern(controller, "ov bad belzig");
        expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("Überschreiben?"));
        expect(JSON.parse(storage.getItem("generatorProfile:v1") ?? "[]")[0].name).toBe("OV Bad Belzig");
    });

    it("speichert kein leeres Formular als Profil", async () => {
        const { profilSpeichern } = await import("../../src/generator/controllerProfile");
        const controller = await controllerMitProfilen();
        controller.funkUebung.teilnehmerListe = ["", ""];
        controller.view.getFormData = () => ({ leitung: "", rufgruppe: "" });
        controller.view.getSelectedTemplates = () => [];
        profilSpeichern(controller, "Leer");
        expect(storage.getItem("generatorProfile:v1")).toBeNull();
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("nichts zu speichern"));
    });

    it("lädt ein Profil aus einer gespeicherten Übung heraus als neue Übung", async () => {
        const { profilAusDatei, profilLaden } = await import("../../src/generator/controllerProfile");
        const controller = await controllerMitProfilen();
        await profilAusDatei(controller, profilDatei());
        vi.clearAllMocks();

        // Eine gespeicherte Übung ist offen.
        controller.funkUebung.id = "alt-id";
        controller.funkUebung.nachrichten = { "Heros 21/11": [{ id: 1, empfaenger: ["x"], nachricht: "alt" }] };
        controller.isFreshExercise = false;

        mocks.confirm.mockReturnValueOnce(false);
        await profilLaden(controller, "OV Bad Belzig");
        expect(mocks.confirm.mock.calls[0]?.[0]).toContain("neue Übung");
        expect(controller.funkUebung.id).toBe("alt-id");

        await profilLaden(controller, "OV Bad Belzig");
        expect(pushState).toHaveBeenCalledWith(null, "", "#/generator");
        expect(controller.isFreshExercise).toBe(true);
        expect(controller.funkUebung.id).not.toBe("alt-id");
        expect(controller.funkUebung.rufgruppe).toBe("DMO OV A");
        expect(controller.funkUebung.leitung).toBe("Heros Bad Belzig 21/10");
        expect(controller.funkUebung.spielModus).toBe("xZeit");
        expect(controller.funkUebung.xZeitIntervallMinuten).toBe(4);
        expect(controller.funkUebung.teilnehmerListe).toEqual(["Heros Bad Belzig 22/51", "Heros Brandenburg 63/63"]);
        expect(controller.funkUebung.teilnehmerStellen).toEqual({ "Heros Bad Belzig 22/51": "Zugtrupp" });
        expect(controller.funkUebung.verwendeteVorlagen).toEqual(["thwleer"]);
        // Das alte Datum wird zu heute.
        expect(new Date(controller.funkUebung.datum).toDateString()).toBe(new Date().toDateString());
        expect(controller.hinweise.zeigeEntwurfHinweis).toHaveBeenCalledWith(expect.any(Date), expect.any(Function), "OV Bad Belzig");
        expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining("„gibt-es-nicht“"));
        // Das geladene Profil ist zugleich der Entwurf: Ein Reload behält es.
        expect(JSON.parse(storage.getItem("generatorEntwurf:v1") ?? "{}").formular.rufgruppe).toBe("DMO OV A");
    });

    it("importiert eine Datei in die Profile des Browsers und weist fremde Dateien ab", async () => {
        const { profilAusDatei } = await import("../../src/generator/controllerProfile");
        const controller = await controllerMitProfilen();
        controller.isFreshExercise = true;
        controller.funkUebung.teilnehmerListe = ["", "", ""];
        controller.funkUebung.leitung = "";
        controller.view.getFormData = () => ({ leitung: "" });
        controller.view.getSelectedTemplates = () => [];

        await profilAusDatei(controller, { text: () => Promise.resolve("{\"name\":\"Übung\"}") });
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("kein Profil"));
        expect(storage.getItem("generatorProfile:v1")).toBeNull();

        await profilAusDatei(controller, profilDatei());
        // Leeres Formular: keine Rückfrage.
        expect(mocks.confirm).not.toHaveBeenCalled();
        expect(JSON.parse(storage.getItem("generatorProfile:v1") ?? "[]").map((p: { name: string }) => p.name)).toEqual(["OV Bad Belzig"]);
        expect(controller.funkUebung.rufgruppe).toBe("DMO OV A");

        // Andere Fassung unter gleichem Namen: Abbrechen lässt alles stehen.
        mocks.confirm.mockReturnValueOnce(false);
        await profilAusDatei(controller, profilDatei("OV Bad Belzig", { ...PROFIL_ENTWURF, vorlagen: [] }));
        expect(JSON.parse(storage.getItem("generatorProfile:v1") ?? "[]")[0].entwurf.vorlagen).toEqual(["thwleer", "gibt-es-nicht"]);
    });

    it("lädt Szenario- und Führungsstellen-Profile mit ihrer Quelle", async () => {
        const { ladeProfilInFormular } = await import("../../src/generator/controllerProfile");
        const { SZENARIEN } = await import("../../src/data/szenarien");
        const { FUEHRUNGSSTELLEN_UEBUNGEN } = await import("../../src/data/fuehrungsstellenUebungen");
        const { erstelleProfil } = await import("../../src/generator/GeneratorProfile");
        const controller = await controllerMitProfilen();
        controller.updateFuehrungsstelleInfo = vi.fn().mockResolvedValue(undefined);
        controller.view.renderSzenarioInfo = vi.fn();
        const szenario = Object.keys(SZENARIEN)[0] as string;
        const drehbuch = Object.keys(FUEHRUNGSSTELLEN_UEBUNGEN)[0] as string;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ladeProfilInFormular(controller, erstelleProfil("Lage", { ...PROFIL_ENTWURF, quelle: "szenario", szenarioSlug: szenario } as any));
        expect(controller.funkUebung.szenarioSlug).toBe(szenario);
        expect(controller.view.setSelectedSource).toHaveBeenLastCalledWith("szenario");

        const rollen = { slug: drehbuch, beuebteStelle: "Heros 10", uebergeordnet: "Kater", unterstellt: ["Heros 21", "Heros 22"] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ladeProfilInFormular(controller, erstelleProfil("Stab", { ...PROFIL_ENTWURF, quelle: "fuehrungsstelle", fuehrungsstelle: rollen } as any));
        expect(controller.funkUebung.fuehrungsstelle).toEqual(rollen);
        expect(controller.view.setSelectedSource).toHaveBeenLastCalledWith("fuehrungsstelle");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ladeProfilInFormular(controller, erstelleProfil("Datei", { ...PROFIL_ENTWURF, quelle: "upload" } as any));
        expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining("Funkspruch-Datei"));
    });

    it("exportiert und löscht gespeicherte Profile", async () => {
        const { profilAusDatei, profilExportieren, profilLoeschen } = await import("../../src/generator/controllerProfile");
        const controller = await controllerMitProfilen();
        await profilAusDatei(controller, profilDatei());

        profilExportieren(controller, "OV Bad Belzig");
        const [inhalt, dateiname] = controller.profilView.herunterladen.mock.calls[0] as [string, string];
        expect(dateiname).toBe("sprechfunk-profil-ov-bad-belzig.json");
        expect(JSON.parse(inhalt)).toMatchObject({ typ: "sprechfunk-uebung-profil", version: 1, name: "OV Bad Belzig" });

        profilExportieren(controller, "fehlt");
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Wähle"));

        mocks.confirm.mockReturnValueOnce(false);
        profilLoeschen(controller, "OV Bad Belzig");
        expect(JSON.parse(storage.getItem("generatorProfile:v1") ?? "[]")).toHaveLength(1);
        profilLoeschen(controller, "OV Bad Belzig");
        expect(JSON.parse(storage.getItem("generatorProfile:v1") ?? "[]")).toHaveLength(0);
        expect(mocks.success).toHaveBeenLastCalledWith(expect.stringContaining("gelöscht"));
    });

    it("bietet die Datei an, wenn der Browser nichts speichern lässt", async () => {
        const { profilSpeichern } = await import("../../src/generator/controllerProfile");
        const controller = await controllerMitProfilen();
        vi.stubGlobal("localStorage", {
            getItem: () => null,
            setItem: () => { throw new Error("voll"); },
            removeItem: () => {}
        });
        profilSpeichern(controller, "Privat");
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("als Datei"));
        expect(controller.profilView.herunterladen).toHaveBeenCalledWith(expect.any(String), "sprechfunk-profil-privat.json");
    });
});
