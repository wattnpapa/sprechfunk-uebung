import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

const { chartCtor, getChart, destroyChart } = vi.hoisted(() => ({
    chartCtor: vi.fn(),
    getChart: vi.fn(),
    destroyChart: vi.fn()
}));

vi.mock("../../src/core/chart", () => {
    const FakeChart = function (...args: unknown[]) {
        chartCtor(...args);
    };
    (FakeChart as unknown as { getChart: typeof getChart }).getChart = getChart;
    const themeFarben = () => ({
        text: "#000", text2: "#555", linie: "#ddd", akzent: "#123", akzentHell: "#456", gut: "#060", warn: "#640"
    });
    return { Chart: FakeChart, themeFarben };
});

import { RUECKGAENGIG_MS, UebungsleitungView } from "../../src/uebungsleitung/UebungsleitungView";
import { captureFieldFocus, restoreFieldFocus } from "../../src/utils/focus";

const setDom = () => {
    const dom = new JSDOM(`
      <div id="uebungsleitungMeta"></div>
      <div id="uebungsleitungLageBody"></div>
      <div id="uebungsleitungGefahrenbereichBody"></div>
      <div id="uebungsleitungUndo" class="d-none"></div>
      <div id="uebungsleitungTeilnehmer"></div>
      <div id="uebungsleitungNachrichten"></div>
      <div id="nachrichtenProgressBar"></div>
      <div id="nachrichtenProgressLabel"></div>
      <div id="nachrichtenEtaLabel"></div>
      <div id="nachrichtenTempoLabel"></div>
      <div id="nachrichtenLoadLabel"></div>
      <div id="nachrichtenHeatmapLabel"></div>
      <span id="uebungsleitungLiveSyncBadge"></span>
      <div id="uebungsleitungCockpit" class="d-none">
        <div id="cockpitUhrzeit"></div>
        <div id="cockpitLaufzeit"></div>
        <div id="cockpitXZeit"></div>
        <span id="cockpitFortschritt"></span>
        <span id="cockpitPlanBadge"></span>
        <input id="cockpitXZeitBasisInput">
        <button id="btn-cockpit-xzeit-jetzt"></button>
        <button id="btn-cockpit-xzeit-vorschlag" class="d-none"></button>
        <small id="cockpitBasisHinweis"></small>
        <small id="cockpitAbweichungen"></small>
      </div>
    `);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
};

