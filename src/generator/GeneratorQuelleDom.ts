import { updateNachrichtenArtOptionsVisibility } from "./GeneratorFormularDom";

/** Spruchquelle im Formular des Generators: Auswahl, Listen und sichtbare Bereiche. */

export type FunkspruchQuelle = "vorlagen" | "upload" | "szenario" | "fuehrungsstelle";

const RADIO_IDS: Record<FunkspruchQuelle, string> = {
    vorlagen: "optionVorlagen",
    upload: "optionUpload",
    szenario: "optionSzenario",
    fuehrungsstelle: "optionFuehrungsstelle"
};

function istGewaehlt(id: string): boolean {
    return !!(document.getElementById(id) as HTMLInputElement | null)?.checked;
}

export function getSelectedSource(): FunkspruchQuelle {
    if (istGewaehlt("optionFuehrungsstelle")) {
        return "fuehrungsstelle";
    }
    if (istGewaehlt("optionSzenario")) {
        return "szenario";
    }
    if ((document.getElementById("optionVorlagen") as HTMLInputElement).checked) {
        return "vorlagen";
    }
    return "upload";
}

export function setSelectedSource(source: FunkspruchQuelle): void {
    const radio = document.getElementById(RADIO_IDS[source]) as HTMLInputElement | null;
    if (radio) {
        radio.checked = true;
    }
    toggleSourceView(source);
}

function setBlockSichtbar(id: string, sichtbar: boolean): void {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = sichtbar ? "block" : "none";
    }
}

function setSichtbar(ids: string[], sichtbar: boolean): void {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = sichtbar ? "" : "none";
        }
    });
}

export function toggleSourceView(source: FunkspruchQuelle): void {
    const selectBoxContainer = document.getElementById("funkspruchVorlage")?.parentElement;
    const fileUploadContainer = document.getElementById("fileUploadContainer");
    if (!selectBoxContainer || !fileUploadContainer) {
        return;
    }

    selectBoxContainer.style.display = source === "vorlagen" ? "block" : "none";
    fileUploadContainer.style.display = source === "upload" ? "block" : "none";
    setBlockSichtbar("szenarioContainer", source === "szenario");
    setBlockSichtbar("fuehrungsstelleContainer", source === "fuehrungsstelle");

    // Im Szenario-Modus bestimmen Drehbuch statt Regler die Verteilung;
    // Lösungswörter und Auto-Stärken würden kuratierte Texte umschreiben.
    const mitDrehbuch = source === "szenario" || source === "fuehrungsstelle";
    setSichtbar(["verteilungSection", "loesungswortSection", "autoStaerkeContainer"], !mitDrehbuch);
    // Die Führungsstellen-Übung bringt Rollen, Zeiten und Anmeldungen aus
    // dem Drehbuch mit; Teilnehmerverwaltung und Spielmodus entfallen.
    setSichtbar([
        "spielModusSection", "anmeldungContainer", "nachrichtenArtContainer",
        "nachrichtenArtOptionsContainer", "teilnehmerVerwaltungCard"
    ], source !== "fuehrungsstelle");
    if (source !== "fuehrungsstelle") {
        updateNachrichtenArtOptionsVisibility();
    }
}

export function populateTemplateSelect(templates: Record<string, { text: string }>, selected: string[]): void {
    const selectBox = document.getElementById("funkspruchVorlage") as HTMLSelectElement;
    if (!selectBox) {
        return;
    }
    selectBox.innerHTML = "";

    for (const [key, value] of Object.entries(templates)) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = value.text;
        // Keine Vorauswahl: Die Organisation kennt nur der Nutzer, und
        // „Lustige Funksprüche“ sollen nie unbemerkt mitlaufen.
        option.selected = selected.includes(key);
        selectBox.appendChild(option);
    }
    // Das Multi-Select-Widget haengt an genau diesem Event und zeichnet
    // Chips und Trefferliste daraufhin neu.
    selectBox.dispatchEvent(new Event("change", { bubbles: true }));
}

export function getSelectedTemplates(): string[] {
    const selectBox = document.getElementById("funkspruchVorlage") as HTMLSelectElement | null;
    if (!selectBox) {
        return [];
    }
    return Array.from(selectBox.selectedOptions).map(option => option.value);
}

export function populateSzenarioSelect(szenarien: Record<string, { titel: string }>, selected?: string): void {
    const selectBox = document.getElementById("szenarioAuswahl") as HTMLSelectElement | null;
    if (!selectBox) {
        return;
    }
    selectBox.innerHTML = "";
    for (const [slug, eintrag] of Object.entries(szenarien)) {
        const option = document.createElement("option");
        option.value = slug;
        option.textContent = eintrag.titel;
        option.selected = slug === selected;
        selectBox.appendChild(option);
    }
}

export function renderInfoZeilen(containerId: string, zeilen: string[]): void {
    const info = document.getElementById(containerId);
    if (!info) {
        return;
    }
    info.innerHTML = "";
    zeilen.forEach(zeile => {
        const div = document.createElement("div");
        div.textContent = zeile;
        info.appendChild(div);
    });
}
