import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- reines JS-Hilfsmodul ohne Typdeklarationen, absichtlich .mjs
import { APP_HUELLE, CACHE_PREFIX, baueServiceWorker, buildVersion } from "../../scripts/lib/service-worker.mjs";
import { registriereServiceWorker } from "../../src/core/serviceWorker";

// Offline (THW-Review 2026-10-04): Ein Neuladen ohne Netz endete auf der
// Fehlerseite des Browsers. Der Worker wird hier in einer nachgebauten
// Worker-Umgebung ausgeführt.

type Handler = (event: { request?: FakeRequest; waitUntil?: (p: Promise<unknown>) => void; respondWith?: (p: Promise<unknown>) => void }) => void;

interface FakeRequest {
    url: string;
    method: string;
    mode: string;
    headers: { has: (name: string) => boolean };
}

const SCOPE = "https://sprechfunk-uebung.de/";

class FakeCache {
    eintraege = new Map<string, string>();
    async addAll(urls: string[]) {
        urls.forEach(url => this.eintraege.set(new URL(url, SCOPE).href, `precache:${url}`));
    }
    async put(request: FakeRequest, antwort: { body: string }) {
        this.eintraege.set(request.url, antwort.body);
    }
    async match(request: FakeRequest | string) {
        const url = typeof request === "string" ? new URL(request, SCOPE).href : request.url;
        const body = this.eintraege.get(url);
        return body === undefined ? undefined : { body };
    }
}

const umgebung = (netz: (url: string) => Promise<{ ok: boolean; type: string; body: string }>) => {
    const handler: Record<string, Handler> = {};
    const caches = new Map<string, FakeCache>();
    const self = {
        location: { origin: "https://sprechfunk-uebung.de" },
        registration: { scope: SCOPE },
        clients: { claim: vi.fn(async () => undefined) },
        skipWaiting: vi.fn(async () => undefined),
        addEventListener: (typ: string, cb: Handler) => {
            handler[typ] = cb;
        }
    };
    const cachesApi = {
        open: async (name: string) => {
            if (!caches.has(name)) caches.set(name, new FakeCache());
            return caches.get(name)!;
        },
        keys: async () => [...caches.keys()],
        delete: async (name: string) => caches.delete(name)
    };
    const fetch = vi.fn(async (request: FakeRequest) => {
        const antwort = await netz(request.url);
        return { ...antwort, clone: () => ({ ...antwort }) };
    });
    vm.runInNewContext(baueServiceWorker({ version: "abc123" }), { self, caches: cachesApi, fetch, URL, Promise });

    const request = (pfad: string, extra: Partial<FakeRequest> = {}): FakeRequest => ({
        url: new URL(pfad, SCOPE).href,
        method: "GET",
        mode: "no-cors",
        headers: { has: () => false },
        ...extra
    });
    const abrufen = async (req: FakeRequest) => {
        let antwort: Promise<unknown> | null = null;
        handler["fetch"]!({ request: req, respondWith: p => { antwort = p; } });
        return antwort;
    };
    const warte = async (typ: string) => {
        let p: Promise<unknown> = Promise.resolve();
        handler[typ]!({ waitUntil: x => { p = x; } });
        await p;
    };
    return { caches, fetch, self, request, abrufen, warte };
};

const online = async (url: string) => ({ ok: true, type: "basic", body: `netz:${url}` });
const offline = async () => {
    throw new TypeError("Failed to fetch");
};