describe("UebungsleitungView", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setDom();
    });

    it("renders meta, binds meta events and escapes values", () => {
        const view = new UebungsleitungView();
        const onPdf = vi.fn();
        const onReset = vi.fn();

        view.renderMeta(
            {
                name: "<b>XSS</b>",
                datum: new Date("2026-02-15T12:00:00Z"),
                rufgruppe: "RG",
                leitung: "L",
                teilnehmerListe: ["A"],
                uebungCode: "ab12cd",
                teilnehmerIds: { "a1b2": "A<script>" },
                nachrichten: {},
                id: "u1"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            "<id>"
        );
        const onUebersicht = vi.fn();
        view.bindMetaEvents(onPdf, onReset, onUebersicht);

        expect(document.getElementById("uebungsleitungMeta")?.innerHTML).toContain("&lt;b&gt;XSS&lt;/b&gt;");
        expect(document.getElementById("uebungsleitungMeta")?.textContent).toContain("Übungscode");
        expect(document.getElementById("uebungsleitungMeta")?.textContent).toContain("AB12CD");
        (document.getElementById("exportUebungsleitungPdf") as HTMLButtonElement).click();
        (document.getElementById("resetUebungsleitungLocalData") as HTMLButtonElement).click();
        (document.getElementById("exportTeilnehmerUebersichtPdf") as HTMLButtonElement).click();
        expect(onPdf).toHaveBeenCalled();
        expect(onReset).toHaveBeenCalled();
        expect(onUebersicht).toHaveBeenCalled();
    });

    it("renders teilnehmer table and triggers teilnehmer callbacks", () => {
        const view = new UebungsleitungView();
        const onAnmelden = vi.fn();
        const onLoesungswort = vi.fn();
        const onStaerke = vi.fn();
        const onNotiz = vi.fn();
        const onToggleDetails = vi.fn();
        const onDownloadDebrief = vi.fn();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uebung: any = {
            teilnehmerListe: ["Alpha"],
            teilnehmerIds: { A1B2: "Alpha" },
            uebungCode: "K7M4Q2",
            teilnehmerStellen: { Alpha: "Stelle 1" },
            loesungswoerter: { Alpha: "WORT" },
            loesungsStaerken: { Alpha: "1/2/3/6" },
            nachrichten: {
                Bravo: [{ empfaenger: ["Alpha"], staerken: [{ fuehrer: 1, unterfuehrer: 2, helfer: 3 }] }]
            }
        };

        view.renderTeilnehmerListe(uebung, {}, true);
        view.bindTeilnehmerEvents({
            onAnmelden,
            onLoesungswort,
            onStaerke,
            onNotiz,
            onToggleDetails,
            onDownloadDebrief
        });
        expect(document.getElementById("uebungsleitungTeilnehmer")?.textContent).toContain("Teilnehmer Code: K7M4Q2 / A1B2");
        const copyBtn = document.querySelector("button[data-action='copy-link']") as HTMLButtonElement | null;
        expect(copyBtn).toBeTruthy();
        expect(copyBtn?.getAttribute("aria-label")).toBe("Teilnehmer-Link kopieren");

        const container = document.getElementById("uebungsleitungTeilnehmer") as HTMLElement;
        (container.querySelector("button[data-action='anmelden']") as HTMLButtonElement).click();
        (container.querySelector("button[data-action='toggle-staerke-details']") as HTMLButtonElement).click();
        (container.querySelector("button[data-action='download-debrief']") as HTMLButtonElement).click();

        const loesungsInput = container.querySelector("input[data-action='loesungswort']") as HTMLInputElement;
        loesungsInput.value = "IST";
        loesungsInput.dispatchEvent(new window.Event("change", { bubbles: true }));

        const staerkeInput = container.querySelector("input[data-action='staerke']") as HTMLInputElement;
        staerkeInput.value = "9";
        staerkeInput.dispatchEvent(new window.Event("change", { bubbles: true }));

        const notizInput = container.querySelector("textarea[data-action='notiz']") as HTMLTextAreaElement;
        notizInput.value = "Hinweis";
        notizInput.dispatchEvent(new window.Event("change", { bubbles: true }));
        notizInput.dispatchEvent(new window.Event("input", { bubbles: true }));

        expect(onAnmelden).toHaveBeenCalledWith("Alpha");
        expect(onToggleDetails).toHaveBeenCalled();
        expect(onDownloadDebrief).toHaveBeenCalledWith("Alpha");
        expect(onLoesungswort).toHaveBeenCalledWith("Alpha", "IST");
        expect(onStaerke).toHaveBeenCalledWith("Alpha", 0, "9");
        expect(onNotiz).toHaveBeenCalledWith("Alpha", "Hinweis");
    });

    it("keeps the note field focused when a live update rebuilds the table", () => {
        const view = new UebungsleitungView();
        const listeOptions = {
            nachrichten: [{ nr: 1, sender: "Heros Lübeck 201", empfaenger: ["B"], text: "hallo" }],
            nachrichtenStatus: { "Heros Lübeck 201__1": { notiz: "Notiz" } },
            hideAbgesetzt: false,
            senderFilter: "",
            empfaengerFilter: "",
            textFilter: ""
        };

        view.renderNachrichtenListe(listeOptions);
        const note = document.querySelector(".nachricht-notiz") as HTMLTextAreaElement;
        note.focus();
        note.setSelectionRange(3, 3);

        const snapshot = captureFieldFocus();
        view.renderNachrichtenListe(listeOptions);
        restoreFieldFocus(snapshot);

        const rebuilt = document.querySelector(".nachricht-notiz") as HTMLTextAreaElement;
        expect(rebuilt).not.toBe(note);
        expect(document.activeElement).toBe(rebuilt);
        expect(rebuilt.selectionStart).toBe(3);
    });

    it("renders nachrichten table and triggers nachrichten callbacks", () => {
        const view = new UebungsleitungView();
        const onAbgesetzt = vi.fn();
        const onReset = vi.fn();
        const onNotiz = vi.fn();
        const onFilterSender = vi.fn();
        const onFilterEmpfaenger = vi.fn();
        const onToggleHide = vi.fn();
        const onFilterText = vi.fn();

        view.renderNachrichtenListe({
            nachrichten: [
                { nr: 1, sender: "A", empfaenger: ["B"], text: "hallo" },
                { nr: 2, sender: "C", empfaenger: ["D"], text: "welt" }
            ],
            nachrichtenStatus: {
                "A__1": { abgesetztUm: "2026-02-15T10:00:00Z", notiz: "n1" },
                "C__2": {}
            },
            hideAbgesetzt: false,
            senderFilter: "",
            empfaengerFilter: "",
            textFilter: ""
        });
        view.bindNachrichtenEvents({
            onAbgesetzt,
            onReset,
            onNotiz,
            onFilterSender,
            onFilterEmpfaenger,
            onToggleHide,
            onFilterText
        });

        const container = document.getElementById("uebungsleitungNachrichten") as HTMLElement;
        (container.querySelector("button[data-action='reset']") as HTMLButtonElement).click();
        (container.querySelector("button[data-action='abgesetzt']") as HTMLButtonElement).click();

        const senderFilter = container.querySelector("#senderFilterSelect") as HTMLSelectElement;
        senderFilter.value = "A";
        senderFilter.dispatchEvent(new window.Event("change", { bubbles: true }));

        const empfFilter = container.querySelector("#empfaengerFilterSelect") as HTMLSelectElement;
        empfFilter.value = "B";
        empfFilter.dispatchEvent(new window.Event("change", { bubbles: true }));

        const toggleHide = container.querySelector("#toggleHideAbgesetzt") as HTMLInputElement;
        toggleHide.checked = true;
        toggleHide.dispatchEvent(new window.Event("change", { bubbles: true }));

        const textSearch = container.querySelector("#nachrichtenTextFilterInput") as HTMLInputElement;
        textSearch.value = "ha";
        textSearch.dispatchEvent(new window.Event("input", { bubbles: true }));

        const note = container.querySelector(".nachricht-notiz") as HTMLTextAreaElement;
        note.value = "memo";
        note.dispatchEvent(new window.Event("input", { bubbles: true }));

        expect(onReset).toHaveBeenCalledWith("A", 1);
        expect(onAbgesetzt).toHaveBeenCalledWith("C", 2);
        expect(onFilterSender).toHaveBeenCalledWith("A");
        expect(onFilterEmpfaenger).toHaveBeenCalledWith("B");
        expect(onToggleHide).toHaveBeenCalledWith(true);
        expect(onFilterText).toHaveBeenCalledWith("ha");
        expect(onNotiz).toHaveBeenCalledWith("A", 1, "memo");
    });

    it("updates progress/stats/heatmap/timeline", () => {
        const view = new UebungsleitungView();
        view.updateProgress(10, 4, "ETA: 120000feb26");
        view.updateOperationalStats("Tempo: 1", "Funklast: S A (2)", "Heatmap 5m: 10:00=1");
        view.renderNachrichtenListe({
            nachrichten: [{ nr: 1, sender: "A", empfaenger: ["B"], text: "x" }],
            nachrichtenStatus: {},
            hideAbgesetzt: false,
            senderFilter: "",
            empfaengerFilter: "",
            textFilter: ""
        });
        view.updateHeatmap([
            { bucket: new Date("2026-02-15T10:00:00Z").getTime(), count: 1 },
            { bucket: new Date("2026-02-15T10:05:00Z").getTime(), count: 2 }
        ]);

        getChart.mockReturnValueOnce({ destroy: destroyChart });
        view.updateTeilnehmerTimeline([
            { teilnehmer: "A", events: [{ ts: new Date("2026-02-15T10:01:00Z").getTime(), type: "S", nr: 1 }] }
        ]);

        expect((document.getElementById("nachrichtenProgressBar") as HTMLElement).style.width).toBe("40%");
        expect(document.getElementById("nachrichtenEtaLabel")?.textContent).toContain("ETA");
        expect(document.getElementById("nachrichtenTempoLabel")?.textContent).toBe("Tempo: 1");
        expect((document.getElementById("nachrichtenHeatmapChart") as HTMLElement).innerHTML).toContain("rgba");
        expect(chartCtor).toHaveBeenCalled();
        expect(destroyChart).toHaveBeenCalled();
    });

    it("covers empty states and non-matching event branches", () => {
        const view = new UebungsleitungView();
        view.renderTeilnehmerListe(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { teilnehmerListe: [], nachrichten: {}, loesungswoerter: {}, loesungsStaerken: {} } as any,
            {},
            false
        );
        expect(document.getElementById("uebungsleitungTeilnehmer")?.textContent).toContain("Keine Teilnehmer vorhanden");

        view.renderNachrichtenListe({
            nachrichten: [],
            nachrichtenStatus: {},
            hideAbgesetzt: false,
            senderFilter: "",
            empfaengerFilter: "",
            textFilter: ""
        });
        expect(document.getElementById("uebungsleitungNachrichten")?.textContent).toContain("Keine Nachrichten vorhanden");

        view.renderNachrichtenListe({
            nachrichten: [{ nr: 1, sender: "A", empfaenger: ["B"], text: "x" }],
            nachrichtenStatus: {},
            hideAbgesetzt: false,
            senderFilter: "",
            empfaengerFilter: "",
            textFilter: ""
        });
        view.updateHeatmap([]);
        expect(document.getElementById("nachrichtenHeatmapChart")?.textContent).toContain("Noch keine Daten");
        view.updateTeilnehmerTimeline([]);
        expect(document.getElementById("nachrichtenTeilnehmerTimeline")?.textContent).toContain("Noch keine Daten");

        view.bindTeilnehmerEvents({
            onAnmelden: vi.fn(),
            onLoesungswort: vi.fn(),
            onStaerke: vi.fn(),
            onNotiz: vi.fn(),
            onToggleDetails: vi.fn(),
            onDownloadDebrief: vi.fn()
        });
        const container = document.getElementById("uebungsleitungTeilnehmer") as HTMLElement;
        container.dispatchEvent(new window.Event("click", { bubbles: true }));
        container.dispatchEvent(new window.Event("change", { bubbles: true }));
        container.dispatchEvent(new window.Event("input", { bubbles: true }));
    });

    it("filters message rows and handles timeline with no points", () => {
        const view = new UebungsleitungView();
        view.renderNachrichtenListe({
            nachrichten: [
                { nr: 1, sender: "A", empfaenger: ["B"], text: "Alpha" },
                { nr: 2, sender: "C", empfaenger: ["D"], text: "Bravo" }
            ],
            nachrichtenStatus: { "A__1": { abgesetztUm: "2026-01-01T00:00:00Z" } },
            hideAbgesetzt: true,
            senderFilter: "A",
            empfaengerFilter: "B",
            textFilter: "zzz"
        });
        const html = document.getElementById("uebungsleitungNachrichten")?.innerHTML ?? "";
        expect(html).toContain("tbody");

        view.updateTeilnehmerTimeline([
            { teilnehmer: "A", events: [] },
            { teilnehmer: "B", events: [] }
        ]);
        expect(document.getElementById("nachrichtenTeilnehmerTimeline")?.textContent).toContain("Noch keine Daten");
    });

    it("handles update methods when nodes are missing", () => {
        const view = new UebungsleitungView();
        document.getElementById("nachrichtenProgressBar")?.remove();
        document.getElementById("nachrichtenProgressLabel")?.remove();
        document.getElementById("nachrichtenEtaLabel")?.remove();
        document.getElementById("nachrichtenTempoLabel")?.remove();
        document.getElementById("nachrichtenLoadLabel")?.remove();
        document.getElementById("nachrichtenHeatmapLabel")?.remove();
        document.getElementById("nachrichtenHeatmapChart")?.remove();
        document.getElementById("nachrichtenTeilnehmerTimeline")?.remove();
        view.updateProgress(1, 1, "ETA");
        view.updateOperationalStats("t", "l", "h");
        view.updateHeatmap([{ bucket: Date.now(), count: 1 }]);
        view.updateTeilnehmerTimeline([{ teilnehmer: "A", events: [{ ts: Date.now(), type: "S", nr: 1 }] }]);
        expect(true).toBe(true);
    });

    it("covers render guards and branchy event paths", () => {
        const view = new UebungsleitungView();
        document.getElementById("uebungsleitungMeta")?.remove();
        document.getElementById("uebungsleitungTeilnehmer")?.remove();
        document.getElementById("uebungsleitungNachrichten")?.remove();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderMeta({} as any, "u");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderTeilnehmerListe({ teilnehmerListe: ["A"], nachrichten: {} } as any, {}, false);
        view.renderNachrichtenListe({
            nachrichten: [{ nr: 1, sender: "A", empfaenger: ["B"], text: "x" }],
            nachrichtenStatus: {},
            hideAbgesetzt: false,
            senderFilter: "",
            empfaengerFilter: "",
            textFilter: ""
        });
        view.bindMetaEvents(vi.fn(), vi.fn());
        view.bindTeilnehmerEvents({
            onAnmelden: vi.fn(),
            onLoesungswort: vi.fn(),
            onStaerke: vi.fn(),
            onNotiz: vi.fn(),
            onToggleDetails: vi.fn(),
            onDownloadDebrief: vi.fn()
        });
        view.bindNachrichtenEvents({
            onAbgesetzt: vi.fn(),
            onReset: vi.fn(),
            onNotiz: vi.fn(),
            onFilterSender: vi.fn(),
            onFilterEmpfaenger: vi.fn(),
            onToggleHide: vi.fn(),
            onFilterText: vi.fn()
        });
        expect(true).toBe(true);
    });

    it("renders participants without optional columns and timeline without existing chart", () => {
        const view = new UebungsleitungView();
        document.body.innerHTML += "<div id=\"nachrichtenTeilnehmerTimeline\"></div>";
        view.renderTeilnehmerListe(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { teilnehmerListe: ["A"], nachrichten: {}, loesungswoerter: {}, loesungsStaerken: {} } as any,
            { A: { notizen: "n" } },
            false
        );
        expect(document.getElementById("uebungsleitungTeilnehmer")?.innerHTML).not.toContain("Lösungswort");

        getChart.mockReturnValueOnce(undefined);
        view.updateTeilnehmerTimeline([
            { teilnehmer: "A", events: [{ ts: new Date("2026-02-15T10:02:00Z").getTime(), type: "E", nr: 2 }] }
        ]);
        expect(document.getElementById("nachrichtenTeilnehmerTimeline")?.innerHTML ?? "").toContain("nachrichtenTimelineChart");
    });

    it("covers participant columns combinations and detail rendering branches", () => {
        const view = new UebungsleitungView();
        // only loesungswort column
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderTeilnehmerListe({ teilnehmerListe: ["A"], loesungswoerter: { A: "W" }, loesungsStaerken: {}, nachrichten: {} } as any, {}, false);
        expect(document.getElementById("uebungsleitungTeilnehmer")?.innerHTML).toContain("Lösungswort");

        // only staerke column without details content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderTeilnehmerListe({ teilnehmerListe: ["A"], loesungswoerter: {}, loesungsStaerken: { A: "1/1/1/3" }, nachrichten: {} } as any, {}, true);
        expect(document.getElementById("uebungsleitungTeilnehmer")?.innerHTML).toContain("Stärke");
    });

    it("covers nachrichten event ignore paths and progress total zero", () => {
        const view = new UebungsleitungView();
        const cb = {
            onAbgesetzt: vi.fn(),
            onReset: vi.fn(),
            onNotiz: vi.fn(),
            onFilterSender: vi.fn(),
            onFilterEmpfaenger: vi.fn(),
            onToggleHide: vi.fn(),
            onFilterText: vi.fn()
        };
        view.renderNachrichtenListe({
            nachrichten: [{ nr: 1, sender: "A", empfaenger: ["B"], text: "txt" }],
            nachrichtenStatus: {},
            hideAbgesetzt: false,
            senderFilter: "",
            empfaengerFilter: "",
            textFilter: ""
        });
        view.bindNachrichtenEvents({
            onAbgesetzt: cb.onAbgesetzt,
            onReset: cb.onReset,
            onNotiz: cb.onNotiz,
            onFilterSender: cb.onFilterSender,
            onFilterEmpfaenger: cb.onFilterEmpfaenger,
            onToggleHide: cb.onToggleHide,
            onFilterText: cb.onFilterText
        });

        const container = document.getElementById("uebungsleitungNachrichten") as HTMLElement;
        container.dispatchEvent(new window.Event("click", { bubbles: true }));
        // unknown button action
        const btn = document.createElement("button");
        btn.dataset["action"] = "noop";
        container.appendChild(btn);
        btn.click();

        // unknown change target
        const input = document.createElement("input");
        input.id = "x";
        container.appendChild(input);
        input.dispatchEvent(new window.Event("change", { bubbles: true }));

        // note input without sender
        const note = document.createElement("textarea");
        note.className = "nachricht-notiz";
        note.dataset["nr"] = "1";
        container.appendChild(note);
        note.dispatchEvent(new window.Event("input", { bubbles: true }));

        expect(cb.onAbgesetzt).not.toHaveBeenCalled();
        expect(cb.onReset).not.toHaveBeenCalled();
        view.updateProgress(0, 0, "ETA: -");
        expect((document.getElementById("nachrichtenProgressBar") as HTMLElement).style.width).toBe("0%");
    });

    it("covers timeline tooltip callback and missing canvas branch", () => {
        const view = new UebungsleitungView();
        document.body.innerHTML += "<div id=\"nachrichtenTeilnehmerTimeline\"></div>";
        getChart.mockReturnValueOnce(undefined);
        view.updateTeilnehmerTimeline([
            {
                teilnehmer: "A",
                events: [{ ts: new Date("2026-02-15T10:02:00Z").getTime(), type: "S", nr: 2 }]
            }
        ]);
        const { label, xTick, yTick } = timelineCallbacks(chartCtor.mock.calls.at(-1)?.[1]);
        expect(label({ raw: { x: new Date("2026-02-15T10:02:00Z").getTime(), y: 0, kind: "S", nr: 2 } })).toContain("A");
        expect(label({ raw: null })).toBe("");

        expect(xTick(new Date("2026-02-15T10:03:00Z").getTime())).toContain(":");
        expect(yTick(0)).toBe("A");
        expect(yTick(99)).toBe("");

        // missing canvas branch
        const oldGet = document.getElementById.bind(document);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).getElementById = (id: string) => (id === "nachrichtenTimelineChart" ? null : oldGet(id));
        view.updateTeilnehmerTimeline([
            { teilnehmer: "A", events: [{ ts: Date.now(), type: "E", nr: 1 }] }
        ]);
    });

    it("covers bind guards when containers are missing", () => {
        const view = new UebungsleitungView();
        document.getElementById("uebungsleitungNachrichten")?.remove();
        document.getElementById("uebungsleitungTeilnehmer")?.remove();
        document.getElementById("uebungsleitungMeta")?.remove();
        view.bindNachrichtenEvents({
            onAbgesetzt: vi.fn(),
            onReset: vi.fn(),
            onNotiz: vi.fn(),
            onFilterSender: vi.fn(),
            onFilterEmpfaenger: vi.fn(),
            onToggleHide: vi.fn(),
            onFilterText: vi.fn()
        });
        view.bindTeilnehmerEvents({
            onAnmelden: vi.fn(),
            onLoesungswort: vi.fn(),
            onStaerke: vi.fn(),
            onNotiz: vi.fn(),
            onToggleDetails: vi.fn(),
            onDownloadDebrief: vi.fn()
        });
        view.bindMetaEvents(vi.fn(), vi.fn());
        expect(true).toBe(true);
    });

});

