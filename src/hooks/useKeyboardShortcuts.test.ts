import { describe, expect, it } from "vitest";
import {
  clampSeek,
  isGlobalShortcutSuppressed,
  isShortcutAllowedInMode,
  resolveEscapeTarget,
} from "./useKeyboardShortcuts";

const key = (code: string, ctrlKey = false) => ({ code, ctrlKey });
const README_KEYS = ["ArrowLeft", "ArrowRight", "KeyF", "KeyM", "KeyT", "KeyS", "KeyA", "KeyC", "Slash", "Escape"];

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

describe("isGlobalShortcutSuppressed", () => {
  it("suppresses every global action while the context menu is open", () => {
    for (const code of [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Space",
      "Enter",
      "KeyS",
      "KeyF",
      "KeyM",
      "KeyT",
      "KeyA",
      "KeyC",
      "Slash",
    ]) {
      expect(isGlobalShortcutSuppressed(true, key(code))).toBe(true);
    }
    expect(isGlobalShortcutSuppressed(true, key("KeyQ", true))).toBe(true);
  });

  it("leaves Escape to resolveEscapeTarget", () => {
    expect(isGlobalShortcutSuppressed(true, key("Escape"))).toBe(false);
  });

  it("does nothing when the menu is closed", () => {
    expect(isGlobalShortcutSuppressed(false, key("ArrowRight"))).toBe(false);
    expect(isGlobalShortcutSuppressed(false, key("Space"))).toBe(false);
    expect(isGlobalShortcutSuppressed(false, key("Escape"))).toBe(false);
  });
});

describe("resolveEscapeTarget", () => {
  it("closes only the topmost open surface", () => {
    const all = { isShortcutsOpen: true, isContextMenuOpen: true, isCrateOpen: true, isSettingsOpen: true, isFullscreen: true };
    expect(resolveEscapeTarget(all)).toBe("shortcuts");
    expect(resolveEscapeTarget({ ...all, isShortcutsOpen: false })).toBe("contextMenu");
    expect(resolveEscapeTarget({ ...all, isShortcutsOpen: false, isContextMenuOpen: false })).toBe("crate");
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
