// Ersatz für select2: reichert ein natives <select multiple> um Chips, ein
// Suchfeld und eine Dropdown-Liste an - ohne jQuery. Das <select> bleibt im DOM
// und ist die einzige Quelle der Wahrheit; alles Weitere ist nur Darstellung.
// Dadurch funktionieren Formular-Serialisierung, page.selectOption() im E2E-Test
// und externe Änderungen (per "change"-Event) unverändert weiter.

export interface MultiSelectTexts {
    placeholder: string;
    search: string;
    empty: string;
    removeLabel: (option: string) => string;
}

const DEFAULT_TEXTS: MultiSelectTexts = {
    placeholder: "Auswählen ...",
    search: "Suchen ...",
    empty: "Keine Treffer",
    removeLabel: (option: string) => `${option} entfernen`
};

let instanceCounter = 0;

export class MultiSelect {
    private readonly select: HTMLSelectElement;
    private readonly texts: MultiSelectTexts;
    private readonly root: HTMLDivElement;
    private readonly control: HTMLDivElement;
    private readonly search: HTMLInputElement;
    private readonly dropdown: HTMLDivElement;
    private readonly list: HTMLUListElement;
    private readonly emptyHint: HTMLParagraphElement;
    private readonly onDocumentPointerDown: (event: Event) => void;

    // Options in der Reihenfolge, in der sie aktuell im Dropdown stehen. Nur
    // darauf arbeitet die Tastatur-Navigation.
    private filtered: HTMLOptionElement[] = [];
    private activeIndex = -1;
    private open = false;
    // Verhindert, dass unser eigenes change-Event ein Re-Render auslöst, das
    // gerade den Fokus oder die Scrollposition der Liste zerschießt.
    private emittingChange = false;

    public static enhance(
        select: HTMLSelectElement | null,
        texts: Partial<MultiSelectTexts> = {}
    ): MultiSelect | null {
        if (!select || select.dataset["multiselect"] === "on") {
            return null;
        }
        return new MultiSelect(select, texts);
    }

    private constructor(select: HTMLSelectElement, texts: Partial<MultiSelectTexts>) {
        this.select = select;
        this.texts = { ...DEFAULT_TEXTS, ...texts };
        const doc = select.ownerDocument;
        const id = `multiselect-${++instanceCounter}`;

        select.dataset["multiselect"] = "on";
        select.classList.add("multiselect-native");
        select.setAttribute("tabindex", "-1");
        select.setAttribute("aria-hidden", "true");

        this.root = doc.createElement("div");
        this.root.className = "multiselect";
        this.root.dataset["testid"] = "multiselect";

        this.control = doc.createElement("div");
        this.control.className = "multiselect-control";

        this.search = doc.createElement("input");
        this.search.type = "text";
        this.search.className = "multiselect-search";
        this.search.autocomplete = "off";
        this.search.placeholder = this.texts.search;
        this.search.setAttribute("role", "combobox");
        this.search.setAttribute("aria-autocomplete", "list");
        this.search.setAttribute("aria-expanded", "false");
        this.search.setAttribute("aria-controls", `${id}-list`);
        this.search.setAttribute("aria-label", this.resolveLabel());
        this.search.dataset["testid"] = "multiselect-search";

        const arrow = doc.createElement("span");
        arrow.className = "multiselect-arrow";
        arrow.setAttribute("aria-hidden", "true");

        this.control.append(this.search, arrow);

        this.dropdown = doc.createElement("div");
        this.dropdown.className = "multiselect-dropdown";
        this.dropdown.hidden = true;

        this.list = doc.createElement("ul");
        this.list.className = "multiselect-options";
        this.list.id = `${id}-list`;
        this.list.setAttribute("role", "listbox");
        this.list.setAttribute("aria-multiselectable", "true");

        this.emptyHint = doc.createElement("p");
        this.emptyHint.className = "multiselect-empty";
        this.emptyHint.textContent = this.texts.empty;
        this.emptyHint.hidden = true;

        this.dropdown.append(this.list, this.emptyHint);
        this.root.append(this.control, this.dropdown);
        // Als Geschwister einhängen, nicht als Wrapper: sonst würde sich
        // select.parentElement ändern, worauf toggleSourceView() sich verlässt.
        select.after(this.root);

        this.onDocumentPointerDown = (event: Event) => {
            if (!this.root.contains(event.target as Node)) {
                this.close();
            }
        };

        this.bindEvents(doc);
        this.render();
    }

