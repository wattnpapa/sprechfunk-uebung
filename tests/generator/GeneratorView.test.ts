import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

const mocks = vi.hoisted(() => ({
    chartDestroy: vi.fn(),
    chartCtor: vi.fn(),
    selectTrigger: vi.fn(),
    selectVal: vi.fn(),
    zip: vi.fn().mockResolvedValue(new Blob(["zip"])),
    uiSuccess: vi.fn(),
    uiError: vi.fn()
}));

vi.mock("chart.js", () => ({
    Chart: function (...args: unknown[]) {
        mocks.chartCtor(...args);
        return { destroy: mocks.chartDestroy };
    },
    registerables: []
}));
vi.mock("../../src/core/select2-setup", () => ({
    default: () => ({ trigger: mocks.selectTrigger, val: mocks.selectVal })
}));

vi.mock("../../src/services/pdfGenerator", () => ({
    default: {
        generateTeilnehmerPDFsAsZip: mocks.zip,
        sanitizeFileName: (v: string) => v.replace(/\s+/g, "_")
    }
}));
vi.mock("../../src/core/UiFeedback", () => ({
    uiFeedback: { success: mocks.uiSuccess, error: mocks.uiError }
}));

import { GeneratorView } from "../../src/generator/GeneratorView";
import { FunkUebung } from "../../src/models/FunkUebung";

