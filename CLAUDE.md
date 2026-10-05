# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sprechfunk Übungsgenerator is a single-page web application for creating BOS radio exercise simulations. It's a TypeScript app bundled with Rollup, using Firebase/Firestore as backend, and deployed as a static site (also available as an Electron desktop app).

## Setup

```bash
npm ci
npm run build
```

`src/firebase-config.js` is committed and already contains the working config — no copy
step needed. Only overwrite it from `src/firebase-config.template.js` if you deliberately
want placeholder values; that dirties the working tree, so revert it afterwards
(`git checkout -- src/firebase-config.js`). See Conventions below for why the file is tracked.

## Common Commands

```bash
npm run build          # Rollup build → dist/
npm run dev            # Watch + serve (concurrently)
npm run serve          # Serve dist/ at http://127.0.0.1:3000
npm run lint           # ESLint
npm run lint:fix       # ESLint with auto-fix
npm run test           # Vitest (watch mode)
npm run test:coverage  # Vitest + coverage + JUnit output
npm run test:e2e       # All Playwright E2E tests
```

Single test file:
```bash
npx vitest run tests/services/GenerationService.test.ts
```

E2E by suite tag (faster than full run):
```bash
npm run test:e2e:smoke
npm run test:e2e:generator
npm run test:e2e:teilnehmer
npm run test:e2e:uebungsleitung
npm run test:e2e:admin
```

## Architecture

### SPA Routing
Hash-based router (`src/core/router.ts`) dispatches to one of four `AppMode` values: `generator`, `teilnehmer`, `uebungsleitung`, `admin`. The `App` class (`src/core/App.ts`) wires Firebase init → router → mode controllers on startup.

### State
A minimal observable store (`src/state/store.ts`) holds `AppState`: current mode, active `Uebung`, active exercise ID, theme, and Firestore instance. Components `subscribe()` to the store rather than passing props.

### Modules
Each mode is a self-contained module with an `index.ts` entry:
- `src/generator/` — exercise creation UI, distribution logic, link/stats rendering
  - Profile (`GeneratorProfile.ts`, `controllerProfile.ts`): a profile is a named `GeneratorEntwurf`,
    stored in localStorage (`generatorProfile:v1`) and exportable/importable as JSON file. New form
    fields or Spielmodi belong in `GeneratorEntwurf` and are then part of profiles automatically.
- `src/teilnehmer/` — participant view with message status, modal PDF preview
- `src/uebungsleitung/` — trainer view split into `TeilnehmerView` and `NachrichtenView`
- `src/admin/` — exercise list, statistics, deletion

### Core Domain Types
- `Uebung` (`src/types/Uebung.ts`) — the persisted exercise document in Firestore
- `FunkUebung` (`src/models/FunkUebung.ts`) — extended model used during generation
- `Nachricht` (`src/types/Nachricht.ts`) — individual radio message
- `Szenario` (`src/types/Szenario.ts`) — peer-to-peer drehbuch: Handlungsstränge distributed
  over the participants (`assets/szenarien/*.json`, registry `src/data/szenarien.ts`)
- `FuehrungsstellenUebung` (`src/types/FuehrungsstellenUebung.ts`) — Stabsrahmenübung for
  exactly one Führungsstelle: the Übungsleitung plays the subordinate Einsatzabschnitte and
  the superior Stab, every message goes to the beübte Stelle and carries a minute (stored as
  `xZeitSlot`, `spielModus` forced to `xZeit`), `weg` (funk/drucker/email), `meldeart`,
  optional `betreff` and the `erwartung` for the Übungsleitung. Strands are distributed
  round-robin (deterministic) over the configured Abschnitte, so the number of Abschnitte is
  variable between `minAbschnitte` and the strand count. Drehbücher live in
  `assets/fuehrungsstellen/*.json` (registry `src/data/fuehrungsstellenUebungen.ts`, parser
  `FuehrungsstellenUebungService`, inventory test
  `tests/fuehrungsstellen/FuehrungsstellenBestand.test.ts`). The role assignment is persisted
  in `Uebung.fuehrungsstelle` (allowlisted in `firestore.rules`); the beübte Stelle gets no
  participant link. `src/pdf/Drehbuch.ts` renders the Drehbuch PDF that the ZIP includes.

### Services
- `GenerationService` — creates message distribution, join codes (Übungs-/Teilnehmercodes), checksums
- `FirebaseService` — all Firestore reads/writes; handles missing-index errors with fallback
- `pdfGenerator` / `pdfA4Service` / `pdfDebriefService` / `pdfZipService` — PDF and ZIP export
- Nachrichten- und Meldevordruck are drawn by the external package `bos-nachrichtenvordruck`
  (repo `wattnpapa/bos-nachrichtenvordruck`, pinned by tag in `package.json`, embeds the
  form images). `src/pdf/vordruckDaten.ts` is the only adapter from `Uebung`/`Nachricht` to
  its `VordruckDaten`; field geometry or rendering changes go into that repo, tag a release there, then bump the pin.
