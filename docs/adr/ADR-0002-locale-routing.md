# ADR-0002: Locale-first route strategy

## Status
Accepted

## Context
Need automatic language handoff and durable localized URLs.

## Decision
Adopt path-based locale routes:
- `/{locale}/`
- `/{locale}/sites/{slug}/`
- `/{locale}/apis/{slug}/`

Root `/` performs first-visit locale detection, with user preference persisted in localStorage.

## Consequences
- Clear locale indexability and hreflang mapping
- Stable route contract for future expansion
- Browser-only redirect logic at entrypoint

