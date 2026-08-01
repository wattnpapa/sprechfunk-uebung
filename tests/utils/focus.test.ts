import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { captureFieldFocus, restoreFieldFocus } from "../../src/utils/focus";

const setDom = (html: string): JSDOM => {
    const dom = new JSDOM(`<div id="liste">${html}</div>`);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    return dom;
};

/** Neuaufbau der Liste wie im Live-Update der Übungsleitung. */
const rerender = (html: string): void => {
    (document.getElementById("liste") as HTMLElement).innerHTML = html;
};

describe("captureFieldFocus / restoreFieldFocus", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("mit Notizfeld", () => {
        const notiz = "<textarea class=\"nachricht-notiz\" data-nr=\"1\" data-sender=\"Heros Lübeck 201\">Hin</textarea>";

        beforeEach(() => {
            setDom(notiz);
        });

        it("stellt Fokus und Cursor nach einem Neuaufbau wieder her", () => {
            const before = document.querySelector("textarea") as HTMLTextAreaElement;
            before.focus();
            before.setSelectionRange(2, 2);

            const snapshot = captureFieldFocus();
            rerender(notiz);
            expect(document.activeElement).not.toBe(before);

            restoreFieldFocus(snapshot);

            const after = document.querySelector("textarea") as HTMLTextAreaElement;
            expect(document.activeElement).toBe(after);
            expect(after.selectionStart).toBe(2);
            expect(after.selectionEnd).toBe(2);
        });

        it("identifiziert das Feld über seine data-Attribute", () => {
            (document.querySelector("textarea") as HTMLTextAreaElement).focus();
            expect(captureFieldFocus()).toEqual({
                selector: "textarea[data-nr=\"1\"][data-sender=\"Heros Lübeck 201\"]",
                selectionStart: 0,
                selectionEnd: 0
            });
        });

        it("begrenzt den Cursor auf die Länge des neuen Wertes", () => {
            const before = document.querySelector("textarea") as HTMLTextAreaElement;
            before.focus();
            before.setSelectionRange(3, 3);

            const snapshot = captureFieldFocus();
            rerender("<textarea data-nr=\"1\" data-sender=\"Heros Lübeck 201\">H</textarea>");
            restoreFieldFocus(snapshot);

            expect((document.querySelector("textarea") as HTMLTextAreaElement).selectionStart).toBe(1);
        });
    });

    it("nutzt die ID, wenn das Feld eine hat", () => {
        setDom("<input id=\"nachrichtenTextFilterInput\" value=\"abc\">");
        const input = document.getElementById("nachrichtenTextFilterInput") as HTMLInputElement;
        input.focus();
        input.setSelectionRange(1, 3);

        const snapshot = captureFieldFocus();
        expect(snapshot).toEqual({ id: "nachrichtenTextFilterInput", selectionStart: 1, selectionEnd: 3 });

        rerender("<input id=\"nachrichtenTextFilterInput\" value=\"abc\">");
        restoreFieldFocus(snapshot);

        const after = document.getElementById("nachrichtenTextFilterInput") as HTMLInputElement;
        expect(document.activeElement).toBe(after);
        expect(after.selectionStart).toBe(1);
        expect(after.selectionEnd).toBe(3);
    });

    it("maskiert Anführungszeichen im Selektor", () => {
        setDom("<textarea data-sender='Heros &quot;X&quot;'></textarea>");
        (document.querySelector("textarea") as HTMLTextAreaElement).focus();

        const snapshot = captureFieldFocus();
        rerender("<textarea data-sender='Heros &quot;X&quot;'></textarea>");
        restoreFieldFocus(snapshot);

        expect(document.activeElement).toBe(document.querySelector("textarea"));
    });

    it("liefert null ohne fokussierbares Feld", () => {
        setDom("<span>kein Feld</span>");
        expect(captureFieldFocus()).toBeNull();
        expect(() => restoreFieldFocus(null)).not.toThrow();
    });

    it("ignoriert ein Feld, das nach dem Neuaufbau fehlt", () => {
        setDom("<textarea data-nr=\"9\" data-sender=\"A\"></textarea>");
        (document.querySelector("textarea") as HTMLTextAreaElement).focus();

        const snapshot = captureFieldFocus();
        rerender("");
        expect(() => restoreFieldFocus(snapshot)).not.toThrow();
    });

    it("kommt ohne Textauswahl aus", () => {
        setDom("<input id=\"anzahl\" type=\"number\" value=\"3\">");
        (document.getElementById("anzahl") as HTMLInputElement).focus();

        const snapshot = captureFieldFocus();
        rerender("<input id=\"anzahl\" type=\"number\" value=\"3\">");
        restoreFieldFocus(snapshot);

        expect(document.activeElement).toBe(document.getElementById("anzahl"));
    });
});
