// Subscribes to the backend's system-audio analysis and writes the smoothed
// bands onto the document as CSS custom properties. No React state: the meter
// and the vinyl/tonearm effects are pure CSS consumers, so 30 events a second
// never re-render the tree.

import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { logger } from "../lib/logger";

export const AUDIO_REACTIVITY_EVENT = "audio-reactivity";

export interface AudioReactivity {
  level: number;
  bass: number;
  mid: number;
  treble: number;
}

const BANDS = ["level", "bass", "mid", "treble"] as const;

export const SILENT_REACTIVITY: AudioReactivity = {
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
};

function unit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(Math.max(value, 0), 1);
}

export function parseAudioReactivity(payload: unknown): AudioReactivity | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const level = unit(record.level);
  const bass = unit(record.bass);
  const mid = unit(record.mid);
  const treble = unit(record.treble);
  if (level === null || bass === null || mid === null || treble === null) {
    return null;
  }
  return { level, bass, mid, treble };
}

export function applyAudioReactivity(levels: AudioReactivity): void {
  const style = document.documentElement.style;
  for (const band of BANDS) {
    style.setProperty(`--audio-${band}`, levels[band].toFixed(3));
  }
}

export function useAudioReactivity(): void {
  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<unknown>(AUDIO_REACTIVITY_EVENT, (event) => {
      const levels = parseAudioReactivity(event.payload);
      if (levels) applyAudioReactivity(levels);
    })
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((error) => {
        logger.warn("[AudioReactivity] subscribe failed:", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
      applyAudioReactivity(SILENT_REACTIVITY);
    };
  }, []);
}