describe("Service Worker", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("legt die App-Hülle bei der Installation in den Cache der Version", async () => {
        const sw = umgebung(online);
        await sw.warte("install");
        const cache = sw.caches.get(`${CACHE_PREFIX}abc123`)!;
        expect([...cache.eintraege.keys()]).toEqual(APP_HUELLE.map((u: string) => new URL(u, SCOPE).href));
        expect(sw.self.skipWaiting).toHaveBeenCalled();
    });

    it("räumt beim Aktivieren die Caches älterer Builds ab, fremde bleiben", async () => {
        const sw = umgebung(online);
        sw.caches.set(`${CACHE_PREFIX}alt`, new FakeCache());
        sw.caches.set("fremd", new FakeCache());
        await sw.warte("install");
        await sw.warte("activate");
        expect([...sw.caches.keys()].sort()).toEqual([`${CACHE_PREFIX}abc123`, "fremd"].sort());
        expect(sw.self.clients.claim).toHaveBeenCalled();
    });

    it("holt mit Netz immer frisch vom Server und legt die Antwort ab", async () => {
        const sw = umgebung(online);
        const antwort = await sw.abrufen(sw.request("bundle.js")) as { body: string };
        expect(antwort.body).toBe("netz:https://sprechfunk-uebung.de/bundle.js");
        expect(sw.caches.get(`${CACHE_PREFIX}abc123`)!.eintraege.get("https://sprechfunk-uebung.de/bundle.js"))
            .toBe("netz:https://sprechfunk-uebung.de/bundle.js");
    });

    it("liefert ohne Netz aus dem Cache, Navigationen bekommen die App-Hülle", async () => {
        let netz = online;
        const sw = umgebung(url => netz(url));
        await sw.warte("install");
        await sw.abrufen(sw.request("pdfGenerator-abc.js"));
        netz = offline;

        const chunk = await sw.abrufen(sw.request("pdfGenerator-abc.js")) as { body: string };
        expect(chunk.body).toContain("pdfGenerator-abc.js");
        const huelle = await sw.abrufen(sw.request("/?utm_source=x", { mode: "navigate" })) as { body: string };
        expect(huelle.body).toBe("precache:./");
    });

    it("meldet ohne Netz und ohne Cache den Fehler weiter", async () => {
        const sw = umgebung(offline);
        await expect(sw.abrufen(sw.request("anleitung/", { mode: "navigate" }))).rejects.toThrow("Failed to fetch");
    });

    it("fasst Firestore, fremde Dateien und Schreibzugriffe nicht an", async () => {
        const sw = umgebung(online);
        expect(await sw.abrufen(sw.request("https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen"))).toBeNull();
        expect(await sw.abrufen(sw.request("https://gc.zgo.at/count.js"))).toBeNull();
        expect(await sw.abrufen(sw.request("bundle.js", { method: "POST" }))).toBeNull();
        expect(await sw.abrufen(sw.request("video.mp4", { headers: { has: n => n === "range" } }))).toBeNull();
        expect(sw.fetch).not.toHaveBeenCalled();
    });

    it("die Version hängt am Inhalt der Kerndateien", () => {
        expect(buildVersion(["a", "b"])).toBe(buildVersion(["a", "b"]));
        expect(buildVersion(["a", "b"])).not.toBe(buildVersion(["a", "c"]));
        expect(() => baueServiceWorker({ version: "x\";alert(1)//" })).toThrow();
    });

    it("der Build schreibt den Worker, die App meldet ihn an", () => {
        const root = path.resolve(__dirname, "..", "..");
        const postbuild = readFileSync(path.join(root, "scripts", "postbuild-copy.mjs"), "utf8");
        expect(postbuild).toContain("baueServiceWorker(");
        expect(postbuild).toMatch(/"sw\.js"/);
        const app = readFileSync(path.join(root, "src", "app.ts"), "utf8");
        expect(app).toContain("registriereServiceWorker()");
    });
});

describe("registriereServiceWorker", () => {
    afterEach(() => vi.unstubAllGlobals());

    const stub = (opts: { protocol: string; secure: boolean; mitSw: boolean; readyState?: string }) => {
        const register = vi.fn(async () => ({}));
        const listener: Record<string, () => void> = {};
        vi.stubGlobal("navigator", opts.mitSw ? { serviceWorker: { register } } : {});
        vi.stubGlobal("window", {
            isSecureContext: opts.secure,
            location: { protocol: opts.protocol },
            addEventListener: (typ: string, cb: () => void) => {
                listener[typ] = cb;
            }
        });
        vi.stubGlobal("document", { readyState: opts.readyState ?? "loading" });
        return { register, listener };
    };

    it("meldet nach load relativ zur Seite an", () => {
        const { register, listener } = stub({ protocol: "https:", secure: true, mitSw: true });
        registriereServiceWorker();
        expect(register).not.toHaveBeenCalled();
        listener["load"]!();
        expect(register).toHaveBeenCalledWith("sw.js", { scope: "./" });
    });

    it("meldet sofort an, wenn die Seite schon geladen ist", () => {
        const { register } = stub({ protocol: "https:", secure: true, mitSw: true, readyState: "complete" });
        registriereServiceWorker();
        expect(register).toHaveBeenCalled();
    });

    it.each([
        { protocol: "file:", secure: true, mitSw: true },
        { protocol: "http:", secure: false, mitSw: true },
        { protocol: "https:", secure: true, mitSw: false }
    ])("tut nichts ohne passende Umgebung (%o)", opts => {
        const { register, listener } = stub(opts);
        registriereServiceWorker();
        expect(listener["load"]).toBeUndefined();
        expect(register).not.toHaveBeenCalled();
    });
});
