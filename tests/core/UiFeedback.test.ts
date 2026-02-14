import { beforeEach, describe, expect, it, vi } from "vitest";
import { UiFeedback } from "../../src/core/UiFeedback";

describe("UiFeedback", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it("confirm uses global confirm when available", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).confirm = vi.fn(() => false);
        const ui = new UiFeedback();
        expect(ui.confirm("x")).toBe(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((globalThis as any).confirm).toHaveBeenCalledWith("x");
    });

    it("confirm falls back to true without confirm fn", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (globalThis as any).confirm;
        const ui = new UiFeedback();
        expect(ui.confirm("x")).toBe(true);
    });

    it("renders toast container and toast entries", () => {
        const body = {
            children: [] as unknown[],
            appendChild: vi.fn(function appendChild(this: { children: unknown[] }, el: unknown) {
                this.children.push(el);
            }),
            // for container appendChild calls:
            push: vi.fn()
        };
        const created: Array<{ className: string; textContent: string; id?: string; setAttribute: ReturnType<typeof vi.fn>; classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }; remove: ReturnType<typeof vi.fn>; appendChild?: ReturnType<typeof vi.fn> }> = [];
        const getById = new Map<string, unknown>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = {
            body,
            getElementById: (id: string) => getById.get(id) ?? null,
            createElement: (_tag: string) => {
                const node = {
                    className: "",
                    textContent: "",
                    id: "",
                    setAttribute: vi.fn(),
                    classList: { add: vi.fn(), remove: vi.fn() },
                    remove: vi.fn(),
                    appendChild: vi.fn(function appendChild(this: { children?: unknown[] }, el: unknown) {
                        if (!this.children) {
                            this.children = [];
                        }
                        this.children.push(el);
                    }),
                    children: [] as unknown[]
                };
                created.push(node);
                return node;
            }
        };

        const ui = new UiFeedback();
        ui.success("ok");

        // First created div is container, second is toast
        expect(created.length).toBeGreaterThanOrEqual(2);
        expect(created[0]?.className).toBe("app-toast-container");
        expect(created[1]?.className).toContain("is-success");
        expect(created[1]?.textContent).toBe("ok");

        vi.runAllTimers();
        expect(created[1]?.classList.add).toHaveBeenCalledWith("is-visible");
        expect(created[1]?.classList.remove).toHaveBeenCalledWith("is-visible");
        expect(created[1]?.remove).toHaveBeenCalled();
    });

    it("calls alert for error when no body available", () => {
        const alertSpy = vi.fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).alert = alertSpy;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = { body: null };
        const ui = new UiFeedback();
        ui.error("boom");
        expect(alertSpy).toHaveBeenCalledWith("boom");
    });

    it("reuses existing toast container", () => {
        const existing = {
            appendChild: vi.fn()
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document = {
            body: { appendChild: vi.fn() },
            getElementById: (id: string) => (id === "globalToastContainer" ? existing : null),
            createElement: () => ({
                className: "",
                textContent: "",
                setAttribute: vi.fn(),
                classList: { add: vi.fn(), remove: vi.fn() },
                remove: vi.fn()
            })
        };

        const ui = new UiFeedback();
        ui.info("reuse");

        expect(existing.appendChild).toHaveBeenCalled();
    });
});
