import { defaultLocale, locales, type Locale } from "../i18n/config";
import { getLocalizedText } from "./registry";
import type { LinkRegistryItem } from "./types";

const hreflangMap: Record<Locale, string> = {
  ko: "ko",
  en: "en",
  ja: "ja",
  "zh-cn": "zh-CN"
};

export interface AlternateLink {
  hrefLang: string;
  href: string;
}

export interface SeoPayload {
  title: string;
  description: string;
  canonical: string;
  alternates: AlternateLink[];
  robots: string;
  image: string;
  jsonLd: string[];
}

interface CreateSeoInput {
  site: string;
  locale: Locale;
  title: string;
  description: string;
  pathByLocale: Record<Locale, string>;
  noindex?: boolean;
  image?: string;
  jsonLd?: unknown[];
}

function toAbsoluteUrl(site: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, site).toString();
}

export function buildLocalizedPathMap(factory: (locale: Locale) => string): Record<Locale, string> {
  return {
    ko: factory("ko"),
    en: factory("en"),
    ja: factory("ja"),
    "zh-cn": factory("zh-cn")
  };
}

export function createSeo(input: CreateSeoInput): SeoPayload {
  const canonical = toAbsoluteUrl(input.site, input.pathByLocale[input.locale]);
  const alternates = locales.map((locale) => ({
    hrefLang: hreflangMap[locale],
    href: toAbsoluteUrl(input.site, input.pathByLocale[locale])
  }));

  alternates.push({
    hrefLang: "x-default",
    href: toAbsoluteUrl(input.site, input.pathByLocale[defaultLocale])
  });

  const robots = input.noindex ? "noindex, follow" : "index, follow";
  const jsonLd = (input.jsonLd ?? []).map((entry) => JSON.stringify(entry));
  const image = toAbsoluteUrl(input.site, input.image ?? "/og/dashboard.svg");

  return {
    title: input.title,
    description: input.description,
    canonical,
    alternates,
    robots,
    image,
    jsonLd
  };
}

interface HubJsonLdInput {
  site: string;
  locale: Locale;
  links: LinkRegistryItem[];
}

export function createHubJsonLd(input: HubJsonLdInput): unknown[] {
  const itemListElements = input.links.map((item, index) => {
    const text = getLocalizedText(item, input.locale);
    return {
      "@type": "ListItem",
      position: index + 1,
      name: text.title,
      url: new URL(`/go/${item.slug}/`, input.site).toString()
    };
  });

  return [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Clerin",
      url: input.site,
      sameAs: [
        "https://techblog.clerindev.com/",
        "https://www.youtube.com/@clerin_dev",
        "https://github.com/jinhyeonseo01"
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Clerin Dev Hub",
      url: input.site
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: itemListElements
    }
  ];
}

interface DetailJsonLdInput {
  site: string;
  locale: Locale;
  item: LinkRegistryItem;
}

export function createDetailJsonLd(input: DetailJsonLdInput): unknown[] {
  const text = getLocalizedText(input.item, input.locale);

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: text.title,
      description: text.summary,
      url: new URL(
        `/${input.locale}/${input.item.kind === "api" ? "apis" : "sites"}/${input.item.slug}/`,
        input.site
      ).toString(),
      inLanguage: hreflangMap[input.locale]
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: text.title,
      url: input.item.href
    }
  ];
}
