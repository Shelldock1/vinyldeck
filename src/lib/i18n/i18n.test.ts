import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "../shortcuts";
import { formatSleepTimerStatus } from "../sleep";
import { en } from "./en";
import { ru } from "./ru";
import { otherLanguage, pluralRu, resolveLanguage } from "./index";

/** Every leaf path in a dictionary, with its runtime type. */
function leaves(value: unknown, path = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      for (const [leaf, type] of leaves(child, path ? `${path}.${key}` : key)) {
        out.set(leaf, type);
      }
    }
  } else {
    out.set(path, typeof value);
  }
  return out;
}

describe("i18n dictionaries", () => {
  it("russian covers every english key with the same kind of value", () => {
    const english = leaves(en);
    const russian = leaves(ru);
    expect([...russian.keys()].sort()).toEqual([...english.keys()].sort());
    for (const [path, type] of english) {
      expect(russian.get(path), path).toBe(type);
    }
  });

  it("has no empty strings", () => {
    for (const dict of [en, ru]) {
      for (const [path] of leaves(dict)) {
        const value = path.split(".").reduce<unknown>(
          (node, key) => (node as Record<string, unknown>)[key],
          dict,
        );
        if (typeof value === "string") expect(value.trim(), path).not.toBe("");
      }
    }
  });

  it("translates every keyboard shortcut", () => {
    for (const shortcut of SHORTCUTS) {
      expect(en.shortcuts.actions[shortcut.id], shortcut.id).toBeTruthy();
      expect(ru.shortcuts.actions[shortcut.id], shortcut.id).toBeTruthy();
    }
  });
});

describe("pluralRu", () => {
  it("picks one / few / many like Russian does", () => {
    const form = (n: number) => pluralRu(n, "день", "дня", "дней");
    expect([1, 21, 101].map(form)).toEqual(["день", "день", "день"]);
    expect([2, 3, 4, 22, 34].map(form)).toEqual(["дня", "дня", "дня", "дня", "дня"]);
    expect([0, 5, 11, 12, 14, 19, 25, 111].map(form)).toEqual(
      ["дней", "дней", "дней", "дней", "дней", "дней", "дней", "дней"],
    );
  });

  it("drives the russian strings", () => {
    expect(ru.crate.times(1)).toBe("1 раз");
    expect(ru.crate.times(3)).toBe("3 раза");
    expect(ru.stamp.plays(5)).toBe("5 прослушиваний");
    expect(ru.crate.streakTitle(2)).toBe("2 дня подряд");
  });
});

describe("language resolution", () => {
  it("follows the system only for auto", () => {
    expect(resolveLanguage("auto", ["ru-RU", "en-US"])).toBe("ru");
    expect(resolveLanguage("auto", ["en-GB"])).toBe("en");
    expect(resolveLanguage("auto", [])).toBe("en");
    expect(resolveLanguage("en", ["ru-RU"])).toBe("en");
    expect(resolveLanguage("ru", ["en-US"])).toBe("ru");
  });

  it("toggles between the two languages", () => {
    expect(otherLanguage("en")).toBe("ru");
    expect(otherLanguage("ru")).toBe("en");
  });

  it("formats the sleep timer in russian", () => {
    expect(formatSleepTimerStatus(null, 0, ru.sleep)).toBe("Выкл");
    expect(
      formatSleepTimerStatus(
        { mode: "minutes", endsAt: 10 * 60_000, track: null },
        0,
        ru.sleep,
      ),
    ).toBe("Осталось 10 мин");
  });
});
