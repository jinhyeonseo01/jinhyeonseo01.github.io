# Frontend Architecture

## Stack
- Framework: Astro (static output)
- Language: TypeScript
- Styling: global CSS + tokenized variables

## Directory decisions
- `src/pages`: route-level entrypoints
- `src/components`: reusable UI sections/cards/common controls
- `src/layouts`: HTML shell and SEO head rendering
- `src/lib`: typed business logic (registry, redirect, SEO)
- `src/i18n`: locale config, language detection, message dictionaries
- `src/data`: content registries and profile data

## Design system baseline
- Light, modern dashboard look
- Strong card hierarchy and sectioned information handoff
- Mobile-first responsive grid
- Non-default typography via explicit font stack

