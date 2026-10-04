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

        const absetzen = document.querySelector("[data-aktion='absetzen']") as HTMLButtonElement;
        absetzen.click();
        expect(cb.onToggleUebertragen).toHaveBeenCalledWith(1, true);

        const modal = document.getElementById("teilnehmerDocModal") as HTMLElement;
        modal.classList.add("show");
        // Nach dem Abhaken oben läuft die Tippsperre; hier später weitermachen.
        const spaeter = Date.now() + 5000;
        const nowSpy = vi.spyOn(Date, "now").mockReturnValue(spaeter);
        document.dispatchEvent(new window.KeyboardEvent("keydown", { code: "Space" }));
        nowSpy.mockRestore();
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
        tbody.innerHTML += "<button data-aktion='absetzen' data-id='x'>x</button><button data-aktion='quatsch' data-id='1'>y</button>";
        (tbody.querySelector("[data-id='x']") as HTMLButtonElement).click();
        (tbody.querySelector("[data-aktion='quatsch']") as HTMLButtonElement).click();
        expect(onToggle).not.toHaveBeenCalled();
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
        tbody.innerHTML += "<button data-aktion='zuruecknehmen' data-id='abc'>x</button>";
        const invalidChip = tbody.querySelector("[data-id='abc']") as HTMLButtonElement;
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

    describe("Absetzstrich", () => {
        it("marks only the just-transmitted row", () => {
            const view = renderBase();
            view.renderNachrichten(
                [
                    { id: 1, empfaenger: ["B"], nachricht: "eins" },
                    { id: 2, empfaenger: ["C"], nachricht: "zwei" }
                ],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { hideTransmitted: false, nachrichten: { 1: { uebertragen: true }, 2: { uebertragen: true } } } as any,
                { zuletztAbgesetzt: 2 }
            );
            const zeilen = document.querySelectorAll("#teilnehmerNachrichtenBody tr");
            expect(zeilen[0]?.className).not.toContain("ist-abgesetzt");
            expect(zeilen[1]?.className).toContain("ist-abgesetzt");
            expect(zeilen[1]?.className).not.toContain("ist-abgang");
        });

        it("does not mark anything without a transmission", () => {
            const view = renderBase();
            view.renderNachrichten(
                [{ id: 1, empfaenger: ["B"], nachricht: "eins" }],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { hideTransmitted: false, nachrichten: { 1: { uebertragen: true } } } as any
            );
            expect(document.getElementById("teilnehmerNachrichtenBody")?.innerHTML).not.toContain("ist-abgesetzt");
        });

        it("keeps the transmitted row visible while hiding is active, then removes it", () => {
            vi.useFakeTimers();
            try {
                const view = renderBase();
                view.renderNachrichten(
                    [
                        { id: 1, empfaenger: ["B"], nachricht: "eins" },
                        { id: 2, empfaenger: ["C"], nachricht: "zwei" }
                    ],
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    { hideTransmitted: true, nachrichten: { 2: { uebertragen: true } } } as any,
                    { zuletztAbgesetzt: 2 }
                );
                const tbody = document.getElementById("teilnehmerNachrichtenBody") as HTMLElement;
                expect(tbody.querySelectorAll("tr")).toHaveLength(2);
                expect(tbody.querySelector("tr[data-abgang]")?.className).toContain("ist-abgang");

                vi.advanceTimersByTime(1000);
                expect(tbody.querySelectorAll("tr")).toHaveLength(1);
                expect(tbody.textContent).toContain("eins");
            } finally {
                vi.useRealTimers();
            }
        });

        it("restores the empty notice when the last row goes", () => {
            vi.useFakeTimers();
            try {
                const view = renderBase();
                view.renderNachrichten(
                    [{ id: 1, empfaenger: ["B"], nachricht: "eins" }],
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    { hideTransmitted: true, nachrichten: { 1: { uebertragen: true } } } as any,
                    { zuletztAbgesetzt: 1 }
                );
                const tbody = document.getElementById("teilnehmerNachrichtenBody") as HTMLElement;
                expect(tbody.querySelectorAll("tr")).toHaveLength(1);

                vi.advanceTimersByTime(1000);
                expect(tbody.textContent).toContain("Keine Nachrichten vorhanden");
            } finally {
                vi.useRealTimers();
            }
        });
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

    it("zeigt in der Fokus-Karte Weg, Betreff und erwartete Reaktion einer Führungsstellen-Nachricht", () => {
        const view = renderXZeit();
        view.renderNachrichten(
            [{ id: 1, empfaenger: ["EL 10"], nachricht: "Sperren Sie den Mühlenkamp.", xZeitSlot: 0, weg: "drucker", meldeart: "auftrag", betreff: "Einsatzauftrag Nr. 3", erwartung: "An EA 12 weitergeben" }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { hideTransmitted: false, fokusModus: true, nachrichten: {} } as any,
            { showXZeit: true, xZeitBasis: "11:55" }
        );
        const html = document.getElementById("teilnehmerFokusCard")?.innerHTML ?? "";
        expect(html).toContain("Ausdruck");
        expect(html).toContain("Einsatzauftrag Nr. 3");
        expect(html).toContain("Erwartet: An EA 12 weitergeben");
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

        expect(document.getElementById("teilnehmerFokusCard")?.textContent).toContain("Alle Meldungen abgesetzt");
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

    it("bietet die zuletzt abgesetzte Meldung zum Zurücknehmen an und sperrt kurz nach einem Tipp", () => {
        const view = renderXZeit();
        const onUebertragen = vi.fn();
        const onZurueck = vi.fn();
        view.bindFokusEvents(vi.fn(), onUebertragen, onZurueck);
        const storage = {
            hideTransmitted: false, fokusModus: true,
            nachrichten: { 1: { uebertragen: true, uebertragenUm: "2026-07-30T11:58:00.000Z" } }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderNachrichten([...nachrichten, { id: 3, empfaenger: ["D"], nachricht: "Dritte", xZeitSlot: 1 }], storage as any,
            { showXZeit: true, xZeitBasis: "11:55" });

        const card = document.getElementById("teilnehmerFokusCard") as HTMLElement;
        expect(card.textContent).toContain("Zuletzt abgesetzt: Meldung 1");
        expect(card.textContent).toContain("Als abgesetzt markieren");

        // Doppeltipp: der zweite Tipp landet auf der nachrückenden Meldung und wird ignoriert.
        (card.querySelector("[data-fokus-uebertragen='3']") as HTMLButtonElement).click();
        (card.querySelector("[data-fokus-uebertragen='3']") as HTMLButtonElement).click();
        expect(onUebertragen).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1100);
        (card.querySelector("[data-fokus-zuruecknehmen='1']") as HTMLButtonElement).click();
        expect(onZurueck).toHaveBeenCalledWith(1);
    });

});

describe("TeilnehmerView – Bedienung am Handy (THW-Review 2026-10-04)", () => {
    beforeEach(() => {
        setupDom();
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 4, 19, 0, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const callbacks = () => ({
        onToggle: vi.fn(),
        onDocToggle: vi.fn()
    });

    const renderMit = (storageNachrichten: Record<string, unknown>, hide = false) => {
        const view = new TeilnehmerView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderHeader({ name: "Wellenbrecher", datum: "2026-10-04T09:00:00.000Z", rufgruppe: "RG", leitung: "L" } as any, "Alpha");
        const cb = callbacks();
        view.bindEvents(cb.onToggle, vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), cb.onDocToggle, vi.fn(), vi.fn());
        view.renderNachrichten(
            [
                { id: 1, empfaenger: ["B"], nachricht: "eins" },
                { id: 2, empfaenger: ["C"], nachricht: "zwei" },
                { id: 3, empfaenger: ["D"], nachricht: "drei" }
            ],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { hideTransmitted: hide, nachrichten: storageNachrichten } as any
        );
        return { view, cb };
    };

    it("hat je Spruch genau einen Abhak-Knopf und keinen zweiten Schalter für dieselbe Aktion", () => {
        renderMit({});
        const zeile = document.querySelector("#teilnehmerNachrichtenBody tr") as HTMLElement;
        expect(zeile.querySelectorAll("[data-aktion]")).toHaveLength(1);
        expect(zeile.querySelector("input[type='checkbox']")).toBeNull();
        expect(zeile.querySelector("[data-aktion='absetzen']")?.textContent).toContain("Als abgesetzt markieren");
        // Der Status ist eine Anzeige, kein Knopf.
        expect(zeile.querySelector(".status-chip")?.tagName).toBe("SPAN");
    });

    it("zeigt abgesetzte Sprüche mit Uhrzeit und einem eigenen Zurücknehmen-Knopf", () => {
        renderMit({ 1: { uebertragen: true, uebertragenUm: new Date(2026, 9, 4, 18, 42).toISOString() } });
        const zeile = document.querySelector("#teilnehmerNachrichtenBody tr") as HTMLElement;
        expect(zeile.querySelector(".status-chip")?.textContent).toContain("abgesetzt 18:42");
        expect(zeile.querySelector("[data-aktion='absetzen']")).toBeNull();
        expect(zeile.querySelector("[data-aktion='zuruecknehmen']")).not.toBeNull();
        expect(zeile.textContent).not.toMatch(/übertragen/i);
    });

    it("ein Doppeltipp nimmt eine Markierung nicht still zurück", () => {
        const { view, cb } = renderMit({});
        (document.querySelector("[data-aktion='absetzen'][data-id='2']") as HTMLButtonElement).click();
        expect(cb.onToggle).toHaveBeenCalledWith(2, true);

        // Controller rendert neu: an derselben Zeile steht jetzt "Zurücknehmen".
        view.renderNachrichten(
            [{ id: 2, empfaenger: ["C"], nachricht: "zwei" }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { hideTransmitted: false, nachrichten: { 2: { uebertragen: true } } } as any
        );
        vi.advanceTimersByTime(200);
        (document.querySelector("[data-aktion='zuruecknehmen'][data-id='2']") as HTMLButtonElement).click();
        expect(cb.onToggle).toHaveBeenCalledTimes(1);

        // Eine bewusste Korrektur nach der Sperre geht.
        vi.advanceTimersByTime(1000);
        (document.querySelector("[data-aktion='zuruecknehmen'][data-id='2']") as HTMLButtonElement).click();
        expect(cb.onToggle).toHaveBeenLastCalledWith(2, false);
    });

    it("sperrt nur die eben geänderte Nachricht, nicht die nächste", () => {
        const { cb } = renderMit({});
        (document.querySelector("[data-aktion='absetzen'][data-id='1']") as HTMLButtonElement).click();
        (document.querySelector("[data-aktion='absetzen'][data-id='2']") as HTMLButtonElement).click();
        expect(cb.onToggle).toHaveBeenCalledTimes(2);
    });

    it("hebt den nächsten offenen Spruch hervor", () => {
        renderMit({ 1: { uebertragen: true } });
        const zeilen = document.querySelectorAll("#teilnehmerNachrichtenBody tr");
        expect(zeilen[1]?.className).toContain("ist-naechster");
        expect(zeilen[1]?.textContent).toContain("als Nächstes");
        expect(zeilen[2]?.className).not.toContain("ist-naechster");
    });

    it("sagt bei „Abgesetzte ausblenden“, wie viele Sprüche verborgen sind", () => {
        renderMit({ 1: { uebertragen: true }, 2: { uebertragen: true } }, true);
        expect(document.getElementById("teilnehmerAusgeblendet")?.textContent).toBe("(2 ausgeblendet)");
        expect(document.querySelectorAll("#teilnehmerNachrichtenBody tr")).toHaveLength(1);
    });

    it("zeigt einen kompakten Kopf ohne doppeltes Sprechfunkübung und mit lesbarem Datum", () => {
        const view = new TeilnehmerView();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        view.renderHeader({ name: "Sprechfunkübung Wellenbrecher 2026", datum: "2026-10-04T09:00:00.000Z", rufgruppe: "RG", leitung: "L" } as any, "Alpha");
        const titel = document.querySelector(".teilnehmer-kopf .card-title")?.textContent ?? "";
        expect(titel).toBe("Sprechfunkübung Wellenbrecher 2026");
        expect(document.querySelector(".teilnehmer-kopf-daten")?.textContent).toContain("04.10.2026");
        // ZIP und Zurücksetzen stehen nicht mehr im Kopf.
        expect(document.querySelector(".teilnehmer-kopf #btn-reset-teilnehmer-data")).toBeNull();
        expect(document.querySelector(".teilnehmer-kopf #btn-download-teilnehmer-zip")).toBeNull();
        expect(document.querySelector(".teilnehmer-gefahr #btn-reset-teilnehmer-data")).not.toBeNull();
    });

    it("benennt das Zurücksetzen nach seiner Reichweite", () => {
        const { view } = renderMit({});
        view.setResetUmfang(true);
        expect(document.getElementById("teilnehmerResetLabel")?.textContent).toContain("für alle");
        expect(document.getElementById("teilnehmerResetHinweis")?.textContent).toContain("Übungsleitung");
        view.setResetUmfang(false);
        expect(document.getElementById("teilnehmerResetLabel")?.textContent).toContain("auf diesem Gerät");
        expect(document.getElementById("teilnehmerResetLabel")?.textContent).not.toContain("Lokale");
    });

    it("Rückgängig-Hinweis: Doppeltipp-sicher, nach Ablauf verschwunden", () => {
        const { view } = renderMit({});
        const undo = vi.fn();
        view.zeigeRueckgaengig("Spruch 2 als abgesetzt markiert.", undo);
        const box = document.getElementById("teilnehmerRueckgaengig") as HTMLElement;
        const knopf = document.getElementById("btn-teilnehmer-rueckgaengig") as HTMLButtonElement;
        expect(box.hidden).toBe(false);
        expect(box.textContent).toContain("Spruch 2");

        knopf.click();
        expect(undo).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1200);
        knopf.click();
        expect(undo).toHaveBeenCalledTimes(1);
        expect(box.hidden).toBe(true);

        view.zeigeRueckgaengig("x", undo);
        vi.advanceTimersByTime(9000);
        expect(box.hidden).toBe(true);
    });

    it("Vordruck: Touch-Knopf zum Abhaken mit Zustand und Sperre gegen Doppeltipp", () => {
        const { view, cb } = renderMit({});
        const knopf = document.getElementById("btn-doc-absetzen") as HTMLButtonElement;
        view.setDocTransmitted(false);
        expect(knopf.textContent).toContain("Als abgesetzt markieren");
        expect(document.getElementById("teilnehmerDocStatus")?.textContent).toBe("offen");

        knopf.click();
        knopf.click();
        expect(cb.onDocToggle).toHaveBeenCalledTimes(1);

        view.setDocTransmitted(true);
        expect(knopf.textContent).toContain("Zurücknehmen");
        expect(document.getElementById("teilnehmerDocStatus")?.textContent).toContain("abgesetzt");

        view.setDocTransmitted(false, false);
        expect(knopf.disabled).toBe(true);

        // Leertaste unterliegt derselben Sperre.
        (document.getElementById("teilnehmerDocModal") as HTMLElement).classList.add("show");
        vi.advanceTimersByTime(1100);
        document.dispatchEvent(new window.KeyboardEvent("keydown", { code: "Space" }));
        document.dispatchEvent(new window.KeyboardEvent("keydown", { code: "Space" }));
        expect(cb.onDocToggle).toHaveBeenCalledTimes(2);
    });

    it("Vordruck: Schließen ist ein beschrifteter Knopf, die Legende nennt keine „Übertragen“-Taste", () => {
        renderMit({});
        const schliessen = document.getElementById("btn-doc-close") as HTMLButtonElement;
        expect(schliessen.textContent).toContain("Schließen");
        const legende = document.querySelector(".teilnehmer-doc-legend")?.textContent ?? "";
        expect(legende).toContain("Leertaste");
        expect(legende).not.toMatch(/übertragen/i);
    });

    it("hängt das Vordruck-Fenster beim Öffnen an body und räumt es beim neuen Rendern ab", () => {
        const { view } = renderMit({});
        view.setDocMode("meldevordruck");
        expect(document.getElementById("teilnehmerDocModal")?.parentElement).toBe(document.body);
        renderMit({});
        expect(document.querySelectorAll("#teilnehmerDocModal")).toHaveLength(1);
        void view;
    });

    it("Fehlerseite zeigt das Code-Formular mit Meldung und vorbelegtem Übungscode", () => {
        const view = new TeilnehmerView();
        view.renderZugangsFehler("Teilnehmer nicht in dieser Übung gefunden.", "K7M4Q2");
        expect(document.getElementById("teilnehmerJoinForm")).not.toBeNull();
        expect((document.getElementById("joinUebungCode") as HTMLInputElement).value).toBe("K7M4Q2");
        const fehler = document.getElementById("teilnehmerJoinError") as HTMLElement;
        expect(fehler.classList.contains("d-none")).toBe(false);
        expect(fehler.textContent).toContain("nicht in dieser Übung");
        // Code-Felder ohne Autokorrektur, mit Großbuchstaben-Tastatur.
        const feld = document.getElementById("joinTeilnehmerCode") as HTMLInputElement;
        expect(feld.getAttribute("autocapitalize")).toBe("characters");
        expect(feld.getAttribute("autocorrect")).toBe("off");
    });

    it("klappt am Handy die Website-Navigation ein, am Desktop nicht", async () => {
        vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
        const { klappeNavigationEin } = await import("../../src/teilnehmer/init");
        document.body.innerHTML = "<details class=\"site-nav-details\" open><summary>Menü</summary></details>";
        const details = document.querySelector("details") as HTMLDetailsElement;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).matchMedia = () => ({ matches: false });
        klappeNavigationEin();
        expect(details.hasAttribute("open")).toBe(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).matchMedia = () => ({ matches: true });
        klappeNavigationEin();
        expect(details.hasAttribute("open")).toBe(false);
    });

    it("nennt den Sync-Zustand nie „übertragen“", () => {
        const { view } = renderMit({});
        for (const state of ["aus", "verbinde", "live", "fehler"] as const) {
            view.updateLiveSyncState(state);
            expect(document.getElementById("teilnehmerLiveSyncBadge")?.getAttribute("title")).not.toMatch(/übertrag/i);
        }
    });
});
