import type { LoesungswortOption } from "./GeneratorStateService";

/** Lösungswort-Auswahl im Formular des Generators. */

const RADIO_IDS: Record<LoesungswortOption, string> = {
    none: "keineLoesungswoerter",
    central: "zentralLoesungswort",
    individual: "individuelleLoesungswoerter"
};

function getZentraleWorte(loesungswoerter: Record<string, string>): Set<string> {
    return new Set(
        Object.values(loesungswoerter || {}).filter(
            (wort): wort is string => typeof wort === "string" && wort.trim().length > 0
        )
    );
}

function applyLoesungswortSelection(options: {
    hasWords: boolean;
    zentraleWorte: Set<string>;
    noneRadio: HTMLInputElement;
    centralRadio: HTMLInputElement;
    indivRadio: HTMLInputElement;
    centralInput: HTMLInputElement;
}): void {
    const { hasWords, zentraleWorte, noneRadio, centralRadio, indivRadio, centralInput } = options;
    if (!hasWords) {
        noneRadio.checked = true;
        return;
    }
    if (zentraleWorte.size === 1) {
        centralRadio.checked = true;
        centralInput.value = [...zentraleWorte][0] ?? "";
        return;
    }
    indivRadio.checked = true;
}

function alleDa(elemente: (HTMLElement | null)[]): boolean {
    return elemente.every(el => !!el);
}

export function setLoesungswortUI(loesungswoerter: Record<string, string>): void {
    const noneRadio = document.getElementById("keineLoesungswoerter") as HTMLInputElement;
    const centralRadio = document.getElementById("zentralLoesungswort") as HTMLInputElement;
    const indivRadio = document.getElementById("individuelleLoesungswoerter") as HTMLInputElement;
    const centralInput = document.getElementById("zentralLoesungswortInput") as HTMLInputElement;
    const container = document.getElementById("zentralLoesungswortContainer") as HTMLElement;
    const shuffleBtn = document.getElementById("shuffleButton") as HTMLElement;

    if (!alleDa([noneRadio, centralRadio, indivRadio, centralInput, container, shuffleBtn])) {
        return;
    }

    applyLoesungswortSelection({
        hasWords: !!loesungswoerter && Object.keys(loesungswoerter).length > 0,
        zentraleWorte: getZentraleWorte(loesungswoerter),
        noneRadio,
        centralRadio,
        indivRadio,
        centralInput
    });

    updateLoesungswortOptionUI();
}

export function updateLoesungswortOptionUI(): void {
    const centralRadio = document.getElementById("zentralLoesungswort") as HTMLInputElement | null;
    const noneRadio = document.getElementById("keineLoesungswoerter") as HTMLInputElement | null;
    const container = document.getElementById("zentralLoesungswortContainer") as HTMLElement | null;
    const shuffleBtn = document.getElementById("shuffleButton") as HTMLElement | null;

    if (!centralRadio || !noneRadio || !container || !shuffleBtn) {
        return;
    }

    const option = getSelectedLoesungswortOption();
    container.style.display = centralRadio.checked ? "block" : "none";
    shuffleBtn.style.display = option === "none" ? "none" : "block";
}

export function selectLoesungswortOption(option: LoesungswortOption): void {
    const radio = document.getElementById(RADIO_IDS[option]) as HTMLInputElement | null;
    if (radio) {
        radio.checked = true;
    }
    updateLoesungswortOptionUI();
}

export function getSelectedLoesungswortOption(): LoesungswortOption {
    if ((document.getElementById("keineLoesungswoerter") as HTMLInputElement).checked) {
        return "none";
    }
    if ((document.getElementById("zentralLoesungswort") as HTMLInputElement).checked) {
        return "central";
    }
    return "individual";
}

export function getZentralesLoesungswort(): string {
    return (document.getElementById("zentralLoesungswortInput") as HTMLInputElement).value;
}
