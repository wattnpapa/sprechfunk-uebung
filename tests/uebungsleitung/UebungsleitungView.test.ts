import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

const { chartCtor, getChart, destroyChart } = vi.hoisted(() => ({
    chartCtor: vi.fn(),
    getChart: vi.fn(),
    destroyChart: vi.fn()
}));

vi.mock("chart.js/auto", () => {
    const FakeChart = function (...args: unknown[]) {
        chartCtor(...args);
    };
    (FakeChart as unknown as { getChart: typeof getChart }).getChart = getChart;
    return { Chart: FakeChart };
});

import { UebungsleitungView } from "../../src/uebungsleitung/UebungsleitungView";

const setDom = () => {
    const dom = new JSDOM(`
      <div id="uebungsleitungMeta"></div>
      <div id="uebungsleitungTeilnehmer"></div>
      <div id="uebungsleitungNachrichten"></div>
      <div id="nachrichtenProgressBar"></div>
      <div id="nachrichtenProgressLabel"></div>
      <div id="nachrichtenEtaLabel"></div>
      <div id="nachrichtenTempoLabel"></div>
      <div id="nachrichtenLoadLabel"></div>
      <div id="nachrichtenHeatmapLabel"></div>
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
                nachrichten: {},
                id: "u1"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            "<id>"
        );
        view.bindMetaEvents(onPdf, onReset);

        expect(document.getElementById("uebungsleitungMeta")?.innerHTML).toContain("&lt;b&gt;XSS&lt;/b&gt;");
        (document.getElementById("exportUebungsleitungPdf") as HTMLButtonElement).click();
        (document.getElementById("resetUebungsleitungLocalData") as HTMLButtonElement).click();
        expect(onPdf).toHaveBeenCalled();
        expect(onReset).toHaveBeenCalled();
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
            teilnehmerStellen: { Alpha: "Stelle 1" },
            loesungswoerter: { Alpha: "WORT" },
            loesungsStaerken: { Alpha: "1/2/3/6" },
            nachrichten: {
                Bravo: [{ empfaenger: ["Alpha"], staerken: [{ fuehrer: 1, unterfuehrer: 2, helfer: 3 }] }]
            }
        };

        view.renderTeilnehmerListe(uebung, {}, true);
        view.bindTeilnehmerEvents(onAnmelden, onLoesungswort, onStaerke, onNotiz, onToggleDetails, onDownloadDebrief);

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

    it("renders nachrichten table and triggers nachrichten callbacks", () => {
        const view = new UebungsleitungView();
        const onAbgesetzt = vi.fn();
        const onReset = vi.fn();
        const onNotiz = vi.fn();
        const onFilterSender = vi.fn();
        const onFilterEmpfaenger = vi.fn();
        const onToggleHide = vi.fn();
        const onFilterText = vi.fn();

        view.renderNachrichtenListe(
            [
                { nr: 1, sender: "A", empfaenger: ["B"], text: "hallo" },
                { nr: 2, sender: "C", empfaenger: ["D"], text: "welt" }
            ],
            {
                "A__1": { abgesetztUm: "2026-02-15T10:00:00Z", notiz: "n1" },
                "C__2": {}
            },
            false,
            "",
            "",
            ""
        );
        view.bindNachrichtenEvents(onAbgesetzt, onReset, onNotiz, onFilterSender, onFilterEmpfaenger, onToggleHide, onFilterText);

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
        view.renderNachrichtenListe([{ nr: 1, sender: "A", empfaenger: ["B"], text: "x" }], {}, false, "", "", "");
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

        view.renderNachrichtenListe([], {}, false, "", "", "");
        expect(document.getElementById("uebungsleitungNachrichten")?.textContent).toContain("Keine Nachrichten vorhanden");

        view.renderNachrichtenListe(
            [{ nr: 1, sender: "A", empfaenger: ["B"], text: "x" }],
            {},
            false,
            "",
            "",
            ""
        );
        view.updateHeatmap([]);
        expect(document.getElementById("nachrichtenHeatmapChart")?.textContent).toContain("Noch keine Daten");
        view.updateTeilnehmerTimeline([]);
        expect(document.getElementById("nachrichtenTeilnehmerTimeline")?.textContent).toContain("Noch keine Daten");

        view.bindTeilnehmerEvents(vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn());
        const container = document.getElementById("uebungsleitungTeilnehmer") as HTMLElement;
        container.dispatchEvent(new window.Event("click", { bubbles: true }));
        container.dispatchEvent(new window.Event("change", { bubbles: true }));
        container.dispatchEvent(new window.Event("input", { bubbles: true }));
    });

    it("filters message rows and handles timeline with no points", () => {
        const view = new UebungsleitungView();
        view.renderNachrichtenListe(
            [
                { nr: 1, sender: "A", empfaenger: ["B"], text: "Alpha" },
                { nr: 2, sender: "C", empfaenger: ["D"], text: "Bravo" }
            ],
            { "A__1": { abgesetztUm: "2026-01-01T00:00:00Z" } },
            true,
            "A",
            "B",
            "zzz"
        );
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
        view.renderNachrichtenListe([{ nr: 1, sender: "A", empfaenger: ["B"], text: "x" }], {}, false, "", "", "");
        view.bindMetaEvents(vi.fn(), vi.fn());
        view.bindTeilnehmerEvents(vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn());
        view.bindNachrichtenEvents(vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn());
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
        view.renderNachrichtenListe(
            [{ nr: 1, sender: "A", empfaenger: ["B"], text: "txt" }],
            {},
            false,
            "",
            "",
            ""
        );
        view.bindNachrichtenEvents(
            cb.onAbgesetzt,
            cb.onReset,
            cb.onNotiz,
            cb.onFilterSender,
            cb.onFilterEmpfaenger,
            cb.onToggleHide,
            cb.onFilterText
        );

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
        const cfg = chartCtor.mock.calls.at(-1)?.[1] as { options?: { plugins?: { tooltip?: { callbacks?: { label?: (ctx: { raw: { x: number; y: number; kind: string; nr: number } }) => string } } } } };
        const label = cfg?.options?.plugins?.tooltip?.callbacks?.label?.({
            raw: { x: new Date("2026-02-15T10:02:00Z").getTime(), y: 0, kind: "S", nr: 2 }
        });
        expect(label ?? "").toContain("A");
        const rawless = cfg?.options?.plugins?.tooltip?.callbacks?.label?.(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { raw: null } as any
        );
        expect(rawless ?? "").toBe("");

        const xTick = (cfg as { options?: { scales?: { x?: { ticks?: { callback?: (v: number) => string } } } } })?.options?.scales?.x?.ticks?.callback;
        const yTick = (cfg as { options?: { scales?: { y?: { ticks?: { callback?: (v: number) => string } } } } })?.options?.scales?.y?.ticks?.callback;
        expect(xTick?.(new Date("2026-02-15T10:03:00Z").getTime()) ?? "").toContain(":");
        expect(yTick?.(0) ?? "").toBe("A");
        expect(yTick?.(99) ?? "").toBe("");

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
        view.bindNachrichtenEvents(vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn());
        view.bindTeilnehmerEvents(vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn());
        view.bindMetaEvents(vi.fn(), vi.fn());
        expect(true).toBe(true);
    });
});
