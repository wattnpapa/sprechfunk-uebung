// Service Worker für den Offline-Fall (THW-Review 2026-10-04, offline P1-1,
// analog-first P2-4): Ohne ihn endete ein Neuladen im Funkloch auf der
// Fehlerseite des Browsers.
//
// Strategie: network-first. Mit Netz kommt jede Datei wie bisher vom Server
// (also nie ein veraltetes Bundle); die Antwort wird nebenbei in den Cache
// der aktuellen Build-Version gelegt. Ohne Netz liefert der Cache, was zuletzt
// geladen wurde. Firestore, GoatCounter und alles andere fremden Ursprungs
// wird nicht angefasst – Übungsdaten liegen nie in diesem Cache.
//
// Versionierung: Die Version ist ein Hash über die ausgelieferten Kerndateien.
// Ändert sich eine davon, ändert sich sw.js, der Browser installiert den neuen
// Worker, und der räumt beim Aktivieren alle Caches älterer Builds ab.
//
// Reine Funktionen ohne Datei- und Netzzugriff; tests/core/ServiceWorker.test.ts
// führt den erzeugten Worker in einer nachgebauten Worker-Umgebung aus.

import { createHash } from "node:crypto";

/** Präfix aller Caches dieses Workers; fremde Caches bleiben unberührt. */
export const CACHE_PREFIX = "sprechfunk-shell-";

/**
 * App-Hülle, die schon bei der Installation in den Cache kommt (relativ zum
 * Worker). Alles Weitere (Chunks, pdf.js, Vorlagen, Inhaltsseiten) landet
 * beim ersten Abruf im Cache.
 */
export const APP_HUELLE = [
    "./",
    "bundle.js",
    "bundle.css",
    "style.css",
    "howto.md",
    "assets/favicon.png",
    "files/archivo-latin-wght-normal.woff2",
    "webfonts/fa-solid-900.woff2",
    "webfonts/fa-brands-400.woff2"
];

/** Version aus dem Inhalt der Kerndateien (Buffer oder String). */
export function buildVersion(inhalte) {
    const hash = createHash("sha256");
    for (const inhalt of inhalte) hash.update(inhalt);
    return hash.digest("hex").slice(0, 12);
}

/** Quelltext von dist/sw.js. */
export function baueServiceWorker({ version, huelle = APP_HUELLE }) {
    if (!/^[0-9a-z-]+$/i.test(version)) {
        throw new Error(`Ungültige Service-Worker-Version: ${version}`);
    }
    return `// Erzeugt von scripts/lib/service-worker.mjs – nicht von Hand ändern.
"use strict";
var CACHE = ${JSON.stringify(CACHE_PREFIX + version)};
var PREFIX = ${JSON.stringify(CACHE_PREFIX)};
var HUELLE = ${JSON.stringify(huelle)};

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE)
            .then(function (cache) { return cache.addAll(HUELLE); })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (namen) {
                return Promise.all(namen
                    .filter(function (name) { return name.indexOf(PREFIX) === 0 && name !== CACHE; })
                    .map(function (name) { return caches.delete(name); }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

function istAppHuelle(url) {
    var basis = new URL("./", self.registration.scope).pathname;
    return url.pathname === basis || url.pathname === basis + "index.html";
}

function netzZuerst(request) {
    return caches.open(CACHE).then(function (cache) {
        return fetch(request).then(function (antwort) {
            if (antwort && antwort.ok && antwort.type === "basic") {
                cache.put(request, antwort.clone());
            }
            return antwort;
        }).catch(function (fehler) {
            return cache.match(request).then(function (treffer) {
                if (treffer) return treffer;
                // Routen der App hängen am Hash, den der Browser nicht
                // mitschickt; Abfragen wie „/?utm=…“ zeigen dieselbe Hülle.
                if (request.mode === "navigate" && istAppHuelle(new URL(request.url))) {
                    return cache.match("./");
                }
                throw fehler;
            }).then(function (treffer) {
                if (treffer) return treffer;
                throw fehler;
            });
        });
    });
}

self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (request.method !== "GET") return;
    var url = new URL(request.url);
    // Nur eigene Dateien: Firestore, Zählpixel und Gravatar laufen am
    // Worker vorbei und werden nie zwischengespeichert.
    if (url.origin !== self.location.origin) return;
    // Teilabrufe (Range) kann der Cache nicht sinnvoll bedienen.
    if (request.headers.has("range")) return;
    event.respondWith(netzZuerst(request));
});
`;
}
