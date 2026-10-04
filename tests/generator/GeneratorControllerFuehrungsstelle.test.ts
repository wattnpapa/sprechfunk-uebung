import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Controller-Pfade der Führungsstellen-Übung: Rollen aus dem Formular in die
 * Übung, Drehbuch laden, Fehler melden, Abschnittsliste in der Spanne des
 * Drehbuchs halten, Drehbuch-PDF anstoßen. Die View ist ein Attrappen-Objekt,
 * das Drehbuch kommt aus einem gemockten Loader.
 */

const mocks = vi.hoisted(() => ({
    lade: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    confirm: vi.fn(() => true),
    generateDrehbuchPDF: vi.fn()
}));

vi.mock("../../src/core/chart", () => ({ Chart: { register: vi.fn() } }));
vi.mock("../../src/services/pdfGeneratorLazy", () => ({
    ladePdfGenerator: () => Promise.resolve({ generateDrehbuchPDF: mocks.generateDrehbuchPDF })
}));
vi.mock("../../src/core/UiFeedback", () => ({
    uiFeedback: { error: mocks.error, info: mocks.info, confirm: mocks.confirm, success: vi.fn() }
}));
vi.mock("../../src/services/FuehrungsstellenUebungService", () => ({
    ladeFuehrungsstellenUebung: mocks.lade
}));
vi.mock("../../src/services/FirebaseService", () => ({
    FirebaseService: class {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(_db: any) {}
        getUebung() { return null; }
        saveUebung() { return Promise.resolve(); }
        isUebungCodeVergeben() { return Promise.resolve(false); }
    }
}));
vi.mock("../../src/generator/GeneratorView", () => ({
    GeneratorView: class {
        render() {}
        resetBindings() {}
    }
}));

function baueDrehbuch(anzahlStraenge = 6, minAbschnitte = 2) {
    return {
        slug: "hochwasser-fuehrungsstelle",
        titel: "Hochwasser",
        beschreibung: "Beschreibung des Drehbuchs.",
        lage: "Lage",
        auftrag: "Auftrag",
        dauerMinuten: 180,
        minAbschnitte,
        uebergeordnet: { bezeichnung: "Stab", hintergrund: "H", nachrichten: [{ zeit: 1, weg: "funk", art: "betrieb", text: "x", erwartung: "y" }] },
        straenge: Array.from({ length: anzahlStraenge }, (_, i) => ({
            key: `s${i + 1}`, bezeichnung: `Einsatzstelle ${i + 1}`, hintergrund: "H",
            nachrichten: [{ zeit: i, weg: "funk", art: "betrieb", text: "x", erwartung: "y" }]
        }))
    };
}

function baueView(overrides: Record<string, unknown> = {}) {
    return {
        getFormData: () => ({ name: "Test" }),
        getSelectedSource: () => "fuehrungsstelle",
        getSelectedSzenario: () => "",
        getSelectedFuehrungsstelle: () => "hochwasser-fuehrungsstelle",
        getFuehrungsstellenRollen: () => ({ beuebteStelle: "EL 10", uebergeordnet: "Kater", unterstellt: ["EA 11", "EA 12"], beginn: "09:00" }),
        getSelectedLoesungswortOption: () => "none",
        getZentralesLoesungswort: () => "",
        renderFuehrungsstelleInfo: vi.fn(),
        renderFuehrungsstellenAbschnitte: vi.fn(),
        getFuehrungsstellenAbschnitte: () => [{ funkrufname: "EA 11", stelle: "" }, { funkrufname: "EA 12", stelle: "" }],
        setFuehrungsstellenRollen: vi.fn(),
        populateFuehrungsstelleSelect: vi.fn(),
        populateTemplateSelect: vi.fn(),
        populateSzenarioSelect: vi.fn(),
        setFormData: vi.fn(),
        setSelectedSource: vi.fn(),
        setVersionInfo: vi.fn(),
        renderUebungResult: vi.fn(),
        toggleFuehrungsstelleDownloads: vi.fn(),
        ...overrides
    };
}

