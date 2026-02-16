# AI Context

## Project intent
Personal hub dashboard that routes users to profile channels, built projects, and API docs.

## Source of truth
- Routes: `src/pages`
- i18n rules: `src/i18n/config.ts`, `src/i18n/detect-locale.ts`
- Content inventory: `src/data/registry/*.json`
- Validation/business logic: `src/lib/registry.ts`
- SEO: `src/lib/seo.ts`

## Non-negotiable constraints
- Keep locale set to `ko`, `en`, `ja`, `zh-cn`
- Preserve URL contract for `/go/{slug}/`
- Keep registry-driven structure (no hardcoded card-only additions)
- Keep redirect pages `noindex`

## Preferred change flow
1. Edit data registry
2. Add translations
3. Verify type/validation
4. Check localized pages and sitemap

