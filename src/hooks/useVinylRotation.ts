// src/hooks/useVinylRotation.ts
// RAF-based rotation with inertia on pause.
// Direct DOM mutation (no React state) = zero re-renders.
// Element must have id="vinyl-disc".

import { useEffect, useRef } from "react";
import type { TrackChangeDirection } from "../lib/trackTransition/types";

export interface VinylRotationFrame {
  rotation: number;
  velocity: number;
  deltaMs: number;
}

interface UseVinylRotationOptions {
  isPlaying: boolean;
  /** Hidden/minimized window: stop scheduling frames, keep rotation as-is. */
  suspended?: boolean;
  rpm?: number; // default 33.33
  skipDirection?: TrackChangeDirection;
  skipNonce?: number;
  onFrame?: (frame: VinylRotationFrame) => void;
}

/** Safety guard: if playback stays paused this long, park the loop for good. */
const PAUSED_LOOP_STOP_MS = 30_000;

export function useVinylRotation({
  isPlaying,
  suspended = false,
  rpm = 33.33,
  skipDirection = "unknown",
  skipNonce = 0,
  onFrame,
}: UseVinylRotationOptions): void {
  const rafRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const lastTimestampRef = useRef<number | null>(null);
  const targetVelocityRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const suspendedRef = useRef<boolean>(suspended);
  const pauseStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipImpulseRef = useRef<number>(0);
  const lastSkipNonceRef = useRef<number>(skipNonce);
  const onFrameRef = useRef<typeof onFrame>(onFrame);

  // degreesPerMs at 33.33 RPM:  (33.33 / 60) * (360 / 1000) ≈ 0.19998 deg/ms
  const degreesPerMs = (rpm / 60) * (360 / 1000);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  function applyFrame(delta: number) {
    const target = targetVelocityRef.current;
    const current = velocityRef.current;
    const lerpFactor = target > current ? 0.06 : 0.018;
    velocityRef.current = current + (target - current) * lerpFactor;
    skipImpulseRef.current *= 0.88;
    if (Math.abs(skipImpulseRef.current) < 0.0005) {
      skipImpulseRef.current = 0;
    }
    rotationRef.current =
      (rotationRef.current +
        (velocityRef.current + skipImpulseRef.current) * delta) %
      360;

    const disc = document.getElementById("vinyl-disc");
    if (disc) {
      disc.style.transform = `rotate(${rotationRef.current}deg)`;
    }

    onFrameRef.current?.({
      rotation: rotationRef.current,
      velocity: velocityRef.current + skipImpulseRef.current,
      deltaMs: delta,
    });
  }

  function cancelLoop() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimestampRef.current = null;
  }

  function wakeLoop() {
    if (suspendedRef.current) return;
    if (rafRef.current === null) {
      lastTimestampRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  function clearPauseStopTimer() {
    if (pauseStopTimerRef.current !== null) {
      clearTimeout(pauseStopTimerRef.current);
      pauseStopTimerRef.current = null;
    }
  }

  // The friction brake settles in ~1.5-3s. This only fires much later, as a
  // guard against a stuck loop; zeroing an already-settled velocity is a no-op.
  function schedulePauseStop() {
    clearPauseStopTimer();
    pauseStopTimerRef.current = setTimeout(() => {
      pauseStopTimerRef.current = null;
      if (isPlayingRef.current) return;
      cancelLoop();
      velocityRef.current = 0;
      skipImpulseRef.current = 0;
    }, PAUSED_LOOP_STOP_MS);
  }

  function tick(timestamp: number) {
    if (suspendedRef.current) {
      rafRef.current = null;
      lastTimestampRef.current = null;
      return;
    }

    if (lastTimestampRef.current === null) {
      lastTimestampRef.current = timestamp;
    }

    const delta = Math.min(timestamp - lastTimestampRef.current, 50);
    lastTimestampRef.current = timestamp;
    applyFrame(delta);

    if (
      Math.abs(velocityRef.current) < 0.0001 &&
      Math.abs(skipImpulseRef.current) < 0.0001 &&
      !isPlayingRef.current
    ) {
      rafRef.current = null;
      lastTimestampRef.current = null;
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  // Sync target velocity whenever isPlaying changes.
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    targetVelocityRef.current = isPlaying ? degreesPerMs : 0;
    if (isPlaying) {
      clearPauseStopTimer();
      wakeLoop();
    } else if (Math.abs(velocityRef.current) > 0.0001) {
      // Let the normal friction brake run; the guard below is only a backstop.
      wakeLoop();
      schedulePauseStop();
    } else if (rafRef.current !== null || Math.abs(skipImpulseRef.current) > 0.0001) {
      schedulePauseStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, degreesPerMs]);

  // Hidden/minimized: drop any pending frame without touching rotation or
  // velocity. Resuming starts from the same angle with a zero first delta.
  useEffect(() => {
    suspendedRef.current = suspended;
    if (suspended) {
      cancelLoop();
      return;
    }

    if (
      isPlayingRef.current ||
      Math.abs(velocityRef.current) > 0.0001 ||
      Math.abs(skipImpulseRef.current) > 0.0001
    ) {
      wakeLoop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspended]);

  useEffect(() => {
    if (skipNonce === lastSkipNonceRef.current) return;
    lastSkipNonceRef.current = skipNonce;
    if (skipDirection === "next") {
      skipImpulseRef.current += degreesPerMs * 1.65;
    } else if (skipDirection === "previous") {
      skipImpulseRef.current -= degreesPerMs * 2.15;
    }
    if (Math.abs(skipImpulseRef.current) > 0) wakeLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipDirection, skipNonce, degreesPerMs]);

  useEffect(() => {
    return () => {
      cancelLoop();
      clearPauseStopTimer();
    };
  }, []);
}
