import en from "./messages/en.json";
import de from "./messages/de.json";

const dictionaries = { en, de } as const;
export type Locale = keyof typeof dictionaries;

export function isLocale(value: string): value is Locale {
  return value in dictionaries;
}

export function getMessages(locale: Locale) {
  return dictionaries[locale];
}
