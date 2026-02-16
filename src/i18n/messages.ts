import en from "./messages/en.json";
import ja from "./messages/ja.json";
import ko from "./messages/ko.json";
import zhCn from "./messages/zh-cn.json";
import { defaultLocale, type Locale } from "./config";

type MessageDictionary = typeof ko;
export type MessageKey = keyof MessageDictionary;

const dictionaries: Record<Locale, MessageDictionary> = {
  ko,
  en,
  ja,
  "zh-cn": zhCn
};

export function getMessages(locale: Locale): MessageDictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

export function t(locale: Locale, key: MessageKey): string {
  const dictionary = getMessages(locale);
  return dictionary[key];
}

