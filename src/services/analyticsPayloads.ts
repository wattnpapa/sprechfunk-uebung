import type { AnalyticsEventMap } from "./analyticsEvents";

export function buildRouteChangePayload(mode: string, params: string[]): AnalyticsEventMap["route_change"] {
    return {
        mode,
        has_params: params.length > 0
    };
}

export function buildUiClickPayload(element: HTMLElement): AnalyticsEventMap["ui_click"] {
    const safeElement = element as Partial<HTMLElement>;
    const getAttr = (name: string) => readAttributeSafe(safeElement, name);
    const label = getElementLabel(safeElement, getAttr);
    return {
        tag: getTagName(safeElement),
        id: getElementId(safeElement),
        class_name: getClassName(safeElement),
        action: getAttr("data-action") || "(none)",
        name: getAttr("name") || "(none)",
        label,
        click_key: getElementTrackingKey(element),
        route_hash: window.location?.hash || "#/"
    };
}

export function buildUiChangePayload(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): AnalyticsEventMap["ui_change"] {
    const payload: AnalyticsEventMap["ui_change"] = {
        ...buildUiClickPayload(element),
        value: "changed"
    };
    if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        payload.value = String(element.checked);
    }
    return payload;
}

function getElementTrackingKey(element: HTMLElement): string {
    const key = getPrimaryTrackingKey(element);
    if (key) {
        return key;
    }
    const path = getElementDomPath(element);
    const text = (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) || "(empty)";
    return `path:${path}|label:${text}`;
}

function getPrimaryTrackingKey(element: HTMLElement): string | null {
    const id = element.id?.trim();
    if (id) {
        return `id:${id}`;
    }
    const analyticsId = readAttributeSafe(element, "data-analytics-id")?.trim();
    if (analyticsId) {
        return `analytics:${analyticsId}`;
    }
    const action = readAttributeSafe(element, "data-action")?.trim();
    if (action) {
        return `action:${action}`;
    }
    return null;
}

function readAttributeSafe(
    element: Partial<HTMLElement>,
    attribute: string
): string | null {
    if (typeof element.getAttribute !== "function") {
        return null;
    }
    return element.getAttribute(attribute);
}

function getTagName(element: Partial<HTMLElement>): string {
    return element.tagName?.toLowerCase() || "(unknown)";
}

function getElementId(element: Partial<HTMLElement>): string {
    return element.id?.trim() || "(none)";
}

function getClassName(element: Partial<HTMLElement>): string {
    return (typeof element.className === "string" ? element.className : "").trim() || "(none)";
}

function getElementLabel(
    element: Partial<HTMLElement>,
    getAttr: (name: string) => string | null
): string {
    const rawText = (element.textContent || "").trim().replace(/\s+/g, " ");
    return (getAttr("aria-label") || rawText || "(empty)").slice(0, 80);
}

function getElementDomPath(element: HTMLElement): string {
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    let guard = 0;
    while (current && guard < 6) {
        const tag = current.tagName?.toLowerCase() || "unknown";
        if (current.id) {
            parts.unshift(`${tag}#${current.id}`);
            break;
        }
        const parentEl: HTMLElement | null = current.parentElement;
        if (!parentEl) {
            parts.unshift(tag);
            break;
        }
        const currentTagName = current.tagName;
        const siblings = Array.from(parentEl.children).filter(
            child => (child as HTMLElement).tagName === currentTagName
        );
        const index = Math.max(1, siblings.indexOf(current) + 1);
        parts.unshift(`${tag}:nth-of-type(${index})`);
        current = parentEl;
        guard++;
    }
    return parts.join(">");
}
