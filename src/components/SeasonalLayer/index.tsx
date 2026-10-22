// src/components/SeasonalLayer/index.tsx
// Halloween decoration: hairline cobwebs, lantern pumpkins, one drifting ghost.
// Static markup mounted once beside AmbientLayer. Visibility is pure CSS
// (--seasonal-display from schemes.css), so switching schemes never
// re-renders this or the deck, and display:none stops its animations.

import { memo } from "react";
import "./SeasonalLayer.css";

const WEB_SPOKES =
  "M0 0L172 0M0 0L159 66M0 0L122 122M0 0L66 159M0 0L0 172";
const WEB_RINGS =
  "M42 0Q35 7 39 16Q29 20 30 30Q20 29 16 39Q7 35 0 42" +
  "M80 0Q66 13 74 31Q56 37 57 57Q37 56 31 74Q13 66 0 80" +
  "M118 0Q98 19 109 45Q83 55 83 83Q55 83 45 109Q19 98 0 118" +
  "M154 0Q127 25 142 59Q108 72 109 109Q72 108 59 142Q25 127 0 154";

function Cobweb({ className }: { className: string }) {
  return (
    <svg className={`seasonal__web ${className}`} viewBox="0 0 172 172" fill="none">
      <path d={WEB_SPOKES} />
      <path d={WEB_RINGS} />
    </svg>
  );
}

function Pumpkin({ className }: { className: string }) {
  return (
    <svg className={`seasonal__pumpkin ${className}`} viewBox="0 0 60 52">
      <path className="seasonal__stem" d="M30 10c-2-6 1-9 5-9" />
      <ellipse cx="18" cy="31" rx="14" ry="18" fill="url(#seasonal-lantern)" />
      <ellipse cx="42" cy="31" rx="14" ry="18" fill="url(#seasonal-lantern)" />
      <ellipse
        className="seasonal__pumpkin-core"
        cx="30"
        cy="31"
        rx="13"
        ry="20"
        fill="url(#seasonal-lantern)"
      />
    </svg>
  );
}

interface SeasonalLayerProps {
  /** Mini player: cobwebs only, no ghost or pumpkins. */
  compact?: boolean;
}

export const SeasonalLayer = memo(function SeasonalLayer({
  compact = false,
}: SeasonalLayerProps) {
  return (
    <div className={`seasonal${compact ? " seasonal--compact" : ""}`} aria-hidden="true">
      <svg className="seasonal__defs" width="0" height="0">
        <defs>
          <radialGradient id="seasonal-lantern" cx="50%" cy="58%" r="60%">
            <stop offset="0" stopColor="#FFA94D" />
            <stop offset="0.55" stopColor="#C9520A" />
            <stop offset="1" stopColor="#3A1A08" />
          </radialGradient>
        </defs>
      </svg>

      <Cobweb className="seasonal__web--left" />
      <Cobweb className="seasonal__web--right" />

      {!compact && (
        <>
          <div className="seasonal__track">
            <svg className="seasonal__ghost" viewBox="0 0 60 78">
              <path
                d="M30 4C15 4 6 16 6 32v40l8-6 8 7 8-7 8 7 8-7 8 6V32C54 16 45 4 30 4z"
                fill="#FFFFFF"
              />
              <ellipse cx="23" cy="30" rx="2.6" ry="3.6" fill="#141214" opacity="0.55" />
              <ellipse cx="37" cy="30" rx="2.6" ry="3.6" fill="#141214" opacity="0.55" />
            </svg>
          </div>

          <div className="seasonal__glow seasonal__glow--left" />
          <Pumpkin className="seasonal__pumpkin--left" />
          <div className="seasonal__glow seasonal__glow--left-small" />
          <Pumpkin className="seasonal__pumpkin--left-small" />
          <div className="seasonal__glow seasonal__glow--right" />
          <Pumpkin className="seasonal__pumpkin--right" />
        </>
      )}
    </div>
  );
});
