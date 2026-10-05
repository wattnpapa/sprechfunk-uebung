export type DocMode = "table" | "meldevordruck" | "nachrichtenvordruck";

/** Rückrufe der Teilnehmeransicht an den Controller. */
export interface TeilnehmerEventHandler {
    onToggleUebertragen: (id: number, checked: boolean) => void;
    onToggleHide: (checked: boolean) => void;
    onReset: () => void;
    onDocViewChange: (mode: DocMode) => void;
    onDocPrev: () => void;
    onDocNext: () => void;
    onDocClose: () => void;
    onDocToggleCurrent: () => void;
    onDownloadZip: () => void;
    onSearch: () => void;
}

/** Tippsperre der Ansicht gegen Doppeltipps (siehe TeilnehmerView). */
export interface Tippsperre {
    istGesperrt: (id: number) => boolean;
    istKontextGesperrt: () => boolean;
    merkeAenderung: (id: number, kontext: boolean) => void;
    merkeKontextAenderung: () => void;
}

/** Aktion, die eine Statusschaltfläche auslöst. */
type StatusAktion = "absetzen" | "zuruecknehmen";

// Eingabetypen, bei denen Tastendrücke keine Texteingabe sind (Space toggelt dort z. B. nur).
const NON_TEXT_INPUT_TYPES = new Set([
    "checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "image"
]);

function isTypingTarget(target: HTMLElement | null): boolean {
    if (!target) {
        return false;
    }
    if (target.isContentEditable) {
        return true;
    }
    if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        return true;
    }
    if (target.tagName !== "INPUT") {
        return false;
    }
    const type = (target as HTMLInputElement).type?.toLowerCase() || "text";
    return !NON_TEXT_INPUT_TYPES.has(type);
}

function toggleHideImModal(handler: TeilnehmerEventHandler): void {
    const toggle = document.getElementById("toggle-hide-transmitted-modal") as HTMLInputElement | null;
    if (toggle) {
        toggle.checked = !toggle.checked;
        handler.onToggleHide(toggle.checked);
    }
}

/** Tastenkürzel im Vordruck-Fenster, außer der Leertaste. */
function tastenAktionen(handler: TeilnehmerEventHandler): Record<string, () => void> {
    const hide = () => toggleHideImModal(handler);
    const melde = () => handler.onDocViewChange("meldevordruck");
    const nachricht = () => handler.onDocViewChange("nachrichtenvordruck");
    return {
        // `[` is a practical fallback on non-DE keyboard layouts (e.g. CI runners).
        "ü": hide, "Ü": hide, "[": hide,
        m: melde, M: melde,
        n: nachricht, N: nachricht,
        Escape: () => handler.onDocClose(),
        ArrowLeft: () => handler.onDocPrev(),
        ArrowRight: () => handler.onDocNext()
    };
}

/** Leertaste und Touch-Knopf im Vordruck: mit Kontextsperre gegen Doppeltipps. */
function toggleAktuellenVordruck(handler: TeilnehmerEventHandler, sperre: Tippsperre): void {
    if (sperre.istKontextGesperrt()) {
        return;
    }
    sperre.merkeKontextAenderung();
    handler.onDocToggleCurrent();
}

function bindTastenkuerzel(handler: TeilnehmerEventHandler, sperre: Tippsperre): void {
    const aktionen = tastenAktionen(handler);
    document.addEventListener("keydown", e => {
        const target = e.target as HTMLElement | null;

        // Wer tippt (z. B. im Suchfeld), darf keine Kürzel auslösen.
        if (isTypingTarget(target)) {
            return;
        }
        // Alle Kürzel gehören zum Vordruck-Modal und greifen nur, solange es offen ist.
        if (!document.getElementById("teilnehmerDocModal")?.classList.contains("show")) {
            return;
        }

        if (e.code === "Space") {
            // Auf Eingabefeldern (z. B. der Checkbox im Modal) bleibt Space die native Aktivierung.
            if (target?.tagName === "INPUT") {
                return;
            }
            e.preventDefault();
            toggleAktuellenVordruck(handler, sperre);
            return;
        }
        if (Object.prototype.hasOwnProperty.call(aktionen, e.key)) {
            aktionen[e.key]?.();
        }
    });
}

/**
 * Delegation für die Zeilen: „absetzen“ und „zurücknehmen“ sind zwei
 * getrennte Knöpfe. Nach einem Wechsel ist die Nachricht kurz gesperrt,
 * damit ein Doppeltipp den Wechsel nicht still wieder aufhebt.
 */
function bindZeilenAktionen(handler: TeilnehmerEventHandler, sperre: Tippsperre): void {
    const tbody = document.getElementById("teilnehmerNachrichtenBody");
    tbody?.addEventListener("click", event => {
        const btn = (event.target as HTMLElement).closest("[data-aktion]") as HTMLElement | null;
        if (!btn) {
            return;
        }
        const id = Number(btn.dataset["id"]);
        const aktion = btn.dataset["aktion"] as StatusAktion | undefined;
        if (!Number.isFinite(id) || (aktion !== "absetzen" && aktion !== "zuruecknehmen")) {
            return;
        }
        if (sperre.istGesperrt(id)) {
            return;
        }
        sperre.merkeAenderung(id, false);
        handler.onToggleUebertragen(id, aktion === "absetzen");
    });
}

function bindSchalterUndKnoepfe(handler: TeilnehmerEventHandler): void {
    document.getElementById("btn-reset-teilnehmer-data")?.addEventListener("click", handler.onReset);
    document.getElementById("btn-download-teilnehmer-zip")?.addEventListener("click", handler.onDownloadZip);

    const onHide = (e: Event) => handler.onToggleHide((e.target as HTMLInputElement).checked);
    document.getElementById("toggle-hide-transmitted")?.addEventListener("change", onHide);
    document.getElementById("toggle-hide-transmitted-modal")?.addEventListener("change", onHide);
    document.getElementById("teilnehmerSearchInput")?.addEventListener("input", () => handler.onSearch());

    document.querySelectorAll<HTMLButtonElement>("[data-doc-view]").forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset["docView"] as DocMode | undefined;
            if (mode) {
                handler.onDocViewChange(mode);
            }
        });
    });
}

function bindVordruckFenster(handler: TeilnehmerEventHandler, sperre: Tippsperre): void {
    document.getElementById("btn-doc-prev")?.addEventListener("click", handler.onDocPrev);
    document.getElementById("btn-doc-next")?.addEventListener("click", handler.onDocNext);
    document.getElementById("btn-doc-close")?.addEventListener("click", handler.onDocClose);
    // Bootstrap schließt das Fenster auch per Hintergrund-Tipp; der
    // Controller muss davon erfahren, sonst bleibt er im Vordruck-Modus.
    document.getElementById("teilnehmerDocModal")?.addEventListener("hidden.bs.modal", handler.onDocClose);

    // Touch-Knopf im Vordruck: dieselbe Aktion wie die Leertaste. Nach dem
    // Wechsel kann der Vordruck auf den nächsten Spruch springen (bei
    // „Abgesetzte ausblenden“) — daher die Kontextsperre.
    document.getElementById("btn-doc-absetzen")?.addEventListener("click", () => {
        toggleAktuellenVordruck(handler, sperre);
    });
}

/** Bindet alle Bedienelemente der Teilnehmeransicht. */
export function bindTeilnehmerEvents(handler: TeilnehmerEventHandler, sperre: Tippsperre): void {
    bindSchalterUndKnoepfe(handler);
    bindVordruckFenster(handler, sperre);
    bindTastenkuerzel(handler, sperre);
    bindZeilenAktionen(handler, sperre);
}
