// src/lib/themes/applier.ts
// Runtime shell switching, simple art-ambient toggling, and vinyl material tokens.
// Ambient is intentionally back to one product concept: Off vs album-art glow.

import type { VinylPressing, VinylPressingType } from "../vinyl/pressingEngine";

export type ThemeId = "noir" | "glass";
export type LegacyThemeId = ThemeId | "aurora" | "vapor" | "paper";

/**
 * Keep the v2 settings field name, but collapse the UX back to a single toggle.
 * "beam" is now the internal value for Art Ambient ON.
 */
export type AmbientModeId = "off" | "beam";

export const ART_AMBIENT_MODE: AmbientModeId = "beam";
export const THEME_IDS: ThemeId[] = ["noir", "glass"];

export const THEME_LABELS: Record<ThemeId, string> = {
  noir: "Noir",
  glass: "Glass",
};

export const AMBIENT_MODE_IDS: AmbientModeId[] = ["off", "beam"];

export const AMBIENT_MODE_LABELS: Record<AmbientModeId, string> = {
  off: "Art Ambient Off",
  beam: "Art Ambient On",
};

export const AMBIENT_MODE_NOTES: Record<AmbientModeId, string> = {
  off: "Pure shell lighting",
  beam: "Subtle album-art glow",
};

const LEGACY_THEME_IDS: LegacyThemeId[] = [
  "noir",
  "glass",
  "aurora",
  "vapor",
  "paper",
];

const LEGACY_AMBIENT_MODES = ["off", "beam", "caustic", "aurora"] as const;

const VINYL_PRESSING_CSS_VARS = [
  "--pressing-primary",
  "--pressing-secondary",
  "--pressing-accent",
  "--pressing-deep",
  "--pressing-soft",
  "--pressing-highlight",
  "--pressing-shadow",
  "--pressing-edge",
  "--pressing-pearl",
  "--pressing-groove",
  "--pressing-groove-bright",
  "--pressing-label-bg",
  "--pressing-seed-angle",
  "--pressing-seed-angle-alt",
  "--pressing-texture-opacity",
  "--pressing-translucency",
  "--pressing-splatter-scale",
  "--pressing-ghost-opacity",
  "--pressing-smoke-density",
  "--pressing-organic-x",
  "--pressing-organic-y",
  "--pressing-hash-a",
  "--pressing-hash-b",
  "--pressing-renderer-recipe",
  "--pressing-shader-alpha",
  "--pressing-rim-absorption",
  "--pressing-reflection-strength",
] as const;

const AMBIENT_CSS_VARS = [
  "--ambient-primary",
  "--ambient-secondary",
  "--ambient-accent",
] as const;

export type VinylPressingEvent = CustomEvent<VinylPressing | null>;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function isLegacyThemeId(value: unknown): value is LegacyThemeId {
  return (
    typeof value === "string" && LEGACY_THEME_IDS.includes(value as LegacyThemeId)
  );
}

export function isAmbientModeId(value: unknown): value is AmbientModeId {
  return typeof value === "string" && AMBIENT_MODE_IDS.includes(value as AmbientModeId);
}

export function normalizeAmbientMode(value: unknown): AmbientModeId {
  if (value === "off") return "off";
  if (typeof value === "string" && LEGACY_AMBIENT_MODES.includes(value as any)) {
    return ART_AMBIENT_MODE;
  }
  return "off";
}

export function legacyThemeToShell(theme: LegacyThemeId): ThemeId {
  if (theme === "glass" || theme === "paper") return "glass";
  return "noir";
}

export function legacyThemeToAmbientMode(
  theme: LegacyThemeId,
  artAmbient = false,
): AmbientModeId {
  if (artAmbient) return ART_AMBIENT_MODE;
  if (theme === "aurora" || theme === "vapor") return ART_AMBIENT_MODE;
  return "off";
}

export function applyTheme(themeId: ThemeId): void {
  document.documentElement.setAttribute("data-theme", themeId);
}

export function applyAmbientMode(mode: AmbientModeId): void {
  document.documentElement.setAttribute("data-ambient-mode", mode);
  if (mode === "off") resetAmbientColors();
}

export function applyVisualMode(themeId: ThemeId, ambientMode: AmbientModeId): void {
  applyTheme(themeId);
  applyAmbientMode(ambientMode);
}

export function applyAmbientColors(
  primary: string,
  secondary: string,
  accent = secondary,
): void {
  const root = document.documentElement;
  root.style.setProperty("--ambient-primary", primary);
  root.style.setProperty("--ambient-secondary", secondary);
  root.style.setProperty("--ambient-accent", accent);
}

export function resetAmbientColors(): void {
  const root = document.documentElement;
  for (const property of AMBIENT_CSS_VARS) root.style.removeProperty(property);
}

export function applyVinylPressing(
  type: VinylPressingType,
  vars: Record<string, string>,
  pressing?: VinylPressing,
): void {
  const root = document.documentElement;
  root.setAttribute("data-vinyl-pressing", type);

  if (pressing) {
    root.setAttribute("data-vinyl-recipe", pressing.recipe);
    root.setAttribute("data-vinyl-pressing-name", pressing.pressingName);
  }

  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }

  window.dispatchEvent(
    new CustomEvent<VinylPressing | null>("vinyldeck:vinyl-pressing", {
      detail: pressing ?? null,
    }),
  );
}

export function resetVinylPressing(): void {
  const root = document.documentElement;
  root.removeAttribute("data-vinyl-pressing");
  root.removeAttribute("data-vinyl-recipe");
  root.removeAttribute("data-vinyl-pressing-name");

  for (const property of VINYL_PRESSING_CSS_VARS) {
    root.style.removeProperty(property);
  }

  window.dispatchEvent(
    new CustomEvent<VinylPressing | null>("vinyldeck:vinyl-pressing", {
      detail: null,
    }),
  );
}
