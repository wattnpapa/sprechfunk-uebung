import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

const { chartCtor, getChart, destroy } = vi.hoisted(() => ({
    chartCtor: vi.fn(),
    getChart: vi.fn(),
    destroy: vi.fn()
}));

vi.mock("../../src/core/chart", () => {
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
          <button id="adminPrevPage"></button>
          <button id="adminNextPage"></button>
          <canvas id="chartUebungenProTag"></canvas>
          <select id="adminStatistikJahr"></select>
          <div id="adminStatistikHinweis" class="d-none"></div>
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

    it("reports an empty result and disables paging buttons", () => {
        const view = new AdminView();
        view.renderPaginationInfo(0, 10, 0, 0);
        view.setPaginationButtons(false, false);

        expect((document.getElementById("adminUebungslisteInfo") as HTMLElement).innerText).toBe("Keine Übungen gefunden");
        expect((document.getElementById("adminPrevPage") as HTMLButtonElement).disabled).toBe(true);
        expect((document.getElementById("adminNextPage") as HTMLButtonElement).disabled).toBe(true);

        view.setPaginationButtons(true, true);
        expect((document.getElementById("adminPrevPage") as HTMLButtonElement).disabled).toBe(false);
        expect((document.getElementById("adminNextPage") as HTMLButtonElement).disabled).toBe(false);
    });

    it("renders list, forwards search input and emits row actions", async () => {
        const view = new AdminView();
        const onView = vi.fn();
        const onMonitor = vi.fn();
        const onDelete = vi.fn();
        const onOnlyTestChange = vi.fn();
        const onSearchChange = vi.fn();
        view.renderUebungsListe([
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: "u1", name: "Alpha", rufgruppe: "R", leitung: "L", teilnehmerListe: ["A"], datum: new Date(), createDate: new Date(), istStandardKonfiguration: true, spielModus: "xZeit", xZeitIntervallMinuten: 5, verwendeteVorlagen: ["thwleer"] } as any
        ]);
        view.bindListEvents({ onView, onMonitor, onDelete, onOnlyTestFilterChange: onOnlyTestChange, onSearchChange });
        const tbody = document.getElementById("adminUebungslisteBody") as HTMLElement;
        expect(tbody.innerHTML).toContain("admin-standard-uebung-row");

        const zellen = Array.from(tbody.querySelectorAll("td"));
        const modusZelle = zellen.find(td => td.textContent === "X-Zeit");
        expect(modusZelle?.getAttribute("title")).toBe("Intervall: 5 Minuten");
        const quelleZelle = zellen.find(td => td.textContent === "Vorlage");
        expect(quelleZelle?.getAttribute("title")).toBe("Funksprüche THW Leer");

        (tbody.querySelector("button[data-action='view']") as HTMLButtonElement).click();
        (tbody.querySelector("button[data-action='monitor']") as HTMLButtonElement).click();
        (tbody.querySelector("button[data-action='delete']") as HTMLButtonElement).click();
        expect(onView).toHaveBeenCalledWith("u1");
        expect(onMonitor).toHaveBeenCalledWith("u1");
        expect(onDelete).toHaveBeenCalledWith("u1");

        const search = document.getElementById("adminSearchInput") as HTMLInputElement;
        search.value = "zz";
        search.dispatchEvent(new window.Event("input"));
        search.value = "zzz";
        search.dispatchEvent(new window.Event("input"));
        // Entprellt: nur der letzte Stand der Eingabe löst eine Abfrage aus.
        await vi.waitFor(() => expect(onSearchChange).toHaveBeenCalledTimes(1));
        expect(onSearchChange).toHaveBeenCalledWith("zzz");

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

    it("fills the year filter and reports the active selection", () => {
        const view = new AdminView();
        const onJahrChange = vi.fn();
        view.bindListEvents({ onView: vi.fn(), onMonitor: vi.fn(), onDelete: vi.fn(), onJahrChange });
        view.renderJahresFilter([{ jahr: 2025, anzahl: 2 }, { jahr: 2026, anzahl: 3 }], 2026);

        const select = document.getElementById("adminStatistikJahr") as HTMLSelectElement;
        expect(select.options).toHaveLength(3);
        expect(select.options[0]?.textContent).toBe("Alle Jahre (5)");
        expect(select.value).toBe("2026");

        select.value = "2025";
        select.dispatchEvent(new window.Event("change"));
        expect(onJahrChange).toHaveBeenCalledWith(2025);

        select.value = "alle";
        select.dispatchEvent(new window.Event("change"));
        expect(onJahrChange).toHaveBeenLastCalledWith("alle");
    });

    it("shows and hides the hint about exercises without statistics fields", () => {
        const view = new AdminView();
        const hinweis = document.getElementById("adminStatistikHinweis") as HTMLElement;

        view.renderStatistikHinweis(7);
        expect(hinweis.classList.contains("d-none")).toBe(false);
        expect(hinweis.textContent).toContain("7 Übung(en)");

        view.renderStatistikHinweis(0);
        expect(hinweis.classList.contains("d-none")).toBe(true);
        expect(hinweis.textContent).toBe("");
    });

    it("labels the chart dataset with the selected year", () => {
        const view = new AdminView();
        view.renderChart([1], ["Jan"], "Übungen pro Monat 2025");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = chartCtor.mock.calls[0]?.[1] as any;
        expect(config.data.datasets[0].label).toBe("Übungen pro Monat 2025");
    });

    it("takes chart colours from the active theme tokens", () => {
        document.body.style.setProperty("--akzent", "#ff9c00");
        document.body.style.setProperty("--akzent-hell", "#ffcc66");

        const view = new AdminView();
        view.renderChart([1], ["Jan"]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = chartCtor.mock.calls[0]?.[1] as any;
        expect(config.data.datasets[0].backgroundColor).toBe("#ff9c00");
        expect(config.data.datasets[0].borderColor).toBe("#ffcc66");
    });

    it("redraws the chart when the theme changes", async () => {
        document.body.style.setProperty("--akzent", "#12275e");
        const view = new AdminView();
        view.renderChart([1], ["Jan"]);
        expect(chartCtor).toHaveBeenCalledTimes(1);

        document.body.style.setProperty("--akzent", "#ff9c00");
        document.body.setAttribute("data-theme", "startrek");
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(chartCtor).toHaveBeenCalledTimes(2);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = chartCtor.mock.calls[1]?.[1] as any;
        expect(config.data.datasets[0].backgroundColor).toBe("#ff9c00");
    });

    it("covers guard branches for missing dom nodes and list actions", () => {
        const view = new AdminView();
        document.getElementById("adminUebungslisteBody")?.remove();
        view.renderUebungsListe([]);
        view.bindListEvents({ onView: vi.fn(), onMonitor: vi.fn(), onDelete: vi.fn() });

        document.getElementById("chartUebungenProTag")?.remove();
        view.renderChart([1], ["Jan"]);

        document.getElementById("adminStatistikJahr")?.remove();
        document.getElementById("adminStatistikHinweis")?.remove();
        view.renderJahresFilter([{ jahr: 2026, anzahl: 1 }], "alle");
        view.renderStatistikHinweis(3);

        document.getElementById("adminUebungslisteInfo")?.remove();
        view.renderPaginationInfo(0, 10, 0, 0);

        document.getElementById("adminPrevPage")?.remove();
        document.getElementById("adminNextPage")?.remove();
        view.setPaginationButtons(true, true);

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

    it("covers row action ignore branches and search without listener", async () => {
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
        view.bindListEvents({ onView, onMonitor, onDelete, onOnlyTestFilterChange: onOnlyTestChange });
        const tbody = document.getElementById("adminUebungslisteBody") as HTMLElement;
        tbody.dispatchEvent(new window.Event("click", { bubbles: true }));
        expect(onView).not.toHaveBeenCalled();

        // Ohne registrierten Such-Callback darf die Eingabe nichts auslösen.
        const search = document.getElementById("adminSearchInput") as HTMLInputElement;
        search.value = "alpha";
        search.dispatchEvent(new window.Event("input"));
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(tbody.querySelectorAll("tr")).toHaveLength(2);

        const onlyTest = document.getElementById("adminOnlyTestFilter") as HTMLInputElement;
        onlyTest.checked = true;
        onlyTest.dispatchEvent(new window.Event("change"));
        expect(onOnlyTestChange).toHaveBeenCalledWith(true);
    });
});
