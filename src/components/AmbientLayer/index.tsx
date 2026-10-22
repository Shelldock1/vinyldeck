// src/components/AmbientLayer/index.tsx
// Fixed full-bleed shell lighting. This pass intentionally drops the complex
// shader ambient modes and returns to one simple Art Ambient toggle.

import { useEffect } from "react";
import { applyAmbientMode } from "../../lib/themes/applier";
import type { AmbientModeId, ThemeId } from "../../lib/themes/applier";
import "./AmbientLayer.css";

interface AmbientLayerProps {
  filmGrain?: boolean;
  mode?: AmbientModeId;
  theme?: ThemeId;
  /** Kept for backwards call-site compatibility; shaders are intentionally disabled here. */
  shaderEnabled?: boolean;
}

export function AmbientLayer({
  filmGrain = true,
  mode = "off",
  theme = "noir",
}: AmbientLayerProps) {
  useEffect(() => {
    applyAmbientMode(mode);
  }, [mode]);

  const artAmbient = mode !== "off";

  return (
    <div
      className={`ambient-layer ambient-layer--theme-${theme}${artAmbient ? " ambient-layer--art" : " ambient-layer--off"}`}
      aria-hidden="true"
    >
      <div className="ambient-layer__base" />
      <div className="ambient-layer__velvet" />

      <div className="ambient-layer__orb ambient-layer__orb--primary" />
      <div className="ambient-layer__orb ambient-layer__orb--secondary" />
      <div className="ambient-layer__orb ambient-layer__orb--accent" />
      <div className="ambient-layer__swirl ambient-layer__swirl--a" />
      <div className="ambient-layer__swirl ambient-layer__swirl--b" />

      <div className="ambient-layer__readability" />
      <div className="ambient-layer__vignette" />
      {filmGrain && <div className="ambient-layer__grain" />}
    </div>
  );
}
