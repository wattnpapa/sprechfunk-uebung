/**
 * Fokus über einen kompletten Neuaufbau einer Liste hinweg erhalten.
 *
 * Die Tabellen der Übungsleitung werden bei jedem Live-Update per `innerHTML`
 * komplett neu gebaut. Das gerade fokussierte Feld verschwindet dabei aus dem
 * DOM – ohne Wiederherstellung verliert z. B. ein Notizfeld mitten im Tippen
 * den Fokus. Identifiziert wird das Feld über seine ID oder – bei den aus dem
 * Template erzeugten Zeilen – über seine `data-`Attribute.
 */

interface FocusableLike {
    id?: string;
    tagName?: string;
    value?: string;
    selectionStart?: number | null;
    selectionEnd?: number | null;
    getAttributeNames?: () => string[];
    getAttribute?: (name: string) => string | null;
    focus?: (options?: { preventScroll?: boolean }) => void;
    setSelectionRange?: (start: number, end: number) => void;
}

export interface FieldFocusSnapshot {
    /** ID des Feldes – bevorzugt, weil eindeutig. */
    id?: string;
    /** Fallback-Selektor aus Tag und `data-`Attributen. */
    selector?: string;
    selectionStart: number | null;
    selectionEnd: number | null;
}

function escapeSelectorValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function buildAttributeSelector(element: FocusableLike): string | null {
    const tag = element.tagName?.toLowerCase();
    const getAttributeNames = element.getAttributeNames;
    const getAttribute = element.getAttribute;
    if (!tag || !getAttributeNames || !getAttribute) {
        return null;
    }
    const parts = getAttributeNames.call(element)
        .filter(name => name.startsWith("data-"))
        .map(name => `[${name}="${escapeSelectorValue(getAttribute.call(element, name) ?? "")}"]`);
    return parts.length > 0 ? `${tag}${parts.join("")}` : null;
}

/** Auswahlbereich lesen; Felder ohne Textauswahl (z. B. `type="number"`) werfen. */
function readSelection(element: FocusableLike): Pick<FieldFocusSnapshot, "selectionStart" | "selectionEnd"> {
    try {
        return {
            selectionStart: element.selectionStart ?? null,
            selectionEnd: element.selectionEnd ?? null
        };
    } catch {
        return { selectionStart: null, selectionEnd: null };
    }
}

export function captureFieldFocus(): FieldFocusSnapshot | null {
    if (typeof document === "undefined") {
        return null;
    }
    const active = document.activeElement as FocusableLike | null;
    if (!active) {
        return null;
    }
    const selection = readSelection(active);
    if (active.id) {
        return { id: active.id, ...selection };
    }
    const selector = buildAttributeSelector(active);
    return selector ? { selector, ...selection } : null;
}

function findField(snapshot: FieldFocusSnapshot): FocusableLike | null {
    if (snapshot.id) {
        return document.getElementById(snapshot.id) as FocusableLike | null;
    }
    if (snapshot.selector && typeof document.querySelector === "function") {
        return document.querySelector(snapshot.selector) as FocusableLike | null;
    }
    return null;
}

export function restoreFieldFocus(snapshot: FieldFocusSnapshot | null): void {
    if (!snapshot || typeof document === "undefined") {
        return;
    }
    const field = findField(snapshot);
    if (!field?.focus) {
        return;
    }
    field.focus({ preventScroll: true });

    const { selectionStart } = snapshot;
    if (selectionStart === null || !field.setSelectionRange) {
        return;
    }
    const length = field.value?.length ?? selectionStart;
    const start = Math.min(selectionStart, length);
    const end = Math.min(snapshot.selectionEnd ?? start, length);
    try {
        field.setSelectionRange(start, end);
    } catch {
        // Feld unterstützt keine Textauswahl – Fokus allein genügt.
    }
}
