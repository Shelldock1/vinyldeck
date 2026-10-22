import { isTauri } from "@tauri-apps/api/core";
import { createMockSource } from "./mockSource";
import { createTauriSource } from "./tauriSource";
import type { PlaybackSource } from "./types";

export function isForceMockSourceEnabled(
  value = import.meta.env.VITE_FORCE_MOCK_SOURCE,
): boolean {
  return value === "true";
}

export function createPlaybackSource(): PlaybackSource {
  if (isTauri() && !isForceMockSourceEnabled()) {
    return createTauriSource();
  }

  return createMockSource();
}
