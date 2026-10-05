import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

vi.mock("../../src/core/chart", () => {
    const FakeChart = function () {};
    (FakeChart as unknown as { getChart: () => undefined }).getChart = () => undefined;
    return {
        Chart: FakeChart,
        themeFarben: () => ({ text: "#000", text2: "#555", linie: "#ddd", akzent: "#123", akzentHell: "#456", gut: "#060", warn: "#640" })
    };
});

import { UebungsleitungView } from "../../src/uebungsleitung/UebungsleitungView";
import { renderGeraetHinweis } from "../../src/uebungsleitung/teilnehmerMarkup";

/**
 * Ansicht der Übungsleitung nach dem zweiten THW-Review (2026-10-05):
 * Kartenansicht, Ausgelassen, Reaktion, Abbruch der Listener, Einklappen.
 */

const setDom = () => {
    const dom = new JSDOM(`
      <div id="uebungsleitungArea">
        <div class="app-view-shell">
          <div id="uebungsleitungResetErfolg" class="d-none"></div>
          <div id="uebungsleitungMeta"></div>
          <div id="uebungsleitungLageBody"></div>
          <button id="btn-teilnehmer-einklappen"></button>
          <div id="uebungsleitungTeilnehmer"></div>
          <div id="uebungsleitungNachrichten"></div>
          <div id="uebungsleitungGefahrenbereich"><div id="uebungsleitungGefahrenbereichBody"></div></div>
        </div>
        <div id="uebungsleitungUndo" class="d-none"></div>
      </div>
      <button id="btn-cockpit-xzeit-jetzt">Jetzt starten</button>
      <button id="btn-cockpit-xzeit-vorschlag" class="d-none"></button>
      <span id="cockpitPlanBadge"></span>
      <div id="cockpitUhrzeit"></div><div id="cockpitLaufzeit"></div><div id="cockpitXZeit"></div>
      <span id="cockpitFortschritt"></span><small id="cockpitBasisHinweis"></small><small id="cockpitAbweichungen"></small>
    `);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    return dom;
};

const callbacks = () => ({
    onAbgesetzt: vi.fn(),
    onReset: vi.fn(),
    onNotiz: vi.fn(),
    onAuslassen: vi.fn(),
    onWiederOeffnen: vi.fn(),
    onReaktion: vi.fn(),
    onFilterSender: vi.fn(),
    onFilterEmpfaenger: vi.fn(),
    onToggleHide: vi.fn(),
    onFilterText: vi.fn()
});

const jetzt = new Date(2026, 9, 5, 19, 20).getTime();

function renderPlan(view: UebungsleitungView, hideAbgesetzt = false) {
    view.renderNachrichtenListe({
        nachrichten: [
            { sender: "EA1", nr: 1, empfaenger: ["Stelle"], text: "Auftrag", erwartung: "quittieren", xZeitSlot: 0, planNr: 1 },
            { sender: "EA1", nr: 2, empfaenger: ["Stelle"], text: "Lage", erwartung: "Lagekarte", xZeitSlot: 1, planNr: 2 },
            { sender: "Stab", nr: 1, empfaenger: ["Stelle"], text: "Weisung", xZeitSlot: 2, planNr: 3 },
            { sender: "Stab", nr: 2, empfaenger: ["Stelle", "EA1"], text: "Später", xZeitSlot: 30, planNr: 4 }
        ],
        nachrichtenStatus: {
            "EA1__1": { abgesetztUm: new Date(jetzt - 6 * 60000).toISOString(), zeitVomTeilnehmer: true },
            "EA1__2": { abgesetztUm: new Date(jetzt - 60000).toISOString(), reaktion: "abweichend" },
            "Stab__1": { ausgelassen: true, statusGeaendertUm: new Date(jetzt).toISOString() }
        },
        hideAbgesetzt,
        senderFilter: "",
        empfaengerFilter: "",
        textFilter: "",
        faelligkeit: { "Stab__2": { zustand: "ueberfaellig", sollMs: jetzt - 10 * 60000, minuten: 10 } },
        sollUhrzeit: { "Stab__2": "19:10" },
        jetztMs: jetzt
    });
}

