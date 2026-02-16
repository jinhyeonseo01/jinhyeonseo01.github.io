# ADR-0003: Data registry content model

## Status
Accepted

## Context
Need scalable content growth without hardcoding cards/routes per new link.

## Decision
Manage links in typed JSON registries:
- `main-links.json`
- `projects.json`
- `apis.json`

Load through typed validation in `src/lib/registry.ts`.

## Consequences
- Additions require data edits, not structural code rewrites
- Better compatibility for future automation or CMS migration
- Validation errors fail early during build