type TimelineRaw = { x: number; y: number; kind: string; nr: number } | null;
type TimelineChartConfig = {
    options: {
        plugins: { tooltip: { callbacks: { label: (ctx: { raw: TimelineRaw }) => string } } };
        scales: { x: { ticks: { callback: (v: number) => string } }; y: { ticks: { callback: (v: number) => string } } };
    };
};

/** Die Rückrufe, die die Timeline dem Chart mitgibt – für Tooltip und Achsen. */
function timelineCallbacks(cfg: unknown) {
    const { options } = cfg as TimelineChartConfig;
    return {
        label: options.plugins.tooltip.callbacks.label,
        xTick: options.scales.x.ticks.callback,
        yTick: options.scales.y.ticks.callback
    };
}

describe("UebungsleitungView – Live-Status", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setDom();
    });

    {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uebung = (teilnehmerListe: string[]): any => ({
            teilnehmerListe,
            nachrichten: {},
            loesungswoerter: {},
            loesungsStaerken: {},
            teilnehmerIds: {},
            id: "u1",
            uebungCode: "AB12CD"
        });

        it("zeigt fehlende Live-Meldungen als solche an", () => {
            const view = new UebungsleitungView();
            view.renderTeilnehmerListe(uebung(["A"]), {}, false);

            const html = document.getElementById("uebungsleitungTeilnehmer")?.textContent ?? "";
            expect(html).toContain("keine Meldung");
        });

        it("zeigt Fortschritt und letzte Meldung je Teilnehmer", () => {
            const view = new UebungsleitungView();
            view.renderTeilnehmerListe(uebung(["A"]), {}, false, { fortschritt: {
                A: {
                    teilnehmer: "A",
                    gemeldet: 2,
                    bestaetigt: 0,
                    erledigt: 2,
                    gesamt: 4,
                    online: true,
                    letzteMeldungUm: "2026-07-26T10:05:00.000Z"
                }
            } });

            const container = document.getElementById("uebungsleitungTeilnehmer");
            expect(container?.textContent).toContain("2");
            expect(container?.textContent).toContain("zuletzt");
            expect(container?.innerHTML).toContain("scaleX(0.5)");
        });

        it("weist Teilnehmer ohne Meldung als noch nicht übertragen aus", () => {
            const view = new UebungsleitungView();
            view.renderTeilnehmerListe(uebung(["A"]), {}, false, { fortschritt: {
                A: { teilnehmer: "A", gemeldet: 0, bestaetigt: 0, erledigt: 0, gesamt: 0, online: true }
            } });

            expect(document.getElementById("uebungsleitungTeilnehmer")?.textContent)
                .toContain("noch nichts abgesetzt");
        });

        it("markiert Nachzügler gegenüber dem Median der Gruppe", () => {
            const view = new UebungsleitungView();
            view.renderTeilnehmerListe(uebung(["A", "B", "C"]), {}, false, { fortschritt: {
                A: { teilnehmer: "A", gemeldet: 8, bestaetigt: 0, erledigt: 8, gesamt: 10, online: true },
                B: { teilnehmer: "B", gemeldet: 8, bestaetigt: 0, erledigt: 8, gesamt: 10, online: true },
                C: { teilnehmer: "C", gemeldet: 1, bestaetigt: 0, erledigt: 1, gesamt: 10, online: true }
            } });

            const container = document.getElementById("uebungsleitungTeilnehmer");
            expect(container?.textContent).toContain("Nachzügler");
            expect(container?.querySelectorAll("tr[data-nachzuegler]")).toHaveLength(1);
        });

        it("markiert niemanden, solange zu wenige Teilnehmer melden", () => {
            const view = new UebungsleitungView();
            view.renderTeilnehmerListe(uebung(["A", "B"]), {}, false, { fortschritt: {
                A: { teilnehmer: "A", gemeldet: 8, bestaetigt: 0, erledigt: 8, gesamt: 10, online: true },
                B: { teilnehmer: "B", gemeldet: 0, bestaetigt: 0, erledigt: 0, gesamt: 10, online: true }
            } });

            expect(document.getElementById("uebungsleitungTeilnehmer")?.textContent)
                .not.toContain("Nachzügler");
        });

        it("markiert erst beim Anstieg eine neue Meldung aus dem Netz", () => {
            const view = new UebungsleitungView();
            const stand = (gemeldet: number) => ({
                A: { teilnehmer: "A", gemeldet, bestaetigt: 0, erledigt: gemeldet, gesamt: 4, online: true }
            });
            const zeile = () => document.querySelector("#uebungsleitungTeilnehmer tbody tr");

            view.renderTeilnehmerListe(uebung(["A"]), {}, false, { fortschritt: stand(1) });
            expect(zeile()?.className).not.toContain("ist-gemeldet");

            view.renderTeilnehmerListe(uebung(["A"]), {}, false, { fortschritt: stand(1) });
            expect(zeile()?.className).not.toContain("ist-gemeldet");

            view.renderTeilnehmerListe(uebung(["A"]), {}, false, { fortschritt: stand(2) });
            expect(zeile()?.className).toContain("ist-gemeldet");
        });

        it("lässt den Fortschrittsbalken vom alten auf den neuen Wert laufen", () => {
            const rahmen: FrameRequestCallback[] = [];
            vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
                rahmen.push(cb);
                return rahmen.length;
            });
            try {
                const view = new UebungsleitungView();
                const stand = (gemeldet: number) => ({
                    A: { teilnehmer: "A", gemeldet, bestaetigt: 0, erledigt: gemeldet, gesamt: 4, online: true }
                });
                const balken = () => document.querySelector("#uebungsleitungTeilnehmer .progress-bar") as HTMLElement;

                view.renderTeilnehmerListe(uebung(["A"]), {}, false, { fortschritt: stand(1) });
                rahmen.splice(0).forEach(cb => cb(0));
                expect(balken().style.transform).toBe("scaleX(0.25)");

                view.renderTeilnehmerListe(uebung(["A"]), {}, false, { fortschritt: stand(3) });
                // Vor dem naechsten Frame steht der Balken noch auf dem alten Wert.
                expect(balken().style.transform).toBe("scaleX(0.25)");
                rahmen.splice(0).forEach(cb => cb(0));
                expect(balken().style.transform).toBe("scaleX(0.75)");
            } finally {
                vi.unstubAllGlobals();
            }
        });

        it("weist unbestätigte Teilnehmer-Meldungen im Fortschritt aus", () => {
            const view = new UebungsleitungView();
            view.updateProgress(10, 6, "ETA: 10:30", 2);

            expect(document.getElementById("nachrichtenProgressLabel")?.textContent)
                .toBe("6 / 10 (2 nur gemeldet)");

            view.updateProgress(10, 6, "ETA: 10:30");
            expect(document.getElementById("nachrichtenProgressLabel")?.textContent).toBe("6 / 10");
        });

        it("spiegelt den Sync-Zustand im Badge", () => {
            const view = new UebungsleitungView();
            const badge = document.getElementById("uebungsleitungLiveSyncBadge");

            view.updateLiveSyncState("live");
            expect(badge?.textContent).toContain("live");
            expect(badge?.className).toContain("bg-success");

            view.updateLiveSyncState("offline", 3);
            expect(badge?.textContent).toContain("offline – wird nachgereicht (3 offen)");
            expect(badge?.className).toContain("bg-warning");

            view.updateLiveSyncState("fehler");
            expect(badge?.textContent).toContain("wird nicht übertragen");
            expect(badge?.className).toContain("bg-danger");

            view.updateLiveSyncState("aus");
            expect(badge?.textContent).toContain("aus");
        });

        it("zeigt vom Teilnehmer gemeldete, aber unbestätigte Nachrichten an", () => {
            const view = new UebungsleitungView();
            view.renderNachrichtenListe({
                nachrichten: [{ nr: 1, sender: "A", empfaenger: ["B"], text: "Text" }],
                nachrichtenStatus: {
                    "A__1": { gemeldetUm: "2026-07-26T10:00:00.000Z", erledigtUm: "2026-07-26T10:00:00.000Z" }
                },
                hideAbgesetzt: false,
                senderFilter: "",
                empfaengerFilter: "",
                textFilter: ""
            });

            const html = document.getElementById("uebungsleitungNachrichten")?.textContent ?? "";
            expect(html).toContain("gemeldet");
            expect(html).toContain("Teilnehmer:");
        });
    }
});

