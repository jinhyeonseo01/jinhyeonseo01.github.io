import type { Locale } from "../i18n/config";

export type { Locale };

export type LinkKind = "main" | "project" | "api";
export type EmbedType = "none" | "iframe";

export interface LocalizedText {
  locale: Locale;
  title: string;
  summary: string;
}

export interface LinkRegistryItem {
  id: string;
  slug: string;
  kind: LinkKind;
  href: string;
  featured: boolean;
  order: number;
  tags: string[];
  embedType: EmbedType;
  embedSrc?: string;
  texts: LocalizedText[];
}

export interface LocalizedProfileText {
  locale: Locale;
  headline: string;
  bio: string;
}

export interface ProfileData {
  name: string;
  role: string;
  location: string;
  avatarEmoji: string;
  texts: LocalizedProfileText[];
}

