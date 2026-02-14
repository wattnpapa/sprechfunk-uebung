export function debounce<T extends (...args: never[]) => void>(fn: T, waitMs = 180) {
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    return (...args: Parameters<T>): void => {
        if (timer !== undefined) {
            globalThis.clearTimeout(timer);
        }
        timer = globalThis.setTimeout(() => fn(...args), waitMs);
    };
}
