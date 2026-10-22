// src/hooks/useIdleMode.ts
// Lean-back idle mode — 3s timer, resets on any mouse activity.
// Rules:
//   - Only idles when isPlaying === true (paused/empty = never idle)
//   - isIdle resets immediately on any mousemove or mousedown
//   - Cursor hidden when idle, restored on first mousemove

import { useEffect, useRef, useState, useCallback } from "react";

const IDLE_TIMEOUT_MS = 3000;

interface IdleModeOptions {
  enabled?: boolean;
  hideCursor?: boolean;
  timeoutMs?: number;
}

export function useIdleMode(isPlaying: boolean, options: IdleModeOptions = {}): boolean {
  const enabled = options.enabled ?? true;
  const hideCursor = options.hideCursor ?? true;
  const timeoutMs = options.timeoutMs ?? IDLE_TIMEOUT_MS;
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef = useRef(false); // mirror for use inside event handlers

  const resetIdle = useCallback(() => {
    // Restore cursor on first activity after going idle
    if (idleRef.current) {
      if (hideCursor) document.body.style.cursor = "";
      idleRef.current = false;
      setIsIdle(false);
    }

    // Clear existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Only set a new timer if currently playing
    if (!isPlaying || !enabled) return;

    timerRef.current = setTimeout(() => {
      idleRef.current = true;
      setIsIdle(true);
      if (hideCursor) document.body.style.cursor = "none";
    }, timeoutMs);
  }, [enabled, hideCursor, isPlaying, timeoutMs]);

  useEffect(() => {
    // If playback stops while idle — immediately come out of idle
    if (!isPlaying || !enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (idleRef.current) {
        if (hideCursor) document.body.style.cursor = "";
        idleRef.current = false;
        setIsIdle(false);
      }
      return;
    }

    // Start listening — reset timer on any activity
    window.addEventListener("mousemove", resetIdle, { passive: true });
    window.addEventListener("mousedown", resetIdle, { passive: true });

    // Kick off the first timer
    resetIdle();

    return () => {
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("mousedown", resetIdle);
      if (timerRef.current) clearTimeout(timerRef.current);
      // Always restore cursor on cleanup
      if (hideCursor) document.body.style.cursor = "";
    };
  }, [enabled, hideCursor, isPlaying, resetIdle]);

  return isIdle;
}
