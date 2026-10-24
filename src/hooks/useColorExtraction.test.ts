import { describe, expect, it } from "vitest";
import {
  buildAmbientFromPalette,
  paletteFromPixels,
} from "./useColorExtraction";
import { buildPalette, colorFromRgb } from "../lib/vinyl/pressingEngine";

function pixels(colors: Array<[number, number, number, number?]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([r, g, b, a = 255], index) => {
    data[index * 4] = r;
    data[index * 4 + 1] = g;
    data[index * 4 + 2] = b;
    data[index * 4 + 3] = a;
  });
  return data;
}

describe("useColorExtraction", () => {
  it("rejects empty, transparent, and clipped pixels", () => {
    expect(paletteFromPixels(new Uint8ClampedArray(0))).toBeNull();

    const transparent = Array.from({ length: 64 }, () => [40, 120, 200, 0] as [number, number, number, number]);
    expect(paletteFromPixels(pixels(transparent))).toBeNull();

    const clipped = Array.from({ length: 64 }, () => [255, 255, 255, 255] as [number, number, number, number]);
    expect(paletteFromPixels(pixels(clipped))).toBeNull();
  });

  it("quantizes a colorful image into a saturated palette", () => {
    const red = Array.from({ length: 40 }, () => [210, 40, 60, 255] as [number, number, number, number]);
    const blue = Array.from({ length: 18 }, () => [30, 60, 190, 255] as [number, number, number, number]);
    const cream = Array.from({ length: 6 }, () => [240, 228, 200, 255] as [number, number, number, number]);

    const palette = paletteFromPixels(pixels([...red, ...blue, ...cream]));
    expect(palette).not.toBeNull();
    expect(palette!.primary.s).toBeGreaterThan(0.4);
    expect(palette!.primary.r).toBeGreaterThan(palette!.primary.b);
  });

  it("converts palettes to ambient rgb strings", () => {
    const colorful = buildPalette(
      colorFromRgb(210, 40, 60),
      colorFromRgb(30, 60, 190),
      colorFromRgb(240, 228, 200),
      colorFromRgb(120, 80, 90),
    );
    const ambient = buildAmbientFromPalette(colorful);
    expect(ambient.primary).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    expect(ambient.secondary).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
    expect(ambient.accent).toMatch(/^rgb\(\d+,\d+,\d+\)$/);

    const neutral = buildPalette(
      colorFromRgb(128, 128, 128),
      colorFromRgb(110, 110, 110),
      colorFromRgb(140, 140, 140),
      colorFromRgb(120, 120, 120),
    );
    expect(buildAmbientFromPalette(neutral).primary).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  });
});
