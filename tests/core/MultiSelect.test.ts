import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

import { MultiSelect } from "../../src/core/MultiSelect";

const MARKUP = `
    <label for="picker">Funkspruch-Vorlagen auswählen:</label>
    <select id="picker" multiple>
        <option value="a">Alpha</option>
        <option value="b">Bravo</option>
        <option value="c" disabled>Charlie</option>
    </select>
`;

const setup = (selected: string[] = []) => {
    const dom = new JSDOM(`<div id="host">${MARKUP}</div>`);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("Event", dom.window.Event);

    const select = dom.window.document.getElementById("picker") as HTMLSelectElement;
    Array.from(select.options).forEach(option => {
        option.selected = selected.includes(option.value);
    });

    const widget = MultiSelect.enhance(select);
    return { dom, select, widget };
};

const chipLabels = () =>
    Array.from(document.querySelectorAll(".multiselect-chip-label")).map(el => el.textContent);

const optionItems = () =>
    Array.from(document.querySelectorAll<HTMLElement>(".multiselect-option"));

const search = () => document.querySelector(".multiselect-search") as HTMLInputElement;

const click = (el: Element) => {
    el.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
};

const press = (key: string) => {
    search().dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
};

describe("MultiSelect", () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it("hides the native select but keeps it in the document", () => {
        const { select } = setup(["a"]);

        expect(select.isConnected).toBe(true);
        expect(select.classList.contains("multiselect-native")).toBe(true);
        // Der Wrapper darf das <select> nicht umhaengen - toggleSourceView() haengt
        // an dessen parentElement.
        expect(select.parentElement?.id).toBe("host");
        expect(select.nextElementSibling?.classList.contains("multiselect")).toBe(true);
    });

    it("renders a chip per selected option and a placeholder when empty", () => {
        setup(["a", "b"]);
        expect(chipLabels()).toEqual(["Alpha", "Bravo"]);

        setup([]);
        expect(chipLabels()).toEqual([]);
        expect(document.querySelector(".multiselect-placeholder")?.textContent).toBe("Auswählen ...");
    });

    it("labels the search field from the associated <label>", () => {
        setup([]);
        expect(search().getAttribute("aria-label")).toBe("Funkspruch-Vorlagen auswählen:");
    });

    it("opens on click, selects an option and emits change on the native select", () => {
        const { select } = setup([]);
        const onChange = vi.fn();
        select.addEventListener("change", onChange);

        click(search());
        expect(document.querySelector(".multiselect-dropdown")?.hasAttribute("hidden")).toBe(false);
        expect(search().getAttribute("aria-expanded")).toBe("true");

        click(optionItems()[1]);

        expect(Array.from(select.selectedOptions).map(o => o.value)).toEqual(["b"]);
        expect(chipLabels()).toEqual(["Bravo"]);
        expect(onChange).toHaveBeenCalledTimes(1);
        // closeOnSelect = false: die Liste bleibt fuer Mehrfachauswahl offen.
        expect(document.querySelector(".multiselect-dropdown")?.hasAttribute("hidden")).toBe(false);
    });

    it("deselects an already selected option", () => {
        const { select } = setup(["a", "b"]);
        click(search());
        click(optionItems()[0]);

        expect(Array.from(select.selectedOptions).map(o => o.value)).toEqual(["b"]);
        expect(chipLabels()).toEqual(["Bravo"]);
    });

    it("ignores disabled options", () => {
        const { select } = setup([]);
        click(search());

        const disabled = optionItems()[2];
        expect(disabled.classList.contains("multiselect-option--disabled")).toBe(true);
        click(disabled);

        expect(Array.from(select.selectedOptions)).toHaveLength(0);
    });

    it("removes a chip without opening the dropdown", () => {
        const { select } = setup(["a", "b"]);
        const remove = document.querySelector(".multiselect-chip-remove") as HTMLElement;

        click(remove);

        expect(Array.from(select.selectedOptions).map(o => o.value)).toEqual(["b"]);
        expect(document.querySelector(".multiselect-dropdown")?.hasAttribute("hidden")).toBe(true);

        // Genau diese Sequenz war unter select2 kaputt: nach dem Entfernen liess
        // sich das Dropdown per Maus nicht mehr oeffnen.
        click(search());
        expect(document.querySelector(".multiselect-dropdown")?.hasAttribute("hidden")).toBe(false);
    });

    it("filters options by the search term", () => {
        setup([]);
        click(search());
        expect(optionItems()).toHaveLength(3);

        search().value = "brav";
        search().dispatchEvent(new window.Event("input", { bubbles: true }));

        expect(optionItems().map(el => el.textContent)).toEqual(["Bravo"]);
        expect(document.querySelector(".multiselect-empty")?.hasAttribute("hidden")).toBe(true);

        search().value = "zulu";
        search().dispatchEvent(new window.Event("input", { bubbles: true }));

        expect(optionItems()).toHaveLength(0);
        expect(document.querySelector(".multiselect-empty")?.hasAttribute("hidden")).toBe(false);
    });

    it("navigates and toggles with the keyboard", () => {
        const { select } = setup([]);

        press("ArrowDown");
        expect(document.querySelector(".multiselect-option--active")?.textContent).toBe("Alpha");

        press("ArrowDown");
        expect(document.querySelector(".multiselect-option--active")?.textContent).toBe("Bravo");

        press("ArrowUp");
        press("Enter");
        expect(Array.from(select.selectedOptions).map(o => o.value)).toEqual(["a"]);

        press("Escape");
        expect(document.querySelector(".multiselect-dropdown")?.hasAttribute("hidden")).toBe(true);
    });

    it("removes the last chip on backspace in an empty search field", () => {
        const { select } = setup(["a", "b"]);

        press("Backspace");
        expect(Array.from(select.selectedOptions).map(o => o.value)).toEqual(["a"]);

        search().value = "x";
        press("Backspace");
        expect(Array.from(select.selectedOptions).map(o => o.value)).toEqual(["a"]);
    });

    it("re-renders when the native select changes from the outside", () => {
        const { select } = setup([]);

        select.options[1].selected = true;
        select.dispatchEvent(new window.Event("change", { bubbles: true }));

        expect(chipLabels()).toEqual(["Bravo"]);
    });

    it("closes when clicking outside", () => {
        setup([]);
        click(search());
        expect(document.querySelector(".multiselect-dropdown")?.hasAttribute("hidden")).toBe(false);

        document.body.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
        expect(document.querySelector(".multiselect-dropdown")?.hasAttribute("hidden")).toBe(true);
    });

    it("enhances a select only once and restores it on destroy", () => {
        const { select, widget } = setup(["a"]);

        expect(MultiSelect.enhance(select)).toBeNull();
        expect(MultiSelect.enhance(null)).toBeNull();

        widget?.destroy();

        expect(document.querySelector(".multiselect")).toBeNull();
        expect(select.classList.contains("multiselect-native")).toBe(false);
        expect(select.hasAttribute("aria-hidden")).toBe(false);
    });
});
