# Feature Flags

## Verfuegbare Flags
- `enableStartrekTheme`
- `enableGlobalErrorMonitoring`

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

