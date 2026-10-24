import { beforeEach, describe, expect, it } from "vitest";
import { bakeVinylTexture } from "./textureBake";
import { createFallbackPalette, deriveVinylPressing } from "./pressingEngine";
import type { VinylPressingRecipe } from "./pressingEngine";

const RECIPES: VinylPressingRecipe[] = [
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

function makeContext() {
  const gradient = { addColorStop: () => {} };
  const context: Record<string, unknown> = {
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
  };
  return new Proxy(context, {
    get(target, property) {
      if (typeof property === "symbol") return undefined;
      if (property in target) return target[property];
      return (..._args: unknown[]) => {};
    },
    set(target, property, value) {
      if (typeof property === "string") target[property] = value;
      return true;
    },
  });
}

beforeEach(() => {
  const context = makeContext();
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind: string) => (kind === "2d" ? context : null),
  };
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error(`unexpected element ${tag}`);
      return canvas;
    },
  };
});

describe("textureBake", () => {
  const palette = createFallbackPalette();

  it("bakes every pressing recipe without throwing", () => {
    for (const recipe of RECIPES) {
      const base = deriveVinylPressing(palette, `seed-${recipe}`);
      const pressing = { ...base, recipe };
      const baked = bakeVinylTexture(pressing, 32);
      expect(baked.size).toBe(32);
      expect(baked.canvas.width).toBe(32);
      expect(baked.canvas.height).toBe(32);
    }
  });

  it("keeps the default texture size when none is requested", () => {
    const baked = bakeVinylTexture(deriveVinylPressing(palette, "default"), 16);
    expect(baked.size).toBe(16);
  });

  it("returns the blank canvas when 2D context is unavailable", () => {
    (globalThis as unknown as { document: unknown }).document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => null,
      }),
    };
    const baked = bakeVinylTexture(deriveVinylPressing(palette, "no-ctx"), 20);
    expect(baked.size).toBe(20);
    expect(baked.canvas.width).toBe(20);
  });
});
