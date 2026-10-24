// src/components/NeedleArm/index.tsx
// Spring-physics tonearm via motion/react.
// Pivots from hinge at top-right.
//
// Needle Drop:
//   - With a known duration the arm tracks progress across the grooves:
//     outer groove = track start, inner groove = track end.
//   - Grab the headshell and drop it anywhere on the grooves to seek
//     (and start playback if paused). Drop it off the record to pause.
//   - Paused = cue lifted in place; LED dims.
//   - Unknown duration (streams / empty state) keeps the legacy fixed angles.
//
// Phase 3:
//   - LED uses CSS class --dim vs default (theme-colored via --ui-accent)
//   - Needle-bump class applied when arm settles on record
//   - trackKey prop: changes trigger lift → re-cue → drop sequence for skip

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import "./NeedleArm.css";
import { useT } from "../../lib/i18n";

const NEEDLE_ANGLE_LIFTED = 15; // degrees: resting, no known duration
const NEEDLE_ANGLE_DOWN = 4; // degrees: playing, no known duration

// Measured against the CSS geometry: stylus radius ≈ 0.80 - 0.0215 * angle
// (fraction of disc radius). Start ≈ 0.93R, end ≈ 0.48R (label edge ≈ 0.38R).
export const GROOVE_START_DEG = -6;
export const GROOVE_END_DEG = 15;
const OFF_RECORD_DEG = -10; // past this the stylus is beyond the disc rim
const PARKED_DEG = -21; // off-record rest after a lift-off pause
const DRAG_MIN_DEG = -24;
const DRAG_MAX_DEG = 17;

const POSITION_POLL_MS = 500;
const DROP_SPRING = { type: "spring", stiffness: 60, damping: 18, mass: 1.2 } as const;
const LIFT_SPRING = { type: "spring", stiffness: 80, damping: 15, mass: 0.8 } as const;
const TRACK_TWEEN = { duration: POSITION_POLL_MS / 1000, ease: "linear" } as const;

// Pivot = .needle-arm transform-origin (82% 12%) inside its container box.
const PIVOT_X = 0.82;
const PIVOT_Y = 0.12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function positionToAngle(position: number, duration: number): number {
  const progress = duration > 0 ? clamp(position / duration, 0, 1) : 0;
  return GROOVE_START_DEG + progress * (GROOVE_END_DEG - GROOVE_START_DEG);
}

export function angleToPosition(angle: number, duration: number): number {
  const progress = clamp(
    (angle - GROOVE_START_DEG) / (GROOVE_END_DEG - GROOVE_START_DEG),
    0,
    1,
  );
  return progress * duration;
}

export function isOffRecord(angle: number): boolean {
  return angle < OFF_RECORD_DEG;
}

export function formatDropTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// Drop label reveal: mechanical snap curve (animation-physics.md §1).
const DROP_LABEL_IN = { duration: 0.22, ease: [0.34, 1.56, 0.64, 1] } as const;
const DROP_LABEL_OUT = { duration: 0.12, ease: "easeOut" } as const;

