# ADR-0001: Use Astro for the hub

## Status
Accepted

## Context
Need a highly performant, SEO-friendly, static-first architecture for GitHub Pages.

## Decision
Use Astro static output for page generation and route-level composition.

## Consequences
- Fast loading and simple hosting model
- Strong control over semantic HTML/SEO
- Minimal runtime JS except locale redirect/switch behavior