describe("UebungsleitungView – Cockpit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setDom();
    });

    it("blendet das Cockpit ein und aus", () => {
        const view = new UebungsleitungView();
        const cockpit = document.getElementById("uebungsleitungCockpit");

        view.setCockpitVisible(true);
        expect(cockpit?.classList.contains("d-none")).toBe(false);

        view.setCockpitVisible(false);
        expect(cockpit?.classList.contains("d-none")).toBe(true);
    });

    it("füllt die Kacheln inklusive Plan-Badge", () => {
        const view = new UebungsleitungView();
        view.updateCockpit({
            uhrzeit: "12:00:00",
            laufzeitMs: 83_000,
            ist: 3,
            gesamt: 20,
            soll: 5,
            basisHinweis: "Basis 11:58 von der Übungsleitung gesetzt."
        });

        expect(document.getElementById("cockpitUhrzeit")?.textContent).toBe("12:00:00");
        expect(document.getElementById("cockpitLaufzeit")?.textContent).toBe("01:23");
        expect(document.getElementById("cockpitXZeit")?.textContent).toBe("X + 1 min");
        expect(document.getElementById("cockpitFortschritt")?.textContent).toBe("3/20");
        const badge = document.getElementById("cockpitPlanBadge");
        expect(badge?.textContent).toBe("2 hinter Plan");
        expect(badge?.className).toContain("bg-warning");
        expect(document.getElementById("cockpitBasisHinweis")?.textContent).toContain("11:58");
    });

    it("zeigt ohne Basis Striche und ein neutrales Badge", () => {
        const view = new UebungsleitungView();
        view.updateCockpit({
            uhrzeit: "12:00:00",
            laufzeitMs: null,
            ist: 0,
            gesamt: 20,
            soll: null,
            basisHinweis: ""
        });

        expect(document.getElementById("cockpitLaufzeit")?.textContent).toBe("–");
        expect(document.getElementById("cockpitXZeit")?.textContent).toBe("–");
        const badge = document.getElementById("cockpitPlanBadge");
        expect(badge?.textContent).toBe("–");
        expect(badge?.className).toContain("bg-secondary");
    });

    it("meldet „im Plan“ bei erfülltem Soll", () => {
        const view = new UebungsleitungView();
        view.updateCockpit({
            uhrzeit: "12:00:00",
            laufzeitMs: 60_000,
            ist: 5,
            gesamt: 20,
            soll: 5,
            basisHinweis: ""
        });

        const badge = document.getElementById("cockpitPlanBadge");
        expect(badge?.textContent).toBe("im Plan");
        expect(badge?.className).toContain("bg-success");
    });

    it("bindet Basis-Eingabe und „Jetzt starten“", () => {
        const view = new UebungsleitungView();
        const onBasisChange = vi.fn();
        const onJetzt = vi.fn();
        view.bindCockpitEvents(onBasisChange, onJetzt);

        const input = document.getElementById("cockpitXZeitBasisInput") as HTMLInputElement;
        input.value = "14:30";
        input.dispatchEvent(new window.Event("change"));
        expect(onBasisChange).toHaveBeenCalledWith("14:30");

        (document.getElementById("btn-cockpit-xzeit-jetzt") as HTMLButtonElement).click();
        expect(onJetzt).toHaveBeenCalled();

        view.setCockpitBasisInputValue("15:00");
        expect(input.value).toBe("15:00");
    });
});