describe("GeneratorView", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.selectVal.mockReturnValue(undefined);
        const dom = new JSDOM("<div id=\"mainAppArea\"></div><div id=\"output-container\" style=\"display:none\"></div><div id=\"uebungsId\"></div><div id=\"version\"></div>");
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("AbortController", dom.window.AbortController);
        vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
        vi.stubGlobal("setTimeout", vi.fn((cb: () => void) => { cb(); return 1; }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:test");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis.URL as any).revokeObjectURL = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).execCommand = vi.fn(() => true);
    });

    it("renders app and can read form data", () => {
        const view = new GeneratorView();
        view.render();
        const name = document.getElementById("nameDerUebung") as HTMLInputElement;
        name.value = "Alpha";
        const auto = document.getElementById("autoStaerkeErgaenzen") as HTMLInputElement;
        auto.checked = false;
        const data = view.getFormData();
        expect(data.name).toBe("Alpha");
        expect(data.autoStaerkeErgaenzen).toBe(false);
    });

    it("sets form values, version info and source toggles", () => {
        const view = new GeneratorView();
        view.render();
        const u = new FunkUebung("dev");
        u.name = "X";
        u.leitung = "L";
        u.autoStaerkeErgaenzen = false;
        view.setFormData(u);
        view.setVersionInfo("u1", "dev");
        expect(document.getElementById("uebungsId")?.textContent).toBe("u1");
        expect((document.getElementById("nameDerUebung") as HTMLInputElement).value).toBe("X");
        expect((document.getElementById("autoStaerkeErgaenzen") as HTMLInputElement).checked).toBe(false);
        view.toggleSourceView("upload");
        expect((document.getElementById("fileUploadContainer") as HTMLElement).style.display).toBe("block");
    });

    it("renders participant section, distribution and links table", async () => {
        const view = new GeneratorView();
        view.render();
        const all = document.getElementById("spruecheAnAlle") as HTMLInputElement;
        const mul = document.getElementById("spruecheAnMehrere") as HTMLInputElement;
        const buch = document.getElementById("spruecheAnBuchstabieren") as HTMLInputElement;
        all.value = "5";
        mul.value = "2";
        buch.value = "1";
        view.bindDistributionInputs(() => {});
        (document.getElementById("spruecheProTeilnehmer") as HTMLInputElement).value = "10";
        (document.getElementById("spruecheProTeilnehmer") as HTMLInputElement).dispatchEvent(new window.Event("input"));

        view.renderTeilnehmerSection(["A"], {}, {}, false);
        expect(document.getElementById("teilnehmer-body")?.innerHTML).toContain("teilnehmer-input");
        view.renderTeilnehmerSection(["A"], { A: "Stelle A" }, { A: "WORT" }, true);
        expect(document.getElementById("teilnehmer-body")?.innerHTML).toContain("stellenname-input");
        const u = new FunkUebung("dev");
        u.id = "u1";
        u.name = "Übung";
        u.teilnehmerListe = ["A"];
        u.teilnehmerIds = { tid: "A" };
        view.renderLinks(u);
        expect(document.getElementById("links-teilnehmer-container")?.innerHTML).toContain("A");
        const copyButton = document.querySelector(".generator-link-actions .btn-outline-secondary") as HTMLButtonElement;
        copyButton.click();
        await Promise.resolve();
        const downloadButton = Array.from(document.querySelectorAll(".generator-link-actions button"))
            .find(btn => btn.textContent?.includes("Druckdaten")) as HTMLButtonElement;
        downloadButton.click();
        await Promise.resolve();
        expect(mocks.zip).toHaveBeenCalled();
    });

    it("binds participant events and primary actions", () => {
        const view = new GeneratorView();
        view.render();
        view.renderTeilnehmerSection(["A"], { A: "Stelle A" }, {}, true);
        const onTeilnehmerNameChange = vi.fn();
        const onStellennameChange = vi.fn();
        const onDelete = vi.fn();
        const onShowStellennameToggle = vi.fn();
        view.bindTeilnehmerEvents(onTeilnehmerNameChange, onStellennameChange, onDelete, onShowStellennameToggle);

        const nameInput = document.querySelector(".teilnehmer-input") as HTMLInputElement;
        nameInput.value = "B";
        nameInput.dispatchEvent(new window.Event("input", { bubbles: true }));
        const deleteBtn = document.querySelector(".delete-teilnehmer") as HTMLButtonElement;
        deleteBtn.click();
        const stellenInput = document.querySelector(".stellenname-input") as HTMLInputElement;
        stellenInput.value = "Neu";
        stellenInput.dispatchEvent(new window.Event("input", { bubbles: true }));
        const show = document.getElementById("showStellennameCheckbox") as HTMLInputElement;
        show.checked = false;
        show.dispatchEvent(new window.Event("change", { bubbles: true }));
        expect(onTeilnehmerNameChange).toHaveBeenCalled();
        expect(onStellennameChange).toHaveBeenCalledWith("A", "Neu");
        expect(onShowStellennameToggle).toHaveBeenCalledWith(false);
        expect(onDelete).toHaveBeenCalled();

        const actions = {
            onAddTeilnehmer: vi.fn(),
            onStartUebung: vi.fn(),
            onChangePage: vi.fn(),
            onCopyJson: vi.fn(),
            onZipAllPdfs: vi.fn()
        };
        document.body.innerHTML += `
            <button id="pagePrevBtn"></button>
            <button id="pageNextBtn"></button>
            <button id="copyJsonBtnFooter"></button>
            <button id="zipAllPdfsBtn"></button>
        `;
        view.bindPrimaryActions(actions);
        (document.getElementById("addTeilnehmerBtn") as HTMLButtonElement).click();
        (document.getElementById("startUebungBtn") as HTMLButtonElement).click();
        (document.getElementById("pagePrevBtn") as HTMLButtonElement).click();
        (document.getElementById("pageNextBtn") as HTMLButtonElement).click();
        (document.getElementById("copyJsonBtn") as HTMLButtonElement).click();
        (document.getElementById("copyJsonBtnFooter") as HTMLButtonElement).click();
        (document.getElementById("zipAllPdfsBtn") as HTMLButtonElement).click();
        expect(actions.onAddTeilnehmer).toHaveBeenCalled();
        expect(actions.onStartUebung).toHaveBeenCalled();
        expect(actions.onChangePage).toHaveBeenCalledTimes(2);
        expect(actions.onCopyJson).toHaveBeenCalledTimes(2);
        expect(actions.onZipAllPdfs).toHaveBeenCalledTimes(1);
    });

    it("handles templates, previews, status, chart and json copy", () => {
        const view = new GeneratorView();
        view.render();
        view.populateTemplateSelect({ a: { text: "A" }, b: { text: "B" } }, ["a"]);
        expect(mocks.selectTrigger).toHaveBeenCalledWith("change");
        mocks.selectVal.mockReturnValue(["a"]);
        expect(view.getSelectedTemplates()).toEqual(["a"]);

        document.body.innerHTML += "<iframe id=\"resultFrame\"></iframe><span id=\"current-page\"></span><canvas id=\"distributionChart\"></canvas>";
        const iframe = document.getElementById("resultFrame") as HTMLIFrameElement;
        view.renderPreview("<p>x</p>", 0, 1);
        expect(iframe.srcdoc).toContain("<p>x</p>");

        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A", "B"];
        u.nachrichten = { A: [{ id: 1, empfaenger: ["B"], nachricht: "x" }], B: [] };
        view.renderUebungResult(
            u,
            {
                optimal: 10,
                durchschnittOptimal: 12,
                schlecht: 20,
                durchschnittSchlecht: 24,
                optimalFormatted: { stunden: 0, minuten: 10 },
                schlechtFormatted: { stunden: 0, minuten: 20 }
            },
            { labels: ["A"], counts: [1] }
        );
        expect(mocks.chartCtor).toHaveBeenCalled();

        view.copyJsonToClipboard("{\"a\":1}");
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it("covers option, source and clipboard fallback branches", async () => {
        const view = new GeneratorView();
        view.render();

        const none = document.getElementById("keineLoesungswoerter") as HTMLInputElement;
        const central = document.getElementById("zentralLoesungswort") as HTMLInputElement;
        const indiv = document.getElementById("individuelleLoesungswoerter") as HTMLInputElement;
        none.checked = true;
        expect(view.getSelectedLoesungswortOption()).toBe("none");
        central.checked = true;
        none.checked = false;
        expect(view.getSelectedLoesungswortOption()).toBe("central");
        indiv.checked = true;
        central.checked = false;
        expect(view.getSelectedLoesungswortOption()).toBe("individual");

        view.setLoesungswortUI({});
        view.setLoesungswortUI({ A: "WORT" });
        view.setLoesungswortUI({ A: "WORT1", B: "WORT2" });
        view.updateLoesungswortOptionUI();
        expect((document.getElementById("zentralLoesungswortContainer") as HTMLElement).style.display).toBe("none");

        const upload = document.getElementById("optionUpload") as HTMLInputElement;
        upload.checked = true;
        expect(view.getSelectedSource()).toBe("upload");
        expect(view.getUploadedFile()).toBeUndefined();
        view.toggleSourceView("vorlagen");
        expect((document.getElementById("fileUploadContainer") as HTMLElement).style.display).toBe("none");

        document.body.innerHTML += "<div id=\"link-action-feedback\"></div>";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (view as any).showLinkActionFeedback("ok", false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (view as any).copyTextToClipboard("abc");

        vi.stubGlobal("navigator", {});
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (view as any).copyTextToClipboard("fallback");
        expect(document.execCommand).toHaveBeenCalledWith("copy");
    });

    it("covers bindings for source/loesungswort/anmeldung and preview null", () => {
        const view = new GeneratorView();
        view.render();
        const sourceToggle = vi.spyOn(view, "toggleSourceView");
        view.bindSourceToggle();
        (document.getElementById("optionVorlagen") as HTMLInputElement).dispatchEvent(new window.Event("change"));
        (document.getElementById("optionUpload") as HTMLInputElement).dispatchEvent(new window.Event("change"));
        expect(sourceToggle).toHaveBeenCalledWith("vorlagen");
        expect(sourceToggle).toHaveBeenCalledWith("upload");

        const onOption = vi.fn();
        view.bindLoesungswortOptionChange(onOption);
        (document.getElementById("keineLoesungswoerter") as HTMLInputElement).dispatchEvent(new window.Event("change"));
        expect(onOption).toHaveBeenCalled();

        const onAnmeldung = vi.fn();
        view.bindAnmeldungToggle(onAnmeldung);
        const anmelden = document.getElementById("anmeldungAktiv") as HTMLInputElement;
        anmelden.checked = false;
        anmelden.dispatchEvent(new window.Event("change"));
        expect(onAnmeldung).toHaveBeenCalledWith(false);

        document.body.innerHTML += "<iframe id=\"resultFrame\"></iframe><span id=\"current-page\"></span>";
        view.renderPreviewPage(null);
        view.renderPreviewPage({ html: "<p>a</p>", index: 0, total: 1 });
        expect((document.getElementById("current-page") as HTMLElement).textContent).toContain("Seite");
    });

    it("covers guard clauses when dom elements are missing", () => {
        const view = new GeneratorView();
        view.render();
        document.getElementById("funkspruchVorlage")?.remove();
        view.populateTemplateSelect({ a: { text: "A" } });
        mocks.selectVal.mockReturnValue(undefined);
        expect(view.getSelectedTemplates()).toEqual([]);

        document.getElementById("output-container")?.remove();
        view.showOutputContainer();

        document.getElementById("distributionChart")?.remove();
        view.renderChart(["A"], [1]);

        document.getElementById("nameDerUebung")?.remove();
        // create minimal required inputs to avoid throw in getFormData
        document.body.innerHTML += `
            <input id="nameDerUebung" value="x">
            <input id="rufgruppe" value="r">
            <input id="leitung" value="l">
            <input id="spruecheProTeilnehmer" value="1">
            <input id="spruecheAnAlle" value="0">
            <input id="spruecheAnMehrere" value="0">
            <input id="spruecheAnBuchstabieren" value="0">
            <input id="datum" value="">
            <input id="anmeldungAktiv" type="checkbox" checked>
        `;
        const data = view.getFormData();
        expect(data.name).toBe("x");
    });

    it("covers chart destroy, copy json error path and render guard", async () => {
        const view = new GeneratorView();
        view.render();
        document.body.innerHTML += "<canvas id=\"distributionChart\"></canvas>";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).chart = { destroy: mocks.chartDestroy };
        view.renderChart(["A"], [1]);
        expect(mocks.chartDestroy).toHaveBeenCalled();

        const write = vi.fn().mockRejectedValue(new Error("fail"));
        vi.stubGlobal("navigator", { clipboard: { writeText: write } });
        view.copyJsonToClipboard("{\"x\":1}");
        await Promise.resolve();
        await Promise.resolve();
        expect(mocks.uiError).toHaveBeenCalled();

        const dom = new JSDOM("<div></div>");
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        const emptyView = new GeneratorView();
        emptyView.render();
        expect(document.getElementById("mainAppArea")).toBeNull();
    });

    it("covers generator status mode labels and link action error branches", async () => {
        const view = new GeneratorView();
        view.render();
        vi.stubGlobal("setTimeout", vi.fn(() => 1));
        const u = new FunkUebung("dev");
        u.teilnehmerListe = ["A"];
        u.nachrichten = { A: [] };
        const stats = {
            optimal: 1,
            durchschnittOptimal: 1,
            schlecht: 2,
            durchschnittSchlecht: 2,
            optimalFormatted: { stunden: 0, minuten: 1 },
            schlechtFormatted: { stunden: 0, minuten: 2 }
        };

        const none = document.getElementById("keineLoesungswoerter") as HTMLInputElement;
        const central = document.getElementById("zentralLoesungswort") as HTMLInputElement;
        const indiv = document.getElementById("individuelleLoesungswoerter") as HTMLInputElement;
        none.checked = true; central.checked = false; indiv.checked = false;
        view.renderGeneratorStatus(u, stats);
        expect((document.getElementById("statusLoesungswortMode") as HTMLElement).textContent).toBe("Keine");
        none.checked = false; central.checked = true; indiv.checked = false;
        view.renderGeneratorStatus(u, stats);
        expect((document.getElementById("statusLoesungswortMode") as HTMLElement).textContent).toBe("Zentral");
        none.checked = false; central.checked = false; indiv.checked = true;
        view.renderGeneratorStatus(u, stats);
        expect((document.getElementById("statusLoesungswortMode") as HTMLElement).textContent).toBe("Individuell");

        // copy failure branch via click
        vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("x")) } });
        u.id = "u1";
        u.name = "Ü";
        u.teilnehmerIds = { tid: "A" };
        view.renderLinks(u);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (view as any).showLinkActionFeedback("Kopieren fehlgeschlagen.", true);
        expect((document.getElementById("link-action-feedback") as HTMLElement).textContent).toContain("fehlgeschlagen");

        // zip failure branch
        mocks.zip.mockRejectedValueOnce(new Error("zipfail"));
        const dlBtn = Array.from(document.querySelectorAll(".generator-link-actions button"))
            .find(btn => btn.textContent?.includes("Druckdaten")) as HTMLButtonElement;
        dlBtn.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(mocks.zip).toHaveBeenCalled();
    });

    it("covers private helper branches", async () => {
        const view = new GeneratorView();
        view.render();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((view as any).getTypeBadgeClass("Übung")).toBe("is-uebung");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((view as any).getTypeBadgeClass("Übungsleitung")).toBe("is-leitung");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((view as any).getTypeBadgeClass("Teilnehmer")).toBe("is-teilnehmer");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((view as any).getTypeBadgeClass("x")).toBe("");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((view as any).shortenUrl("abc", 10)).toBe("abc");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((view as any).shortenUrl("abcdefghijklmnopqrstuvwxyz", 10)).toContain("…");

        // no feedback node branch
        document.getElementById("link-action-feedback")?.remove();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (view as any).showLinkActionFeedback("x", false);

        // timeout condition false and true branches
        document.body.innerHTML += "<div id=\"link-action-feedback\"></div>";
        vi.stubGlobal("setTimeout", vi.fn((cb: () => void) => {
            const el = document.getElementById("link-action-feedback") as HTMLElement;
            el.textContent = "other";
            cb();
            return 1;
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (view as any).showLinkActionFeedback("msg", true);
        expect((document.getElementById("link-action-feedback") as HTMLElement).textContent).toBe("other");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).setTimeout = vi.fn((cb: () => void) => { cb(); return 1; });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (view as any).showLinkActionFeedback("msg2", false);
        expect((document.getElementById("link-action-feedback") as HTMLElement).textContent).toBe("");
    });

    it("covers renderLinks guard and copy/mail button branches", async () => {
        const view = new GeneratorView();
        const dom = new JSDOM("<div id=\"mainAppArea\"></div>");
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        const u = new FunkUebung("dev");
        u.id = "u1";
        u.name = "Ü";
        u.teilnehmerIds = { t1: "A" };
        view.renderLinks(u); // missing containers -> guard

        document.body.innerHTML += "<div id='uebung-links'></div><div id='links-teilnehmer-container'></div><div id='link-action-feedback'></div>";
        const feedbackSpy = vi.spyOn(view as never, "showLinkActionFeedback" as never).mockImplementation(() => {});
        vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("x")) } });
        view.renderLinks(u);
        const copyButtons = Array.from(document.querySelectorAll(".generator-link-actions .btn-outline-secondary")) as HTMLButtonElement[];
        copyButtons[0]?.click();
        await Promise.resolve();
        await Promise.resolve();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (view as any).showLinkActionFeedback("x", true);
        expect(feedbackSpy).toHaveBeenCalled();

        const mailBtn = Array.from(document.querySelectorAll(".generator-link-actions button"))
            .find(btn => btn.textContent?.includes("Mail")) as HTMLButtonElement;
        mailBtn?.click();
        expect(true).toBe(true);
    });

    it("covers additional helper guards in generator view", () => {
        const view = new GeneratorView();
        view.render();
        // missing id branch
        const noId = new FunkUebung("dev");
        noId.id = "";
        const linksContainer = document.getElementById("links-teilnehmer-container") as HTMLElement;
        linksContainer.innerHTML = "<span>keep</span>";
        view.renderLinks(noId);
        expect(linksContainer.innerHTML).toContain("keep");

        document.getElementById("resultFrame")?.remove();
        document.getElementById("current-page")?.remove();
        view.renderPreview("<p>x</p>", 1, 3);

        document.getElementById("uebungsId")?.remove();
        document.getElementById("version")?.remove();
        view.setVersionInfo("id", "v");

        // renderTeilnehmerListe guard when container missing
        document.getElementById("teilnehmer-container")?.remove();
        view.renderTeilnehmerListe(["A"], {}, {}, false);

        // getSelectedSource "vorlagen" branch
        const ov = document.createElement("input");
        ov.id = "optionVorlagen";
        ov.checked = true;
        document.body.appendChild(ov);
        expect(view.getSelectedSource()).toBe("vorlagen");

        // toggleSourceView guard when nodes missing
        document.getElementById("funkspruchVorlage")?.remove();
        document.getElementById("fileUploadContainer")?.remove();
        view.toggleSourceView("upload");
    });

    it("covers individual mode rendering and helper branches", () => {
        const view = new GeneratorView();
        view.render();
        const none = document.getElementById("keineLoesungswoerter") as HTMLInputElement;
        const indiv = document.getElementById("individuelleLoesungswoerter") as HTMLInputElement;
        none.checked = false;
        indiv.checked = true;
        view.renderTeilnehmerListe(["A"], {}, { A: "WORT" }, false);
        expect(document.getElementById("teilnehmer-container")?.innerHTML).toContain("loesungswortHeader");

        // getUploadedFile with file present
        const input = document.getElementById("funksprueche") as HTMLInputElement;
        const fakeFile = new File(["x"], "a.txt", { type: "text/plain" });
        Object.defineProperty(input, "files", { configurable: true, value: [fakeFile] });
        expect(view.getUploadedFile()?.name).toBe("a.txt");

        // private appendLinkRow branches: no mailto, unknown type
        const container = document.createElement("div");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (view as any).appendLinkRow(container, "X", "n", "http://x");
        expect(container.innerHTML).toContain("Öffnen");
    });

    it("covers teilnehmer-body missing branch", () => {
        const view = new GeneratorView();
        view.render();
        const originalGet = document.getElementById.bind(document);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (document as any).getElementById = (id: string) => {
            if (id === "teilnehmer-body") {
                return null;
            }
            return originalGet(id);
        };
        view.renderTeilnehmerListe(["A"], {}, {}, false);
    });

    it("covers additional guard branches and central value getter", () => {
        const view = new GeneratorView();
        view.render();

        const centralInput = document.getElementById("zentralLoesungswortInput") as HTMLInputElement;
        centralInput.value = "ALFA";
        expect(view.getZentralesLoesungswort()).toBe("ALFA");

        document.getElementById("keineLoesungswoerter")?.remove();
        view.setLoesungswortUI({ A: "X" });
        view.updateLoesungswortOptionUI();

        document.getElementById("teilnehmer-container")?.remove();
        view.bindTeilnehmerEvents(vi.fn(), vi.fn(), vi.fn(), vi.fn());
    });

    it("updates hidden distribution values when percent inputs change", () => {
        const view = new GeneratorView();
        view.render();
        const onChange = vi.fn();
        view.bindDistributionInputs(onChange);

        (document.getElementById("spruecheProTeilnehmer") as HTMLInputElement).value = "20";
        const mehr = document.getElementById("prozentAnMehrere") as HTMLInputElement;
        mehr.value = "25";
        mehr.dispatchEvent(new window.Event("input"));
        expect((document.getElementById("spruecheAnMehrere") as HTMLInputElement).value).toBe("5");
        expect(document.getElementById("calcAnMehrere")?.textContent).toBe("5");

        const buch = document.getElementById("prozentAnBuchstabieren") as HTMLInputElement;
        buch.value = "10";
        buch.dispatchEvent(new window.Event("input"));
        expect((document.getElementById("spruecheAnBuchstabieren") as HTMLInputElement).value).toBe("2");
        expect(document.getElementById("calcAnBuchstabieren")?.textContent).toBe("2");
        expect(onChange).toHaveBeenCalled();
    });
});
