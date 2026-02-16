# IA and Sitemap

## Public routes
- `/` -> locale redirect entrypoint (first visit auto-detect)
- `/{locale}/` -> localized dashboard
- `/{locale}/sites/{slug}/` -> main/project detail and handoff
- `/{locale}/apis/{slug}/` -> API detail and handoff
- `/go/{slug}/` -> stable redirect URL
- `/sitemap.xml`
- `/404/`

## Locale matrix
Supported locales:
- `ko` (default)
- `en`
- `ja`
- `zh-cn`

Every locale contains the same route shape with translated text only.

## Content source
- `src/data/registry/main-links.json`
- `src/data/registry/projects.json`
- `src/data/registry/apis.json`

