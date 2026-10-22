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
  rpm?: number; // default 33.33
  skipDirection?: TrackChangeDirection;
  skipNonce?: number;
  onFrame?: (frame: VinylRotationFrame) => void;
}

export function useVinylRotation({
  isPlaying,
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

  function wakeLoop() {
    if (rafRef.current === null) {
      lastTimestampRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  function tick(timestamp: number) {
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
    if (isPlaying || Math.abs(velocityRef.current) > 0.0001) wakeLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, degreesPerMs]);

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
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTimestampRef.current = null;
      }
    };
  }, []);
}
