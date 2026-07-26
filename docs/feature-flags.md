# Feature Flags

## Verfuegbare Flags
- `enableStartrekTheme`
- `enableGlobalErrorMonitoring`
- `enableLiveStatusSync` – Live-Sync des Uebungsstatus ueber
  `uebungen/{id}/status` (siehe `docs/adr/0006-live-sync-uebungsstatus.md`).
  Abgeschaltet arbeiten Teilnehmer und Uebungsleitung wieder rein lokal.

## Nutzung per Query
- Aktivieren:
  - `?ff=enableStartrekTheme,enableGlobalErrorMonitoring`
- Deaktivieren:
  - `?ff_disable=enableGlobalErrorMonitoring`

## Nutzung per localStorage
Key: `featureFlags`

Beispiel:
```json
{
  "enableStartrekTheme": true,
  "enableGlobalErrorMonitoring": true
}
```

Setzen in der Browser-Konsole:
```js
localStorage.setItem("featureFlags", JSON.stringify({
  enableStartrekTheme: false
}));
location.reload();
```

