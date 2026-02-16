# Deploy to GitHub Pages

## Workflow file
- `.github/workflows/deploy.yml`

## Trigger
- push to `main`
- manual dispatch

## Build/deploy steps
1. Checkout repository
2. Setup pnpm + Node.js
3. Install dependencies
4. Run `pnpm build`
5. Upload `dist/` as Pages artifact
6. Deploy artifact to GitHub Pages environment

## Required repo settings
- Settings -> Pages -> Source: GitHub Actions

