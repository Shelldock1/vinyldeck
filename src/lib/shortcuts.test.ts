import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SHORTCUTS,
  SHORTCUT_GROUPS,
  isShortcutCheatSheetKey,
} from "./shortcuts";
import { resolveEscapeTarget } from "../hooks/useKeyboardShortcuts";

const README = readFileSync(
  new URL("../../README.md", import.meta.url),
  "utf8",
);

function readmeControlsSection(markdown: string): string {
  const heading = "## Controls";
  const start = markdown.indexOf(heading);
  if (start === -1) throw new Error("README.md is missing the Controls section");
  const end = markdown.indexOf("\n## ", start + heading.length);
  return markdown.slice(start, end === -1 ? markdown.length : end);
}

const controlsSection = readmeControlsSection(README);
const controlsRows = controlsSection
  .split(/\r?\n/)
  .filter(
    (line) =>
      line.startsWith("|") &&
      !/^\|\s*-+/.test(line) &&
      !line.startsWith("| Action |"),
  )
  .map((line) => line.trim());

describe("SHORTCUTS as the single source", () => {
  it("documents every definition in the README Controls table", () => {
    for (const shortcut of SHORTCUTS) {
      expect(
        controlsSection,
        `README Controls is missing the row for ${shortcut.id}`,
      ).toContain(shortcut.readmeRow);
      expect(controlsSection).toContain(shortcut.key);
      // The row must mention the definition's own keycap.
      expect(shortcut.readmeRow).toContain(`\`${shortcut.key}\``);
    }
  });

  it("leaves no README Controls row unmanaged by SHORTCUTS", () => {
    const managedRows = new Set(SHORTCUTS.map((shortcut) => shortcut.readmeRow));
    expect(controlsRows.length).toBeGreaterThan(0);
    for (const row of controlsRows) {
      expect(
        managedRows.has(row),
        `README Controls row has no SHORTCUTS definition: ${row}`,
      ).toBe(true);
    }
  });

  it("uses unique ids and only declared groups", () => {
    const ids = SHORTCUTS.map((shortcut) => shortcut.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const shortcut of SHORTCUTS) {
      expect(SHORTCUT_GROUPS).toContain(shortcut.group);
    }
  });

  it("covers every group so the sheet never hides a definition", () => {
    for (const group of SHORTCUT_GROUPS) {
      expect(SHORTCUTS.some((shortcut) => shortcut.group === group)).toBe(true);
    }
  });
});

describe("isShortcutCheatSheetKey", () => {
  const key = (
    keyValue: string,
    code: string,
    shiftKey = false,
  ): Pick<KeyboardEvent, "key" | "code" | "shiftKey"> => ({
    key: keyValue,
    code,
    shiftKey,
  });

  it("matches Shift+Slash and layouts that report ? directly", () => {
    expect(isShortcutCheatSheetKey(key("?", "Slash", true))).toBe(true);
    expect(isShortcutCheatSheetKey(key("?", "Slash", false))).toBe(true);
    expect(isShortcutCheatSheetKey(key("?", "", false))).toBe(true);
  });

  it("ignores a plain slash and unrelated keys", () => {
    expect(isShortcutCheatSheetKey(key("/", "Slash"))).toBe(false);
    expect(isShortcutCheatSheetKey(key("Slash", "KeyS", true))).toBe(false);
    expect(isShortcutCheatSheetKey(key("s", "KeyS", true))).toBe(false);
    expect(isShortcutCheatSheetKey(key("Escape", "Escape"))).toBe(false);
  });
});

describe("resolveEscapeTarget ordering with the cheat sheet", () => {
  const all = {
    isShortcutsOpen: true,
    isContextMenuOpen: true,
    isCrateOpen: true,
    isSettingsOpen: true,
    isFullscreen: true,
  };

  it("closes the cheat sheet first, then falls back down the stack", () => {
    expect(resolveEscapeTarget(all)).toBe("shortcuts");
    expect(resolveEscapeTarget({ ...all, isShortcutsOpen: false })).toBe(
      "contextMenu",
    );
    expect(
      resolveEscapeTarget({
        isCrateOpen: true,
        isSettingsOpen: true,
        isFullscreen: true,
      }),
    ).toBe("crate");
    expect(resolveEscapeTarget({ isSettingsOpen: true, isFullscreen: true })).toBe(
      "settings",
    );
    expect(resolveEscapeTarget({ isFullscreen: true })).toBe("fullscreen");
    expect(resolveEscapeTarget({ isShortcutsOpen: true, isFullscreen: true })).toBe(
      "shortcuts",
    );
    expect(resolveEscapeTarget({})).toBeNull();
  });
});
