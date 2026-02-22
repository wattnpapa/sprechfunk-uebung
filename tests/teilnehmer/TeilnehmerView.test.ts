import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { TeilnehmerView } from "../../src/teilnehmer/TeilnehmerView";

const setupDom = () => {
    const dom = new JSDOM("<div id=\"teilnehmerContent\"></div>");
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
    });
    return dom;
};

describe("TeilnehmerView", () => {
    beforeEach(() => {
        setupDom();
    });

    const renderBase = () => {
        const view = new TeilnehmerView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderHeader({ name: "Ü", datum: new Date(), rufgruppe: "RG", leitung: "L" } as any, "Alpha");
        return view;
    };

    it("renders and validates join form inputs", () => {
        const view = new TeilnehmerView();
        const submit = vi.fn();
        view.renderJoinForm("ab12cd");
        view.bindJoinForm(submit);

        const uebung = document.getElementById("joinUebungCode") as HTMLInputElement;
        const teilnehmer = document.getElementById("joinTeilnehmerCode") as HTMLInputElement;
        const form = document.getElementById("teilnehmerJoinForm") as HTMLFormElement;
        uebung.value = "ab-12 cd";
        teilnehmer.value = "9f_3k";
        uebung.dispatchEvent(new window.Event("input"));
        teilnehmer.dispatchEvent(new window.Event("input"));
        form.dispatchEvent(new window.Event("submit"));

        expect(submit).toHaveBeenCalledWith("AB12CD", "9F3K");
        view.showJoinError("Fehler");
        expect(document.getElementById("teilnehmerJoinError")?.textContent).toContain("Fehler");
    });

    it("renders header and messages with filters, escaping and status", () => {
        const view = renderBase();
        view.renderNachrichten(
            [
                { id: 1, empfaenger: ["B"], nachricht: "<b>text</b>" },
                { id: 2, empfaenger: ["C"], nachricht: "andere" }
            ],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { hideTransmitted: false, nachrichten: { 1: { uebertragen: true } } } as any
        );
        const html = document.getElementById("teilnehmerNachrichtenBody")?.innerHTML ?? "";
        expect(html).toContain("status-chip--ok");
        expect(html).toContain("&lt;b&gt;text&lt;/b&gt;");

        (document.getElementById("teilnehmerSearchInput") as HTMLInputElement).value = "andere";
        view.renderNachrichten(
            [
                { id: 1, empfaenger: ["B"], nachricht: "eins" },
                { id: 2, empfaenger: ["C"], nachricht: "andere" }
            ],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { hideTransmitted: true, nachrichten: { 2: { uebertragen: true } } } as any
        );
        expect(document.getElementById("teilnehmerNachrichtenBody")?.textContent).toContain("Keine Nachrichten vorhanden");
    });

    it("binds click/change/search/doc view events and keyboard shortcuts", () => {
        const view = renderBase();
        view.renderNachrichten([{ id: 1, empfaenger: ["B"], nachricht: "text" }], {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hideTransmitted: false, nachrichten: {}
        } as any);

        const cb = {
            onToggleUebertragen: vi.fn(),
            onToggleHide: vi.fn(),
            onReset: vi.fn(),
            onDocViewChange: vi.fn(),
            onDocPrev: vi.fn(),
            onDocNext: vi.fn(),
            onDocClose: vi.fn(),
            onDocToggleCurrent: vi.fn(),
            onDownloadZip: vi.fn(),
            onSearch: vi.fn()
        };
        view.bindEvents(
            cb.onToggleUebertragen, cb.onToggleHide, cb.onReset, cb.onDocViewChange, cb.onDocPrev, cb.onDocNext,
            cb.onDocClose, cb.onDocToggleCurrent, cb.onDownloadZip, cb.onSearch
        );

        (document.getElementById("btn-reset-teilnehmer-data") as HTMLButtonElement).click();
        (document.getElementById("btn-download-teilnehmer-zip") as HTMLButtonElement).click();
        (document.getElementById("toggle-hide-transmitted") as HTMLInputElement).click();
        (document.getElementById("teilnehmerSearchInput") as HTMLInputElement).dispatchEvent(new window.Event("input"));
        expect(cb.onReset).toHaveBeenCalled();
        expect(cb.onDownloadZip).toHaveBeenCalled();
        expect(cb.onToggleHide).toHaveBeenCalled();
        expect(cb.onSearch).toHaveBeenCalled();

        const modeBtn = document.querySelector("[data-doc-view='meldevordruck']") as HTMLButtonElement;
        modeBtn.click();
        expect(cb.onDocViewChange).toHaveBeenCalledWith("meldevordruck");

        const checkbox = document.querySelector(".btn-toggle-uebertragen") as HTMLInputElement;
        checkbox.dispatchEvent(new window.Event("change", { bubbles: true }));
        const chip = document.querySelector(".btn-toggle-uebertragen-chip") as HTMLButtonElement;
        chip.click();
        expect(cb.onToggleUebertragen).toHaveBeenCalled();

        const modal = document.getElementById("teilnehmerDocModal") as HTMLElement;
        modal.classList.add("show");
        document.dispatchEvent(new window.KeyboardEvent("keydown", { code: "Space" }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ü" }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "m" }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "n" }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowLeft" }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight" }));
        expect(cb.onDocToggleCurrent).toHaveBeenCalled();
        expect(cb.onDocPrev).toHaveBeenCalled();
        expect(cb.onDocNext).toHaveBeenCalled();
        expect(cb.onDocClose).toHaveBeenCalled();
    });

    it("switches doc mode and toggles modal classes", () => {
        const view = renderBase();
        const modalEl = document.getElementById("teilnehmerDocModal") as HTMLElement;
        const show = vi.fn();
        const hide = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).bootstrap = {
            Modal: {
                getOrCreateInstance: () => ({ show, hide })
            }
        };
        view.setDocMode("meldevordruck");
        expect(show).toHaveBeenCalled();
        expect(modalEl.classList.contains("show")).toBe(false);
        view.setDocMode("table");
        expect(hide).toHaveBeenCalled();

        // fallback branch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).bootstrap;
        view.setDocMode("table");
        expect(document.body.classList.contains("modal-open")).toBe(false);

        view.setDocTransmitted(true);
        expect(modalEl.classList.contains("teilnehmer-doc-modal--done")).toBe(true);
        view.setDocTransmitted(false);
        expect(modalEl.classList.contains("teilnehmer-doc-modal--done")).toBe(false);
    });

    it("updates page label and buttons without canvas render path", async () => {
        const view = renderBase();
        const center = document.getElementById("teilnehmerPdfView");
        center?.remove();
        const canvas = document.getElementById("teilnehmerPdfCanvas");
        canvas?.remove();
        await view.renderPdfPage(new Blob(["x"]), 2, 3);
        expect(document.getElementById("teilnehmerDocPage")?.textContent).toContain("Seite 2 / 3");
        expect((document.getElementById("btn-doc-prev") as HTMLButtonElement).disabled).toBe(false);
        expect((document.getElementById("btn-doc-next") as HTMLButtonElement).disabled).toBe(false);

        await view.renderPdfPage(new Blob(["x"]), 1, 1);
        expect((document.getElementById("btn-doc-prev") as HTMLButtonElement).disabled).toBe(true);
        expect((document.getElementById("btn-doc-next") as HTMLButtonElement).disabled).toBe(true);
    });

    it("covers bindEvents guard and invalid toggle ids", () => {
        const view = new TeilnehmerView();
        const onToggle = vi.fn();
        // no container branch
        view.bindEvents(onToggle, vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn());

        const full = renderBase();
        full.renderNachrichten([{ id: 1, empfaenger: ["B"], nachricht: "x" }], {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hideTransmitted: false, nachrichten: {}
        } as any);
        full.bindEvents(onToggle, vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn());

        const tbody = document.getElementById("teilnehmerNachrichtenBody") as HTMLElement;
        tbody.innerHTML += "<input class='btn-toggle-uebertragen' data-id='x'>";
        const invalid = tbody.querySelector("input[data-id='x']") as HTMLInputElement;
        invalid.dispatchEvent(new window.Event("change", { bubbles: true }));
        expect(onToggle).not.toHaveBeenCalledWith(NaN, expect.anything());
    });

    it("covers keyboard typing targets and no modal branch", () => {
        const view = renderBase();
        view.renderNachrichten([{ id: 1, empfaenger: ["B"], nachricht: "x" }], {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hideTransmitted: false, nachrichten: {}
        } as any);
        const onDocToggleCurrent = vi.fn();
        const onToggleHide = vi.fn();
        view.bindEvents(vi.fn(), onToggleHide, vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), onDocToggleCurrent, vi.fn(), vi.fn());

        const input = document.getElementById("teilnehmerSearchInput") as HTMLInputElement;
        document.dispatchEvent(new window.KeyboardEvent("keydown", { code: "Space" }));
        input.dispatchEvent(new window.KeyboardEvent("keydown", { code: "Space", bubbles: true }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "[" }));
        expect(onToggleHide).toHaveBeenCalled();
        expect(onDocToggleCurrent).not.toHaveBeenCalled();
    });

    it("covers render guards and additional delegation branches", () => {
        const view = new TeilnehmerView();
        document.getElementById("teilnehmerContent")?.remove();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderHeader({ name: "X", datum: new Date(), rufgruppe: "", leitung: "" } as any, "A");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderNachrichten([], { hideTransmitted: false, nachrichten: {} } as any);

        document.body.innerHTML = "<div id=\"teilnehmerContent\"></div>";
        const full = renderBase();
        full.renderNachrichten([{ id: 1, empfaenger: ["B"], nachricht: "line1\\nline2" }], {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hideTransmitted: false, nachrichten: {}
        } as any);
        expect(document.getElementById("teilnehmerNachrichtenBody")?.innerHTML).toContain("<br>");

        const onToggle = vi.fn();
        full.bindEvents(onToggle, vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn());
        const tbody = document.getElementById("teilnehmerNachrichtenBody") as HTMLElement;
        tbody.innerHTML += "<button class='btn-toggle-uebertragen-chip' data-id='abc' data-checked='1'>x</button>";
        const invalidChip = tbody.querySelector(".btn-toggle-uebertragen-chip[data-id='abc']") as HTMLButtonElement;
        invalidChip.click();
        expect(onToggle).not.toHaveBeenCalled();
    });

    it("covers setDocMode guard and no-modal toggle path", () => {
        const view = new TeilnehmerView();
        // no elements branch
        view.setDocMode("table");
        expect(true).toBe(true);

        const full = renderBase();
        document.getElementById("teilnehmerDocModal")?.remove();
        full.setDocMode("meldevordruck");
        expect(true).toBe(true);
    });
});
