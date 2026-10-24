import type { en } from "./en";

export type Language = "en" | "ru";
/** Persisted setting: an explicit language, or follow the OS. */
export type LanguageSetting = "auto" | Language;
export type Dict = typeof en;

export const LANGUAGES: Language[] = ["en", "ru"];
export const LANGUAGE_SETTINGS: LanguageSetting[] = ["auto", "en", "ru"];