describe("UebungsleitungView – THW-Review", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setDom();
    });

    const basisOptionen = {
        hideAbgesetzt: false,
        senderFilter: "",
        empfaengerFilter: "",
        textFilter: ""
    };
    const zeile = (planNr: number) =>
        document.querySelector(`#uebungsleitungNachrichten tr[data-plan-nr="${planNr}"]`) as HTMLElement;

    it("trennt Aktion und Rücknahme räumlich und unterscheidet Aktion von Zustand", () => {
        const view = new UebungsleitungView();
        view.renderNachrichtenListe({
            ...basisOptionen,
            nachrichten: [
                { nr: 1, sender: "A", empfaenger: ["B"], text: "offen", planNr: 1 },
                { nr: 2, sender: "A", empfaenger: ["B"], text: "erledigt", planNr: 2 }
            ],
            nachrichtenStatus: { "A__2": { abgesetztUm: "2026-10-04T17:12:00.000Z", erledigtUm: "2026-10-04T17:12:00.000Z" } }
        });

        const offen = zeile(1);
        const aktion = offen.querySelector("button[data-action='abgesetzt']") as HTMLButtonElement;
        expect(aktion.textContent).toBe("Als abgesetzt markieren");
        expect(aktion.textContent).not.toContain("✓");
        expect(aktion.className).not.toContain("success");
        // Die Aktion steht in der Statusspalte (2.), die Rücknahme in der letzten.
        expect(aktion.closest("td")?.cellIndex).toBe(1);

        const erledigt = zeile(2);
        expect(erledigt.querySelector("button[data-action='abgesetzt']")).toBeNull();
        expect(erledigt.cells[1]?.querySelector("button")).toBeNull();
        expect(erledigt.cells[1]?.textContent).toContain("✓ abgesetzt");
        const reset = erledigt.querySelector("button[data-action='reset']") as HTMLButtonElement;
        expect(reset.textContent).toBe("zurücknehmen");
        expect(reset.closest("td")?.cellIndex).toBe(erledigt.cells.length - 1);
    });

    it("sperrt die Rücknahme direkt nach dem Markieren", () => {
        const view = new UebungsleitungView();
        const onReset = vi.fn();
        view.renderNachrichtenListe({
            ...basisOptionen,
            nachrichten: [{ nr: 1, sender: "A", empfaenger: ["B"], text: "x", planNr: 1 }],
            nachrichtenStatus: { "A__1": { abgesetztUm: "2026-10-04T17:12:00.000Z" } },
            ruecknahmeGesperrt: new Set(["A__1"])
        });
        view.bindNachrichtenEvents({
            onAbgesetzt: vi.fn(), onReset, onNotiz: vi.fn(), onFilterSender: vi.fn(),
            onFilterEmpfaenger: vi.fn(), onToggleHide: vi.fn(), onFilterText: vi.fn()
        });

        const reset = zeile(1).querySelector("button[data-action='reset']") as HTMLButtonElement;
        expect(reset.disabled).toBe(true);
        reset.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
        expect(onReset).not.toHaveBeenCalled();
    });

    it("zeigt eindeutige Plan-Nummer, Soll-Uhrzeit und Fälligkeit als Text", () => {
        const view = new UebungsleitungView();
        view.renderNachrichtenListe({
            ...basisOptionen,
            nachrichten: [
                { nr: 1, sender: "A", empfaenger: ["B"], text: "a", xZeitSlot: 3, planNr: 1 },
                { nr: 1, sender: "B", empfaenger: ["A"], text: "b", xZeitSlot: 10, planNr: 2 },
                { nr: 2, sender: "A", empfaenger: ["B"], text: "c", xZeitSlot: 15, planNr: 3 }
            ],
            nachrichtenStatus: {},
            sollUhrzeit: { "A__1": "09:03", "B__1": "09:10", "A__2": "09:15" },
            faelligkeit: {
                "A__1": { zustand: "ueberfaellig", sollMs: 0, minuten: 7 },
                "B__1": { zustand: "faellig", sollMs: 0, minuten: 0 },
                "A__2": { zustand: "spaeter", sollMs: 0, minuten: 5 }
            }
        });

        expect(zeile(1).dataset["planZustand"]).toBe("ueberfaellig");
        expect(zeile(1).className).toContain("plan-zeile--ueberfaellig");
        expect(zeile(1).textContent).toContain("überfällig 7 min");
        expect(zeile(1).textContent).toContain("09:03");
        expect(zeile(1).textContent).toContain("X+3");
        expect(zeile(2).textContent).toContain("jetzt fällig");
        expect(zeile(3).textContent).toContain("in 5 min");
        expect(zeile(2).cells[0]?.textContent).toContain("2");
        expect(zeile(2).cells[0]?.textContent).toContain("Abs.-Nr. 1");
    });

    it("klappt Notizen erst auf Wunsch auf und lässt Zeiten nachtragen", () => {
        const view = new UebungsleitungView();
        const onNotiz = vi.fn();
        const onZeitNachtragen = vi.fn();
        view.renderNachrichtenListe({
            ...basisOptionen,
            nachrichten: [
                { nr: 1, sender: "A", empfaenger: ["B"], text: "a", planNr: 1 },
                { nr: 2, sender: "A", empfaenger: ["B"], text: "b", planNr: 2 }
            ],
            nachrichtenStatus: { "A__2": { notiz: "steht schon" } }
        });
        view.bindNachrichtenEvents({
            onAbgesetzt: vi.fn(), onReset: vi.fn(), onZeitNachtragen, onNotiz, onFilterSender: vi.fn(),
            onFilterEmpfaenger: vi.fn(), onToggleHide: vi.fn(), onFilterText: vi.fn()
        });

        expect(zeile(1).querySelector("textarea")).toBeNull();
        expect(zeile(2).querySelector("textarea")?.value).toBe("steht schon");
        (zeile(1).querySelector("button[data-action='notiz-oeffnen']") as HTMLButtonElement).click();
        const textarea = zeile(1).querySelector("textarea.nachricht-notiz") as HTMLTextAreaElement;
        textarea.value = "neu";
        textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
        expect(onNotiz).toHaveBeenCalledWith("A", 1, "neu");

        (zeile(1).querySelector("button[data-action='zeit-bearbeiten']") as HTMLButtonElement).click();
        const input = zeile(1).querySelector("input.ul-zeit-input") as HTMLInputElement;
        expect(input).toBeTruthy();
        // Die aufgeklappte Notiz bleibt nach dem Neuaufbau offen.
        expect(zeile(1).querySelector("textarea.nachricht-notiz")).toBeTruthy();
        input.value = "19:05";
        (zeile(1).querySelector("button[data-action='zeit-speichern']") as HTMLButtonElement).click();
        expect(onZeitNachtragen).toHaveBeenCalledWith("A", 1, "19:05");

        (zeile(2).querySelector("button[data-action='zeit-bearbeiten']") as HTMLButtonElement).click();
        const zweite = zeile(2).querySelector("input.ul-zeit-input") as HTMLInputElement;
        zweite.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        expect(zeile(2).querySelector("input.ul-zeit-input")).toBeNull();
    });

    it("unterscheidet „gemeldet (TN)“ vom bestätigten Zustand", () => {
        const view = new UebungsleitungView();
        view.renderNachrichtenListe({
            ...basisOptionen,
            nachrichten: [{ nr: 1, sender: "A", empfaenger: ["B"], text: "x", planNr: 1 }],
            nachrichtenStatus: { "A__1": { gemeldetUm: "2026-10-04T17:11:00.000Z", erledigtUm: "2026-10-04T17:11:00.000Z" } }
        });
        const chip = zeile(1).querySelector(".status-chip") as HTMLElement;
        expect(chip.className).toContain("status-chip--gemeldet");
        expect(chip.className).not.toContain("status-chip--ok");
        expect(zeile(1).className).toContain("status-gemeldet-row");
        expect(zeile(1).querySelector("button[data-action='abgesetzt']")?.textContent).toBe("Bestätigen");
    });

    it("zeigt die Lage mit offen je Teilnehmer, nächsten Nachrichten und Sprüngen", () => {
        const view = new UebungsleitungView();
        const onGemeldeteBestaetigen = vi.fn();
        const onToggleHide = vi.fn();
        view.renderNachrichtenListe({
            ...basisOptionen,
            nachrichten: [{ nr: 1, sender: "A", empfaenger: ["B"], text: "x", planNr: 4 }],
            nachrichtenStatus: {},
            faelligkeit: { "A__1": { zustand: "ueberfaellig", sollMs: 0, minuten: 2 } }
        });
        const scroll = vi.fn();
        zeile(4).scrollIntoView = scroll;
        view.bindLageEvents({ onGemeldeteBestaetigen, onToggleHide });
        view.renderLage({
            teilnehmer: [
                { teilnehmer: "A", offen: 3, gesamt: 5, nurGemeldet: 1 },
                { teilnehmer: "B", offen: 0, gesamt: 2, nurGemeldet: 0 }
            ],
            naechste: [{ planNr: 4, sender: "A", empfaenger: ["B"], faelligkeit: { zustand: "ueberfaellig", sollMs: new Date(2026, 9, 4, 9, 3).getTime(), minuten: 2 } }],
            zuBestaetigen: 1,
            hideAbgesetzt: false,
            ueberfaellig: 1
        });

        const lage = document.getElementById("uebungsleitungLageBody") as HTMLElement;
        expect(lage.textContent).toContain("A: 3 offen, 1 zu bestätigen");
        expect(lage.textContent).toContain("B: fertig");
        expect(lage.textContent).toContain("Nr. 4 · A → B · 09:03 · überfällig 2 min");

        (lage.querySelector("[data-action='zu-plan-nr']") as HTMLButtonElement).click();
        expect(scroll).toHaveBeenCalled();
        (lage.querySelector("[data-action='zu-ueberfaellig']") as HTMLButtonElement).click();
        expect(scroll).toHaveBeenCalledTimes(2);
        (lage.querySelector("[data-action='gemeldete-bestaetigen']") as HTMLButtonElement).click();
        expect(onGemeldeteBestaetigen).toHaveBeenCalled();
        (lage.querySelector("[data-action='lage-hide']") as HTMLButtonElement).click();
        expect(onToggleHide).toHaveBeenCalledWith(true);
        const auswertung = document.getElementById("nachrichtenAuswertung") as HTMLElement;
        auswertung.scrollIntoView = vi.fn();
        (lage.querySelector("[data-action='zu-auswertung']") as HTMLButtonElement).click();
        expect(auswertung.scrollIntoView).toHaveBeenCalled();
    });

    it("bietet nach einer Rücknahme ein Rückgängig an, das von selbst verschwindet", () => {
        vi.useFakeTimers();
        const view = new UebungsleitungView();
        const onUndo = vi.fn();
        const leiste = document.getElementById("uebungsleitungUndo") as HTMLElement;

        view.zeigeRueckgaengig("„Abgesetzt“ zurückgenommen.", onUndo);
        expect(leiste.classList.contains("d-none")).toBe(false);
        (leiste.querySelector("[data-action='undo']") as HTMLButtonElement).click();
        expect(onUndo).toHaveBeenCalledTimes(1);
        expect(leiste.classList.contains("d-none")).toBe(true);

        view.zeigeRueckgaengig("noch einmal", onUndo);
        vi.advanceTimersByTime(RUECKGAENGIG_MS + 10);
        expect(leiste.classList.contains("d-none")).toBe(true);
        expect(onUndo).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it("zeigt bei falscher Übungs-ID eine Meldung mit Weiter-Weg statt leerer Karten", () => {
        document.body.innerHTML = `
          <div id="uebungsleitungArea">
            <div class="card"><div id="uebungsleitungMeta"></div></div>
            <div class="card" id="andere"><div id="uebungsleitungTeilnehmer"></div></div>
          </div>`;
        const view = new UebungsleitungView();
        view.showLadefehler("Übung nicht gefunden.", "abc<1>");

        const meta = document.getElementById("uebungsleitungMeta") as HTMLElement;
        expect(meta.textContent).toContain("Übung nicht gefunden.");
        expect(meta.innerHTML).toContain("abc&lt;1&gt;");
        expect(meta.querySelector("a[href='#/admin']")).toBeTruthy();
        expect(document.getElementById("andere")?.classList.contains("d-none")).toBe(true);
    });

    it("beschriftet den Rücksetz-Knopf nach seiner Reichweite und setzt ihn von den Exporten ab", () => {
        const view = new UebungsleitungView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderMeta({ name: "Ü", datum: new Date(), teilnehmerListe: [], nachrichten: {} } as any, "u1");
        const btn = document.getElementById("resetUebungsleitungLocalData") as HTMLButtonElement;
        expect(document.getElementById("uebungsleitungMeta")?.contains(btn)).toBe(false);

        view.setResetModus(true);
        expect(btn.textContent).toContain("für alle");
        expect(btn.textContent).not.toContain("Lokale");
        view.setResetModus(false);
        expect(btn.textContent).toContain("auf diesem Gerät");
    });

    it("bietet den geplanten Beginn als Vorschlag an und springt vom Plan-Badge", () => {
        const view = new UebungsleitungView();
        const onVorschlag = vi.fn();
        const onBadge = vi.fn();
        view.bindCockpitEvents(vi.fn(), vi.fn(), onVorschlag, onBadge);
        view.updateCockpit({
            uhrzeit: "08:50:00", laufzeitMs: null, ist: 0, gesamt: 3, soll: null,
            basisHinweis: "Geplanter Übungsbeginn", vorschlag: "09:00", abweichungen: ["Kater 10 (08:55)"]
        });

        const btn = document.getElementById("btn-cockpit-xzeit-vorschlag") as HTMLButtonElement;
        expect(btn.classList.contains("d-none")).toBe(false);
        expect(btn.textContent).toBe("09:00 übernehmen");
        btn.click();
        expect(onVorschlag).toHaveBeenCalledWith("09:00");
        expect(document.getElementById("cockpitAbweichungen")?.textContent).toContain("Kater 10 (08:55)");

        (document.getElementById("cockpitPlanBadge") as HTMLElement).click();
        expect(onBadge).toHaveBeenCalled();

        view.updateCockpit({ uhrzeit: "", laufzeitMs: null, ist: 0, gesamt: 3, soll: null, basisHinweis: "" });
        expect(btn.classList.contains("d-none")).toBe(true);
    });

    it("stellt die beübte Stelle getrennt und ohne Code oder Anmeldung dar", () => {
        const view = new UebungsleitungView();
        view.renderTeilnehmerListe({
            teilnehmerListe: ["EA 1", "Stelle"],
            teilnehmerIds: { AAAA: "Stelle", BBBB: "EA 1" },
            uebungCode: "ABCDEF",
            nachrichten: { "EA 1": [{ id: 1, empfaenger: ["Stelle"], nachricht: "x" }] },
            fuehrungsstelle: { slug: "s", beuebteStelle: "Stelle", uebergeordnet: "Stab", unterstellt: ["EA 1"] }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any, {}, false);

        const zeilen = document.querySelectorAll("#uebungsleitungTeilnehmer tbody tr");
        const beuebt = zeilen[0] as HTMLElement;
        expect(beuebt.dataset["beuebt"]).toBe("1");
        expect(beuebt.textContent).toContain("beübte Stelle");
        expect(beuebt.textContent).toContain("empfängt 1 Einspielungen");
        expect(beuebt.textContent).not.toContain("AAAA");
        expect(beuebt.querySelector("[data-action='anmelden']")).toBeNull();
        expect(zeilen[1]?.textContent).toContain("BBBB");
    });

    it("koppelt die Anmeldeanzeige an den Funkspruch und bietet eine Rücknahme", () => {
        const view = new UebungsleitungView();
        const onAnmeldungZuruecknehmen = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uebung: any = { teilnehmerListe: ["A", "B", "C"], nachrichten: {} };
        view.renderTeilnehmerListe(uebung, {}, false, {
            anmeldung: {
                A: { angemeldetUm: "2026-10-04T17:01:00.000Z", quelle: "funkspruch" },
                B: { angemeldetUm: "2026-10-04T17:02:00.000Z", quelle: "teilnehmer" },
                C: {}
            }
        });
        view.bindTeilnehmerEvents({
            onAnmelden: vi.fn(), onAnmeldungZuruecknehmen, onLoesungswort: vi.fn(), onStaerke: vi.fn(),
            onNotiz: vi.fn(), onToggleDetails: vi.fn(), onDownloadDebrief: vi.fn()
        });
        const zeilen = document.querySelectorAll("#uebungsleitungTeilnehmer tbody tr");
        expect(zeilen[0]?.textContent).toContain("über Anmelde-Funkspruch");
        (zeilen[0]?.querySelector("[data-action='anmeldung-zuruecknehmen']") as HTMLButtonElement).click();
        expect(onAnmeldungZuruecknehmen).toHaveBeenCalledWith("A");
        expect(zeilen[1]?.textContent).toContain("vom Teilnehmer gemeldet");
        expect(zeilen[1]?.querySelector("[data-action='anmeldung-zuruecknehmen']")).toBeNull();
        expect(zeilen[2]?.querySelector("[data-action='anmelden']")?.textContent?.trim()).toBe("Anmeldung erhalten");
    });

    it("weist Teilnehmer- und Leitungsanteil aus und erkennt ein stilles Gerät", () => {
        const view = new UebungsleitungView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uebung: any = { teilnehmerListe: ["A", "B"], nachrichten: {} };
        const jetztMs = Date.parse("2026-10-04T17:30:00.000Z");
        view.renderTeilnehmerListe(uebung, {}, false, { fortschritt: {
            A: {
                teilnehmer: "A", gemeldet: 1, bestaetigt: 2, erledigt: 3, gesamt: 8, online: true,
                letzteMeldungUm: "2026-10-04T17:10:00.000Z", zuletztGesehenUm: "2026-10-04T17:10:00.000Z"
            },
            B: { teilnehmer: "B", gemeldet: 0, bestaetigt: 2, erledigt: 2, gesamt: 8, online: false, letzteMeldungUm: "2026-10-04T17:25:00.000Z" }
        }, jetztMs });

        const zeilen = document.querySelectorAll("#uebungsleitungTeilnehmer tbody tr");
        expect(zeilen[0]?.textContent).toContain("TN 1 · Leitung 2");
        expect(zeilen[0]?.textContent).toContain("seit 20 min nichts vom Gerät");
        // Ohne Gerät, aber von der Leitung abgehakt: Fortschritt statt „keine Meldung“.
        expect(zeilen[1]?.textContent).not.toContain("keine Meldung");
        expect(zeilen[1]?.textContent).toContain("kein Live-Gerät");
    });

    it("behält die seitliche Scrollposition der Tabelle beim Neuaufbau", () => {
        const view = new UebungsleitungView();
        const optionen = {
            ...basisOptionen,
            nachrichten: [{ nr: 1, sender: "A", empfaenger: ["B"], text: "x", planNr: 1 }],
            nachrichtenStatus: {}
        };
        view.renderNachrichtenListe(optionen);
        const tabelle = () => document.querySelector("#uebungsleitungNachrichten .table-responsive") as HTMLElement;
        tabelle().scrollLeft = 120;
        view.renderNachrichtenListe(optionen);
        expect(tabelle().scrollLeft).toBe(120);
    });
});
