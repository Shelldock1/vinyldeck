import { invoke, isTauri } from "@tauri-apps/api/core";
import { useVinylDeckStore } from "../playback/store";
import type { RepeatMode } from "../playback/types";

export const MEDIA_SET_REPEAT_COMMAND = "cmd_media_set_repeat";
export const MEDIA_SET_SHUFFLE_COMMAND = "cmd_media_set_shuffle";

export function isRepeatMode(value: unknown): value is RepeatMode {
  return value === "off" || value === "all" || value === "one";
}

/** Shuffle/repeat lever cycle: off -> all -> one -> off. */
export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  if (mode === "off") return "all";
  if (mode === "all") return "one";
  return "off";
}

/**
 * Sends the repeat choice to the Rust media bridge. The store is refreshed by
 * the next authority poll, never by optimistic local state, so a source that
 * silently ignores the write cannot leave the UI lying.
 */
export async function setRepeatMode(mode: RepeatMode): Promise<void> {
  if (!isRepeatMode(mode)) return;

  // Browser development has no native media session; the mock keeps the
  // mode locally so the levers still move.
  if (!isTauri()) {
    useVinylDeckStore.getState().source?.setRepeatMode?.(mode);
    return;
  }

  try {
    await invoke(MEDIA_SET_REPEAT_COMMAND, { mode });
  } catch (error) {
    console.warn(`[MediaControls] ${MEDIA_SET_REPEAT_COMMAND} failed:`, error);
  }
}

export async function setShuffle(enabled: boolean): Promise<void> {
  if (!isTauri()) {
    useVinylDeckStore.getState().source?.setShuffle?.(enabled);
    return;
  }

  try {
    await invoke(MEDIA_SET_SHUFFLE_COMMAND, { enabled });
  } catch (error) {
    console.warn(`[MediaControls] ${MEDIA_SET_SHUFFLE_COMMAND} failed:`, error);
  }
}
