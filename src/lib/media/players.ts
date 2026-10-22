import { invoke, isTauri } from "@tauri-apps/api/core";

export const MEDIA_PLAYERS_COMMAND = "cmd_media_players";

export interface MediaPlayer {
  /** Stable platform session handle (MPRIS bus name / SMTC AUMID). */
  id: string;
  /** Human-readable app name used when the player is not running. */
  name: string;
  isPlaying: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isMediaPlayer(value: unknown): value is MediaPlayer {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    typeof value.isPlaying === "boolean"
  );
}

/**
 * Validates and orders the backend list: playing sessions first, then by
 * display name. Duplicate ids collapse to the first entry.
 */
export function normalizeMediaPlayers(value: unknown): MediaPlayer[] {
  if (!Array.isArray(value)) return [];

  const unique: MediaPlayer[] = [];
  for (const entry of value) {
    if (!isMediaPlayer(entry)) continue;
    if (unique.some((player) => player.id === entry.id)) continue;
    unique.push({
      id: entry.id,
      name: entry.name || entry.id,
      isPlaying: entry.isPlaying,
    });
  }

  return unique.sort((left, right) => {
    if (left.isPlaying !== right.isPlaying) return left.isPlaying ? -1 : 1;
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
  });
}

/** Browser development has no native media sessions. */
export async function listMediaPlayers(): Promise<MediaPlayer[]> {
  if (!isTauri()) return [];

  try {
    return normalizeMediaPlayers(
      await invoke<unknown>(MEDIA_PLAYERS_COMMAND),
    );
  } catch (error) {
    console.warn("[MediaPlayers] List failed:", error);
    return [];
  }
}
