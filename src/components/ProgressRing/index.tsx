// src/components/ProgressRing/index.tsx
// SVG progress ring wrapping the vinyl.
// Phase 8:
//   - Scrub interaction: onPointerDown/Move/Up + setPointerCapture
//   - Aurora ambient decorative outer ring (breathe pulse)
//   - Scrub timestamp tooltip follows cursor angle
//   - RULES OF HOOKS: ALL hooks declared before any early return

import { useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useVinylDeckStore, selectAmbientMode } from "../../lib/playback/store";

interface ProgressRingProps {
  duration: number;
  position: number;
  isPlaying: boolean;
  size: number;
  onSeek?: (positionSeconds: number) => void;
}

const STROKE_WIDTH = 2.5;

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function ProgressRing({
  duration,
  position,
  size,
  onSeek,
}: ProgressRingProps) {
  // ── ALL hooks first — no early returns before this block ──────
  const ambientMode = useVinylDeckStore(selectAmbientMode);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const [scrubAngle, setScrubAngle] = useState(0);

  const angleFromPointer = useCallback(
    (e: React.PointerEvent<SVGSVGElement>): number => {
      if (!svgRef.current) return 0;
      const center = size / 2;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - center;
      const y = e.clientY - rect.top - center;
      let deg = Math.atan2(x, -y) * (180 / Math.PI);
      if (deg < 0) deg += 360;
      return deg;
    },
    [size]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!onSeek || duration <= 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const deg = angleFromPointer(e);
      const pos = (deg / 360) * duration;
      setIsScrubbing(true);
      setScrubPosition(pos);
      setScrubAngle(deg);
    },
    [onSeek, duration, angleFromPointer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isScrubbing || !onSeek) return;
      const deg = angleFromPointer(e);
      const pos = (deg / 360) * duration;
      setScrubPosition(pos);
      setScrubAngle(deg);
    },
    [isScrubbing, onSeek, duration, angleFromPointer]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isScrubbing || !onSeek) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const deg = angleFromPointer(e);
      const pos = (deg / 360) * duration;
      setIsScrubbing(false);
      onSeek(pos);
    },
    [isScrubbing, onSeek, duration, angleFromPointer]
  );
  // ── End of hooks block ────────────────────────────────────────

  // Early return AFTER all hooks
  if (duration <= 0) return null;

  const center = size / 2;
  const radius = center - STROKE_WIDTH - 4;
  const circumference = 2 * Math.PI * radius;
  const decorRadius = center - 2;

  const displayPosition = isScrubbing ? scrubPosition : position;
  const progress = Math.min(Math.max(displayPosition / duration, 0), 1);
  const dashOffset = circumference * (1 - progress);

  const artAmbient = ambientMode !== "off";

  // Scrub handle position on the arc
  const handleDeg = progress * 360 - 90;
  const handleRad = handleDeg * (Math.PI / 180);
  const handleX = center + radius * Math.cos(handleRad);
  const handleY = center + radius * Math.sin(handleRad);

  // Tooltip position — follows scrub angle
  const tooltipRad = (scrubAngle - 90) * (Math.PI / 180);
  const tooltipR = radius + 20;
  const tooltipX = center + tooltipR * Math.cos(tooltipRad);
  const tooltipY = center + tooltipR * Math.sin(tooltipRad);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 5,
        pointerEvents: onSeek ? "all" : "none",
        cursor: isScrubbing ? "grabbing" : (onSeek ? "pointer" : "default"),
        overflow: "visible",
      }}
      aria-label={`Track progress: ${formatTime(displayPosition)} / ${formatTime(duration)}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Art Ambient — decorative outer breathing ring */}
      {artAmbient && (
        <motion.circle
          cx={center}
          cy={center}
          r={decorRadius}
          fill="none"
          stroke="var(--ui-accent, #00d4be)"
          strokeWidth={1}
          style={{ filter: "drop-shadow(0 0 6px var(--ui-accent, #00d4be))" }}
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
        />
      )}

      {/* Track circle — full dim ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--ring-track)"
        strokeWidth={1.5}
        transform={`rotate(-90, ${center}, ${center})`}
      />

      {/* Progress fill arc */}
      <motion.circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--ring-fill)"
        strokeWidth={STROKE_WIDTH}
        strokeDasharray={circumference}
        strokeLinecap="round"
        transform={`rotate(-90, ${center}, ${center})`}
        style={{
          filter: `drop-shadow(0 0 ${isScrubbing ? "8px" : "4px"} var(--ring-glow))`,
          animation: artAmbient
            ? "glow-pulse 3.6s ease-in-out infinite alternate"
            : "none",
        }}
        animate={{ strokeDashoffset: dashOffset }}
        transition={{ duration: isScrubbing ? 0 : 0.3, ease: "linear" }}
      />

      {/* Scrub handle dot */}
      {onSeek && (
        <circle
          cx={handleX}
          cy={handleY}
          r={isScrubbing ? 6 : 4}
          fill="var(--ring-fill)"
          style={{
            filter: "drop-shadow(0 0 4px var(--ring-glow))",
            transition: "r 150ms ease",
          }}
        />
      )}

      {/* Scrub timestamp tooltip */}
      {isScrubbing && (
        <g>
          <rect
            x={tooltipX - 22}
            y={tooltipY - 11}
            width={44}
            height={20}
            rx={10}
            fill="rgba(0,0,0,0.75)"
          />
          <text
            x={tooltipX}
            y={tooltipY + 4}
            textAnchor="middle"
            fill="var(--ring-fill)"
            fontSize="10"
            fontFamily="var(--font-mono, 'JetBrains Mono'), monospace"
            letterSpacing="0.05em"
          >
            {formatTime(scrubPosition)}
          </text>
        </g>
      )}
    </svg>
  );
}