describe("Übungsleitung – Plan nach THW-Review 2026-10-05", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setDom();
    });

    it("zeigt Ausgelassen, Reaktion, auslassen und Herkunft der Zeit und meldet die Klicks", () => {
        const view = new UebungsleitungView();
        const cb = callbacks();
        renderPlan(view);
        view.bindNachrichtenEvents(cb);

        const zeilen = document.querySelectorAll("#uebungsleitungNachrichten tbody tr");
        expect(zeilen).toHaveLength(4);
        expect(zeilen[0]?.textContent).toContain("Zeit vom TN");
        expect(zeilen[0]?.textContent).toContain("Reaktion ausstehend seit 6 min");
        expect(zeilen[1]?.querySelector("[data-reaktion='abweichend']")?.getAttribute("aria-pressed")).toBe("true");
        expect(zeilen[1]?.textContent).not.toContain("ausstehend seit");
        expect(zeilen[2]?.className).toContain("status-ausgelassen-row");
        expect(zeilen[2]?.querySelector(".ul-reaktion-block")).toBeNull();
        // Kartenansicht: jede Zelle trägt ihren Spaltennamen.
        expect(zeilen[3]?.querySelector(".ul-zelle-sender")?.getAttribute("data-label")).toBe("von");
        expect(zeilen[3]?.querySelector(".ul-zelle-empfaenger")?.getAttribute("data-label")).toBe("an");

        (zeilen[0]?.querySelector("[data-reaktion='erfolgt']") as HTMLButtonElement).click();
        expect(cb.onReaktion).toHaveBeenCalledWith("EA1", 1, "erfolgt");
        (zeilen[2]?.querySelector("[data-action='wieder-oeffnen']") as HTMLButtonElement).click();
        expect(cb.onWiederOeffnen).toHaveBeenCalledWith("Stab", 1);
        (zeilen[3]?.querySelector("[data-action='auslassen']") as HTMLButtonElement).click();
        expect(cb.onAuslassen).toHaveBeenCalledWith("Stab", 2);

        // Unbekannte Reaktion wird ignoriert.
        const fremd = zeilen[0]?.querySelector("[data-reaktion='erfolgt']") as HTMLButtonElement;
        fremd.dataset["reaktion"] = "unsinn";
        fremd.click();
        expect(cb.onReaktion).toHaveBeenCalledTimes(1);
    });

    it("blendet Abgesetzte und Ausgelassene aus und nennt die Zahl am Schalter", () => {
        const view = new UebungsleitungView();
        renderPlan(view, true);
        expect(document.querySelectorAll("#uebungsleitungNachrichten tbody tr")).toHaveLength(1);
        const filter = document.querySelector(".ul-plan-filter");
        expect(filter?.textContent).toContain("3 ausgeblendet");
        expect(filter?.querySelector("#toggleHideAbgesetzt")).toBeTruthy();
        expect(filter?.querySelector("#senderFilterSelect")).toBeTruthy();
        expect(document.querySelector("thead #senderFilterSelect")).toBeNull();
    });

    it("löst beim Verlassen alle Listener – eine spätere Ansicht reagiert nicht doppelt", () => {
        const alt = new UebungsleitungView();
        const altCb = callbacks();
        renderPlan(alt);
        alt.bindNachrichtenEvents(altCb);
        const altTeilnehmer = { onAnmelden: vi.fn(), onLoesungswort: vi.fn(), onStaerke: vi.fn(), onNotiz: vi.fn(), onToggleDetails: vi.fn(), onDownloadDebrief: vi.fn() };
        alt.bindTeilnehmerEvents(altTeilnehmer);
        alt.dispose();

        const neu = new UebungsleitungView();
        const neuCb = callbacks();
        renderPlan(neu);
        neu.bindNachrichtenEvents(neuCb);
        const neuTeilnehmer = { ...altTeilnehmer, onDownloadDebrief: vi.fn() };
        neu.renderTeilnehmerListe({ teilnehmerListe: ["A"], nachrichten: {} } as never, {}, false);
        neu.bindTeilnehmerEvents(neuTeilnehmer);

        (document.querySelector("[data-action='auslassen']") as HTMLButtonElement).click();
        expect(altCb.onAuslassen).not.toHaveBeenCalled();
        expect(neuCb.onAuslassen).toHaveBeenCalledTimes(1);
        (document.querySelector("[data-action='download-debrief']") as HTMLButtonElement).click();
        expect(altTeilnehmer.onDownloadDebrief).not.toHaveBeenCalled();
        expect(neuTeilnehmer.onDownloadDebrief).toHaveBeenCalledTimes(1);
    });

    it("schließt die Rückgängig-Leiste auf Zuruf und hält solange Platz frei", () => {
        const view = new UebungsleitungView();
        const onUndo = vi.fn();
        view.zeigeRueckgaengig("weg", onUndo);
        expect(document.getElementById("uebungsleitungArea")?.classList.contains("ul-undo-offen")).toBe(true);
        view.schliesseRueckgaengig();
        expect(document.getElementById("uebungsleitungUndo")?.classList.contains("d-none")).toBe(true);
        expect(document.getElementById("uebungsleitungArea")?.classList.contains("ul-undo-offen")).toBe(false);
        expect(onUndo).not.toHaveBeenCalled();
    });

    it("klappt die Teilnehmertabelle ein und bestätigt ein Zurücksetzen", () => {
        const view = new UebungsleitungView();
        const onToggle = vi.fn();
        view.bindTeilnehmerEinklappen(onToggle);
        view.setTeilnehmerEingeklappt(true);
        expect(document.getElementById("uebungsleitungTeilnehmer")?.classList.contains("d-none")).toBe(true);
        expect(document.getElementById("btn-teilnehmer-einklappen")?.textContent).toBe("Teilnehmer zeigen");
        (document.getElementById("btn-teilnehmer-einklappen") as HTMLButtonElement).click();
        expect(onToggle).toHaveBeenCalled();
        view.setTeilnehmerEingeklappt(false);
        expect(document.getElementById("btn-teilnehmer-einklappen")?.getAttribute("aria-expanded")).toBe("true");

        view.zeigeZurueckgesetzt(new Date(2026, 9, 5, 21, 5).toISOString());
        const erfolg = document.getElementById("uebungsleitungResetErfolg");
        expect(erfolg?.textContent).toBe("Übungsstand für alle zurückgesetzt (um 21:05).");
        expect(erfolg?.classList.contains("d-none")).toBe(false);
    });

    it("nennt im Cockpit den Neustart und dieselbe Rückstandszahl wie die Lage", () => {
        const view = new UebungsleitungView();
        view.updateCockpit({
            uhrzeit: "21:07:00", laufzeitMs: 60000, ist: 2, gesamt: 10, soll: 5, basisHinweis: "",
            vorschlag: "19:30", vorschlagLabel: "19:30 übernehmen (liegt 97 min zurück)",
            basisGesetzt: true, hinterPlan: { ueberfaellig: 12, faellig: 2 }
        });
        expect(document.getElementById("btn-cockpit-xzeit-jetzt")?.textContent).toBe("Neu starten (verschiebt alle Zeiten)");
        expect(document.getElementById("btn-cockpit-xzeit-vorschlag")?.textContent).toBe("19:30 übernehmen (liegt 97 min zurück)");
        const badge = document.getElementById("cockpitPlanBadge");
        expect(badge?.textContent).toBe("14 hinter Plan");
        expect(badge?.getAttribute("title")).toContain("12 überfällig, 2 jetzt fällig");

        view.updateCockpit({ uhrzeit: "", laufzeitMs: null, ist: 0, gesamt: 1, soll: null, basisHinweis: "" });
        expect(document.getElementById("btn-cockpit-xzeit-jetzt")?.textContent).toBe("Jetzt starten");
        expect(badge?.textContent).toBe("–");
    });

    it("zeigt das Übungsdatum als Datum und den Gefahrenbereich in eigener Warnfarbe", () => {
        const view = new UebungsleitungView();
        view.renderMeta({ name: "Ü", datum: new Date(2026, 9, 5), teilnehmerListe: [], nachrichten: {} } as never, "u1");
        expect(document.getElementById("uebungsleitungMeta")?.textContent).toContain("05.10.2026");
        expect(document.querySelector("#uebungsleitungGefahrenbereichBody h3")?.className).toContain("ul-gefahr-titel");
        view.renderMeta({ name: "Ü", datum: "kaputt", teilnehmerListe: [], nachrichten: {} } as never, "u1");
        expect(document.getElementById("uebungsleitungMeta")?.textContent).toContain("Datum –");
    });

    it("springt aus der Lage zum Zurücksetzen und zur ersten fälligen Zeile", () => {
        const view = new UebungsleitungView();
        renderPlan(view);
        const scroll = vi.fn();
        (window as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement.prototype.scrollIntoView = scroll;
        view.renderLage({
            teilnehmer: [], naechste: [], zuBestaetigen: 0, hideAbgesetzt: false, ueberfaellig: 0, faellig: 1,
            veraltet: { anzahl: 2, fassungVom: "05.10. um 19:00" }
        });
        view.bindLageEvents({ onGemeldeteBestaetigen: vi.fn(), onToggleHide: vi.fn() });
        (document.querySelector("[data-action='zu-zuruecksetzen']") as HTMLButtonElement).click();
        expect(document.getElementById("uebungsleitungGefahrenbereich")?.classList.contains("plan-zeile--ziel")).toBe(true);
        (document.querySelector("[data-action='zu-ueberfaellig']") as HTMLButtonElement).click();
        expect(scroll).toHaveBeenCalledTimes(1);
    });
});

