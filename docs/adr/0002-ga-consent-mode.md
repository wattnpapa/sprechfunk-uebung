# ADR 0002: GA Consent Mode

## Status
Accepted

## Context

The application tracks user interactions for product analytics. Tracking must support privacy-first behavior and explicit user choice.

## Decision

- Use GA4 Consent Mode with default denied state.
- Store user choice in `localStorage` key `ga_consent` (`granted` / `denied`).
- Add a footer toggle button to switch consent at runtime.
- Only send `page_view` and event tracking when consent is granted.

## Consequences

- Analytics data is only collected after user opt-in.
- Existing reports may initially see lower traffic until users grant consent.
- Implementation remains simple and fully client-side.
