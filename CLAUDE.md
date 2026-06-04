# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sprechfunk Übungsgenerator is a single-page web application for creating BOS radio exercise simulations. It's a TypeScript app bundled with Rollup, using Firebase/Firestore as backend, and deployed as a static site (also available as an Electron desktop app).

## Setup

```bash
npm ci
cp src/firebase-config.template.js src/firebase-config.js  # required for local dev/tests without secrets
npm run build
```

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
- `src/teilnehmer/` — participant view with message status, modal PDF preview
- `src/uebungsleitung/` — trainer view split into `TeilnehmerView` and `NachrichtenView`
- `src/admin/` — exercise list, statistics, deletion

### Core Domain Types
- `Uebung` (`src/types/Uebung.ts`) — the persisted exercise document in Firestore
- `FunkUebung` (`src/models/FunkUebung.ts`) — extended model used during generation
- `Nachricht` (`src/types/Nachricht.ts`) — individual radio message

### Services
- `GenerationService` — creates message distribution, join codes (Übungs-/Teilnehmercodes), checksums
- `FirebaseService` — all Firestore reads/writes; handles missing-index errors with fallback
- `pdfGenerator` / `pdfA4Service` / `pdfDebriefService` / `pdfZipService` — PDF and ZIP export
- `analytics` — GA4 tracking (consent-mode, off by default)
- `featureFlags` — runtime feature toggles via localStorage/URL params

### Build
Rollup bundles `src/app.ts` → `dist/bundle.js`. PostCSS extracts CSS. FontAwesome webfonts and PDF.js worker are copied to `dist/` as static assets. A postbuild script (`scripts/postbuild-copy.mjs`) handles additional static file copies.

### Tests
- Unit/integration: `tests/` mirrors `src/` structure; uses Vitest with jsdom-free node environment
- E2E: `e2e/app.spec.ts` with Playwright; tagged with `@smoke`, `@generator`, `@admin`, `@teilnehmer`, `@uebungsleitung`, `@routing`
- Coverage thresholds: 75% lines/statements/functions/branches

## Conventions

- **Commit style**: Conventional Commits scoped to module — `fix(generator):`, `feat(admin):`, `test(e2e):`, `chore(ci):`
- **TypeScript**: strict mode; no implicit `any` (explicit casts require ESLint disable comment)
- **Firestore**: sanitize data before writing (no `undefined` fields, no empty keys); queries must handle missing-index errors gracefully
- **`firebase-config.js`** is gitignored — never commit real Firebase credentials
- **`localStorage` seed paths** support mock/E2E mode; don't break them when refactoring storage logic
