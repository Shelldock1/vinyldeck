import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useVinylDeckStore } from "../playback/store";
import {
  ART_AMBIENT_MODE,
  applyVisualMode,
  isLegacyThemeId,
  isThemeId,
  legacyThemeToAmbientMode,
  legacyThemeToShell,
  normalizeAmbientMode,
  resetAmbientColors,
} from "../themes/applier";
import { DEFAULT_SETTINGS, WINDOW_MODES } from "./types";
import type { PersistedSettings } from "./types";
import type { AmbientModeId, LegacyThemeId, ThemeId } from "../themes/applier";

export const SETTINGS_CHANGED_EVENT = "settings-changed";

const LEGACY_SETTINGS_HANDOFF_KEY = "vinyldeck:settings-handoff";

export type SettingsPatch = Partial<Omit<PersistedSettings, "version">>;

export function validateSettings(value: unknown): PersistedSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;

  const raw = value as Record<string, unknown>;
  const rawTheme = isLegacyThemeId(raw.theme)
    ? raw.theme
    : DEFAULT_SETTINGS.theme;
  const legacyTheme = rawTheme as LegacyThemeId;
  const theme: ThemeId = isThemeId(rawTheme)
    ? rawTheme
    : legacyThemeToShell(legacyTheme);
  const legacyArtAmbient = readBoolean(raw.artAmbient, false);
  const rawAmbientMode = raw.ambientMode;
  const ambientMode: AmbientModeId =
    typeof rawAmbientMode === "string"
      ? normalizeAmbientMode(rawAmbientMode)
      : legacyThemeToAmbientMode(legacyTheme, legacyArtAmbient);
  const windowMode = isWindowMode(raw.windowMode)
    ? raw.windowMode
    : DEFAULT_SETTINGS.windowMode;

  return {
    version: 2,
    theme,
    ambientMode,
    artAmbient: ambientMode !== "off",
    vinylWobble: readBoolean(raw.vinylWobble, DEFAULT_SETTINGS.vinylWobble),
    filmGrain: readBoolean(raw.filmGrain, DEFAULT_SETTINGS.filmGrain),
    leanBackMode: readBoolean(raw.leanBackMode, DEFAULT_SETTINGS.leanBackMode),
    cursorHide: readBoolean(raw.cursorHide, DEFAULT_SETTINGS.cursorHide),
    idleTimeoutSeconds: readIdleTimeout(raw.idleTimeoutSeconds),
    alwaysOnTop: readBoolean(raw.alwaysOnTop, DEFAULT_SETTINGS.alwaysOnTop),
    keyboardShortcutsEnabled: readBoolean(
      raw.keyboardShortcutsEnabled,
      DEFAULT_SETTINGS.keyboardShortcutsEnabled,
    ),
    quitToTray: readBoolean(raw.quitToTray, DEFAULT_SETTINGS.quitToTray),
    startWithWindows: readBoolean(
      raw.startWithWindows,
      DEFAULT_SETTINGS.startWithWindows,
    ),
    windowMode,
    miniTransparentMode: readBoolean(
      raw.miniTransparentMode,
      DEFAULT_SETTINGS.miniTransparentMode,
    ),
  };
}

export async function loadSettings(): Promise<PersistedSettings> {
  if (!isTauri()) return DEFAULT_SETTINGS;
  clearLegacySettingsHandoff();

  try {
    return validateSettings(
      await invoke<PersistedSettings>("cmd_settings_snapshot"),
    );
  } catch (error) {
    console.warn("[Settings] Snapshot failed:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function commitSettings(
  patch: SettingsPatch,
): Promise<PersistedSettings> {
  const normalizedPatch = normalizePatch(patch);

  if (!isTauri()) {
    const current = useVinylDeckStore.getState().settings;
    const settings = validateSettings({ ...current, ...normalizedPatch });
    useVinylDeckStore.getState().hydrateSettings(settings);
    applyVisualMode(settings.theme, settings.ambientMode);
    return settings;
  }

  return validateSettings(
    await invoke<PersistedSettings>("cmd_settings_update", {
      patch: normalizedPatch,
    }),
  );
}

export async function resetSettings(): Promise<PersistedSettings> {
  if (!isTauri()) {
    useVinylDeckStore.getState().hydrateSettings(DEFAULT_SETTINGS);
    applyVisualMode(DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.ambientMode);
    return DEFAULT_SETTINGS;
  }

  return validateSettings(
    await invoke<PersistedSettings>("cmd_settings_reset"),
  );
}

export async function subscribeToSettingsChanges(
  callback: (settings: PersistedSettings) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};

  return listen<PersistedSettings>(SETTINGS_CHANGED_EVENT, ({ payload }) => {
    callback(validateSettings(payload));
  });
}

function normalizePatch(patch: SettingsPatch): SettingsPatch {
  const next: SettingsPatch = { ...patch };
  if (patch.artAmbient !== undefined && patch.ambientMode === undefined) {
    next.ambientMode = patch.artAmbient ? ART_AMBIENT_MODE : "off";
  }
  if (patch.ambientMode !== undefined) {
    next.ambientMode = normalizeAmbientMode(patch.ambientMode);
    next.artAmbient = next.ambientMode !== "off";
  }
  return next;
}

function clearLegacySettingsHandoff(): void {
  try {
    window.localStorage.removeItem(LEGACY_SETTINGS_HANDOFF_KEY);
  } catch {
    // Ignore unavailable storage; desktop settings come from backend Store.
  }
}

function isWindowMode(
  value: unknown,
): value is PersistedSettings["windowMode"] {
  return (
    typeof value === "string" &&
    WINDOW_MODES.includes(value as PersistedSettings["windowMode"])
  );
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readIdleTimeout(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.idleTimeoutSeconds;
  }
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function sanitizeSettingsForTheme(
  settings: PersistedSettings,
): PersistedSettings {
  const next = validateSettings(settings);
  if (next.ambientMode === "off") resetAmbientColors();
  return next;
}
