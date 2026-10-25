// src/components/SeasonalLayer/index.tsx
// Halloween decoration: hairline cobwebs, carved jack-o'-lanterns, a spider on
// its thread, and one drifting ghost.
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

// Carved openings, lit from inside: triangle eyes and nose, a grin with
// two teeth hanging from its top edge.
const FACE_EYES = "M18.5 27L25.5 27L22 21ZM34.5 27L41.5 27L38 21Z";
const FACE_NOSE = "M28.4 31.2L31.6 31.2L30 28.2Z";
const FACE_MOUTH =
  "M17 34Q30 46 43 34Q40 36 36 36.2L35 38.6L33.6 36.6L26.4 36.6L25 38.6L24 36.2Q20 36 17 34Z";

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
      <g className="seasonal__face" fill="url(#seasonal-candle)">
        <path d={FACE_EYES} />
        <path d={FACE_NOSE} />
        <path d={FACE_MOUTH} />
      </g>
    </svg>
  );
}

// Thread runs from the top of the box into the head, so it meets the
// stretching thread above without a gap.
function Spider() {
  return (
    <svg className="seasonal__spider" viewBox="0 0 40 44">
      <path className="seasonal__spider-thread" d="M20 0V12" />
      <g className="seasonal__spider-legs">
        <path d="M16 17Q9 11 5 14M15 20Q7 17 3 22M15 23Q7 24 4 30M16 26Q10 30 8 36" />
        <path d="M24 17Q31 11 35 14M25 20Q33 17 37 22M25 23Q33 24 36 30M24 26Q30 30 32 36" />
      </g>
      <ellipse className="seasonal__spider-body" cx="20" cy="26" rx="7" ry="8.5" />
      <circle className="seasonal__spider-body" cx="20" cy="15.5" r="4.2" />
      <circle cx="18.3" cy="14.8" r="0.9" fill="#FFA94D" />
      <circle cx="21.7" cy="14.8" r="0.9" fill="#FFA94D" />
    </svg>
  );
}

interface SeasonalLayerProps {
  /** Mini player: cobwebs only, no ghost, spider or pumpkins. */
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
          <radialGradient id="seasonal-candle" cx="50%" cy="60%" r="70%">
            <stop offset="0" stopColor="#FFF4C6" />
            <stop offset="0.6" stopColor="#FFD166" />
            <stop offset="1" stopColor="#FF9F1C" />
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

          <div className="seasonal__drop">
            <span className="seasonal__drop-thread" />
            <div className="seasonal__drop-spider">
              <Spider />
            </div>
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
