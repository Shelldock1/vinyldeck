// src/hooks/useColorExtraction.ts
// Album-art visual extraction for both systems:
//   1. Ambient bloom colors (existing Noir-only toggle behavior)
//   2. Album-specific collectible vinyl pressing colors + deterministic pressing type
//
// The ambient system stays opt-in, but vinyl pressing extraction is always allowed
// whenever artwork exists. No RAF loops, no React re-render loop — results are
// written as CSS custom properties on <html>.

import { useEffect, useRef } from "react";
import { FastAverageColor } from "fast-average-color";
import {
  applyAmbientColors,
  applyVinylPressing,
  resetAmbientColors,
  resetVinylPressing,
} from "../lib/themes/applier";
import {
  buildPalette,
  colorFromRgb,
  createFallbackPalette,
  deriveVinylPressing,
} from "../lib/vinyl/pressingEngine";
import type {
  ArtworkPalette,
  RgbColor,
  VinylPressing,
} from "../lib/vinyl/pressingEngine";

const fac = new FastAverageColor();
const PALETTE_CANVAS_SIZE = 72;
const MAX_CLUSTERS = 28;

interface UseColorExtractionOptions {
  /** Preserve the old behavior: only tint ambient when caller explicitly enables it. */
  ambientEnabled?: boolean;
  /** Deterministic identity seed. Prefer album + artist; fallback to track + artist. */
  seed?: string;
  /** Allow tests/dev tools to opt out of applying vinyl CSS while still extracting. */
  vinylEnabled?: boolean;
}

interface ExtractedArtworkVisuals {
  ambient: {
    primary: string;
    secondary: string;
    accent: string;
  };
  palette: ArtworkPalette;
  pressing: VinylPressing;
}

interface QuantizedCluster {
  key: string;
  count: number;
  score: number;
  r: number;
  g: number;
  b: number;
  saturation: number;
  lightness: number;
  color: RgbColor;
}

// ── HSL helpers for ambient post-processing ──────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rf:
      h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
      break;
    case gf:
      h = ((bf - rf) / d + 2) / 6;
      break;
    case bf:
      h = ((rf - gf) / d + 4) / 6;
      break;
  }
  return [h, s, l];
}

