import { getLinkBySlug } from "./registry";
import type { LinkRegistryItem } from "./types";

export function resolveRedirectTarget(slug: string): LinkRegistryItem | null {
  return getLinkBySlug(slug) ?? null;
}

