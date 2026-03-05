# AGENTS.md

Diese Datei definiert Arbeitsregeln für AI-/Automations-Agents in diesem Repository.

## Ziel
- Stabil entwickeln, ohne bestehende Übungsabläufe zu brechen.
- Änderungen immer testbar, nachvollziehbar und CI-freundlich liefern.

## Tech-Stack
- TypeScript + Rollup (Web-App)
- Electron (Desktop-Paket)
- Vitest (Unit/Integration)
- Playwright (E2E)
- Firebase/Firestore

## Projekt-Setup
1. `npm ci`
2. `cp src/firebase-config.template.js src/firebase-config.js` (für lokale Tests ohne Secrets)
3. `npm run build`

## Wichtige Befehle
- `npm run build` – Web-Build
- `npm run lint` – ESLint
- `npm run test:coverage` – Vitest inkl. Coverage + JUnit
- `npm run test:e2e` – Playwright komplett

## Code-Richtlinien
- TypeScript strict-konform halten.
- Kleine, gezielte Änderungen statt großer Umbauten ohne Not.
- Bestehende Naming-Konventionen und Ordnerstruktur beibehalten.
- Keine toten Exporte/Imports hinterlassen.
- Keine Secrets, Keys oder Tokens committen.

## Tests (Pflicht bei Änderungen)
- Bei Logikänderungen mindestens passende Unit/Integration-Tests ergänzen.
- Bei UI-/Routing-Änderungen mindestens einen E2E-Test ergänzen/anpassen.
- Vor Abschluss mindestens:
  - `npm run lint`
  - betroffene Test-Suite(s)

## CI/Workflow-Regeln
- Änderungen müssen mit GitHub Actions kompatibel sein (Linux/macOS/Windows wenn relevant).
- Build-Skripte plattformneutral halten (keine reinen Unix-Kommandos in npm scripts).
- Für Electron-Builds kein implizites Publishing erzwingen (`--publish never`).

## Firestore/Firebase
- Queries so bauen, dass fehlende Indizes robust behandelt werden (Fallback-Strategie).
- Daten beim Speichern sanitizen (keine leeren Keys, keine `undefined` Felder).
- Mock-/E2E-Modus nicht kaputtmachen (`localStorage`-Seed-Pfade beachten).

## UX/Produktregeln
- Teilnehmer-/Übungs-Codes und Join-Flows dürfen nicht regressieren.
- PDF-/Druckdaten-Funktionen müssen funktionsfähig bleiben.
- Darkmode/Theme-Anpassungen immer auf Lesbarkeit prüfen.

## Commit-Regeln
- Präzise Conventional-Commits verwenden, z. B.:
  - `fix(generator): ...`
  - `feat(admin): ...`
  - `test(e2e): ...`
  - `chore(ci): ...`
- Keine Sammel-Commits mit unzusammenhängenden Änderungen.

## DoD (Definition of Done)
- Build erfolgreich.
- Lint erfolgreich.
- Relevante Tests erfolgreich.
- Keine unbeabsichtigten Änderungen (Diff prüfen).
- Kurze Änderungsbeschreibung mit betroffenen Dateien.
