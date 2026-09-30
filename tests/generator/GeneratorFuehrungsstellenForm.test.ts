import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { GeneratorFuehrungsstellenForm } from "../../src/generator/GeneratorFuehrungsstellenForm";

const MARKUP = `
<select id="fuehrungsstelleAuswahl"></select>
<input id="fuehrungsstelleBeuebteStelle">
<input id="fuehrungsstelleUebergeordnet">
<div id="fuehrungsstelleAbschnitte"></div>
<button id="fuehrungsstelleAbschnittHinzufuegen"></button>
<small id="fuehrungsstelleAbschnitteHinweis"></small>
<input id="fuehrungsstelleBeginn">
<div id="fuehrungsstelleDownloads" style="display:none"></div>`;

describe("GeneratorFuehrungsstellenForm", () => {
    let form: GeneratorFuehrungsstellenForm;

    beforeEach(() => {
        const dom = new JSDOM(MARKUP);
        vi.stubGlobal("window", dom.window);
        vi.stubGlobal("document", dom.window.document);
        vi.stubGlobal("AbortController", dom.window.AbortController);
        vi.stubGlobal("Event", dom.window.Event);
        form = new GeneratorFuehrungsstellenForm();
    });

    it("füllt die Drehbuch-Auswahl und liefert den gewählten Slug", () => {
        form.populateSelect({ a: { titel: "Lage A" }, b: { titel: "Lage B" } }, "b");
        expect(form.getSelected()).toBe("b");
        const onChange = vi.fn();
        form.bindChange(onChange, new AbortController().signal);
        document.getElementById("fuehrungsstelleAuswahl")?.dispatchEvent(new Event("change"));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("setzt und liest die Rollenbesetzung samt optionalem Übungsbeginn", () => {
        form.setRollen({ beuebteStelle: " EL 10 ", uebergeordnet: "Kater", unterstellt: ["EA 11", "EA 12"], beginn: "09:00" }, { min: 2, max: 6 });
        expect(form.getRollen()).toEqual({ beuebteStelle: "EL 10", uebergeordnet: "Kater", unterstellt: ["EA 11", "EA 12"], beginn: "09:00" });

        form.setRollen({ beuebteStelle: "EL", uebergeordnet: "Stab", unterstellt: ["EA"] }, { min: 1, max: 6 });
        expect(form.getRollen()).toEqual({ beuebteStelle: "EL", uebergeordnet: "Stab", unterstellt: ["EA"] });
        expect(form.getRollen()).not.toHaveProperty("beginn");
    });

    it("sperrt Entfernen an der Untergrenze und Hinzufügen an der Obergrenze", () => {
        form.renderAbschnitte(["EA 11", "EA 12"], { min: 2, max: 2 });
        const entfernen = document.querySelectorAll<HTMLButtonElement>(".fuehrungsstelle-abschnitt-entfernen");
        expect(entfernen).toHaveLength(2);
        entfernen.forEach(btn => expect(btn.disabled).toBe(true));
        expect((document.getElementById("fuehrungsstelleAbschnittHinzufuegen") as HTMLButtonElement).disabled).toBe(true);
        expect(document.getElementById("fuehrungsstelleAbschnitteHinweis")?.textContent).toContain("für 2 Einsatzabschnitte");

        form.renderAbschnitte(["EA 11", "EA 12", "EA 13"], { min: 2, max: 6 });
        expect((document.getElementById("fuehrungsstelleAbschnittHinzufuegen") as HTMLButtonElement).disabled).toBe(false);
        expect(document.querySelector<HTMLButtonElement>(".fuehrungsstelle-abschnitt-entfernen")?.disabled).toBe(false);
        expect(document.getElementById("fuehrungsstelleAbschnitteHinweis")?.textContent).toContain("2 bis 6");
    });

    it("meldet Hinzufügen und Entfernen mit dem Index der Zeile", () => {
        const onAdd = vi.fn();
        const onRemove = vi.fn();
        form.bindAbschnittEvents(onAdd, onRemove, new AbortController().signal);
        form.renderAbschnitte(["EA 11", "EA 12", "EA 13"], { min: 2, max: 6 });
        document.getElementById("fuehrungsstelleAbschnittHinzufuegen")?.dispatchEvent(new Event("click", { bubbles: true }));
        expect(onAdd).toHaveBeenCalledTimes(1);
        document.querySelectorAll<HTMLButtonElement>(".fuehrungsstelle-abschnitt-entfernen")[1]
            ?.dispatchEvent(new Event("click", { bubbles: true }));
        expect(onRemove).toHaveBeenCalledWith(1);
    });

    it("blendet den Drehbuch-Download ein und aus", () => {
        form.toggleDownloads(true);
        expect(document.getElementById("fuehrungsstelleDownloads")?.style.display).toBe("block");
        form.toggleDownloads(false);
        expect(document.getElementById("fuehrungsstelleDownloads")?.style.display).toBe("none");
    });

    it("bleibt ohne Formular-Knoten stumm", () => {
        document.body.innerHTML = "";
        expect(() => {
            form.populateSelect({ a: { titel: "A" } });
            form.renderAbschnitte(["x"], { min: 1, max: 1 });
            form.setRollen({ beuebteStelle: "", uebergeordnet: "", unterstellt: [] }, { min: 1, max: 1 });
            form.toggleDownloads(true);
        }).not.toThrow();
        expect(form.getSelected()).toBe("");
        expect(form.getRollen()).toEqual({ beuebteStelle: "", uebergeordnet: "", unterstellt: [] });
    });
});
