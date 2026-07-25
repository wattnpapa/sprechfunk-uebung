import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { FooterView } from "../../src/core/FooterView";

describe("FooterView", () => {
    it("sets version and uebung id text", () => {
        const dom = new JSDOM(`
            <span id="version">dev</span>
            <span id="uebungsId">-</span>
        `);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = dom.window.document;

        const view = new FooterView();
        view.setVersion("v1");
        view.setUebungId("abc");

        expect(dom.window.document.getElementById("version")?.textContent).toBe("v1");
        expect(dom.window.document.getElementById("uebungsId")?.textContent).toBe("abc");
    });
});
