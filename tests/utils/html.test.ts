import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/utils/html";

describe("escapeHtml", () => {
    it("escapes all html special chars", () => {
        const input = "&<>\"'";
        const output = escapeHtml(input);
        expect(output).toBe("&amp;&lt;&gt;&quot;&#039;");
    });
});