async function makeController() {
    const { store } = await import("../../src/state/store");
    store.setState({ db: {} as unknown as import("firebase/firestore").Firestore });
    const { GeneratorController } = await import("../../src/generator/index");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (GeneratorController as any).instance = undefined;
    const controller = GeneratorController.getInstance();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (controller as any).generationService = {
        generateFuehrungsstelle: vi.fn(),
        generate: vi.fn(),
        ensureUniqueUebungCode: vi.fn().mockResolvedValue(true)
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (controller as any).firebaseService = {
        saveUebung: vi.fn().mockResolvedValue(undefined),
        isUebungCodeVergeben: vi.fn().mockResolvedValue(false),
        getUebung: vi.fn().mockResolvedValue(null)
    };
    return controller;
}

describe("GeneratorController Führungsstellen-Übung", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.lade.mockResolvedValue(baueDrehbuch());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = { body: { innerHTML: "" }, getElementById: () => null };
    });

    it("übernimmt Slug und Rollen aus dem Formular, generiert und speichert", async () => {
        const controller = await makeController();
        const view = baueView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderUebungResult = vi.fn();

        await controller.startUebung();

        expect(controller.funkUebung.fuehrungsstelle).toEqual({
            slug: "hochwasser-fuehrungsstelle", beuebteStelle: "EL 10", uebergeordnet: "Kater",
            unterstellt: ["EA 11", "EA 12"], beginn: "09:00"
        });
        expect(controller.funkUebung.szenarioSlug).toBeUndefined();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const generationService = (controller as any).generationService;
        expect(generationService.generateFuehrungsstelle).toHaveBeenCalledWith(controller.funkUebung, expect.objectContaining({ slug: "hochwasser-fuehrungsstelle" }));
        expect(generationService.generate).not.toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).firebaseService.saveUebung).toHaveBeenCalled();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).renderUebungResult).toHaveBeenCalled();
        expect(mocks.error).not.toHaveBeenCalled();
    });

    it("verlangt ein gewähltes Drehbuch und meldet Lade- und Besetzungsfehler", async () => {
        const controller = await makeController();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = baueView({ getSelectedFuehrungsstelle: () => "" });
        await controller.startUebung();
        expect(mocks.error).toHaveBeenCalledWith("Bitte ein Drehbuch auswählen.");

        mocks.lade.mockRejectedValueOnce(new Error("HTTP 404"));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = baueView();
        await controller.startUebung();
        expect(mocks.error).toHaveBeenLastCalledWith("Das Drehbuch konnte nicht geladen werden. Prüfe die Internetverbindung und versuche es erneut.");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).generationService.generateFuehrungsstelle = vi.fn(() => {
            throw new Error("Die Funkrufnamen der Führungsstellen-Übung müssen eindeutig sein.");
        });
        await controller.startUebung();
        expect(mocks.error).toHaveBeenLastCalledWith("Die Funkrufnamen der Führungsstellen-Übung müssen eindeutig sein.");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((controller as any).firebaseService.saveUebung).not.toHaveBeenCalled();
    });

    it("zeigt Drehbuch-Info und bringt die Abschnittsliste in die Spanne des Drehbuchs", async () => {
        const controller = await makeController();
        const view = baueView({
            getFuehrungsstellenRollen: () => ({ beuebteStelle: "EL", uebergeordnet: "Stab", unterstellt: ["EA 11"] }),
            getFuehrungsstellenAbschnitte: () => [{ funkrufname: "EA 11", stelle: "Abschnitt Nord" }]
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        mocks.lade.mockResolvedValue(baueDrehbuch(4, 2));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).updateFuehrungsstelleInfo();

        expect(view.renderFuehrungsstelleInfo).toHaveBeenCalledWith([
            "Beschreibung des Drehbuchs.",
            "Für 2 bis 4 Einsatzabschnitte · 5 Nachrichten · 180 Minuten."
        ]);
        // Ein Abschnitt zu wenig: mit einer leeren Zeile auf das Minimum aufgefüllt
        // (Beispielnamen nur als Platzhalter), der getippte Stellenname bleibt erhalten.
        expect(view.renderFuehrungsstellenAbschnitte).toHaveBeenCalledWith(
            [{ funkrufname: "EA 11", stelle: "Abschnitt Nord" }, { funkrufname: "", stelle: "" }],
            { min: 2, max: 4 }
        );
    });

    it("leert die Info bei unbekanntem Slug und meldet Ladefehler in der Info", async () => {
        const controller = await makeController();
        const view = baueView({ getSelectedFuehrungsstelle: () => "gibt-es-nicht" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).updateFuehrungsstelleInfo();
        expect(view.renderFuehrungsstelleInfo).toHaveBeenCalledWith([]);

        const view2 = baueView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view2;
        mocks.lade.mockRejectedValueOnce(new Error("kaputt"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (controller as any).updateFuehrungsstelleInfo();
        expect(view2.renderFuehrungsstelleInfo).toHaveBeenCalledWith(["Das Drehbuch konnte nicht geladen werden."]);
    });

    it("fügt Abschnitte bis zur Obergrenze hinzu und entfernt sie nicht unter das Minimum", async () => {
        const controller = await makeController();
        type Zeile = { funkrufname: string; stelle: string };
        const zeile = (funkrufname: string, stelle = ""): Zeile => ({ funkrufname, stelle });
        let zeilen = [zeile("Heros Musterstadt 21/10", "Nord"), zeile("Heros Musterstadt 22/10"), zeile("Heros Musterstadt 23/10")];
        const view = baueView({
            getFuehrungsstellenAbschnitte: () => zeilen,
            renderFuehrungsstellenAbschnitte: vi.fn((neue: Zeile[]) => { zeilen = neue; })
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).fuehrungsstelleGrenzen = { min: 2, max: 4 };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aendere = (controller as any).aendereAbschnitte.bind(controller);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const naechster = (controller as any).naechsterAbschnitt.bind(controller);

        aendere((liste: Zeile[]) => [...liste, naechster(liste)]);
        expect(zeilen).toEqual([
            zeile("Heros Musterstadt 21/10", "Nord"), zeile("Heros Musterstadt 22/10"), zeile("Heros Musterstadt 23/10"),
            zeile("")
        ]);
        aendere((liste: Zeile[]) => [...liste, naechster(liste)]);
        expect(zeilen).toHaveLength(4); // Obergrenze: der fünfte wird abgeschnitten
        aendere((liste: Zeile[]) => liste.filter((_, i) => i !== 0));
        aendere((liste: Zeile[]) => liste.filter((_, i) => i !== 0));
        aendere((liste: Zeile[]) => liste.filter((_, i) => i !== 0));
        expect(zeilen).toHaveLength(2); // Untergrenze: wieder aufgefüllt
        // Neue Zeilen sind leer: Beispiel-Funkrufnamen stehen nur als Platzhalter
        // im Formular und landen so nicht unbemerkt auf den Vordrucken.
        expect(naechster([zeile("Heros Musterstadt 22/10")])).toEqual(zeile(""));
    });

    it("stellt beim Laden einer Führungsstellen-Übung Quelle und Rollen wieder her", async () => {
        const controller = await makeController();
        const view = baueView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        controller.funkUebung.fuehrungsstelle = { slug: "hochwasser-fuehrungsstelle", beuebteStelle: "EL", uebergeordnet: "Stab", unterstellt: ["EA 11", "EA 12"] };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).applyUebungToView();
        await Promise.resolve();

        expect(view.setSelectedSource).toHaveBeenCalledWith("fuehrungsstelle");
        expect(view.populateFuehrungsstelleSelect).toHaveBeenCalledWith(expect.any(Object), "hochwasser-fuehrungsstelle");
        expect(view.setFuehrungsstellenRollen).toHaveBeenCalledWith(controller.funkUebung.fuehrungsstelle, expect.any(Object));
        expect(mocks.lade).toHaveBeenCalledWith("hochwasser-fuehrungsstelle");
    });

    it("lädt für das Drehbuch-PDF das Drehbuch nach und übergibt beides an den PDF-Generator", async () => {
        const controller = await makeController();
        let onDrehbuchPdf: (() => Promise<void>) | undefined;
        const view = baueView({
            bindDistributionInputs: vi.fn(), bindSourceToggle: vi.fn(), bindSzenarioChange: vi.fn(),
            bindFuehrungsstelleChange: vi.fn(), bindFuehrungsstellenAbschnittEvents: vi.fn(),
            bindLoesungswortOptionChange: vi.fn(), bindTeilnehmerEvents: vi.fn(), bindAnmeldungToggle: vi.fn(),
            bindNachrichtenArtToggle: vi.fn(), bindSpielModusToggle: vi.fn(), bindQuickJoin: vi.fn(),
            bindPrimaryActions: vi.fn((handlers: { onDrehbuchPdf: () => Promise<void> }) => { onDrehbuchPdf = handlers.onDrehbuchPdf; })
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).bindEvents();

        // Ohne Rollenbesetzung passiert nichts.
        await onDrehbuchPdf?.();
        expect(mocks.generateDrehbuchPDF).not.toHaveBeenCalled();

        controller.funkUebung.fuehrungsstelle = { slug: "hochwasser-fuehrungsstelle", beuebteStelle: "EL", uebergeordnet: "Stab", unterstellt: ["EA"] };
        await onDrehbuchPdf?.();
        expect(mocks.generateDrehbuchPDF).toHaveBeenCalledWith(controller.funkUebung, expect.objectContaining({ slug: "hochwasser-fuehrungsstelle" }));
    });

    it("lässt die Rollenbesetzung bei anderen Quellen fallen und rechnet sie in den Fingerabdruck", async () => {
        const controller = await makeController();
        controller.funkUebung.fuehrungsstelle = { slug: "x", beuebteStelle: "EL", uebergeordnet: "Stab", unterstellt: ["EA"] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mit = (controller as any).createConfigFingerprint(controller.funkUebung);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).fetch = vi.fn().mockResolvedValue({ text: async () => "Spruch eins.\nSpruch zwei.\n" });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = baueView({
            getSelectedSource: () => "vorlagen",
            getSelectedTemplates: () => ["thwleer"],
            getFormData: () => ({ spruecheProTeilnehmer: 3, spruecheAnAlle: 0, spruecheAnMehrere: 0, anmeldungAktiv: false, spielModus: "klassisch" })
        });
        controller.funkUebung.teilnehmerListe = ["A", "B"];
        await controller.startUebung();
        expect(controller.funkUebung.fuehrungsstelle).toBeUndefined();
        expect(controller.funkUebung.spielModus).toBe("klassisch");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ohne = (controller as any).createConfigFingerprint(controller.funkUebung);
        expect(mit).not.toBe(ohne);
    });

    it("behält bei abgelehnter Besetzung die vorherige Rollenbesetzung", async () => {
        const controller = await makeController();
        const vorher = { slug: "hochwasser-fuehrungsstelle", beuebteStelle: "EL alt", uebergeordnet: "Stab alt", unterstellt: ["EA alt"] };
        controller.funkUebung.fuehrungsstelle = vorher;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).generationService.generateFuehrungsstelle = vi.fn(() => {
            throw new Error("Die Funkrufnamen der Führungsstellen-Übung müssen eindeutig sein.");
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = baueView();
        await controller.startUebung();
        expect(controller.funkUebung.fuehrungsstelle).toEqual(vorher);
    });

    it("stellt die Teilnehmer des Formulars wieder her, wenn die Quelle die Führungsstellen-Übung verlässt", async () => {
        const controller = await makeController();
        let quelleGewechselt: ((source: string) => void) | undefined;
        const renderTeilnehmerSection = vi.fn();
        const view = baueView({
            bindDistributionInputs: vi.fn(), bindSzenarioChange: vi.fn(),
            bindSourceToggle: vi.fn((cb: (source: string) => void) => { quelleGewechselt = cb; }),
            bindFuehrungsstelleChange: vi.fn(), bindFuehrungsstellenAbschnittEvents: vi.fn(),
            bindLoesungswortOptionChange: vi.fn(), bindTeilnehmerEvents: vi.fn(), bindAnmeldungToggle: vi.fn(),
            bindNachrichtenArtToggle: vi.fn(), bindSpielModusToggle: vi.fn(), bindQuickJoin: vi.fn(),
            bindPrimaryActions: vi.fn(), selectLoesungswortOption: vi.fn(), renderTeilnehmerSection,
            updateLoesungswortOptionUI: vi.fn()
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).view = view;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).renderUebungResult = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).bindEvents();
        controller.funkUebung.teilnehmerListe = ["Heros A 21/10", "Heros B 21/10"];
        controller.funkUebung.teilnehmerStellen = { "Heros A 21/10": "Trupp A" };
        // Die echte Generierung ersetzt die Teilnehmerliste durch die Rollen.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (controller as any).generationService.generateFuehrungsstelle = vi.fn((uebung: { teilnehmerListe: string[]; teilnehmerStellen: Record<string, string> }) => {
            uebung.teilnehmerListe = ["EL 10", "EA 11", "EA 12", "Kater"];
            uebung.teilnehmerStellen = { Kater: "Führungsstab" };
        });

        await controller.startUebung();
        expect(controller.funkUebung.teilnehmerListe).toEqual(["EL 10", "EA 11", "EA 12", "Kater"]);

        quelleGewechselt?.("vorlagen");
        expect(controller.funkUebung.teilnehmerListe).toEqual(["Heros A 21/10", "Heros B 21/10"]);
        expect(controller.funkUebung.teilnehmerStellen).toEqual({ "Heros A 21/10": "Trupp A" });
        // Die Tabelle wird bei jedem Quellenwechsel neu gezeichnet.
        expect(renderTeilnehmerSection).toHaveBeenLastCalledWith(["Heros A 21/10", "Heros B 21/10"], { "Heros A 21/10": "Trupp A" }, {}, true);
    });
});
