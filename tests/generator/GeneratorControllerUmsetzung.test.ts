import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Controller-Verhalten aus dem THW-Review vom 2026-10-04: Neu generieren als
 * neue Übung oder Überschreiben, Fehler beim Speichern ohne Datenverlust,
 * Entwurf, Adresse mit Übungs-ID, veraltetes Ergebnis, Vorbelegung ohne
 * Beispielwerte, Rückgängig beim Entfernen und gemerkte Lösungswörter.
 */

const mocks = vi.hoisted(() => ({
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    confirm: vi.fn(() => true),
    lade: vi.fn(),
    zip: vi.fn(),
    zuruecksetzen: vi.fn(() => Promise.resolve(true))
}));

vi.mock("../../src/core/chart", () => ({ Chart: { register: vi.fn() } }));
vi.mock("../../src/core/UiFeedback", () => ({
    uiFeedback: { error: mocks.error, info: mocks.info, success: mocks.success, confirm: mocks.confirm }
}));
vi.mock("../../src/services/pdfGeneratorLazy", () => ({
    ladePdfGenerator: () => Promise.resolve({ generateAllPDFsAsZip: mocks.zip }),
    vorladenPdfGenerator: vi.fn()
}));
vi.mock("../../src/generator/liveStatusZuruecksetzen", () => ({
    setzeLiveStatusZurueck: mocks.zuruecksetzen
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
        zeigeEntwurfVerworfen: vi.fn(),
        zeigeErgebnisHinweis: vi.fn(),
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

/** Eine schon gespeicherte, verteilte Übung. */
function machGespeichert(controller: Beliebig) {
    controller.funkUebung.id = "alt-id";
    controller.funkUebung.uebungCode = "ALT123";
    controller.funkUebung.teilnehmerIds = { AB12: "Heros 21/11" };
    controller.funkUebung.seed = "seed-alt";
    controller.funkUebung.nachrichten = { "Heros 21/11": [{ id: 1, empfaenger: ["Heros 22/11"], nachricht: "alt" }] };
    controller.isFreshExercise = false;
}

describe("GeneratorController – THW-Review", () => {
    let storage: ReturnType<typeof makeStorage>;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.confirm.mockReturnValue(true);
        mocks.zuruecksetzen.mockResolvedValue(true);
        storage = makeStorage();
        vi.stubGlobal("localStorage", storage);
        vi.stubGlobal("document", { body: { innerHTML: "" }, getElementById: () => null });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("Spruch 1\nSpruch 2\nSpruch 3") }));
        vi.stubGlobal("window", {
            location: { hash: "", hostname: "localhost" },
            history: { state: null, replaceState: vi.fn() }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("legt eine gespeicherte Übung standardmäßig als neue Übung an und lässt die alte stehen", async () => {
        const controller = await makeController();
        machGespeichert(controller);

        controller.funkUebung.name = "Dienstabend";
        controller.view = baueView({ getFormData: () => ({ ...baueView().getFormData(), name: "Dienstabend" }) });

        await controller.startUebung();

        // Keine Rückfrage: Die bisherige Übung bleibt ja unverändert (destructive-action P3-1).
        expect(mocks.confirm).not.toHaveBeenCalled();
        // Gleicher Name bekommt einen Zusatz (error-recovery P2-2).
        expect(controller.funkUebung.name).toBe("Dienstabend (2)");
        expect(controller.funkUebung.id).not.toBe("alt-id");
        expect(controller.funkUebung.uebungCode).toBe("NEU123");
        expect(controller.funkUebung.teilnehmerIds).toEqual({});
        expect(controller.funkUebung.seed).toBeUndefined();
        const gespeichert = controller.firebaseService.saveUebung.mock.calls[0]?.[0];
        expect(gespeichert.id).toBe(controller.funkUebung.id);
        expect(window.history.replaceState).toHaveBeenCalledWith(null, "", `#/generator/${controller.funkUebung.id}`);
        // Rückmeldung oben im Ergebnis statt als Toast über der Linktabelle (stress-test P3-2).
        expect(mocks.success).not.toHaveBeenCalled();
        expect(controller.hinweise.zeigeErgebnisHinweis).toHaveBeenCalledWith(
            expect.stringContaining("bisherige Übung bleibt unverändert"), false
        );
        expect(mocks.zuruecksetzen).not.toHaveBeenCalled();
        // Die neue Übung steht in „Zuletzt in diesem Browser erstellt“.
        expect(JSON.parse(storage.getItem("generatorZuletzt:v1") ?? "[]")[0]).toMatchObject({
            id: controller.funkUebung.id, name: "Dienstabend (2)", uebungCode: "NEU123"
        });
        expect(controller.hinweise.zeigeModus).toHaveBeenLastCalledWith(expect.objectContaining({ gespeichert: true }));
    });

    it("überschreibt nur auf ausdrücklichen Wunsch und nennt die Folgen", async () => {
        const controller = await makeController();
        machGespeichert(controller);

        await controller.startUebung("ueberschreiben");

        const frage = mocks.confirm.mock.calls[0]?.[0] as string;
        expect(frage).toContain("überschreiben");
        expect(frage).toContain("Ausdrucke");
        expect(frage).toContain("Übungsstand wird für alle zurückgesetzt");
        expect(frage).toContain("nicht rückgängig");
        expect(controller.funkUebung.id).toBe("alt-id");
        expect(controller.funkUebung.uebungCode).toBe("ALT123");
        expect(controller.firebaseService.saveUebung).toHaveBeenCalled();
        // Der Live-Status wird gleich mit zurückgesetzt, mit alter und neuer Fassung
        // (destructive-action P2-1, workflow W3).
        const [, uebungId, staende] = mocks.zuruecksetzen.mock.calls[0] as unknown as [unknown, string, Beliebig];
        expect(uebungId).toBe("alt-id");
        expect(staende.alt.nachrichten["Heros 21/11"][0].nachricht).toBe("alt");
        expect(staende.neu.nachrichten["Heros 21/11"][0].nachricht).toBe("neu");
        expect(controller.hinweise.zeigeErgebnisHinweis).toHaveBeenCalledWith(
            expect.stringContaining("Übungsstand ist für alle zurückgesetzt"), false
        );
    });

    it("warnt sichtbar, wenn der Server das Zurücksetzen des Übungsstands nicht bestätigt", async () => {
        const controller = await makeController();
        machGespeichert(controller);
        mocks.zuruecksetzen.mockResolvedValue(false);

        await controller.startUebung("ueberschreiben");

        expect(controller.hinweise.zeigeErgebnisHinweis).toHaveBeenCalledWith(
            expect.stringContaining("noch nicht bestätigt"), true
        );
    });

    it("bricht ab, wenn die Rückfrage verneint wird", async () => {
        const controller = await makeController();
        machGespeichert(controller);
        mocks.confirm.mockReturnValue(false);

        await controller.startUebung("ueberschreiben");

        expect(controller.generationService.generate).not.toHaveBeenCalled();
        expect(controller.funkUebung.id).toBe("alt-id");
    });

    it("behält bei einem Speicherfehler den alten Stand und zeigt die Meldung dauerhaft", async () => {
        const controller = await makeController();
        machGespeichert(controller);
        controller.firebaseService.saveUebung.mockRejectedValue(new Error("offline"));
        vi.spyOn(console, "error").mockImplementation(() => {});

        await controller.startUebung();

        expect(controller.funkUebung.id).toBe("alt-id");
        expect(controller.funkUebung.uebungCode).toBe("ALT123");
        expect(controller.funkUebung.nachrichten["Heros 21/11"][0].nachricht).toBe("alt");
        const text = controller.hinweise.zeigeFehlerBox.mock.calls.at(-1)?.[0] as string;
        expect(text).toContain("nicht gespeichert");
        expect(text).toContain("zuletzt gespeicherten Fassung");
        expect(window.history.replaceState).not.toHaveBeenCalled();
        expect(controller.hinweise.setzeBeschaeftigt).toHaveBeenLastCalledWith(false);
    });

    it("meldet ein ausbleibendes Speichern nach dem Zeitlimit", async () => {
        vi.useFakeTimers();
        const controller = await makeController();
        controller.firebaseService.saveUebung.mockReturnValue(new Promise(() => {}));
        vi.spyOn(console, "error").mockImplementation(() => {});

        const lauf = controller.startUebung();
        await vi.advanceTimersByTimeAsync(15001);
        await lauf;

        const text = controller.hinweise.zeigeFehlerBox.mock.calls.at(-1)?.[0] as string;
        expect(text).toContain("nicht rechtzeitig geantwortet");
        // Ehrlich: Das Speichern kann noch ankommen (offline-resilience P2-1).
        expect(text).toContain("Speichern nicht bestätigt");
        expect(text).toContain("kann noch ankommen");
        expect(text).toContain("Gib noch keine Links weiter");
        expect(controller.funkUebung.nachrichten).toEqual({});
    });

    it("sperrt einen zweiten Klick, solange die Generierung läuft", async () => {
        const controller = await makeController();
        let freigeben: () => void = () => {};
        controller.firebaseService.saveUebung.mockReturnValue(new Promise<void>(resolve => { freigeben = resolve; }));

        const erster = controller.startUebung();
        await controller.startUebung();
        freigeben();
        await erster;

        expect(controller.generationService.generate).toHaveBeenCalledTimes(1);
    });

    it("meldet fehlende Verbindung, bevor etwas erzeugt wird", async () => {
        vi.stubGlobal("navigator", { onLine: false });
        const controller = await makeController();

        await controller.startUebung();

        expect(controller.generationService.generate).not.toHaveBeenCalled();
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Keine Internetverbindung"));
    });

    it("meldet nicht ladbare Vorlagen sichtbar", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const controller = await makeController();

        await controller.startUebung();

        expect(controller.hinweise.zeigeFehlerBox).toHaveBeenLastCalledWith(expect.stringContaining("Vorlagen konnten nicht geladen werden"));
        expect(controller.firebaseService.saveUebung).not.toHaveBeenCalled();
    });

    it("sammelt Eingabefehler und markiert alle Felder auf einmal", async () => {
        const controller = await makeController();
        controller.funkUebung.teilnehmerListe = ["Heros 21/11", "heros 21/11 "];
        controller.view = baueView({
            getFormData: () => ({ leitung: "", spruecheProTeilnehmer: 9999, spruecheAnAlle: 0, spruecheAnMehrere: 0, anmeldungAktiv: false }),
            getSelectedTemplates: () => []
        });

        await controller.startUebung();

        // Eingabefehler stehen am Feld und im Kasten, ohne Toast (error-recovery P2-1).
        expect(mocks.error).not.toHaveBeenCalled();
        const meldung = controller.hinweise.zeigeFehlerBox.mock.calls.at(-1)?.[0] as string;
        expect(meldung).toContain("Übungsleitung");
        expect(meldung).toContain("Teilnehmernamen müssen eindeutig sein.");
        expect(meldung).toContain("Höchstens 200");
        const felder = (controller.hinweise.zeigeFeldFehler.mock.calls.at(-1)?.[0] as { feld: string }[]).map(f => f.feld);
        expect(felder).toEqual(expect.arrayContaining(["leitung", "funkspruchVorlage", "teilnehmer-0", "teilnehmer-1", "spruecheProTeilnehmer"]));
        expect(controller.generationService.generate).not.toHaveBeenCalled();
    });

    it("startet eine neue Übung ohne Beispiel-Funkrufnamen und stellt einen Entwurf wieder her", async () => {
        const controller = await makeController();
        controller.renderTeilnehmer = vi.fn();
        await controller.handleRoute([]);
        expect(controller.funkUebung.teilnehmerListe).toEqual(["", "", ""]);
        expect(controller.funkUebung.leitung).toBe("");
        expect(controller.funkUebung.rufgruppe).toBe("");
        expect(controller.view.populateTemplateSelect).toHaveBeenCalledWith(expect.any(Object), []);
        expect(controller.hinweise.zeigeEntwurfHinweis).not.toHaveBeenCalled();

        storage.setItem("generatorEntwurf:v1", JSON.stringify({
            version: 1,
            gespeichertAm: "2026-10-04T18:00:00.000Z",
            formular: {
                name: "Entwurf", datum: "2026-10-06T00:00:00.000Z", rufgruppe: "", leitung: "Heros 10",
                spruecheProTeilnehmer: 10, spruecheAnAlle: 1, spruecheAnMehrere: 1, buchstabierenAn: 0,
                anmeldungAktiv: true, autoStaerkeErgaenzen: true, nachrichtenArtAktiv: false, spruchAnteilProzent: 50,
                spielModus: "klassisch", xZeitIntervallMinuten: 3, xZeitStartOffsetMinuten: 0
            },
            quelle: "vorlagen",
            vorlagen: ["thwleer"],
            teilnehmerListe: ["Heros 21/11"],
            teilnehmerStellen: {},
            loesungswortOption: "central",
            loesungswoerter: { "Heros 21/11": "FUNKE" }
        }));
        await controller.handleRoute([]);
        expect(controller.funkUebung.name).toBe("Entwurf");
        expect(controller.funkUebung.teilnehmerListe).toEqual(["Heros 21/11"]);
        expect(controller.view.selectLoesungswortOption).toHaveBeenCalledWith("central");
        expect(controller.hinweise.zeigeEntwurfHinweis).toHaveBeenCalledWith(expect.any(Date), expect.any(Function));

        // Verwerfen löscht den Entwurf und zeichnet das leere Formular neu.
        const verwerfen = controller.hinweise.zeigeEntwurfHinweis.mock.calls.at(-1)?.[1] as () => void;
        await verwerfen();
        expect(storage.getItem("generatorEntwurf:v1")).toBeNull();
        expect(controller.funkUebung.name).not.toBe("Entwurf");

        // Rückgängig holt den Entwurf zurück (destructive-action P2-2).
        const rueckgaengig = controller.hinweise.zeigeEntwurfVerworfen.mock.calls.at(-1)?.[0] as () => void;
        rueckgaengig();
        await vi.waitFor(() => expect(controller.funkUebung.name).toBe("Entwurf"));
        expect(JSON.parse(storage.getItem("generatorEntwurf:v1") ?? "{}").formular.name).toBe("Entwurf");
    });

    it("meldet eine nicht gefundene Übungs-ID", async () => {
        const controller = await makeController();
        controller.renderTeilnehmer = vi.fn();
        await controller.handleRoute(["gibt-es-nicht"]);
        expect(controller.hinweise.zeigeFehlerBox).toHaveBeenCalledWith(expect.stringContaining("gibt-es-nicht"));
        expect(controller.funkUebung.teilnehmerListe).toEqual(["", "", ""]);
    });

    it("meldet einen Ladefehler, statt still ein leeres Formular zu zeigen", async () => {
        const controller = await makeController();
        controller.renderTeilnehmer = vi.fn();
        controller.firebaseService.getUebung.mockRejectedValue(new Error("offline"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        await controller.handleRoute(["abc"]);
        expect(controller.hinweise.zeigeFehlerBox).toHaveBeenCalledWith(expect.stringContaining("nicht geladen werden"));
    });

    it("lost die Lösungswörter einer geladenen Übung nicht neu aus", async () => {
        const controller = await makeController();
        controller.firebaseService.getUebung.mockResolvedValue({
            id: "abc",
            teilnehmerListe: ["A", "B"],
            loesungswoerter: { A: "FUNKER", B: "FUNKER" },
            nachrichten: { A: [{ id: 1, empfaenger: ["B"], nachricht: "x" }] }
        });
        controller.renderUebungResult = vi.fn();
        const shuffle = vi.spyOn(controller, "shuffleLoesungswoerter");

        await controller.handleRoute(["abc"]);

        expect(shuffle).not.toHaveBeenCalled();
        expect(controller.funkUebung.loesungswoerter).toEqual({ A: "FUNKER", B: "FUNKER" });
        expect(controller.loesungswortOption).toBe("central");
        expect(controller.renderUebungResult).toHaveBeenCalled();
    });

    it("kennzeichnet ein gespeichertes Ergebnis nach einer Änderung als veraltet", async () => {
        const controller = await makeController();
        machGespeichert(controller);
        controller.formularGeaendert();
        controller.formularGeaendert();
        expect(controller.hinweise.markiereErgebnisVeraltet).toHaveBeenCalledTimes(1);
        expect(controller.hinweise.markiereErgebnisVeraltet).toHaveBeenCalledWith(true);
        expect(storage.getItem("generatorEntwurf:v1")).toBeNull();
    });

    it("sichert Eingaben einer neuen Übung verzögert als Entwurf und zeigt die Statusleiste live", async () => {
        vi.useFakeTimers();
        const controller = await makeController();
        controller.isFreshExercise = true;
        controller.formularGeaendert();
        expect(controller.hinweise.aktualisiereStatusleiste).toHaveBeenCalledWith({
            teilnehmer: 2, nachrichten: `ca. ${2 * controller.funkUebung.spruecheProTeilnehmer}`,
            loesungswoerter: "Keine", dauer: "nach dem Generieren"
        });
        expect(storage.getItem("generatorEntwurf:v1")).toBeNull();
        vi.advanceTimersByTime(500);
        const entwurf = JSON.parse(storage.getItem("generatorEntwurf:v1") ?? "{}");
        expect(entwurf.formular.leitung).toBe("Heros 10");
        expect(entwurf.vorlagen).toEqual(["thwleer"]);
        expect(entwurf.teilnehmerListe).toEqual(["Heros 21/11", "Heros 22/11"]);
    });

    it("ignoriert Änderungen, während ein Stand ins Formular geschrieben wird", async () => {
        const controller = await makeController();
        machGespeichert(controller);
        controller.wendeAn = true;
        controller.formularGeaendert();
        expect(controller.hinweise.markiereErgebnisVeraltet).not.toHaveBeenCalled();
    });

    it("entfernt Teilnehmer ohne Rückfrage und holt sie mit Rückgängig samt Stelle zurück", async () => {
        const controller = await makeController();
        controller.funkUebung.teilnehmerStellen = { "Heros 22/11": "Trupp" };
        controller.funkUebung.loesungswoerter = { "Heros 22/11": "FUNKE" };

        controller.removeTeilnehmer(1);
        expect(controller.funkUebung.teilnehmerListe).toEqual(["Heros 21/11"]);
        const [name, rueckgaengig] = controller.hinweise.zeigeEntferntHinweis.mock.calls[0] ?? [];
        expect(name).toBe("Heros 22/11");

        (rueckgaengig as () => void)();
        expect(controller.funkUebung.teilnehmerListe).toEqual(["Heros 21/11", "Heros 22/11"]);
        expect(controller.funkUebung.teilnehmerStellen).toEqual({ "Heros 22/11": "Trupp" });
        expect(controller.funkUebung.loesungswoerter).toEqual({ "Heros 22/11": "FUNKE" });

        controller.removeTeilnehmer(9);
        expect(controller.hinweise.zeigeEntferntHinweis).toHaveBeenCalledTimes(1);
    });

    it("merkt sich eigene Lösungswörter beim Umschalten der Option", async () => {
        const controller = await makeController();
        const felder: Record<string, { value: string }> = {
            "loesungswort-0": { value: "funke" },
            "loesungswort-1": { value: "" }
        };
        vi.stubGlobal("document", { getElementById: (id: string) => felder[id] ?? null });
        let option = "individual";
        controller.view = baueView({ getSelectedLoesungswortOption: () => option });
        controller.loesungswortOption = "individual";
        const shuffle = vi.spyOn(controller, "shuffleLoesungswoerter");

        option = "none";
        controller.wechsleLoesungswortOption();
        expect(controller.funkUebung.loesungswoerter).toEqual({});

        option = "individual";
        controller.wechsleLoesungswortOption();
        expect(shuffle).not.toHaveBeenCalled();
        expect(controller.funkUebung.loesungswoerter).toEqual({ "Heros 21/11": "FUNKE" });

        option = "central";
        controller.wechsleLoesungswortOption();
        expect(shuffle).toHaveBeenCalledTimes(1);
    });

    it("meldet fehlgeschlagene Druckdaten statt still nichts zu tun", async () => {
        const controller = await makeController();
        controller.bindEvents();
        mocks.zip.mockRejectedValueOnce(new Error("offline"));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const aktionen = controller.view.bindPrimaryActions.mock.calls[0]?.[0];
        await aktionen.onZipAllPdfs();
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Druckdaten konnten nicht erstellt werden"));
    });

    it("druckt das Blatt für die beübte Stelle aus dem Drehbuch", async () => {
        const controller = await makeController();
        const druck = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
        vi.stubGlobal("window", { open: vi.fn(() => druck) });
        mocks.lade.mockResolvedValue({ titel: "Hochwasser", lage: "Pegel steigt", auftrag: "Führen", dauerMinuten: 180 });
        controller.funkUebung.fuehrungsstelle = { slug: "hochwasser-fuehrungsstelle", beuebteStelle: "EL", uebergeordnet: "Stab", unterstellt: ["EA"] };

        await controller.druckeBlattBeuebteStelle();

        expect(druck.document.write).toHaveBeenCalledWith(expect.stringContaining("Pegel steigt"));
        expect(druck.print).toHaveBeenCalled();

        vi.stubGlobal("window", { open: vi.fn(() => null) });
        await controller.druckeBlattBeuebteStelle();
        expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("Pop-ups"));
    });

    it("zeigt bei der Führungsstellen-Übung die Dauer des Drehbuchs", async () => {
        const controller = await makeController();
        mocks.lade.mockResolvedValue({ dauerMinuten: 180 });
        controller.funkUebung.fuehrungsstelle = { slug: "hochwasser-fuehrungsstelle", beuebteStelle: "EL", uebergeordnet: "Stab", unterstellt: ["EA"] };
        controller.funkUebung.nachrichten = { EA: [] };
        controller.statsService = {
            berechneUebungsdauer: () => ({}),
            berechneVerteilung: () => ({ labels: [], counts: [] })
        };

        controller.renderUebungResult();
        await Promise.resolve();
        await Promise.resolve();

        expect(controller.hinweise.zeigeBeuebteStelle).toHaveBeenCalledWith("EL");
        expect(controller.hinweise.setzeDauer).toHaveBeenCalledWith("180 Min (Drehbuch)");
    });

    it("lädt den Druckteil vor, sobald ein Ergebnis angezeigt wird", async () => {
        // Ohne Vorladen blieben ZIP und Übersicht nach einem Netzaussetzer bis zum
        // Neuladen kaputt (THW-Review 2026-10-05, offline-resilience P1-1).
        const { vorladenPdfGenerator } = await import("../../src/services/pdfGeneratorLazy");
        const controller = await makeController();
        controller.statsService = {
            berechneUebungsdauer: () => ({}),
            berechneVerteilung: () => ({ labels: [], counts: [] })
        };
        controller.renderUebungResult();
        expect(vorladenPdfGenerator).toHaveBeenCalled();
    });
});
