import { describe, expect, it } from "vitest";
import { isShortcutAllowedInMode } from "./useKeyboardShortcuts";

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
