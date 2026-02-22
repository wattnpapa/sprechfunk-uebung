import type { AnalyticsEventMap } from "./analyticsEvents";

export function buildRouteChangePayload(mode: string, params: string[]): AnalyticsEventMap["route_change"] {
    return {
        mode,
        has_params: params.length > 0
    };
}

export function buildUiClickPayload(element: HTMLElement): AnalyticsEventMap["ui_click"] {
    const safeElement = element as Partial<HTMLElement>;
    const getAttr = (name: string) => typeof safeElement.getAttribute === "function"
        ? safeElement.getAttribute(name)
        : null;
    const rawText = (safeElement.textContent || "").trim().replace(/\s+/g, " ");
    return {
        tag: safeElement.tagName?.toLowerCase() || "(unknown)",
        id: safeElement.id?.trim() || "(none)",
        class_name: (typeof safeElement.className === "string" ? safeElement.className : "").trim() || "(none)",
        action: getAttr("data-action") || "(none)",
        name: getAttr("name") || "(none)",
        label: (getAttr("aria-label") || rawText || "(empty)").slice(0, 80),
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
    const id = element.id?.trim();
    if (id) {
        return `id:${id}`;
    }
    const analyticsId = typeof element.getAttribute === "function"
        ? element.getAttribute("data-analytics-id")?.trim()
        : undefined;
    if (analyticsId) {
        return `analytics:${analyticsId}`;
    }
    const action = typeof element.getAttribute === "function"
        ? element.getAttribute("data-action")?.trim()
        : undefined;
    if (action) {
        return `action:${action}`;
    }
    const path = getElementDomPath(element);
    const text = (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) || "(empty)";
    return `path:${path}|label:${text}`;
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
