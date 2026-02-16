import apiRegistryRaw from "../data/registry/apis.json";
import mainRegistryRaw from "../data/registry/main-links.json";
import projectsRegistryRaw from "../data/registry/projects.json";
import { defaultLocale, isLocale, type Locale } from "../i18n/config";
import type { LinkKind, LinkRegistryItem, LocalizedText } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid ${fieldName}: expected non-empty string`);
  }
  return value;
}

function asBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${fieldName}: expected boolean`);
  }
  return value;
}

function asNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid ${fieldName}: expected number`);
  }
  return value;
}

function asStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`Invalid ${fieldName}: expected string[]`);
  }
  return value;
}

function asLocalizedTextArray(value: unknown, fieldName: string): LocalizedText[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${fieldName}: expected LocalizedText[]`);
  }

  return value.map((entry, index) => {
    if (!isObject(entry)) {
      throw new Error(`Invalid ${fieldName}[${index}]: expected object`);
    }

    const rawLocale = asString(entry.locale, `${fieldName}[${index}].locale`).toLowerCase();
    if (!isLocale(rawLocale)) {
      throw new Error(`Invalid ${fieldName}[${index}].locale: unsupported locale`);
    }

    return {
      locale: rawLocale,
      title: asString(entry.title, `${fieldName}[${index}].title`),
      summary: asString(entry.summary, `${fieldName}[${index}].summary`)
    };
  });
}

function validateRegistry(raw: unknown, expectedKind: LinkKind): LinkRegistryItem[] {
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid ${expectedKind} registry: expected array`);
  }

  return raw.map((item, index) => {
    if (!isObject(item)) {
      throw new Error(`Invalid ${expectedKind}[${index}]: expected object`);
    }

    const kind = asString(item.kind, `${expectedKind}[${index}].kind`) as LinkKind;
    if (kind !== expectedKind) {
      throw new Error(
        `Invalid ${expectedKind}[${index}].kind: expected "${expectedKind}" got "${kind}"`
      );
    }

    const embedType = asString(item.embedType, `${expectedKind}[${index}].embedType`);
    if (embedType !== "none" && embedType !== "iframe") {
      throw new Error(
        `Invalid ${expectedKind}[${index}].embedType: expected "none" or "iframe"`
      );
    }

    const embedSrcValue = item.embedSrc;
    const embedSrc =
      typeof embedSrcValue === "string" && embedSrcValue.trim().length > 0
        ? embedSrcValue
        : undefined;
    const ogImageValue = item.ogImage;
    const ogImage =
      typeof ogImageValue === "string" && ogImageValue.trim().length > 0
        ? ogImageValue
        : undefined;

    return {
      id: asString(item.id, `${expectedKind}[${index}].id`),
      slug: asString(item.slug, `${expectedKind}[${index}].slug`),
      kind,
      href: asString(item.href, `${expectedKind}[${index}].href`),
      featured: asBoolean(item.featured, `${expectedKind}[${index}].featured`),
      order: asNumber(item.order, `${expectedKind}[${index}].order`),
      tags: asStringArray(item.tags, `${expectedKind}[${index}].tags`),
      ogImage,
      embedType,
      embedSrc,
      texts: asLocalizedTextArray(item.texts, `${expectedKind}[${index}].texts`)
    };
  });
}

const mainLinks = validateRegistry(mainRegistryRaw, "main");
const projectLinks = validateRegistry(projectsRegistryRaw, "project");
const apiLinks = validateRegistry(apiRegistryRaw, "api");
const allLinks = [...mainLinks, ...projectLinks, ...apiLinks].sort((a, b) => a.order - b.order);

export function getLinksByKind(kind: LinkKind): LinkRegistryItem[] {
  switch (kind) {
    case "main":
      return [...mainLinks].sort((a, b) => a.order - b.order);
    case "project":
      return [...projectLinks].sort((a, b) => a.order - b.order);
    case "api":
      return [...apiLinks].sort((a, b) => a.order - b.order);
  }
}

export function getSiteLinks(): LinkRegistryItem[] {
  return [...mainLinks, ...projectLinks].sort((a, b) => a.order - b.order);
}

export function getAllLinks(): LinkRegistryItem[] {
  return [...allLinks];
}

export function getLinkBySlug(slug: string): LinkRegistryItem | undefined {
  return allLinks.find((item) => item.slug === slug);
}

export function getLocalizedText(
  item: LinkRegistryItem,
  locale: Locale
): LocalizedText {
  return (
    item.texts.find((text) => text.locale === locale) ??
    item.texts.find((text) => text.locale === defaultLocale) ??
    item.texts[0]
  );
}
