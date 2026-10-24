import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAmbientColors,
  applyScheme,
  applyTheme,
  applyVinylPressing,
  applyVisualMode,
  isAmbientModeId,
  isLegacyThemeId,
  isSchemeId,
  isThemeId,
  legacyThemeToAmbientMode,
  legacyThemeToShell,
  normalizeAmbientMode,
  resetAmbientColors,
  resetVinylPressing,
} from "./applier";

interface FakeRoot {
  attributes: Map<string, string>;
  styles: Map<string, string>;
  classes: Set<string>;
  classList: { add: (name: string) => void; remove: (name: string) => void };
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  style: {
    setProperty: (name: string, value: string) => void;
    removeProperty: (name: string) => void;
  };
}

function makeRoot(): FakeRoot {
  const attributes = new Map<string, string>();
  const styles = new Map<string, string>();
  const classes = new Set<string>();
  return {
    attributes,
    styles,
    classes,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: (name) => attributes.get(name) ?? null,
    removeAttribute: (name) => attributes.delete(name),
    style: {
      setProperty: (name, value) => styles.set(name, value),
      removeProperty: (name) => styles.delete(name),
    },
  };
}

let root: FakeRoot;
let events: Array<{ type: string; detail: unknown }>;

beforeEach(() => {
  root = makeRoot();
  events = [];
  (globalThis as unknown as { document: unknown }).document = {
    documentElement: root,
  };
  (globalThis as unknown as { window: unknown }).window = {
    dispatchEvent: (event: { type: string; detail: unknown }) => {
      events.push(event);
      return true;
    },
  };
  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("themes/applier", () => {
  it("recognizes only the supported ids", () => {
    expect(isThemeId("noir")).toBe(true);
    expect(isThemeId("aurora")).toBe(false);
    expect(isLegacyThemeId("vapor")).toBe(true);
    expect(isLegacyThemeId("neon")).toBe(false);
    expect(isSchemeId("halloween")).toBe(true);
    expect(isAmbientModeId("beam")).toBe(true);
  });

  it("migrates legacy themes and ambient modes", () => {
    expect(legacyThemeToShell("paper")).toBe("glass");
    expect(legacyThemeToShell("aurora")).toBe("noir");
    expect(legacyThemeToAmbientMode("vapor")).toBe("beam");
    expect(legacyThemeToAmbientMode("paper", true)).toBe("beam");
    expect(legacyThemeToAmbientMode("paper")).toBe("off");
    expect(normalizeAmbientMode("caustic")).toBe("beam");
    expect(normalizeAmbientMode("laser")).toBe("off");
  });

  it("writes theme, ambient mode, and scheme to the root", () => {
    applyVisualMode("glass", "beam", "halloween");
    expect(root.attributes.get("data-theme")).toBe("glass");
    expect(root.attributes.get("data-ambient-mode")).toBe("beam");
    expect(root.attributes.get("data-scheme")).toBe("halloween");
  });

  it("transitions schemes only when the scheme actually changes", () => {
    vi.useFakeTimers();
    applyTheme("noir");
    applyScheme("dark");
    applyScheme("halloween");
    expect(root.classes.has("is-scheme-switching")).toBe(true);
    vi.advanceTimersByTime(320);
    expect(root.classes.has("is-scheme-switching")).toBe(false);
  });

  it("clears ambient colors when ambient mode turns off", () => {
    applyAmbientColors("rgb(1,2,3)", "rgb(4,5,6)");
    expect(root.styles.get("--ambient-primary")).toBe("rgb(1,2,3)");
    applyVisualMode("noir", "off");
    expect(root.styles.has("--ambient-primary")).toBe(false);
    resetAmbientColors();
    expect(root.styles.size).toBe(0);
  });

  it("applies and resets vinyl pressing attributes, vars, and events", () => {
    applyVinylPressing("marble", {
      "--pressing-primary": "#112233",
      "--pressing-accent": "#445566",
    });
    expect(root.attributes.get("data-vinyl-pressing")).toBe("marble");
    expect(root.styles.get("--pressing-primary")).toBe("#112233");
    expect(events[events.length - 1]?.detail).toBeNull();

    resetVinylPressing();
    expect(root.attributes.has("data-vinyl-pressing")).toBe(false);
    expect(root.styles.has("--pressing-primary")).toBe(false);
  });
});