- `errorMonitoring` — global runtime error capture, forwarded to Sentry when available
- `featureFlags` — runtime feature toggles via localStorage/URL params

### Build
Rollup bundles `src/app.ts` → `dist/bundle.js`. PostCSS extracts CSS. FontAwesome webfonts and PDF.js worker are copied to `dist/` as static assets. A postbuild script (`scripts/postbuild-copy.mjs`) handles additional static file copies.

### Static content pages / SEO
`scripts/site-pages.mjs` is the single source of truth for every indexable URL. Adding a page means: create `src/pages/<slug>.html` and add one entry to `SITE_PAGES` — the postbuild step then deploys it as `dist/<slug>/index.html` and regenerates `dist/sitemap.xml` (with `lastmod` taken from the file's last git commit). `tests/seo/StaticPages.test.ts` enforces canonical, title, description, `og:image` and internal linking from the start page. `assets/og-image.png` is generated by `npm run og:image` (headless Chromium) and committed, so the normal build needs no browser. The guide screenshots in `assets/anleitung/` come from `npm run anleitung:screenshots` (Playwright against a locally served build in mock mode; post-processing steps in the script header) and are committed as well.

### Verbreitbare Artefakte (AP-12)
Der Build erzeugt hinter dem Postbuild-Schritt zwei weitere Ausgaben, beide aus
denselben Quellen wie die Seiten selbst — es gibt bewusst keine zweite Fassung der
Inhalte:
- `scripts/generate-embed.mjs` → `dist/embed/<slug>/index.html`, das einbettbare
  Widget. Registry: `EMBEDS` in `scripts/lib/embed.mjs`. Ohne Skript, ohne Cookies,
  `noindex`; der Einbettungscode auf `/einbetten/` trägt den eigentlichen Verweis
  außerhalb des iframes. E2E: `e2e/embed.spec.ts` bettet es von einem eigenen
  lokalen Server auf anderem Port ein (echt cross-origin).
- `scripts/generate-pdfs.mjs` → `dist/downloads/*.pdf`, die A4-Aushänge. Registry:
  `AUSHAENGE` in `scripts/lib/aushaenge.mjs`. Der QR-Code kommt aus
  `scripts/lib/qrcode.mjs` (selbst geschriebener Encoder, keine neue Abhängigkeit);
  `tests/seo/QrCode.test.ts` liest ihn mit eigenem Decoder zurück und prüft die
  Reed-Solomon-Syndrome.

Off-Page-Werkzeuge ohne Buildbezug: `npm run backlinks:report` (liest den manuellen
Search-Console-CSV-Export — die API hat **keinen** Links-Endpunkt) und
`npm run outreach:check` (ruft alle URLs aus `seo/outreach.md` ab, braucht Netz,
deshalb nicht in der CI).

### Tests
- Unit/integration: `tests/` mirrors `src/` structure; uses Vitest with jsdom-free node environment
- E2E: `e2e/app.spec.ts` with Playwright; tagged with `@smoke`, `@generator`, `@admin`, `@teilnehmer`, `@uebungsleitung`, `@routing`
- Coverage thresholds: 75% lines/statements/functions/branches

## Conventions

- **Commit style**: Conventional Commits scoped to module — `fix(generator):`, `feat(admin):`, `test(e2e):`, `chore(ci):`
- **TypeScript**: strict mode; no implicit `any` (explicit casts require ESLint disable comment)
- **Firestore**: sanitize data before writing (no `undefined` fields, no empty keys); queries must handle missing-index errors gracefully
- **`src/firebase-config.js` is deliberately committed, not gitignored.** A Firebase *web*
  config is not a secret: it identifies the project, it does not authenticate. It has to ship
  to the browser, so the same values are already in the public `dist/bundle.js` on
  sprechfunk-uebung.de — checking them in adds no exposure. Keeping the file tracked means
  local dev, the test suite and `scripts/backfill-stat-felder.mjs` work straight after
  `npm ci`, without secrets. `src/firebase-config.template.js` exists for CI, which
  regenerates the file from `secrets.FIREBASE_*` (`.github/workflows/main.yml`,
  `e2e-nightly.yml`); keep the two in sync — guarded by
  `tests/repo/FirebaseConfigDoku.test.ts`.
  - The actual access boundary is `firestore.rules`, **not** the API key. Those rules
    knowingly allow anonymous read, create and delete (see the "Restrisiken" comments there),
    because the app has no notion of identity. Restricting the key to a domain would not
    change that — an HTTP `Referer` is client-controlled and forgeable.
  - Do commit no *server* credentials: service-account JSON, Admin-SDK keys or CI tokens
    never belong in the repo.
- **`firestore.rules`** denies every subcollection of `/uebungen` except
  `status`; new persisted fields must be added to the allowlists there, or
  Firestore rejects the write in production (guarded by
  `tests/services/FirestoreRules.contract.test.ts`)
  - **The rules are part of the deployment.** The job `firestore-rules` in `main.yml` pushes
    `firestore.rules` to Firebase on every push to `main`, before the Pages deploy, which
    waits for it; without the repository secret `FIREBASE_SERVICE_ACCOUNT` the job fails on
    purpose, the website is held back, and the deploy has to be done by hand with
    `npm run rules:deploy`. Details: `docs/entwicklung.md`, section „Firestore-Regeln
    deployen“; rationale in `docs/adr/0008-firestore-regeln-im-deployment.md` (credentials
    and failure semantics in ADR 0007). Guarded by `tests/repo/FirestoreRulesDeploy.test.ts`.
  - **Firestore evaluates at most 1000 expressions per request** and answers
    `PERMISSION_DENIED` above that. Check presence of optional fields with `'feld' in daten`,
    never with `keys()` per field, and keep each new optional field to 10–20 expressions.
    `npm run rules:test` runs the rules in the Firestore emulator against documents the app
    really writes and asserts a reserve below the limit (needs Java); CI runs the same as the
    job `firestore-rules-emulator`.
- **`localStorage` seed paths** support mock/E2E mode; don't break them when refactoring storage logic

## Funkspruch-Vorlagen erweitern (Skills)

Der Bestand war lange THW-lastig. Seit 2026-09 gibt es dafür Projekt-Skills unter
`.claude/skills/`, die im Repo versioniert sind:

- `funkspruch-basis` – Format, Stil nach DV 810.3, Qualitätsregeln, Prüfskript
  (`node .claude/skills/funkspruch-basis/scripts/pruefe-vorlage.mjs <datei>`) und der
  vollständige Einbau-Pfad in `referenz/einbau.md` (neun Stationen: Textdatei, beide
  Registries, Archivseite, Seiten-Registry, feste Zahlen, Schema-Zählung, eingehende
  Links, Hub-Text).
- `funkspruch-feuerwehr`, `funkspruch-sanitaet-betreuung`, `funkspruch-wasserrettung`,
  `funkspruch-rettungsdienst` – Fachprofil je Organisation: Einheiten, Fahrzeuge,
  Stärkeschema, Rufnamen, Meldearten, typische Lagen, und was nicht hineingehört.

Immer Basis-Skill plus Organisations-Skill laden. Neue Vorlagen kommen als eigener PR und
werden vor dem Merge von jemandem mit Praxis in der Organisation gegengelesen; der PR-Text
sagt, ob das passiert ist. Das Prüfskript ersetzt diese Durchsicht nicht, es fängt nur
Format, Dubletten gegen den ganzen Bestand und Stilverstöße ab.

## SEO-Arbeitspakete (AP-XX)

Gemeinsamer Kontext für die SEO-Arbeitspakete. Ziel ist Platz 1 für "BOS Sprechfunk Übung"
auf https://sprechfunk-uebung.de (Repo `wattnpapa/sprechfunk-uebung`, EUPL-1.2, öffentlich).

### Regeln je Arbeitspaket
1. Vor Beginn `AGENTS.md`, `CLAUDE.md` und `README.md` lesen. Deren Konventionen haben Vorrang.
2. Bestehende Struktur erweitern, nicht parallel neu erfinden — insbesondere `scripts/site-pages.mjs`
   statt einer zweiten Seiten-Registry.
3. Keine neuen Laufzeit-Abhängigkeiten ohne Begründung im PR-Text. Das Performance-Budget
   (`npm run perf:budget`, `scripts/check-performance-budget.mjs`) ist ein Wettbewerbsvorteil.
4. Jede Änderung an Seiten oder Metadaten braucht einen Test: Vitest für Datenstrukturen und
   generierte Metadaten (`tests/seo/StaticPages.test.ts`), Playwright für gerendertes HTML und Navigation.
5. `npm run lint`, `npm test` und der Build müssen grün sein, bevor der PR gestellt wird.
6. Ein PR je Arbeitspaket, Titel `seo(AP-XX): kurze Beschreibung`. Im PR-Text: was, warum, wie zu prüfen.
7. Keine URL löschen oder umbenennen ohne Weiterleitung — **aber siehe Hosting-Hinweis unten**.

### Hosting (wichtig, weicht von der Annahme "Firebase Hosting" ab)
Deployment läuft über **GitHub Pages** (`.github/workflows/main.yml`, `actions/deploy-pages`).
`firebase.json` enthält **nur** `firestore` und `emulators` — **keine** `hosting`-Sektion.
Firebase liefert hier ausschließlich Firestore als Datenbank, nicht die Website.

Folge: **echte 301-Weiterleitungen sind aktuell nicht möglich.** GitHub Pages serviert keine
serverseitigen Redirects, und `firebase.json` ist dafür nicht der richtige Ort. Wer eine URL
umbenennt, braucht daher eine bewusste Entscheidung:
- HTML-Stub am alten Pfad mit `<link rel="canonical">` auf das neue Ziel plus Meta-Refresh, oder
- Wechsel auf einen Host mit Redirect-Support (eigener ADR unter `docs/adr/`).

Nicht stillschweigend annehmen, ein Redirect sei eingerichtet.

### Seiten-Registry
`SITE_PAGES` in `scripts/site-pages.mjs` hält je Seite nur `slug`, `source`, `changefreq`
und `priority` — **nicht** Titles und Descriptions. Die stehen in der jeweiligen
`src/pages/<slug>.html` und werden von `tests/seo/StaticPages.test.ts` gegen Canonical,
`og:*` und interne Verlinkung geprüft.

### Sprache und Inhalt
- Deutsche Texte in Du-Form, wie im Bestand.
- Keine Werbesprache, keine Superlative ohne Beleg.
- Keine erfundenen Quellen, Normen, Zahlen oder Zitate.
- Fachbegriffe korrekt: BOS, TMO, DMO, Rufgruppe, Funkrufname, OPTA, Meldevordruck, Nachrichtenvordruck.
- Zitierbare Quellen nur real existierende: DV 810.3, BOS-Funkrichtlinie, FwDV 100,
  THW-Dienstvorschriften. Im Zweifel keine Quelle angeben statt eine zu erfinden.

### Eigene Position
**Über andere Anbieter wird hier nicht geurteilt.** Keine namentliche Nennung, kein
Merkmalsvergleich, keine Aussagen über deren Preise, Funktionsumfang oder Datenschutz —
auch nicht belegt und auch nicht wohlwollend. `tests/seo/Wettbewerbsvergleich.test.ts`
erzwingt das über alle Seiten hinweg und über `seo/keywords.json`. Die Seite
`/alternative/` vergleicht Wege (Handarbeit, Tabelle, dieser Generator, kommerzielle
Kategorie), nicht Produkte.

Eigene, belegbare Vorteile: kostenlos, ohne Anmeldung, ohne Installation, Open Source,
ein Bestand von Übungsfunksprüchen in `assets/funksprueche/`, dessen THW-Vorlagen aus
tatsächlich gefunkten Übungen stammen. Die Vorlagen für Feuerwehr, Sanitäts- und
Betreuungsdienst, Wasserrettung und Rettungsdienst sind **für den Generator geschrieben**
(Feld `herkunft` in `VORLAGEN`) und werden auf jeder Seite so genannt. Nie behaupten,
der ganze Bestand stamme aus echten Übungen.

Ebenso wichtig sind die eigenen Grenzen, und sie gehören sichtbar auf die Seiten: ohne
Konto gibt es keinen Zugriffsschutz und keine Rechteverwaltung, es gibt keinen
Vertragspartner, keine Rechnung und keinen Anspruch auf Unterstützung.

**Die Anzahl nicht von Hand zitieren.** Seit AP-08 kommt sie aus dem gezählten Bestand:
`ANZAHL_GESAMT` (alle Vorlagen, also was der Generator verteilt) und `ANZAHL_ARCHIV`
(nur das öffentliche Archiv) aus `scripts/lib/funkspruch-bestand.mjs`. Im Fließtext der
Seiten stehen die Platzhalter `{{FUNKSPRUECHE_GESAMT}}` und `{{FUNKSPRUECHE_ARCHIV}}`,
die der Build auflöst. Ein Test verbietet die früher verstreute Zahl „1.800" domainweit.

```
node -e 'import("./scripts/lib/funkspruch-bestand.mjs").then(m => console.log(m.ANZAHL_GESAMT, m.ANZAHL_ARCHIV))'
```

Am 2026-09-27 sind das 4.314 und 2.654. **Nicht über `cat *.txt | grep -c` zählen** – das
Ergebnis ist um eins zu niedrig, weil `nachrichten_thw_melle.txt` ohne Zeilenumbruch endet
und `cat` ihre letzte Zeile mit der ersten der Folgedatei verklebt.

Diese Punkte in Inhalten sichtbar machen, ohne den Wettbewerber abzuwerten oder unbelegte
Behauptungen über ihn aufzustellen. Performance-Vergleiche nur mit selbst gemessenen,
datierten Werten.
