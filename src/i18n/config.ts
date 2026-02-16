export const locales = ["ko", "en", "ja", "zh-cn"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ko";
export const localeStorageKey = "savedLocale";

export const localeLabels: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-cn": "简体中文"
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value.toLowerCase());
}

export function toNormalizedLocale(value: string): Locale | null {
  const language = value.trim().toLowerCase();
  if (!language) {
    return null;
  }

  if (language.startsWith("ko")) {
    return "ko";
  }

  if (language.startsWith("en")) {
    return "en";
  }

  if (language.startsWith("ja")) {
    return "ja";
  }

  if (
    language.startsWith("zh-cn") ||
    language.startsWith("zh-hans") ||
    language === "zh"
  ) {
    return "zh-cn";
  }

  return null;
}

export function resolveLocaleFromLanguages(languages: readonly string[]): Locale {
  for (const language of languages) {
    const normalized = toNormalizedLocale(language);
    if (normalized) {
      return normalized;
    }
  }
  return defaultLocale;
}

export function replaceLocaleInPath(pathname: string, locale: Locale): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const parts = normalizedPath.split("/").filter(Boolean);

  if (parts.length === 0) {
    return `/${locale}/`;
  }

  if (isLocale(parts[0])) {
    parts[0] = locale;
    return `/${parts.join("/")}/`;
  }

  return `/${locale}/${parts.join("/")}/`;
}
