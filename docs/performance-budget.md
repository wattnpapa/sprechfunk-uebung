# Performance Budget

Die CI prueft nach `npm run build` feste Bundle-Budgets mit `npm run perf:budget`.

## Aktuelle Limits
- `dist/bundle.js`: max `4_200_000` bytes, gzip max `980_000` bytes
- `dist/bundle.css`: max `420_000` bytes, gzip max `70_000` bytes
- `dist/style.css`: max `60_000` bytes, gzip max `12_000` bytes

## Lokaler Check
1. `npm run build`
2. `npm run perf:budget`

Wenn ein Budget gerissen wird, stoppt die CI mit Fehler.

