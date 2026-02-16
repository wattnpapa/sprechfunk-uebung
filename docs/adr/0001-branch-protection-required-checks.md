# ADR 0001: Branch Protection and Required Checks

## Status
Accepted

## Context

`main` should only receive changes that passed automated quality gates.
GitHub branch protection settings are configured in repository settings (not in source files), but CI workflows must provide stable check names.

## Decision

- Provide a dedicated CI workflow for PR validation.
- Keep stable job names for required checks:
  - `validate`
  - `e2e-smoke-routing`
- Recommend enabling branch protection on `main` with:
  - Require pull request before merging
  - Require status checks to pass before merging
  - Include administrators

## Consequences

- Merges to `main` are safer and more predictable.
- Failing quality gates block merges early.
