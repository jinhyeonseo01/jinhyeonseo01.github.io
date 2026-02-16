# Release Checklist

## Before merge
- Update registries (`src/data/registry/*.json`)
- Add localized texts for all supported locales
- Verify slug uniqueness and immutability
- Run `pnpm check`
- Run `pnpm build`

## SEO checks
- Confirm canonical and hreflang links on localized pages
- Confirm JSON-LD scripts are present
- Confirm `/sitemap.xml` includes new localized routes

## Redirect checks
- Confirm `/go/{slug}/` routes to expected destination
- Confirm first-visit locale redirect on `/`
- Confirm manual locale change persists via `savedLocale`