function hueToRgb(p: number, q: number, tInput: number): number {
  let t = tInput;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Boost a raw average color into a vivid ambient bloom color.
 * Returns "" if the color is near-achromatic (no usable hue).
 */
function boostToAmbient(r: number, g: number, b: number): string {
  let [h, s, l] = rgbToHsl(r, g, b);
  if (s < 0.05) return "";
  s = Math.min(Math.max(s, 0.55), 0.9);
  l = Math.min(Math.max(l, 0.25), 0.5);
  const [rb, gb, bb] = hslToRgb(h, s, l);
  return `rgb(${rb},${gb},${bb})`;
}

/**
 * Backwards-compatible ambient extraction API. Kept for any existing callers/tests.
 */
export async function extractAmbientColors(artworkSrc: string): Promise<{
  primary: string;
  secondary: string;
} | null> {
  try {
    const imgEl = await loadImage(artworkSrc);
    return extractAmbientFromImage(imgEl);
  } catch (err) {
    console.warn("[VinylDeck] Color extraction failed:", err);
    return null;
  }
}

export async function extractArtworkVisuals(
  artworkSrc: string,
  seed: string,
): Promise<ExtractedArtworkVisuals | null> {
  try {
    const imgEl = await loadImage(artworkSrc);
    const palette = extractArtworkPaletteFromImage(imgEl);
    const safePalette = palette ?? createFallbackPalette();
    const pressing = deriveVinylPressing(safePalette, seed);

    return {
      ambient: buildAmbientFromPalette(safePalette),
      palette: safePalette,
      pressing,
    };
  } catch (err) {
    console.warn("[VinylDeck] Artwork visual extraction failed:", err);
    return null;
  }
}

async function extractAmbientFromImage(imgEl: HTMLImageElement): Promise<{
  primary: string;
  secondary: string;
} | null> {
  const result = await fac.getColorAsync(imgEl, {
    algorithm: "simple",
    mode: "precision",
    ignoredColor: [
      [255, 255, 255, 255, 25] as [number, number, number, number, number],
      [0, 0, 0, 255, 15] as [number, number, number, number, number],
    ],
  });

  if (result.error) return null;

  const [r, g, b] = result.value;
  const color = boostToAmbient(r, g, b);

  if (!color) {
    console.debug(
      `[VinylDeck] near-achromatic rgb(${r},${g},${b}) → theme ambient fallback`,
    );
    return null;
  }

  console.debug(`[VinylDeck] ambient: raw=rgb(${r},${g},${b}) → ${color}`);
  return { primary: color, secondary: color };
}

function buildAmbientFromPalette(palette: ArtworkPalette): {
  primary: string;
  secondary: string;
  accent: string;
} {
  return {
    primary: colorToAmbientCss(palette.primary, "primary"),
    secondary: colorToAmbientCss(palette.secondary, "secondary"),
    accent: colorToAmbientCss(palette.accent, "accent"),
  };
}

function colorToAmbientCss(
  color: RgbColor,
  role: "primary" | "secondary" | "accent",
): string {
  let h = color.h / 360;
  let s = color.s;
  let l = color.l;

  if (s < 0.07) {
    // Neutral artwork should become a restrained silver/warm-grey glow instead
    // of forcing a fake hue. The pressing engine already protects these cases.
    const neutralLightness = role === "accent" ? 0.52 : role === "secondary" ? 0.42 : 0.34;
    const value = Math.round(neutralLightness * 255);
    const warmth = role === "accent" ? 8 : 0;
    return `rgb(${value + warmth},${value + Math.round(warmth * 0.7)},${value})`;
  }

  const minS = role === "accent" ? 0.5 : role === "secondary" ? 0.38 : 0.42;
  const maxS = role === "accent" ? 0.86 : 0.76;
  const minL = role === "accent" ? 0.42 : role === "secondary" ? 0.34 : 0.3;
  const maxL = role === "accent" ? 0.62 : role === "secondary" ? 0.56 : 0.5;

  s = Math.min(maxS, Math.max(minS, s * 1.08));
  l = Math.min(maxL, Math.max(minL, l));

  const [r, g, b] = hslToRgb(h, s, l);
  return `rgb(${r},${g},${b})`;
}

export async function extractArtworkPalette(
  artworkSrc: string,
): Promise<ArtworkPalette | null> {
  try {
    const imgEl = await loadImage(artworkSrc);
    return extractArtworkPaletteFromImage(imgEl);
  } catch (err) {
    console.warn("[VinylDeck] Palette extraction failed:", err);
    return null;
  }
}

function extractArtworkPaletteFromImage(
  imgEl: HTMLImageElement,
): ArtworkPalette | null {
  const canvas = document.createElement("canvas");
  canvas.width = PALETTE_CANVAS_SIZE;
  canvas.height = PALETTE_CANVAS_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, PALETTE_CANVAS_SIZE, PALETTE_CANVAS_SIZE);
  ctx.drawImage(imgEl, 0, 0, PALETTE_CANVAS_SIZE, PALETTE_CANVAS_SIZE);

  const pixels = ctx.getImageData(
    0,
    0,
    PALETTE_CANVAS_SIZE,
    PALETTE_CANVAS_SIZE,
  ).data;
  const clusters = new Map<string, QuantizedCluster>();
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalCount = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const a = pixels[index + 3];
    if (a < 170) continue;

    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const color = colorFromRgb(r, g, b);

    // Ignore only true clipping artifacts, not useful white/black artwork regions.
    if (color.l < 0.012 || color.l > 0.992) continue;

    totalR += r;
    totalG += g;
    totalB += b;
    totalCount += 1;

    const key = quantizeColor(color);
    const existing = clusters.get(key);
    const pixelScore = scorePixel(color);

    if (existing) {
      existing.count += 1;
      existing.score += pixelScore;
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.saturation += color.s;
      existing.lightness += color.l;
    } else {
      clusters.set(key, {
        key,
        count: 1,
        score: pixelScore,
        r,
        g,
        b,
        saturation: color.s,
        lightness: color.l,
        color,
      });
    }
  }

  if (totalCount === 0 || clusters.size === 0) return null;

  const ranked = Array.from(clusters.values())
    .map((cluster) => {
      const averaged = colorFromRgb(
        cluster.r / cluster.count,
        cluster.g / cluster.count,
        cluster.b / cluster.count,
      );
      return {
        ...cluster,
        color: averaged,
        saturation: cluster.saturation / cluster.count,
        lightness: cluster.lightness / cluster.count,
        score: cluster.score * Math.log2(cluster.count + 2),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CLUSTERS);

  const average = colorFromRgb(
    totalR / totalCount,
    totalG / totalCount,
    totalB / totalCount,
  );
  const primary = selectPrimary(ranked, average);
  const secondary = selectSecondary(ranked, primary);
  const accent = selectAccent(ranked, primary, secondary, average);

  return buildPalette(primary, secondary, accent, average);
}

function quantizeColor(color: RgbColor): string {
  if (color.s < 0.12) {
    return `neutral-${Math.floor(color.l * 8)}`;
  }

  const hueBin = Math.floor(color.h / 15);
  const saturationBin = Math.floor(color.s * 5);
  const lightnessBin = Math.floor(color.l * 5);
  return `${hueBin}-${saturationBin}-${lightnessBin}`;
}

function scorePixel(color: RgbColor): number {
  const chromaBonus = color.s < 0.12 ? 0.68 : 0.72 + color.s * 1.75;
  const lightnessBalance = 0.78 + Math.min(color.l, 0.72) * 0.52;
  const neutralCollectorBonus = color.s < 0.12 && color.l > 0.72 ? 0.48 : 0;
  return chromaBonus * lightnessBalance + neutralCollectorBonus;
}

function selectPrimary(
  clusters: QuantizedCluster[],
  average: RgbColor,
): RgbColor {
  const colorful = clusters.find(
    (cluster) => cluster.color.s > 0.16 && cluster.count > 6,
  );
  return (colorful ?? clusters[0])?.color ?? average;
}

function selectSecondary(
  clusters: QuantizedCluster[],
  primary: RgbColor,
): RgbColor {
  const [best] = clusters
    .filter((cluster) => colorDistance(cluster.color, primary) > 0.13)
    .sort(
      (a, b) =>
        secondaryScore(b.color, primary, b.score) -
        secondaryScore(a.color, primary, a.score),
    );

  if (best) return best.color;

  return colorFromRgb(
    255 - primary.r * 0.35,
    255 - primary.g * 0.35,
    255 - primary.b * 0.35,
  );
}

function selectAccent(
  clusters: QuantizedCluster[],
  primary: RgbColor,
  secondary: RgbColor,
  average: RgbColor,
): RgbColor {
  const [best] = clusters
    .filter(
      (cluster) =>
        colorDistance(cluster.color, primary) > 0.1 ||
        colorDistance(cluster.color, secondary) > 0.1,
    )
    .sort(
      (a, b) =>
        accentScore(b.color, primary, secondary, b.score) -
        accentScore(a.color, primary, secondary, a.score),
    );

  if (best) return best.color;

  return colorFromRgb(
    average.r * 0.75 + secondary.r * 0.25,
    average.g * 0.75 + secondary.g * 0.25,
    average.b * 0.75 + secondary.b * 0.25,
  );
}

function secondaryScore(
  color: RgbColor,
  primary: RgbColor,
  clusterScore: number,
): number {
  const distance = colorDistance(color, primary);
  const lightContrast = Math.abs(color.l - primary.l);
  const neutralWhiteBonus = color.s < 0.14 && color.l > 0.68 ? 2.4 : 0;
  return (
    clusterScore * (0.8 + distance * 2.2 + lightContrast * 1.2) +
    neutralWhiteBonus
  );
}

function accentScore(
  color: RgbColor,
  primary: RgbColor,
  secondary: RgbColor,
  clusterScore: number,
): number {
  const distance = Math.max(
    colorDistance(color, primary),
    colorDistance(color, secondary),
  );
  return clusterScore * (0.7 + color.s * 2.4 + distance * 1.2 + color.l * 0.2);
}

function colorDistance(a: RgbColor, b: RgbColor): number {
  const dr = (a.r - b.r) / 255;
  const dg = (a.g - b.g) / 255;
  const db = (a.b - b.b) / 255;
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * React hook: watches artworkDataUrl, extracts visuals, applies to DOM.
 * Stale-safe by monotonic request id — no stale song can overwrite a newer song.
 */
export function useColorExtraction(
  artworkDataUrl: string | null,
  options: UseColorExtractionOptions = {},
): void {
  const requestIdRef = useRef(0);
  const ambientEnabled = options.ambientEnabled ?? true;
  const vinylEnabled = options.vinylEnabled ?? true;
  const seed = options.seed ?? "";

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!artworkDataUrl) {
      resetAmbientColors();
      resetVinylPressing();
      return;
    }

    if (!ambientEnabled) resetAmbientColors();

    extractArtworkVisuals(artworkDataUrl, seed).then((result) => {
      if (requestIdRef.current !== requestId) return;

      if (!result) {
        if (ambientEnabled) resetAmbientColors();
        if (vinylEnabled) {
          const fallbackPressing = deriveVinylPressing(
            createFallbackPalette(),
            seed,
          );
          applyVinylPressing(
            fallbackPressing.type,
            fallbackPressing.cssVars,
            fallbackPressing,
          );
        }
        return;
      }

      if (ambientEnabled) {
        applyAmbientColors(
          result.ambient.primary,
          result.ambient.secondary,
          result.ambient.accent,
        );
      } else {
        resetAmbientColors();
      }

      if (vinylEnabled) {
        applyVinylPressing(
          result.pressing.type,
          result.pressing.cssVars,
          result.pressing,
        );
      }

      console.debug(
        `[VinylDeck] vinyl pressing: ${result.pressing.type} seed=${result.pressing.seed}`,
        result.palette.characteristics,
      );
    });

    return () => {
      requestIdRef.current += 1;
    };
  }, [artworkDataUrl, ambientEnabled, seed, vinylEnabled]);
}
