import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EMPTY_PLAYBACK } from "./store";
import type { PlaybackSource, PlaybackState } from "./types";

const MEDIA_SNAPSHOT_EVENT = "media-state-changed";
const SMTC_SNAPSHOT_COMMAND = "cmd_smtc_snapshot";
const COMMAND_ERROR_LOG_INTERVAL_MS = 5_000;

export interface BackendMediaSnapshot {
  track: string;
  artist: string;
  album: string;
  artworkDataUrl: string | null;
  duration: number;
  position: number;
  isPlaying: boolean;
  sourceName: string;
  sourceId: string;
  canSeek: boolean;
  canSkip: boolean;
  canControl: boolean;
}

type MediaCommand =
  | "cmd_smtc_play"
  | "cmd_smtc_pause"
  | "cmd_smtc_toggle_play_pause"
  | "cmd_smtc_next"
  | "cmd_smtc_previous"
  | "cmd_smtc_seek";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

export function isBackendMediaSnapshot(value: unknown): value is BackendMediaSnapshot {
  if (!isRecord(value)) return false;

  return (
    typeof value.track === "string" &&
    typeof value.artist === "string" &&
    typeof value.album === "string" &&
    isNullableString(value.artworkDataUrl) &&
    isNonNegativeFiniteNumber(value.duration) &&
    isNonNegativeFiniteNumber(value.position) &&
    typeof value.isPlaying === "boolean" &&
    typeof value.sourceName === "string" &&
    typeof value.sourceId === "string" &&
    typeof value.canSeek === "boolean" &&
    typeof value.canSkip === "boolean" &&
    typeof value.canControl === "boolean"
  );
}

export function mapBackendMediaSnapshot(
  snapshot: BackendMediaSnapshot | null | undefined,
): PlaybackState {
  if (!snapshot) return EMPTY_PLAYBACK;

  return {
    track: snapshot.track,
    artist: snapshot.artist,
    album: snapshot.album,
    artworkDataUrl: snapshot.artworkDataUrl,
    duration: snapshot.duration,
    position: snapshot.position,
    isPlaying: snapshot.isPlaying,
    sourceName: snapshot.sourceName,
    sourceId: snapshot.sourceId,
    canSeek: snapshot.canSeek,
    canSkip: snapshot.canSkip,
    canControl: snapshot.canControl,
  };
}

function parseBackendMediaSnapshot(payload: unknown): PlaybackState {
  if (payload === null || payload === undefined) return EMPTY_PLAYBACK;
  if (!isBackendMediaSnapshot(payload)) {
    throw new Error("Invalid backend media snapshot payload");
  }

  return mapBackendMediaSnapshot(payload);
}

export function createTauriSource(): PlaybackSource {
  let currentState = EMPTY_PLAYBACK;
  let started = false;
  const listeners = new Set<(state: PlaybackState) => void>();
  const unlisteners: Array<() => void> = [];
  const commandErrors = new Map<MediaCommand, { lastLoggedAt: number; suppressed: number }>();

  function notify(state: PlaybackState) {
    currentState = state;
    listeners.forEach((listener) => listener(state));
  }

  function notifyFromBackendPayload(payload: unknown, context: string) {
    try {
      notify(parseBackendMediaSnapshot(payload));
    } catch (error) {
      console.warn(`[TauriSource] ${context} payload rejected:`, error);
    }
  }

  function releaseUnlisteners() {
    while (unlisteners.length > 0) {
      try {
        unlisteners.pop()?.();
      } catch (error) {
        console.warn("[TauriSource] event unlisten failed:", error);
      }
    }
  }

  function retainUnlistener(unlisten: () => void): boolean {
    if (!started) {
      unlisten();
      return false;
    }

    unlisteners.push(unlisten);
    return true;
  }

  function warnCommandError(command: MediaCommand, error: unknown) {
    const now = Date.now();
    const previous = commandErrors.get(command);
    if (previous && now - previous.lastLoggedAt < COMMAND_ERROR_LOG_INTERVAL_MS) {
      previous.suppressed += 1;
      return;
    }

    const suppressed = previous?.suppressed ?? 0;
    commandErrors.set(command, { lastLoggedAt: now, suppressed: 0 });
    const suffix = suppressed > 0 ? ` (${suppressed} repeats suppressed)` : "";
    console.warn(`[TauriSource] ${command} failed${suffix}:`, error);
  }

  function invokeCommand(command: MediaCommand, args?: Record<string, unknown>) {
    if (!isTauri()) return;
    void invoke<unknown>(command, args).catch((error) => warnCommandError(command, error));
  }

  return {
    getState() {
      return currentState;
    },

    async start() {
      if (!isTauri() || started) return;
      started = true;

      try {
        const unlistenSnapshot = await listen<unknown>(
          MEDIA_SNAPSHOT_EVENT,
          ({ payload }) => notifyFromBackendPayload(payload, MEDIA_SNAPSHOT_EVENT),
        );
        if (!retainUnlistener(unlistenSnapshot)) return;
      } catch (error) {
        started = false;
        releaseUnlisteners();
        console.warn(`[TauriSource] ${MEDIA_SNAPSHOT_EVENT} listener failed:`, error);
        return;
      }

      try {
        const payload = await invoke<unknown>(SMTC_SNAPSHOT_COMMAND);
        if (started) notify(parseBackendMediaSnapshot(payload));
      } catch (error) {
        console.warn(`[TauriSource] ${SMTC_SNAPSHOT_COMMAND} failed:`, error);
      }
    },

    stop() {
      started = false;
      releaseUnlisteners();
      listeners.clear();
    },

    onStateChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    play() {
      invokeCommand("cmd_smtc_play");
    },

    pause() {
      invokeCommand("cmd_smtc_pause");
    },

    togglePlayPause() {
      invokeCommand("cmd_smtc_toggle_play_pause");
    },

    next() {
      invokeCommand("cmd_smtc_next");
    },

    previous() {
      invokeCommand("cmd_smtc_previous");
    },

    seekTo(seconds: number) {
      if (!Number.isFinite(seconds) || seconds < 0) return;
      invokeCommand("cmd_smtc_seek", { seconds });
    },
  };
}
