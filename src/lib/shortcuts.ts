// Single source for keyboard shortcuts.
//
// The cheat sheet renders from SHORTCUTS, and README.md's Controls table keeps
// one row per definition (combined rows such as Left/Right are shared by two
// definitions). `shortcuts.test.ts` fails if a definition or a README row
// drifts apart, so edit both here and in README together.

export type ShortcutGroup = "Playback" | "Window" | "App";

export interface ShortcutDefinition {
  id: string;
  /** Keycap label, e.g. "Space" or "Shift+Left". Split on "+" for display. */
  key: string;
  /** Human action label rendered in the sheet. */
  action: string;
  group: ShortcutGroup;
  /** Exact markdown row in README.md's Controls table. */
  readmeRow: string;
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = ["Playback", "Window", "App"];

export const SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "play-pause",
    key: "Space",
    action: "Play / pause",
    group: "Playback",
    readmeRow: "| Play / pause | `Space` |",
  },
  {
    id: "global-play-pause",
    key: "Ctrl+Alt+Space",
    action: "Play / pause (global)",
    group: "Playback",
    readmeRow: "| Play / pause (global) | `Ctrl+Alt+Space` |",
  },
  {
    id: "previous",
    key: "Left",
    action: "Previous track",
    group: "Playback",
    readmeRow: "| Previous / next | `Left` / `Right` |",
  },
  {
    id: "next",
    key: "Right",
    action: "Next track",
    group: "Playback",
    readmeRow: "| Previous / next | `Left` / `Right` |",
  },
  {
    id: "seek-back",
    key: "Shift+Left",
    action: "Seek back 5s",
    group: "Playback",
    readmeRow:
      "| Seek -5s / +5s | `Shift+Left` / `Shift+Right` (or arrows with the progress ring focused) |",
  },
  {
    id: "seek-forward",
    key: "Shift+Right",
    action: "Seek forward 5s",
    group: "Playback",
    readmeRow:
      "| Seek -5s / +5s | `Shift+Left` / `Shift+Right` (or arrows with the progress ring focused) |",
  },
  {
    id: "fullscreen",
    key: "F",
    action: "Fullscreen",
    group: "Window",
    readmeRow: "| Fullscreen | `F` |",
  },
  {
    id: "mini",
    key: "M",
    action: "Mini player",
    group: "Window",
    readmeRow: "| Mini player | `M` |",
  },
  {
    id: "global-mini",
    key: "Ctrl+Alt+M",
    action: "Mini player (global)",
    group: "Window",
    readmeRow: "| Mini player (global) | `Ctrl+Alt+M` |",
  },
  {
    id: "theme",
    key: "T",
    action: "Cycle shell",
    group: "App",
    readmeRow: "| Cycle shell | `T` |",
  },
  {
    id: "settings",
    key: "S",
    action: "Settings",
    group: "App",
    readmeRow: "| Settings | `S` |",
  },
  {
    id: "art-ambient",
    key: "A",
    action: "Art Ambient",
    group: "App",
    readmeRow: "| Art Ambient | `A` |",
  },
  {
    id: "crate",
    key: "C",
    action: "The Crate",
    group: "App",
    readmeRow: "| The Crate (your collection) | `C` |",
  },
  {
    id: "shortcuts",
    key: "?",
    action: "Show keyboard shortcuts",
    group: "App",
    readmeRow: "| Show keyboard shortcuts | `?` |",
  },
  {
    id: "close-surface",
    key: "Escape",
    action: "Close topmost surface",
    group: "App",
    readmeRow: "| Close the topmost surface | `Escape` |",
  },
  {
    id: "quit",
    key: "Ctrl+Q",
    action: "Quit",
    group: "App",
    readmeRow: "| Quit | `Ctrl+Q` |",
  },
];

/**
 * "?" on most layouts is Shift+Slash; some keyboard layouts report the
 * character directly. Both open the cheat sheet.
 */
export function isShortcutCheatSheetKey(
  event: Pick<KeyboardEvent, "key" | "code" | "shiftKey">,
): boolean {
  return event.key === "?" || (event.code === "Slash" && event.shiftKey);
}
