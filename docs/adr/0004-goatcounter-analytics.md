# ADR 0004: GoatCounter statt Google Analytics

## Status
Accepted

## Context

Google Analytics 4 erforderte eine Consent-Verwaltung (ADR 0002), ein eigenes Event-Schema
(ADR 0003) und einen Analytics-Service samt `data-analytics-id`-Attributen quer durch alle
Module. Der Nutzen stand in keinem Verhaltnis zum Aufwand: gebraucht wird lediglich eine
grobe Reichweitenmessung.

## Decision

- Google Analytics vollstaendig entfernen: Service, Event-Schema, Payload-Builder,
  `data-analytics-id`-Attribute, Consent-Toggle im Footer und `measurementId` in der
  Firebase-Konfiguration.
- Stattdessen GoatCounter per Script-Tag in `src/index.html` einbinden:

```html
<script data-goatcounter="https://sprechfunk-uebung.goatcounter.com/count"
        async src="//gc.zgo.at/count.js"></script>
```

- Kein Consent-Banner und kein Opt-out-Schalter, da GoatCounter cookielos arbeitet und
  keine personenbezogenen Daten speichert.
- Laufzeitfehler gehen weiterhin ueber `errorMonitoring` an Sentry, sofern vorhanden.

## Consequences

- Deutlich weniger Code und keine Consent-Logik mehr.
- Der Datenschutzhinweis nennt GoatCounter statt Google Analytics.
- Es werden nur Seitenaufrufe gezaehlt, keine Button-Klicks oder Feature-Events.
- Hash-Routenwechsel innerhalb der SPA erzeugen keinen zusaetzlichen Zaehler; bei Bedarf
  liesse sich das ueber `window.goatcounter.count()` nachruesten.
