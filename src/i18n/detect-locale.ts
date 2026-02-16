import {
  defaultLocale,
  isLocale,
  localeStorageKey,
  resolveLocaleFromLanguages,
  type Locale
} from "./config";

export function getStoredLocale(storage: Storage | null): Locale | null {
  if (!storage) {
    return null;
  }

  const stored = storage.getItem(localeStorageKey);
  if (!stored) {
    return null;
  }

  const normalized = stored.toLowerCase();
  return isLocale(normalized) ? normalized : null;
}

export function detectPreferredLocale(
  storage: Storage | null,
  languages: readonly string[]
): Locale {
  const stored = getStoredLocale(storage);
  if (stored) {
    return stored;
  }

  if (languages.length > 0) {
    return resolveLocaleFromLanguages(languages);
  }

  return defaultLocale;
}

export function saveLocale(storage: Storage | null, locale: Locale): void {
  if (!storage) {
    return;
  }
  storage.setItem(localeStorageKey, locale);
}

