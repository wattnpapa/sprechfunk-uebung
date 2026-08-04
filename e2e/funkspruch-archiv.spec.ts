import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import { ARCHIV_VORLAGEN } from "../scripts/lib/funkspruch-daten.mjs";

// Playwright lädt die Spezifikationen als ES-Module; __dirname gibt es dort nicht.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Vorlage { datei: string; slug: string; name: string }
const vorlagen = ARCHIV_VORLAGEN as unknown as Vorlage[];

const zeilenDerQuelle = (datei: string): string[] =>
    readFileSync(path.join(ROOT, "assets", "funksprueche", datei), "utf8")
        .split(/\r?\n/)
        .map(zeile => zeile.trim())
        .filter(zeile => zeile !== "");

/** Kleinste Archivvorlage – hält den Round-Trip-Test schnell. */
const kleinste = [...vorlagen]
    .sort((a, b) => zeilenDerQuelle(a.datei).length - zeilenDerQuelle(b.datei).length)[0]!;

test.describe("Archiv ohne JavaScript", () => {
    // Der entscheidende Punkt des Arbeitspakets: der Bestand steht im
    // ausgelieferten HTML, nicht in einem nachgeladenen Datensatz.
    test.use({ javaScriptEnabled: false });

    for (const vorlage of vorlagen) {
        test(`@seo /funksprueche/vorlage/${vorlage.slug}/ zeigt alle Funksprüche ohne JavaScript`, async ({ page }) => {
            await page.goto(`/funksprueche/vorlage/${vorlage.slug}/`);

            const zeilen = zeilenDerQuelle(vorlage.datei);
            const eintraege = page.locator('[data-testid="funkspruch-liste"] > li');
            await expect(eintraege).toHaveCount(zeilen.length);

            // Erster, mittlerer und letzter Eintrag im sichtbaren Text: eine
            // Stichprobe über die ganze Liste, ohne 752 Zusicherungen.
            const sichtbar = (await page.locator("body").innerText()).replace(/\s+/g, " ");
            for (const index of [0, Math.floor(zeilen.length / 2), zeilen.length - 1]) {
                expect(sichtbar, `Funkspruch ${index + 1} fehlt im sichtbaren Text`)
                    .toContain(zeilen[index]!.replace(/\s+/g, " "));
            }
        });
    }

    test("@seo die Übersichtsseite nennt jede Vorlage mit ihrer Anzahl", async ({ page }) => {
        await page.goto("/funksprueche/");
        const tabelle = page.getByTestId("vorlagen-tabelle");
        await expect(tabelle).toBeVisible();

        for (const vorlage of vorlagen) {
            const zeile = tabelle.locator("tr", { hasText: vorlage.name }).first();
            await expect(zeile).toContainText(String(zeilenDerQuelle(vorlage.datei).length));
            await expect(zeile.locator("a")).toHaveAttribute(
                "href", `../funksprueche/vorlage/${vorlage.slug}/`
            );
        }
    });

    test("@seo die humorvolle Vorlage ist genannt, aber nicht verlinkt", async ({ page }) => {
        await page.goto("/funksprueche/");
        const zeile = page.getByTestId("vorlagen-tabelle").locator("tr", { hasText: "Humorvolle Lagen" });
        await expect(zeile).toContainText("nur im Generator");
        await expect(zeile.locator("a")).toHaveCount(0);
    });
});

test.describe("Filter über der Liste", () => {
    test("@seo filtert die Liste im Browser, ohne Einträge zu entfernen", async ({ page }) => {
        await page.goto(`/funksprueche/vorlage/${kleinste.slug}/`);

        const eintraege = page.locator('[data-testid="funkspruch-liste"] > li');
        const gesamt = zeilenDerQuelle(kleinste.datei).length;
        await expect(eintraege).toHaveCount(gesamt);

        const suchbegriff = zeilenDerQuelle(kleinste.datei)[0]!.split(/\s+/)[0]!;
        await page.locator("#funkspruchSuche").fill(suchbegriff);

        // Gefiltert wird über hidden – die Einträge bleiben im DOM und damit
        // auch für einen Crawler ohne Skriptausführung vorhanden.
        await expect(eintraege).toHaveCount(gesamt);
        const sichtbare = await eintraege.evaluateAll(
            liste => liste.filter(li => !(li as HTMLElement).hidden).length
        );
        expect(sichtbare).toBeGreaterThan(0);
        expect(sichtbare).toBeLessThan(gesamt);
        await expect(page.locator("#funkspruchTreffer")).toContainText("von");
    });
});

