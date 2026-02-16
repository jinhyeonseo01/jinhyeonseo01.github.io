# i18n Routing Spec

## Locale config
- supported: `ko`, `en`, `ja`, `zh-cn`
- default: `ko`
- storage key: `savedLocale`

## Root redirect algorithm (`/`)
1. Check `localStorage.savedLocale`
2. If valid locale exists, redirect to `/{locale}/`
3. Else map `navigator.languages` to supported locale
4. If no match, fallback to `ko`

## Language mapping rules
- `ko*` -> `ko`
- `en*` -> `en`
- `ja*` -> `ja`
- `zh-cn*`, `zh-hans*`, `zh` -> `zh-cn`

## Manual switch behavior
- Locale switch links rewrite current path to target locale path
- Clicking a locale stores the selected locale to `localStorage`

