# jinhyeonseo01.github.io

Astro-based personal hub dashboard with:

- locale-first routing (`ko`, `en`, `ja`, `zh-cn`)
- first-visit language redirect from `/`
- data-registry-driven links for main sites/projects/APIs
- GitHub Pages deployment workflow

## Commands

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
```

## Structure

- `src/data/registry/*.json`: link inventory
- `src/pages/[locale]/*`: localized pages
- `src/pages/go/[slug].astro`: stable redirect URLs
- `docs/*`: product/architecture/ops/ADR/AI docs

