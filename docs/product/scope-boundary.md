# Scope Boundary

## In scope
- Astro static site
- Locale routing (`ko`, `en`, `ja`, `zh-cn`)
- First-visit locale redirect from `/`
- Dashboard pages and detail pages
- Registry-driven link catalog for main/project/api
- SEO basics: canonical, hreflang, sitemap, JSON-LD
- GitHub Pages CI deploy

## Out of scope
- API backend hosting
- OAuth/account features
- Analytics stack setup (GA4, event pipeline)
- CMS integration
- Modifying external destination services

## Future-ready extension points
- Add new link category by extending `LinkKind` and section config
- Add embed support with `embedType: iframe` + CSP review
- Add analytics on `/go/{slug}` via serverless redirect layer

