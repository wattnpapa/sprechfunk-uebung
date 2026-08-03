# Entwicklerdokumentation

Technische Informationen zum Sprechfunk Übungsgenerator. Die Anwenderperspektive steht in der
[README](../README.md) und in der [Anleitung für Anwender](../howto.md).

## Überblick

Single-Page-Webanwendung in TypeScript, gebündelt mit Rollup, Firebase/Firestore als Backend,
Auslieferung als statische Seite (zusätzlich als Electron-Desktop-App verfügbar).

Die Anwendung besteht aus vier Modi: Generator, Teilnehmeransicht, Übungsleitung und Admin.

## Lokal starten

Voraussetzungen:
- Node.js 20+
- npm

Schritte:
1. `npm ci`
2. `npm run build`
3. `npm run serve`
4. Browser öffnen: `http://127.0.0.1:3000`

Entwicklung mit Watch:
- `npm run dev`

## Firebase-Konfiguration

`src/firebase-config.js` ist **bewusst eingecheckt und nicht gitignored**. Eine Firebase-*Web*-
Konfiguration ist kein Geheimnis: sie identifiziert das Projekt, sie authentifiziert nicht.
Sie muss ohnehin in den Browser ausgeliefert werden, dieselben Werte stehen also bereits im
öffentlichen `dist/bundle.js` auf sprechfunk-uebung.de. Einchecken erzeugt damit keine
zusätzliche Offenlegung, spart dir aber jeden Einrichtungsschritt: nach `npm ci` laufen
lokale Entwicklung, Tests und `scripts/backfill-stat-felder.mjs` sofort.

`src/firebase-config.template.js` existiert für die CI, die die Datei in
`.github/workflows/main.yml` und `e2e-nightly.yml` aus `secrets.FIREBASE_*` neu erzeugt.
Wenn du ein Feld ergänzt, ergänze es in beiden – `tests/repo/FirebaseConfigDoku.test.ts`
prüft das.

Die eigentliche Zugriffsgrenze ist `firestore.rules`, **nicht** der API-Key. Diese Regeln
erlauben anonymes Lesen, Anlegen und Löschen bewusst (siehe die Kommentare zu den
„Restrisiken“ dort), weil die Anwendung keinen Identitätsbegriff hat. Eine Domain-
Beschränkung des Keys würde daran nichts ändern, denn der HTTP-`Referer` ist clientseitig
setzbar und damit fälschbar.

Was du dagegen **nie** committen darfst: *Server*-Credentials – Service-Account-JSONs,
Admin-SDK-Schlüssel oder CI-Tokens.

## Tests und Qualität

- Lint: `npm run lint`
- Lint mit Autofix: `npm run lint:fix`
- Unit/Integration: `npm run test`
- Coverage: `npm run test:coverage`
- E2E komplett: `npm run test:e2e`

E2E-Suiten (tag-basiert):
- Smoke: `npm run test:e2e:smoke`
- Generator: `npm run test:e2e:generator`
- Admin: `npm run test:e2e:admin`
- Teilnehmer: `npm run test:e2e:teilnehmer`
- Übungsleitung: `npm run test:e2e:uebungsleitung`
- Routing: `npm run test:e2e:routing`
- Alle nacheinander: `npm run test:e2e:split`

Coverage-Schwellwerte: 75 % für Lines/Statements/Functions/Branches.

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/main.yml`
- Build, Lint, Unit/Integration mit Coverage
- Codecov-Upload (`CODECOV_TOKEN` via Secret/Variable)
- E2E als Matrix-Jobs:
- `smoke`, `generator`, `admin`, `teilnehmer`, `uebungsleitung`, `routing`
- E2E Matrix läuft nur bei relevanten Code-Änderungen (Path Filter)
- Playwright mit Retry in CI (`retries: 1`)
- Pro E2E-Suite werden Artefakte hochgeladen:
- `test-results`, `playwright-report`
- E2E JUnit-Resultate werden zu Codecov hochgeladen
- Deployment auf GitHub Pages nach erfolgreichen Jobs
- Nightly Full E2E: `.github/workflows/e2e-nightly.yml`
- PR-Validierung: `.github/workflows/ci.yml`
- Empfohlene Required Checks (Branch Protection):
- `validate`
- `e2e-smoke-routing`

## Reichweitenmessung

- GoatCounter per Script-Tag in `src/index.html`, cookielos und ohne personenbezogene Daten
- Kein Consent-Banner und kein Opt-out-Schalter nötig
- Es werden nur Seitenaufrufe gezählt, keine Button-Klicks oder Feature-Events

## Sicherheit / Dependencies

- Firestore-Zugriffsregeln: `firestore.rules` (Deploy: `firebase deploy --only firestore`)
- Zugriffsmodell und bekannte Restrisiken: [adr/0005-firestore-sicherheitsregeln.md](adr/0005-firestore-sicherheitsregeln.md)
- Sicherheitsupdates regelmäßig über Dependabot/NPM Audit
- `jspdf`/`jspdf-autotable` auf aktuellem Stand
- Dependabot Konfiguration: `.github/dependabot.yml`
- Geplanter Hygiene-Workflow: `.github/workflows/dependency-hygiene.yml`

## Betrieb / Performance

- Feature Flags: [feature-flags.md](feature-flags.md)
- Performance Budget: [performance-budget.md](performance-budget.md)
- Backup/Restore Playbook: [backup-restore-firestore.md](backup-restore-firestore.md)
- Error Monitoring: [error-monitoring.md](error-monitoring.md)
- Architekturentscheidungen: [adr/](adr/)

## Mitwirken

Pull Requests sind willkommen – Code verbessern, Fehler beheben, Features vorschlagen und
implementieren, Tests schreiben, Dokumentation verbessern.

- Commit-Stil: Conventional Commits, auf das Modul gescoped – `fix(generator):`, `feat(admin):`,
  `test(e2e):`, `chore(ci):`
- [Issues auf GitHub](https://github.com/wattnpapa/sprechfunk-uebung/issues)

## Lizenz

[EUPL-1.2](../LICENSE) (European Union Public Licence v1.2) – Copyleft: abgeleitete Werke stehen
unter derselben oder einer kompatiblen Lizenz.
