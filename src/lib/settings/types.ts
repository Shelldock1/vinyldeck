import type { AmbientModeId, ThemeId } from "../themes/applier";
import { WINDOW_MODES } from "../window/types";
import type { WindowMode } from "../window/types";

export { WINDOW_MODES };
export type { WindowMode };

export interface PersistedSettings {
  version: 2;
  theme: ThemeId;
  /** v2 field kept, but only off/on values are exposed now: off | beam. */
  ambientMode: AmbientModeId;
  /** Legacy compatibility flag. Derived from ambientMode and kept for old callers/tests. */
  artAmbient: boolean;
  vinylWobble: boolean;
  filmGrain: boolean;
  leanBackMode: boolean;
  cursorHide: boolean;
  idleTimeoutSeconds: number;
  alwaysOnTop: boolean;
  keyboardShortcutsEnabled: boolean;
  quitToTray: boolean;
  startWithWindows: boolean;
  windowMode: WindowMode;
  /**
   * Mini-only. Applies a native Windows Acrylic blur-through effect on the
   * Mini window and lets its background go fully transparent so the desktop
   * shows through behind the vinyl/controls. Has no effect on Main/Fullscreen.
   */
  miniTransparentMode: boolean;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  version: 2,
  theme: "noir",
  ambientMode: "off",
  artAmbient: false,
  vinylWobble: true,
  filmGrain: true,
  leanBackMode: true,
  cursorHide: true,
  idleTimeoutSeconds: 3,
  alwaysOnTop: false,
  keyboardShortcutsEnabled: true,
  quitToTray: true,
  startWithWindows: false,
  windowMode: "main",
  miniTransparentMode: false,
};
