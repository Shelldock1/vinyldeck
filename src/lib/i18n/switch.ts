// Language changes go through the settings authority like any other setting,
// so the other window and the tray menu follow.

import { commitSettings } from "../settings";
import { useVinylDeckStore } from "../playback/store";
import { logger } from "../logger";
import { getLanguage, otherLanguage } from "./index";
import type { LanguageSetting } from "./types";

export function setLanguage(language: LanguageSetting): Promise<void> {
  return commitSettings({ language })
    .then((settings) => useVinylDeckStore.getState().hydrateSettings(settings))
    .catch((error) => {
      logger.warn("[i18n] Language change failed:", error);
    });
}

/** Flips between English and Russian (resolving "auto" first). */
export function toggleLanguage(): Promise<void> {
  return setLanguage(otherLanguage(getLanguage()));
}
