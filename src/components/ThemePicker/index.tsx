// src/components/ThemePicker/index.tsx
// Premium shell switcher + single Art Ambient toggle.

import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { Kbd } from "../Kbd";
import { LiquidGlass } from "../LiquidGlass";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip";
import {
  ART_AMBIENT_MODE,
  THEME_IDS,
  THEME_LABELS,
  applyVisualMode,
  resetAmbientColors,
} from "../../lib/themes/applier";
import type { ThemeId } from "../../lib/themes/applier";
import { useVinylDeckStore } from "../../lib/playback/store";
import { commitSettings } from "../../lib/settings";

const SHELL_ACCENT: Record<ThemeId, string> = {
  noir: "#f1efea",
  glass: "#0070d9",
};

const SHELL_BG: Record<ThemeId, string> = {
  noir: "#050505",
  glass: "#f5f2ea",
};

export function ThemePicker() {
  const currentTheme = useVinylDeckStore((s) => s.theme);
  const ambientMode = useVinylDeckStore((s) => s.ambientMode);
  const hydrateSettings = useVinylDeckStore((s) => s.hydrateSettings);
  const artAmbient = ambientMode !== "off";

  function applyCommittedSettings(
    settings: Awaited<ReturnType<typeof commitSettings>>,
  ) {
    hydrateSettings(settings);
    applyVisualMode(settings.theme, settings.ambientMode);
    if (settings.ambientMode === "off") resetAmbientColors();
  }

  function handleThemeSelect(id: ThemeId) {
    void commitSettings({ theme: id })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Settings] Theme update failed:", error);
      });
  }

  function handleArtAmbientToggle() {
    const nextMode = artAmbient ? "off" : ART_AMBIENT_MODE;
    if (nextMode === "off") resetAmbientColors();
    void commitSettings({ ambientMode: nextMode, artAmbient: nextMode !== "off" })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[Settings] Art ambient update failed:", error);
      });
  }

  return (
    <LiquidGlass
      className="theme-picker"
      contentClassName="theme-picker__content"
      variant="dock"
      intensity="normal"
      role="group"
      aria-label="Visual shell and art ambient"
    >
      <div className="theme-picker__shells" role="radiogroup" aria-label="Visual shell">
        {THEME_IDS.map((id) => {
          const active = id === currentTheme;
          return (
            <Tooltip key={id}>
              <TooltipTrigger>
                <motion.button
                  type="button"
                  className={`theme-picker__shell theme-picker__shell--${id}${active ? " theme-picker__shell--active" : ""}`}
                  role="radio"
                  aria-checked={active}
                  aria-label={`${THEME_LABELS[id]} shell`}
                  onClick={() => handleThemeSelect(id)}
                  style={
                    {
                      "--theme-shell-accent": SHELL_ACCENT[id],
                      "--theme-shell-bg": SHELL_BG[id],
                    } as CSSProperties
                  }
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <span className="theme-picker__shell-core" aria-hidden="true" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent>
                {THEME_LABELS[id]} shell <Kbd>T</Kbd>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="theme-picker__divider" aria-hidden="true" />

      <Tooltip>
        <TooltipTrigger>
          <motion.button
            type="button"
            className={`theme-picker__ambient${artAmbient ? " theme-picker__ambient--active" : ""}`}
            aria-pressed={artAmbient}
            aria-label="Toggle art ambient"
            onClick={handleArtAmbientToggle}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
          >
            <span className="theme-picker__ambient-dot" aria-hidden="true" />
            <span>ART AMBIENT</span>
          </motion.button>
        </TooltipTrigger>
        <TooltipContent>
          Art Ambient <Kbd>A</Kbd>
        </TooltipContent>
      </Tooltip>
    </LiquidGlass>
  );
}
