import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

    it("escapes exercise data in the header and in message rows", () => {
        const view = new TeilnehmerView();
        const payload = "<img src=x onerror=alert(1)>";
        view.renderHeader(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { name: payload, datum: new Date(), rufgruppe: payload, leitung: payload } as any,
            payload
        );
        const headerHtml = document.getElementById("teilnehmerContent")?.innerHTML ?? "";
        expect(headerHtml).not.toContain("<img src=x");
        expect(headerHtml.match(/&lt;img src=x onerror=alert\(1\)&gt;/g)?.length).toBe(4);

        view.renderNachrichten([{ id: 1, empfaenger: [payload], nachricht: "x" }], {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hideTransmitted: false, nachrichten: {}
        } as any);
        const rowHtml = document.getElementById("teilnehmerNachrichtenBody")?.innerHTML ?? "";
        expect(rowHtml).not.toContain("<img src=x");
        expect(rowHtml).toContain("&lt;img src=x onerror=alert(1)&gt;");
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

    it("ignores shortcuts while typing in the search field", () => {
        const view = renderBase();
        view.renderNachrichten([{ id: 1, empfaenger: ["B"], nachricht: "x" }], {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hideTransmitted: false, nachrichten: {}
        } as any);
        const onDocViewChange = vi.fn();
        const onDocToggleCurrent = vi.fn();
        const onToggleHide = vi.fn();
        const onDocClose = vi.fn();
        view.bindEvents(
            vi.fn(), onToggleHide, vi.fn(), onDocViewChange, vi.fn(), vi.fn(),
            onDocClose, onDocToggleCurrent, vi.fn(), vi.fn()
        );

        // Modal offen, damit ausschliesslich der Tipp-Schutz greift.
        (document.getElementById("teilnehmerDocModal") as HTMLElement).classList.add("show");
        const input = document.getElementById("teilnehmerSearchInput") as HTMLInputElement;
        for (const init of [
            { code: "Space" }, { key: "ü" }, { key: "[" }, { key: "m" },
            { key: "n" }, { key: "Escape" }, { key: "ArrowLeft" }, { key: "ArrowRight" }
        ]) {
            input.dispatchEvent(new window.KeyboardEvent("keydown", { ...init, bubbles: true }));
        }

        expect(onDocViewChange).not.toHaveBeenCalled();
        expect(onToggleHide).not.toHaveBeenCalled();
        expect(onDocToggleCurrent).not.toHaveBeenCalled();
        expect(onDocClose).not.toHaveBeenCalled();
    });

    it("ignores shortcuts while the doc modal is closed", () => {
        const view = renderBase();
        view.renderNachrichten([{ id: 1, empfaenger: ["B"], nachricht: "x" }], {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hideTransmitted: false, nachrichten: {}
        } as any);
        const onDocViewChange = vi.fn();
        const onDocToggleCurrent = vi.fn();
        const onToggleHide = vi.fn();
        view.bindEvents(
            vi.fn(), onToggleHide, vi.fn(), onDocViewChange, vi.fn(), vi.fn(),
            vi.fn(), onDocToggleCurrent, vi.fn(), vi.fn()
        );

        document.dispatchEvent(new window.KeyboardEvent("keydown", { code: "Space" }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "[" }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "m" }));
        expect(onToggleHide).not.toHaveBeenCalled();
        expect(onDocViewChange).not.toHaveBeenCalled();
        expect(onDocToggleCurrent).not.toHaveBeenCalled();
    });

    it("keeps shortcuts alive on modal checkboxes and leaves Space native there", () => {
        const view = renderBase();
        const onDocViewChange = vi.fn();
        const onDocToggleCurrent = vi.fn();
        view.bindEvents(
            vi.fn(), vi.fn(), vi.fn(), onDocViewChange, vi.fn(), vi.fn(),
            vi.fn(), onDocToggleCurrent, vi.fn(), vi.fn()
        );

        (document.getElementById("teilnehmerDocModal") as HTMLElement).classList.add("show");
        const checkbox = document.getElementById("toggle-hide-transmitted-modal") as HTMLInputElement;
        checkbox.dispatchEvent(new window.KeyboardEvent("keydown", { key: "n", bubbles: true }));
        expect(onDocViewChange).toHaveBeenCalledWith("nachrichtenvordruck");

        checkbox.dispatchEvent(new window.KeyboardEvent("keydown", { code: "Space", bubbles: true }));
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

    it("zeigt Bestätigungen der Übungsleitung je Nachricht", () => {
        const view = renderBase();
        view.renderNachrichten(
            [
                { id: 1, empfaenger: ["B"], nachricht: "eins" },
                { id: 2, empfaenger: ["C"], nachricht: "zwei" }
            ],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { hideTransmitted: false, nachrichten: {} } as any,
            { bestaetigungen: { "1": { abgesetztUm: "2026-07-26T10:00:00.000Z" } } }
        );

        const rows = document.querySelectorAll("#teilnehmerNachrichtenBody tr");
        expect(rows[0]?.textContent).toContain("bestätigt");
        // Ohne Bestätigung bleibt die Spalte leer.
        expect(rows[1]?.textContent).not.toContain("bestätigt");
    });

    it("spiegelt den Sync-Zustand im Kopfbereich", () => {
        const view = renderBase();
        const badge = document.getElementById("teilnehmerLiveSyncBadge");

        view.updateLiveSyncState("live");
        expect(badge?.textContent).toContain("live");
        expect(badge?.className).toContain("bg-success");

        view.updateLiveSyncState("fehler");
        expect(badge?.textContent).toContain("offline");

        view.updateLiveSyncState("verbinde");
        expect(badge?.textContent).toContain("verbinde");

        view.updateLiveSyncState("aus");
        expect(badge?.textContent).toContain("aus");

        badge?.remove();
        expect(() => view.updateLiveSyncState("live")).not.toThrow();
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

describe("TeilnehmerView – Fokus-Modus", () => {
    beforeEach(() => {
        setupDom();
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 6, 30, 12, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const renderXZeit = () => {
        const view = new TeilnehmerView();
        view.renderHeader(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { name: "Ü", datum: new Date(), rufgruppe: "RG", leitung: "L", spielModus: "xZeit" } as any,
            "Alpha"
        );
        return view;
    };

    const nachrichten = [
        { id: 1, empfaenger: ["Bravo"], nachricht: "Erste <b>Meldung</b>", xZeitSlot: 0 },
        { id: 2, empfaenger: ["Charlie"], nachricht: "Zweite", xZeitSlot: 30 }
    ];

    const renderMitStorage = (view: TeilnehmerView, storageNachrichten: Record<string, { uebertragen: boolean }>, basis?: string) => {
        view.renderNachrichten(
            nachrichten,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { hideTransmitted: false, fokusModus: true, nachrichten: storageNachrichten } as any,
            { showXZeit: true, ...(basis ? { xZeitBasis: basis } : {}) }
        );
    };

    it("zeigt die fällige Meldung groß an und blendet die Tabelle aus", () => {
        const view = renderXZeit();
        renderMitStorage(view, {}, "11:55");

        const card = document.getElementById("teilnehmerFokusCard");
        expect(card?.classList.contains("d-none")).toBe(false);
        expect(card?.innerHTML).toContain("Meldung 1 fällig · X+0");
        expect(card?.innerHTML).toContain("Erste &lt;b&gt;Meldung&lt;/b&gt;");
        expect(card?.innerHTML).toContain("an: Bravo");
        expect((document.getElementById("teilnehmerTableView") as HTMLElement).style.display).toBe("none");
    });

    it("zeigt einen Countdown, solange keine Meldung fällig ist", () => {
        const view = renderXZeit();
        renderMitStorage(view, { 1: { uebertragen: true } }, "11:55");

        // Slot 30 ab Basis 11:55 → fällig 12:25, jetzt 12:00 → 25 Minuten.
        expect(document.getElementById("fokusCountdown")?.textContent).toBe("25:00");
        const card = document.getElementById("teilnehmerFokusCard");
        expect(card?.innerHTML).toContain("Nächste Meldung in");
        expect(card?.innerHTML).not.toContain("Zweite");
    });

    it("meldet Vollzug, wenn alles übertragen ist", () => {
        const view = renderXZeit();
        renderMitStorage(view, { 1: { uebertragen: true }, 2: { uebertragen: true } }, "11:55");

        expect(document.getElementById("teilnehmerFokusCard")?.textContent).toContain("Alle Meldungen übertragen");
    });

    it("bittet ohne Basis um den X-Zeit-Start", () => {
        const view = renderXZeit();
        renderMitStorage(view, {});

        expect(document.getElementById("teilnehmerFokusCard")?.textContent).toContain("Starte oben die X-Zeit");
    });

    it("lässt die Tabelle sichtbar, wenn der Fokus-Modus aus ist", () => {
        const view = renderXZeit();
        view.renderNachrichten(
            nachrichten,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { hideTransmitted: false, fokusModus: false, nachrichten: {} } as any,
            { showXZeit: true, xZeitBasis: "11:55" }
        );

        expect(document.getElementById("teilnehmerFokusCard")?.classList.contains("d-none")).toBe(true);
        expect((document.getElementById("teilnehmerTableView") as HTMLElement).style.display).toBe("");
    });

    it("meldet Schalter und Übertragen-Button an den Controller", () => {
        const view = renderXZeit();
        const onToggle = vi.fn();
        const onUebertragen = vi.fn();
        view.bindFokusEvents(onToggle, onUebertragen);
        renderMitStorage(view, {}, "11:55");

        const toggle = document.getElementById("toggle-fokus-modus") as HTMLInputElement;
        toggle.checked = false;
        toggle.dispatchEvent(new window.Event("change"));
        expect(onToggle).toHaveBeenCalledWith(false);

        (document.querySelector("[data-fokus-uebertragen=\"1\"]") as HTMLButtonElement).click();
        expect(onUebertragen).toHaveBeenCalledWith(1);
    });

    it("aktualisiert die Fokus-Karte über den X-Zeit-Ticker", () => {
        const view = renderXZeit();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const storage = { hideTransmitted: false, fokusModus: true, nachrichten: { 1: { uebertragen: true } } } as any;
        view.renderNachrichten(nachrichten, storage, { showXZeit: true, xZeitBasis: "11:55" });
        expect(document.getElementById("fokusCountdown")?.textContent).toBe("25:00");

        vi.setSystemTime(new Date(2026, 6, 30, 12, 10, 0));
        view.updateXZeitCountdown(nachrichten, storage, "11:55");
        expect(document.getElementById("fokusCountdown")?.textContent).toBe("15:00");
    });
});
