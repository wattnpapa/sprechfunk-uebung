# ADR 0003: Observability Event Schema

## Status
Accepted

## Context

Button clicks and route usage must be clearly attributable in analytics across modules.

## Decision

- Use generic `ui_click` events for all button clicks.
- Add stable button identity via `data-analytics-id` where relevant.
- Include `click_key` and `route_hash` in payload.
- Track runtime failures with `js_error` from:
  - `window.error`
  - `unhandledrejection`

## Consequences

- Better funnel and feature usage analysis.
- Fewer ambiguous click events.
- Faster diagnosis of client-side runtime issues.