interface NeedleArmProps {
  isPlaying: boolean;
  trackKey?: string; // pass track title or ID — changes trigger lift/re-drop
  duration?: number; // seconds; 0 = unknown → fixed legacy angles
  getPosition?: () => number;
  canSeek?: boolean;
  canControl?: boolean;
  onSeek?: (positionSeconds: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  /** Live drop target while dragging; null when off-record or not dragging. */
  onScrubPreview?: (positionSeconds: number | null) => void;
  /** Increment to lift and return the arm to its rest after a sleep timer. */
  parkRequest?: number;
}

export function NeedleArm({
  isPlaying,
  trackKey,
  duration = 0,
  getPosition,
  canSeek = false,
  canControl = false,
  onSeek,
  onPlay,
  onPause,
  onScrubPreview,
  parkRequest = 0,
}: NeedleArmProps) {
  const t = useT();
  const rotate = useMotionValue(NEEDLE_ANGLE_LIFTED);
  // Keeps the drop-time label upright while the arm swings.
  const labelRotate = useTransform(() => -rotate.get());
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTrackKey = useRef(trackKey);
  const prevParkRequest = useRef(parkRequest);
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lowerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdUntilRef = useRef(0); // suppress progress tracking during cue moves
  const dragRef = useRef<{
    pointerId: number;
    startPointerDeg: number;
    startArmDeg: number;
  } | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const [showBump, setShowBump] = useState(false);
  const [isLifted, setIsLifted] = useState(!isPlaying);
  const [isDragging, setIsDragging] = useState(false);
  const [isParked, setIsParked] = useState(false);
  // Whole seconds only, so dragging re-renders once per second of travel.
  const [dropSecond, setDropSecond] = useState<number | null>(null);

  const tracksProgress = duration > 0 && !!getPosition;
  const canDrag = tracksProgress && (canSeek || canControl);

  function restingAngle(): number {
    if (isParked) return PARKED_DEG;
    if (tracksProgress) return positionToAngle(getPosition!(), duration);
    return isPlaying ? NEEDLE_ANGLE_DOWN : NEEDLE_ANGLE_LIFTED;
  }

  function bump() {
    setShowBump(true);
    if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
    bumpTimerRef.current = setTimeout(() => setShowBump(false), 140);
  }

  function holdFor(ms: number) {
    holdUntilRef.current = performance.now() + ms;
  }

  // Lowering is timed, not chained to the swing animation: progress tracking
  // may retarget the swing, and a stopped motion animation never resolves.
  function lowerAfter(ms: number) {
    if (lowerTimerRef.current) clearTimeout(lowerTimerRef.current);
    lowerTimerRef.current = setTimeout(() => {
      lowerTimerRef.current = null;
      if (dragRef.current || !isPlayingRef.current) return;
      setIsLifted(false);
      bump();
    }, ms);
  }

  // Phase 3.2: On track skip — lift arm, re-cue to the new position, drop.
  useEffect(() => {
    if (trackKey === prevTrackKey.current) return;
    prevTrackKey.current = trackKey;
    setIsParked(false);

    // Only do the skip animation if we're playing (arm is down)
    if (!isPlaying || dragRef.current) return;

    holdFor(1100);
    setIsLifted(true);
    const recueTimer = setTimeout(() => {
      if (dragRef.current) return;
      const target = tracksProgress
        ? positionToAngle(getPosition!(), duration)
        : NEEDLE_ANGLE_DOWN;
      animate(rotate, target, LIFT_SPRING);
      lowerAfter(650);
    }, 280);

    return () => clearTimeout(recueTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey]);

  // Sleep timer: the backend already paused playback. Lift and park the arm
  // on its rest with the same cue-return motion as a manual lift-off. Pivot
  // and groove geometry stay untouched.
  useEffect(() => {
    if (parkRequest === prevParkRequest.current) return;
    prevParkRequest.current = parkRequest;

    setIsParked(true);
    setIsLifted(true);
    holdFor(900);
    animate(rotate, PARKED_DEG, LIFT_SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkRequest]);

  // Play/pause: cue lever lifts or lowers the arm in place.
  useEffect(() => {
    if (dragRef.current) return;
    if (isPlaying) setIsParked(false);
    setIsLifted(!isPlaying);

    if (!tracksProgress) {
      const controls = animate(
        rotate,
        isPlaying ? NEEDLE_ANGLE_DOWN : NEEDLE_ANGLE_LIFTED,
        DROP_SPRING,
      );
      void controls.then(() => {
        if (isPlaying) bump();
      });
      return () => controls.stop();
    }

    if (isPlaying) bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, tracksProgress]);

  // Progress tracking: the arm creeps inward as the track plays.
  useEffect(() => {
    if (!tracksProgress) return;

    function follow(transition: typeof TRACK_TWEEN | typeof DROP_SPRING) {
      if (dragRef.current) return;
      if (performance.now() < holdUntilRef.current) return;
      animate(rotate, restingAngle(), transition);
    }

    follow(DROP_SPRING);
    const id = setInterval(() => follow(TRACK_TWEEN), POSITION_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracksProgress, duration, isParked, isPlaying]);

  useEffect(() => {
    return () => {
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
      if (lowerTimerRef.current) clearTimeout(lowerTimerRef.current);
    };
  }, []);

  function pointerDeg(event: ReactPointerEvent): number {
    const rect = containerRef.current!.getBoundingClientRect();
    const pivotX = rect.left + rect.width * PIVOT_X;
    const pivotY = rect.top + rect.height * PIVOT_Y;
    return (
      Math.atan2(event.clientY - pivotY, event.clientX - pivotX) *
      (180 / Math.PI)
    );
  }

  function previewFor(angle: number) {
    const position =
      isOffRecord(angle) || !canSeek ? null : angleToPosition(angle, duration);
    onScrubPreview?.(position);
    setDropSecond(position === null ? null : Math.floor(position));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canDrag || event.button !== 0 || !containerRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    rotate.stop();
    if (lowerTimerRef.current) clearTimeout(lowerTimerRef.current);
    dragRef.current = {
      pointerId: event.pointerId,
      startPointerDeg: pointerDeg(event),
      startArmDeg: rotate.get(),
    };
    setIsDragging(true);
    setIsLifted(true);
    previewFor(rotate.get());
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    let delta = pointerDeg(event) - drag.startPointerDeg;
    // atan2 wraps at ±180°; keep the delta continuous.
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const angle = clamp(drag.startArmDeg + delta, DRAG_MIN_DEG, DRAG_MAX_DEG);
    rotate.set(angle);
    previewFor(angle);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
    onScrubPreview?.(null);
    setDropSecond(null);

    const angle = rotate.get();
    const cancelled = event.type === "pointercancel";

    if (!cancelled && isOffRecord(angle) && canControl) {
      // Lifted off the record → park on the rest and pause.
      setIsParked(true);
      setIsLifted(true);
      holdFor(900);
      animate(rotate, PARKED_DEG, LIFT_SPRING);
      if (isPlaying) onPause?.();
      return;
    }

    if (!cancelled && !isOffRecord(angle) && canSeek) {
      // Needle drop: seek where the stylus landed, start playing if paused.
      const target = clamp(angle, GROOVE_START_DEG, GROOVE_END_DEG);
      setIsParked(false);
      holdFor(900);
      onSeek?.(angleToPosition(target, duration));
      if (!isPlaying && canControl) onPlay?.();
      animate(rotate, target, DROP_SPRING);
      // When paused, onPlay flips isPlaying and the cue effect lowers the arm.
      if (isPlaying) lowerAfter(220);
      return;
    }

    // Nothing we can do with this drop — spring back to where we were.
    setIsLifted(!isPlaying);
    animate(rotate, restingAngle(), DROP_SPRING);
  }

  return (
    <div className="needle-arm-container" ref={containerRef}>
      <motion.div
        className={`needle-arm${isLifted ? " needle-arm--lifted" : ""}${isDragging ? " needle-arm--dragging" : ""}`}
        style={{ rotate }}
      >
        {/* Pivot stack + counterweight */}
        <div className="needle-arm__pivot-stack" aria-hidden="true">
          <div className="needle-arm__counterweight" />
          <div className="needle-arm__base-ring" />
          <div className="needle-arm__hinge" />
        </div>

        {/* Arm wand */}
        <div className="needle-arm__body" />
        <div className="needle-arm__bend" />

        {/* Headshell + cartridge — grab handle for Needle Drop */}
        <div
          className={`needle-arm__head${showBump ? " needle-arm__head--bump" : ""}${canDrag ? " needle-arm__head--grabbable" : ""}`}
          aria-label={canDrag ? t.vinyl.tonearm : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="needle-arm__headshell-plate" />
          <div className="needle-arm__cartridge">
            <span className="needle-arm__stylus" aria-hidden="true" />
          </div>
          <div className="needle-arm__screws" aria-hidden="true">
            <span />
            <span />
          </div>
          {/* Phase 3.1: LED — theme-colored via --ui-accent, dimmed when lifted */}
          <div
            className={`needle-arm__led${isLifted ? " needle-arm__led--dim" : ""}`}
          />
        </div>

        {/* Needle Drop: would-be seek time, shown only while dragging over the grooves */}
        <AnimatePresence>
          {isDragging && dropSecond !== null && (
            <motion.span
              key="drop-time"
              className="needle-arm__drop-time"
              aria-hidden="true"
              style={{ rotate: labelRotate }}
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.85 }}
              animate={{ opacity: 1, scale: 1, transition: DROP_LABEL_IN }}
              exit={{ opacity: 0, transition: DROP_LABEL_OUT }}
            >
              {formatDropTime(dropSecond)}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
