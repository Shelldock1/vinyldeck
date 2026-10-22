import { describe, expect, it } from "vitest";
import {
  clampSeek,
  isShortcutAllowedInMode,
  resolveEscapeTarget,
} from "./useKeyboardShortcuts";

const key = (code: string, ctrlKey = false) => ({ code, ctrlKey });
const README_KEYS = ["ArrowLeft", "ArrowRight", "KeyF", "KeyM", "KeyT", "KeyS", "KeyA", "KeyC", "Escape"];

describe("isShortcutAllowedInMode", () => {
  it("allows only Space and Ctrl+Q in mini", () => {
    expect(isShortcutAllowedInMode("mini", key("Space"))).toBe(true);
    expect(isShortcutAllowedInMode("mini", key("KeyQ", true))).toBe(true);
    expect(isShortcutAllowedInMode("mini", key("KeyQ"))).toBe(false);
    for (const code of README_KEYS) {
      expect(isShortcutAllowedInMode("mini", key(code))).toBe(false);
    }
  });

  it("leaves main (and fullscreen, which renders as main) untouched", () => {
    for (const code of ["Space", ...README_KEYS]) {
      expect(isShortcutAllowedInMode("main", key(code))).toBe(true);
    }
    expect(isShortcutAllowedInMode("main", key("KeyQ", true))).toBe(true);
  });
});

describe("resolveEscapeTarget", () => {
  it("closes only the topmost open surface", () => {
    const all = { isContextMenuOpen: true, isCrateOpen: true, isSettingsOpen: true, isFullscreen: true };
    expect(resolveEscapeTarget(all)).toBe("contextMenu");
    expect(resolveEscapeTarget({ ...all, isContextMenuOpen: false })).toBe("crate");
    expect(resolveEscapeTarget({ isSettingsOpen: true, isFullscreen: true })).toBe("settings");
    expect(resolveEscapeTarget({ isFullscreen: true })).toBe("fullscreen");
  });

  it("does nothing when no surface is open", () => {
    expect(resolveEscapeTarget({})).toBeNull();
  });
});

describe("clampSeek", () => {
  it("steps within the track", () => {
    expect(clampSeek(60, 5, 200)).toBe(65);
    expect(clampSeek(60, -5, 200)).toBe(55);
  });

  it("clamps at both ends", () => {
    expect(clampSeek(3, -5, 200)).toBe(0);
    expect(clampSeek(198, 5, 200)).toBe(200);
    expect(clampSeek(10, 5, 0)).toBe(0);
  });
});
