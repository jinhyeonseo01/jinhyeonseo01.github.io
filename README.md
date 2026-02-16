# jinhyeonseo01.github.io

Astro-based personal hub dashboard with:

- locale-first routing (`ko`, `en`, `ja`, `zh-cn`)
- first-visit language redirect from `/`
- data-registry-driven links for main sites/projects/APIs
- GitHub Pages deployment workflow

## Commands

```bash
pnpm install
pnpm sync:og
pnpm dev
pnpm check
pnpm build
```

## GitHub Token Setup (Secure)

Use a repository secret instead of hard-coding tokens in code or `.env` committed files.

1. Revoke any token that was exposed in chat, screenshots, or commits.
2. Create a new GitHub token with minimum scope required for this project.
3. Add it to repository secrets as `GH_SNAPSHOT_TOKEN`.
4. The deploy workflow uses `GH_SNAPSHOT_TOKEN` first and falls back to `GITHUB_TOKEN`.

For local testing only:

```bash
cp .env.example .env
# set GH_SNAPSHOT_TOKEN in .env (never commit this file)
```

Anonymous browser calls are limited (commonly `60/hour`), but this site uses build-time snapshot data (`public/data/github/*.json`) to avoid repeated live API calls in production.
Link card cover images are also collected at build-time from each external URL (`og:image`/`twitter:image`) and saved to `src/data/generated/og-covers.json`.

## Structure

- `src/data/registry/*.json`: link inventory
- `src/pages/[locale]/*`: localized pages
- `src/pages/go/[slug].astro`: stable redirect URLs
- `docs/*`: product/architecture/ops/ADR/AI docs
