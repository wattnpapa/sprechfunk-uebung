# Analytics Event Schema

This project tracks UI interactions with two layers:

1. Generic event: `ui_click`
2. Domain events: e.g. `generator_start_uebung`, `teilnehmer_toggle_uebertragen`, `admin_delete_uebung`

## `ui_click` payload

- `tag`: clicked element tag
- `id`: element id or `(none)`
- `class_name`: css classes or `(none)`
- `action`: `data-action` value or `(none)`
- `name`: form `name` value or `(none)`
- `label`: aria-label/text fallback (trimmed)
- `click_key`: stable key (`id:*`, `analytics:*`, `action:*`, fallback DOM path)
- `route_hash`: current route hash (`#/generator`, `#/admin`, ...)

## Naming rules

- Prefer explicit `data-analytics-id` on important buttons.
- Keep event names lowercase and feature-scoped:
  - `generator_*`
  - `teilnehmer_*`
  - `uebungsleitung_*`
  - `admin_*`
  - `route_*`

## Error telemetry

Global runtime errors are tracked as `js_error` with:

- `kind`: `window_error` or `unhandled_rejection`
- `message`
- optional: `source`, `line`, `col`

Deduplication is applied client-side to avoid flooding.