    public destroy(): void {
        this.select.ownerDocument.removeEventListener("mousedown", this.onDocumentPointerDown);
        this.root.remove();
        delete this.select.dataset["multiselect"];
        this.select.classList.remove("multiselect-native");
        this.select.removeAttribute("tabindex");
        this.select.removeAttribute("aria-hidden");
    }

    private resolveLabel(): string {
        const doc = this.select.ownerDocument;
        const label = this.select.id
            ? doc.querySelector<HTMLElement>(`label[for="${this.select.id}"]`)
            : null;
        return label?.textContent?.trim() || this.texts.placeholder;
    }

    private bindEvents(doc: Document): void {
        // Klick auf das x eines Chips darf weder den Fokus wegnehmen noch das
        // Dropdown öffnen - genau das war der alte select2-Bug.
        this.control.addEventListener("mousedown", event => {
            const remove = (event.target as HTMLElement).closest(".multiselect-chip-remove");
            if (!remove) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const value = (remove as HTMLElement).dataset["value"];
            if (value !== undefined) {
                this.setSelected(value, false);
            }
        });

        this.control.addEventListener("click", event => {
            if ((event.target as HTMLElement).closest(".multiselect-chip-remove")) {
                return;
            }
            if ((event.target as HTMLElement).closest(".multiselect-arrow")) {
                this.toggle();
                return;
            }
            this.openDropdown();
        });

        this.search.addEventListener("input", () => {
            this.openDropdown();
            this.renderOptions();
        });

        this.search.addEventListener("keydown", event => this.onKeyDown(event));

        // Fokus muss beim Suchfeld bleiben, sonst schließt der Klick das Dropdown.
        this.list.addEventListener("mousedown", event => event.preventDefault());

        this.list.addEventListener("click", event => {
            const item = (event.target as HTMLElement).closest(".multiselect-option");
            const value = item ? (item as HTMLElement).dataset["value"] : undefined;
            if (value === undefined) {
                return;
            }
            this.setSelected(value, !this.isSelected(value));
            this.search.focus();
        });

        this.select.addEventListener("change", () => {
            if (!this.emittingChange) {
                this.render();
            }
        });

        doc.addEventListener("mousedown", this.onDocumentPointerDown);
    }

