import { describe, expect, it } from "vitest";
import {
  buildPalette,
  colorFromRgb,
  createFallbackPalette,
  deriveVinylPressing,
  recipeIdFor,
  seededUnit,
} from "./pressingEngine";
import type { VinylPressingRecipe } from "./pressingEngine";

const RED = colorFromRgb(214, 38, 52);
const BLUE = colorFromRgb(32, 64, 194);
const CREAM = colorFromRgb(242, 230, 206);
const YELLOW = colorFromRgb(238, 198, 54);

describe("pressingEngine", () => {
  it("clamps and rounds RGB input into a stable hex", () => {
    const color = colorFromRgb(-20, 300, 127.6);
    expect(color.r).toBe(0);
    expect(color.g).toBe(255);
    expect(color.b).toBe(128);
    expect(color.hex).toBe("#00ff80");
    expect(color.h).toBeGreaterThanOrEqual(0);
    expect(color.s).toBeGreaterThan(0);
  });

  it("classifies neutral and colorful palettes", () => {
    const neutral = buildPalette(
      colorFromRgb(120, 120, 120),
      colorFromRgb(170, 170, 170),
      colorFromRgb(90, 90, 90),
      colorFromRgb(128, 128, 128),
    );
    expect(neutral.characteristics.isAchromatic).toBe(true);
    expect(neutral.characteristics.isColorfulMultiTone).toBe(false);

    const colorful = buildPalette(RED, BLUE, YELLOW, CREAM);
    expect(colorful.characteristics.isAchromatic).toBe(false);
    expect(colorful.characteristics.contrast).toBeGreaterThan(0.2);
    expect(colorful.characteristics.isColorfulMultiTone).toBe(true);

    const black = buildPalette(
      colorFromRgb(4, 4, 4),
      colorFromRgb(8, 8, 8),
      colorFromRgb(12, 12, 12),
      colorFromRgb(6, 6, 6),
    );
    expect(black.characteristics.isNearlyBlack).toBe(true);
    expect(black.characteristics.isDark).toBe(true);
  });

  it("derives the same pressing for the same palette and seed", () => {
    const palette = createFallbackPalette();
    const first = deriveVinylPressing(palette, "Björk|Homogenic");
    const again = deriveVinylPressing(palette, "Björk|Homogenic");
    const other = deriveVinylPressing(palette, "Björk|Vespertine");

    expect(again).toEqual(first);
    expect(other.seedHash).not.toBe(first.seedHash);
    expect(other.seed).not.toBe(first.seed);
    expect(first.cssVars["--pressing-primary"]).toBeTruthy();
    expect(first.cssVars["--pressing-renderer-recipe"]).toBe(first.recipe);
  });

  it("maps every recipe to its own shader id", () => {
    const recipes: VinylPressingRecipe[] = [
      "opaque-solid",
      "clear-tint",
      "smoke-clear",
      "marble-blend",
      "splatter",
      "color-in-color",
      "merge",
      "galaxy",
      "audiophile-black",
    ];
    const ids = recipes.map(recipeIdFor);
    expect(new Set(ids).size).toBe(recipes.length);
    expect(ids.every((id) => Number.isFinite(id) && id >= 0)).toBe(true);
  });

  it("seededUnit stays inside the unit interval", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const value = seededUnit(seed * 7919);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
