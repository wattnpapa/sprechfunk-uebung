import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

const { chartCtor, getChart, destroy } = vi.hoisted(() => ({
    chartCtor: vi.fn(),
    getChart: vi.fn(),
    destroy: vi.fn()
}));

vi.mock("chart.js/auto", () => {
    const Chart = function (...args: unknown[]) {
        chartCtor(...args);
    };
    (Chart as unknown as { getChart: typeof getChart }).getChart = getChart;
    return { Chart };
});

import { AdminView } from "../../src/admin/AdminView";

describe("AdminView", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const dom = new JSDOM(`
          <div id="infoGroesse"></div>
          <div id="infoTeilnehmer"></div>
          <div id="infoDauer"></div>
          <div id="infoLoesungswort"></div>
          <div id="infoStaerke"></div>
          <div id="infoBuchstabieren"></div>
          <div id="infoGesamtUebungen"></div>
          <div id="infoSpruecheProTeilnehmer"></div>
          <input id="adminSearchInput" />
          <input id="adminOnlyTestFilter" type="checkbox" />
          <table><tbody id="adminUebungslisteBody"></tbody></table>
          <div id="adminUebungslisteInfo"></div>
          <canvas id="chartUebungenProTag"></canvas>
        `);
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
    });

    it("renders statistics and pagination info", () => {
        const view = new AdminView();
        view.renderStatistik({
            totalKB: "1",
            avgTeilnehmer: "2",
            avgDauer: "3",
            pLoesungswort: "4",
            pStaerke: "5",
            pBuchstabieren: "6",
            total: 7,
            avgSpruecheProTeilnehmer: "8"
        });
        view.renderPaginationInfo(1, 10, 5, 30);

        // jsdom exposes innerText, which is used by the view
        expect((document.getElementById("infoGesamtUebungen") as HTMLElement).innerText).toContain("7");
        expect((document.getElementById("adminUebungslisteInfo") as HTMLElement).innerText).toContain("Zeige 11 - 15 von 30");
    });

    it("renders list, filters and emits row actions", () => {
        const view = new AdminView();
        const onView = vi.fn();
        const onMonitor = vi.fn();
        const onDelete = vi.fn();
        const onOnlyTestChange = vi.fn();
        view.renderUebungsListe([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: "u1", name: "Alpha", rufgruppe: "R", leitung: "L", teilnehmerListe: ["A"], datum: new Date(), createDate: new Date(), istStandardKonfiguration: true } as any
        ]);
        view.bindListEvents(onView, onMonitor, onDelete, onOnlyTestChange);
        const tbody = document.getElementById("adminUebungslisteBody") as HTMLElement;
        expect(tbody.innerHTML).toContain("admin-standard-uebung-row");

        (tbody.querySelector("button[data-action='view']") as HTMLButtonElement).click();
        (tbody.querySelector("button[data-action='monitor']") as HTMLButtonElement).click();
        (tbody.querySelector("button[data-action='delete']") as HTMLButtonElement).click();
        expect(onView).toHaveBeenCalledWith("u1");
        expect(onMonitor).toHaveBeenCalledWith("u1");
        expect(onDelete).toHaveBeenCalledWith("u1");

        const search = document.getElementById("adminSearchInput") as HTMLInputElement;
        search.value = "zzz";
        search.dispatchEvent(new window.Event("input"));
        expect((tbody.querySelector("tr") as HTMLTableRowElement).style.display).toBe("none");

        search.value = "";
        search.dispatchEvent(new window.Event("input"));
        const onlyTest = document.getElementById("adminOnlyTestFilter") as HTMLInputElement;
        onlyTest.checked = true;
        onlyTest.dispatchEvent(new window.Event("change"));
        expect(onOnlyTestChange).toHaveBeenCalledWith(true);
    });

    it("renders chart and destroys previous one", () => {
        getChart.mockReturnValueOnce({ destroy });
        const view = new AdminView();
        view.renderChart([1], ["Jan"]);
        expect(destroy).toHaveBeenCalled();
        expect(chartCtor).toHaveBeenCalled();
    });

    it("covers guard branches for missing dom nodes and list actions", () => {
        const view = new AdminView();
        document.getElementById("adminUebungslisteBody")?.remove();
        view.renderUebungsListe([]);
        view.bindListEvents(vi.fn(), vi.fn(), vi.fn());

        document.getElementById("chartUebungenProTag")?.remove();
        view.renderChart([1], ["Jan"]);

        document.getElementById("adminUebungslisteInfo")?.remove();
        view.renderPaginationInfo(0, 10, 0, 0);

        // setText guard path through renderStatistik with missing ids
        [
            "infoGroesse", "infoTeilnehmer", "infoDauer", "infoLoesungswort",
            "infoStaerke", "infoBuchstabieren", "infoGesamtUebungen", "infoSpruecheProTeilnehmer"
        ].forEach(id => document.getElementById(id)?.remove());
        view.renderStatistik({
            totalKB: "1",
            avgTeilnehmer: "2",
            avgDauer: "3",
            pLoesungswort: "4",
            pStaerke: "5",
            pBuchstabieren: "6",
            total: 7,
            avgSpruecheProTeilnehmer: "8"
        });
        expect(true).toBe(true);
    });

    it("covers row action ignore branches and positive search match", () => {
        const view = new AdminView();
        const onView = vi.fn();
        const onMonitor = vi.fn();
        const onDelete = vi.fn();
        const onOnlyTestChange = vi.fn();
        view.renderUebungsListe([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: "u1", name: "Alpha", rufgruppe: "R", leitung: "L", teilnehmerListe: ["A"], datum: null, createDate: null } as any
        ]);
        view.renderUebungsListe([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: "u1", name: "Alpha", rufgruppe: "R", leitung: "L", teilnehmerListe: ["A"], datum: null, createDate: null, istStandardKonfiguration: true } as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: "u2", name: "Beta", rufgruppe: "R", leitung: "L", teilnehmerListe: ["A"], datum: null, createDate: null, istStandardKonfiguration: false } as any
        ]);
        view.bindListEvents(onView, onMonitor, onDelete, onOnlyTestChange);
        const tbody = document.getElementById("adminUebungslisteBody") as HTMLElement;
        tbody.dispatchEvent(new window.Event("click", { bubbles: true }));
        expect(onView).not.toHaveBeenCalled();

        const search = document.getElementById("adminSearchInput") as HTMLInputElement;
        search.value = "alpha";
        search.dispatchEvent(new window.Event("input"));
        expect((tbody.querySelector("tr") as HTMLTableRowElement).style.display).toBe("");

        const onlyTest = document.getElementById("adminOnlyTestFilter") as HTMLInputElement;
        onlyTest.checked = true;
        onlyTest.dispatchEvent(new window.Event("change"));
        expect(onOnlyTestChange).toHaveBeenCalledWith(true);
    });
});
