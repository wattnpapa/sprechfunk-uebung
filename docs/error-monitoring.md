# Error Monitoring

Die App erfasst globale Laufzeitfehler zentral ueber `src/services/errorMonitoring.ts`.

## Was wird erfasst
- `window.error`
- `unhandledrejection`

## Event
- Analytics Event: `app_error`
- Felder: `kind`, `message`, `source`, `line`, `col`, `route_hash`, `mode`, `app_version`
- Client-seitige Deduplizierung aktiv

## Optional Sentry
Wenn `window.Sentry.captureException` vorhanden ist, wird der Fehler dort zusaetzlich gemeldet.

## Feature Flag
- `enableGlobalErrorMonitoring` (siehe `docs/feature-flags.md`)

