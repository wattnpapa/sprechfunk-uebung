/**
 * Meldet den Service Worker (dist/sw.js, erzeugt von
 * scripts/lib/service-worker.mjs) an. Er hält die App-Hülle vor, damit ein
 * Neuladen ohne Netz die App statt der Fehlerseite des Browsers zeigt
 * (THW-Review 2026-10-04). Übungsdaten aus Firestore cacht er nicht.
 *
 * Angemeldet wird erst nach dem load-Ereignis, damit die Installation nicht
 * mit dem ersten Bild um Bandbreite konkurriert. Ohne sicheren Kontext
 * (http außerhalb von localhost, file:// in Electron) gibt es keinen Worker.
 */
export function registriereServiceWorker(): void {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
        return;
    }
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
        return;
    }
    const { protocol } = window.location;
    if (protocol !== "https:" && protocol !== "http:") {
        return;
    }
    const anmelden = () => {
        // Relativ zur Seite: auf GitHub Pages liegt die App an der Wurzel,
        // der Worker gilt damit für App und Inhaltsseiten.
        navigator.serviceWorker.register("sw.js", { scope: "./" }).catch((err: unknown) => {
            console.warn("Service Worker nicht angemeldet:", err);
        });
    };
    if (document.readyState === "complete") {
        anmelden();
    } else {
        window.addEventListener("load", anmelden, { once: true });
    }
}
