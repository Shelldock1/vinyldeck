// UI language. The persisted `language` setting is "auto" | "en" | "ru"; the
// Rust settings authority owns it so Main, Mini and the tray stay in step.
// Components read strings with `useT()`; plain modules use `getT()`.

import { useVinylDeckStore } from "../playback/store";
import { en } from "./en";
import { ru } from "./ru";
import { LANGUAGE_SETTINGS } from "./types";
import type { Dict, Language, LanguageSetting } from "./types";

export { pluralRu } from "./plural";
export { LANGUAGES, LANGUAGE_SETTINGS } from "./types";
export type { Dict, Language, LanguageSetting } from "./types";

const DICTIONARIES: Record<Language, Dict> = { en, ru };

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return LANGUAGE_SETTINGS.includes(value as LanguageSetting);
}

function systemLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

export function resolveLanguage(
  setting: LanguageSetting,
  preferred: readonly string[] = systemLanguages(),
): Language {
  if (setting !== "auto") return setting;
  return preferred[0]?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

/** BCP 47 tag for Intl date/number formatting. */
export function localeFor(language: Language): string {
  return language === "ru" ? "ru-RU" : "en-US";
}

/** The language the toggle switches to from `current`. */
export function otherLanguage(current: Language): Language {
  return current === "ru" ? "en" : "ru";
}

export function dictionaryFor(language: Language): Dict {
  return DICTIONARIES[language];
}

export function getLanguage(): Language {
  return resolveLanguage(useVinylDeckStore.getState().settings.language);
}

export function getT(): Dict {
  return dictionaryFor(getLanguage());
}

export function useLanguage(): Language {
  const setting = useVinylDeckStore((state) => state.settings.language);
  return resolveLanguage(setting);
}

export function useT(): Dict {
  return dictionaryFor(useLanguage());
}