test.describe("Download und Wiedereinlesen im Generator", () => {
    for (const vorlage of vorlagen) {
        test(`@seo Download für ${vorlage.slug} entspricht der Quelldatei`, async ({ request }) => {
            const antwort = await request.get(`/assets/funksprueche-${vorlage.slug}.txt`);
            expect(antwort.status()).toBe(200);

            const inhalt = await antwort.text();
            const zeilen = inhalt.split("\n");
            expect(zeilen.pop()).toBe("");
            expect(zeilen).toEqual(zeilenDerQuelle(vorlage.datei));
        });
    }

    test("@seo die heruntergeladene Datei lässt sich im Generator wieder einlesen", async ({ page, context, request }) => {
        const inhalt = await (await request.get(`/assets/funksprueche-${kleinste.slug}.txt`)).text();

        // Firestore-Mock einschalten, wie es app.spec.ts für alle Generator-Tests
        // tut. Ohne ihn spricht der Test die echte Datenbank an: lokal geht das
        // gut (die committete Config funktioniert) und legt nebenbei Übungen im
        // Produktivbestand an – in CI wird firebase-config.js aus Secrets erzeugt,
        // das Speicherversprechen löst nie auf, und die Generierung bleibt ohne
        // Fehlermeldung vor den Links stehen. Genau daran ist der Deploy seit
        // AP-08 gescheitert.
        await context.addInitScript(() => {
            window.localStorage.setItem("useFirestoreEmulator", "1");
            window.localStorage.setItem("e2eFirestoreSeed", JSON.stringify({}));
        });

        await page.goto("/");

        // Zwei Funkstellen genügen für den Nachweis, dass die Datei gelesen wird.
        // Die Teilnehmertabelle bringt Zeilen mit, deshalb erst auffüllen, dann
        // alle vorhandenen Felder belegen – sonst bleiben leere Namen stehen.
        const namen = ["Heros Beispielstadt 11/11", "Heros Beispielstadt 22/22"];
        const felder = page.locator("#teilnehmer-body .teilnehmer-input");
        while ((await felder.count()) < namen.length) {
            await page.locator("#addTeilnehmerBtn").click();
        }
        const anzahlFelder = await felder.count();
        for (let i = 0; i < anzahlFelder; i++) {
            await felder.nth(i).fill(namen[i] ?? `Heros Beispielstadt 9${i}/9${i}`);
        }
        await page.locator("#nameDerUebung").fill("Archiv-Round-Trip");

        // Verteilung ausdrücklich setzen statt sie zu erben: validateSpruchVerteilung
        // bricht ab, sobald „Sprüche pro Teilnehmer" kleiner ist als Anmeldung
        // plus „an Alle" plus „an Mehrere". Die Prozentfelder rechnen die
        // versteckten Anzahlfelder bei jedem input-Ereignis neu, deshalb zuerst
        // die Anzahl, dann die Prozentsätze – und danach die Probe darauf.
        await page.locator("#spruecheProTeilnehmer").fill("3");
        await page.locator("#prozentAnAlle").fill("0");
        await page.locator("#prozentAnMehrere").fill("0");
        await page.locator("#prozentAnBuchstabieren").fill("0");
        await expect(page.locator("#spruecheAnAlle")).toHaveValue("0");
        await expect(page.locator("#spruecheAnMehrere")).toHaveValue("0");

        await page.locator("#optionUpload").check();
        await page.locator("#funksprueche").setInputFiles({
            name: `funksprueche-${kleinste.slug}.txt`,
            mimeType: "text/plain",
            buffer: Buffer.from(inhalt, "utf8")
        });

        await page.locator("#startUebungBtn").click();

        // Die Übung entsteht: ohne lesbare Datei bliebe der Nachrichtenpool leer
        // und die Generierung käme nicht bis zu den Links.
        await expect(page.locator("#uebung-links")).toBeVisible();

        // Beleg, dass der Mock gegriffen hat: die Übung liegt im lokalen Speicher.
        // Ohne diese Probe würde ein Abrutschen auf die echte Datenbank lokal
        // wieder unbemerkt bleiben und erst den Deploy zerlegen.
        const imMock = await page.evaluate(() =>
            Object.keys(JSON.parse(window.localStorage.getItem("e2eFirestoreSeed") ?? "{}")).length);
        expect(imMock, "Übung wurde nicht im Firestore-Mock gespeichert").toBeGreaterThan(0);
        await expect(
            page.locator("#links-teilnehmer-container .generator-link-row[data-link-type='teilnehmer']")
        ).toHaveCount(anzahlFelder);

        // Drei Sprüche je Funkstelle – die Statuszeile zählt, was aus der
        // hochgeladenen Datei verteilt wurde.
        const anzahl = Number(await page.locator("#statusNachrichtenCount").textContent());
        expect(anzahl, "keine Nachrichten aus der hochgeladenen Datei")
            .toBeGreaterThanOrEqual(3 * anzahlFelder);
    });
});
