# API Linking Policy

## Purpose
Keep API visibility in the hub without coupling API runtime hosting to this repository.

## Rules
- APIs are represented in `src/data/registry/apis.json`
- Each API entry must include:
  - stable `id`
  - stable `slug`
  - external `href` to docs or gateway
  - localized `texts`
- Default behavior is link-out (`embedType: none`)
- `embedType: iframe` is allowed only after CSP/security review

## URL stability contract
- Public handoff URL: `/go/{slug}/`
- `slug` must be immutable once published
- If destination changes, update `href` only