describe("Übungsleitung – Teilnehmertabelle nach THW-Review 2026-10-05", () => {
    beforeEach(() => setDom());

    it("benennt die Stärke als Summe der an die Stelle gemeldeten Stärken und das Debrief als Nachbesprechung", () => {
        const view = new UebungsleitungView();
        view.renderTeilnehmerListe({
            teilnehmerListe: ["A"],
            loesungsStaerken: { A: "0/5/15/20" },
            nachrichten: {}
        } as never, {}, false);
        const text = document.getElementById("uebungsleitungTeilnehmer")?.textContent ?? "";
        expect(text).toContain("Erwartete Summe der an sie gemeldeten Stärken");
        expect(text).toContain("Debrief (PDF)");
        expect(text).not.toContain("Soll (F/UF/H/Ges)");
        expect(document.querySelector("#uebungsleitungTeilnehmer td[data-label='Angemeldet']")).toBeTruthy();
    });

    it("warnt vor einem stillen Gerät mit eigener Klasse und Symbol", () => {
        const html = renderGeraetHinweis(
            { teilnehmer: "A", gemeldet: 1, bestaetigt: 0, erledigt: 1, gesamt: 5, online: true, zuletztGesehenUm: new Date(jetzt - 12 * 60000).toISOString() },
            jetzt
        );
        expect(html).toContain("ul-warnzeile");
        expect(html).toContain("⚠ seit 12 min nichts vom Gerät");
        expect(html).not.toContain("text-warning-emphasis");
    });
});