    private onKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                this.openDropdown();
                this.moveActive(1);
                break;
            case "ArrowUp":
                event.preventDefault();
                this.openDropdown();
                this.moveActive(-1);
                break;
            case "Enter": {
                const option = this.filtered[this.activeIndex];
                if (!this.open || !option) {
                    return;
                }
                event.preventDefault();
                this.setSelected(option.value, !option.selected);
                break;
            }
            case "Escape":
                if (this.open) {
                    event.preventDefault();
                    this.close();
                }
                break;
            case "Backspace": {
                if (this.search.value !== "") {
                    return;
                }
                const last = this.selectedOptions().pop();
                if (last) {
                    event.preventDefault();
                    this.setSelected(last.value, false);
                }
                break;
            }
            default:
                break;
        }
    }

    private options(): HTMLOptionElement[] {
        return Array.from(this.select.options);
    }

    private selectedOptions(): HTMLOptionElement[] {
        return this.options().filter(option => option.selected);
    }

    private isSelected(value: string): boolean {
        return this.options().some(option => option.value === value && option.selected);
    }

    private setSelected(value: string, selected: boolean): void {
        const option = this.options().find(item => item.value === value);
        if (!option || option.disabled || option.selected === selected) {
            return;
        }
        option.selected = selected;
        this.render();
        this.emittingChange = true;
        this.select.dispatchEvent(new Event("change", { bubbles: true }));
        this.emittingChange = false;
    }

    private toggle(): void {
        if (this.open) {
            this.close();
        } else {
            this.openDropdown();
        }
    }

    private openDropdown(): void {
        if (this.open) {
            return;
        }
        this.open = true;
        this.root.classList.add("multiselect--open");
        this.dropdown.hidden = false;
        this.search.setAttribute("aria-expanded", "true");
        this.renderOptions();
    }

    private close(): void {
        if (!this.open) {
            return;
        }
        this.open = false;
        this.root.classList.remove("multiselect--open");
        this.dropdown.hidden = true;
        this.search.setAttribute("aria-expanded", "false");
        this.search.value = "";
        this.activeIndex = -1;
        this.search.removeAttribute("aria-activedescendant");
    }

    private moveActive(delta: number): void {
        if (this.filtered.length === 0) {
            return;
        }
        const next = this.activeIndex + delta;
        this.activeIndex = (next + this.filtered.length) % this.filtered.length;
        this.highlightActive();
    }

    private highlightActive(): void {
        const items = Array.from(this.list.children) as HTMLElement[];
        items.forEach((item, index) => {
            item.classList.toggle("multiselect-option--active", index === this.activeIndex);
        });
        const active = items[this.activeIndex];
        if (active) {
            this.search.setAttribute("aria-activedescendant", active.id);
            active.scrollIntoView?.({ block: "nearest" });
        } else {
            this.search.removeAttribute("aria-activedescendant");
        }
    }

    private render(): void {
        this.renderChips();
        if (this.open) {
            this.renderOptions();
        }
    }

    private renderChips(): void {
        const doc = this.select.ownerDocument;
        this.control
            .querySelectorAll(".multiselect-chip, .multiselect-placeholder")
            .forEach(node => node.remove());

        const selected = this.selectedOptions();
        if (selected.length === 0) {
            const placeholder = doc.createElement("span");
            placeholder.className = "multiselect-placeholder";
            placeholder.textContent = this.texts.placeholder;
            this.control.insertBefore(placeholder, this.search);
            return;
        }

        selected.forEach(option => {
            const label = option.textContent ?? option.value;
            const chip = doc.createElement("span");
            chip.className = "multiselect-chip";
            chip.dataset["value"] = option.value;

            const text = doc.createElement("span");
            text.className = "multiselect-chip-label";
            text.textContent = label;
            // In der schmalen Spalte werden lange Vorlagennamen gekuerzt.
            text.title = label;

            const remove = doc.createElement("button");
            remove.type = "button";
            remove.className = "multiselect-chip-remove";
            remove.dataset["value"] = option.value;
            remove.setAttribute("aria-label", this.texts.removeLabel(label));
            remove.textContent = "×";

            chip.append(text, remove);
            this.control.insertBefore(chip, this.search);
        });
    }

    private renderOptions(): void {
        const doc = this.select.ownerDocument;
        const needle = this.search.value.trim().toLowerCase();
        this.filtered = this.options().filter(option =>
            needle === "" || (option.textContent ?? "").toLowerCase().includes(needle)
        );

        this.list.textContent = "";
        this.filtered.forEach((option, index) => {
            const item = doc.createElement("li");
            item.className = "multiselect-option";
            item.id = `${this.list.id}-option-${index}`;
            item.dataset["value"] = option.value;
            item.setAttribute("role", "option");
            item.setAttribute("aria-selected", String(option.selected));
            if (option.selected) {
                item.classList.add("multiselect-option--selected");
            }
            if (option.disabled) {
                item.classList.add("multiselect-option--disabled");
                item.setAttribute("aria-disabled", "true");
            }
            item.textContent = option.textContent ?? option.value;
            this.list.append(item);
        });

        this.emptyHint.hidden = this.filtered.length > 0;
        if (this.activeIndex >= this.filtered.length) {
            this.activeIndex = this.filtered.length - 1;
        }
        this.highlightActive();
    }
}
