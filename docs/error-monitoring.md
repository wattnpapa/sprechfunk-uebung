# Error Monitoring

Die App erfasst globale Laufzeitfehler zentral ueber `src/services/errorMonitoring.ts`.

## Was wird erfasst
- `window.error`
- `unhandledrejection`

## Meldung
- Client-seitige Deduplizierung aktiv (gleiche Kombination aus Art, Quelle, Zeile, Spalte und Meldung wird nur einmal gemeldet)
- Kontext: `kind`, `message`, `source`, `line`, `col`, `routeHash`, `mode`, `appVersion`

## Optional Sentry
Wenn `window.Sentry.captureException` vorhanden ist, wird der Fehler dorthin gemeldet.
Ohne Sentry bleibt die Erfassung rein clientseitig ohne Versand.

## Feature Flag
- `enableGlobalErrorMonitoring` (siehe `docs/feature-flags.md`)

