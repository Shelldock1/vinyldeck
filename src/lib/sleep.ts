// Sleep timer adapter.
//
// The timer itself is backend-owned and ephemeral: starting or cancelling it
// here only asks Rust, and Rust emits the resulting state. Browser development
// has no backend, so a local timer mirrors the same contract so the Settings
// and context-menu states can still be inspected.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useVinylDeckStore } from "./playback/store";
import { logger } from "./logger";

export const SLEEP_TIMER_START_COMMAND = "cmd_sleep_timer_start";
export const SLEEP_TIMER_CANCEL_COMMAND = "cmd_sleep_timer_cancel";
export const SLEEP_TIMER_SNAPSHOT_COMMAND = "cmd_sleep_timer_snapshot";
export const SLEEP_TIMER_CHANGED_EVENT = "sleep-timer-changed";
export const SLEEP_TIMER_FIRED_EVENT = "sleep-timer-fired";

export const SLEEP_MINUTE_OPTIONS = [15, 30, 45, 60] as const;
export const MIN_SLEEP_MINUTES = 5;
export const MAX_SLEEP_MINUTES = 240;
const BROWSER_END_OF_TRACK_POLL_MS = 500;

export type SleepTimerMode = "minutes" | "endOfTrack";

export interface SleepTimerSnapshot {
  mode: SleepTimerMode;
  /** Unix milliseconds for minute timers; `null` for end-of-track. */
  endsAt: number | null;
  /** Track title captured at start; `null` for minute timers. */
  track: string | null;
}

export interface SleepTimerFired {
  mode: SleepTimerMode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSleepTimerMode(value: unknown): value is SleepTimerMode {
  return value === "minutes" || value === "endOfTrack";
}

/** Epoch milliseconds must be a safe positive integer before we do math on it. */
export function isEpochMillis(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isValidSleepMinutes(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_SLEEP_MINUTES &&
    value <= MAX_SLEEP_MINUTES
  );
}

export function isSleepTimerSnapshot(value: unknown): value is SleepTimerSnapshot {
  if (!isRecord(value) || !isSleepTimerMode(value.mode)) return false;
  if (value.track !== null && typeof value.track !== "string") return false;

  if (value.mode === "minutes") return isEpochMillis(value.endsAt);
  return value.endsAt === null;
}

export function normalizeSleepTimer(value: unknown): SleepTimerSnapshot | null {
  if (value === null || value === undefined) return null;
  if (!isSleepTimerSnapshot(value)) return null;

  return {
    mode: value.mode,
    endsAt: value.mode === "minutes" ? value.endsAt : null,
    track: value.track || null,
  };
}

export function isSleepTimerFired(value: unknown): value is SleepTimerFired {
  return isRecord(value) && isSleepTimerMode(value.mode);
}

export function normalizeSleepTimerFired(
  value: unknown,
): SleepTimerFired | null {
  return isSleepTimerFired(value) ? { mode: value.mode } : null;
}

/** Whole minutes left, rounded up; `null` when no minute timer is running. */
export function sleepRemainingMinutes(
  snapshot: SleepTimerSnapshot | null,
  now = Date.now(),
): number | null {
  if (!snapshot || snapshot.mode !== "minutes" || snapshot.endsAt === null) {
    return null;
  }
  return Math.max(0, Math.ceil((snapshot.endsAt - now) / 60_000));
}

/** Compact status line for the mono metadata row in Settings. */
export function formatSleepTimerStatus(
  snapshot: SleepTimerSnapshot | null,
  now = Date.now(),
): string {
  if (!snapshot) return "Off";

  if (snapshot.mode === "endOfTrack") {
    return snapshot.track ? `After ${snapshot.track}` : "After this track";
  }

  const remaining = sleepRemainingMinutes(snapshot, now);
  if (remaining === null) return "Off";
  if (remaining <= 0) return "Pausing now";
  return `${remaining} min left`;
}

// ── Browser development fallback ──────────────────────────────
type BrowserTimer = {
  snapshot: SleepTimerSnapshot;
  timeout: ReturnType<typeof setTimeout> | null;
  interval: ReturnType<typeof setInterval> | null;
};

let browserTimer: BrowserTimer | null = null;
const changedListeners = new Set<(snapshot: SleepTimerSnapshot | null) => void>();
const firedListeners = new Set<(event: SleepTimerFired) => void>();

function notifyChanged(snapshot: SleepTimerSnapshot | null) {
  changedListeners.forEach((listener) => listener(snapshot));
}

function notifyFired(event: SleepTimerFired) {
  firedListeners.forEach((listener) => listener(event));
}

function clearBrowserTimer(): SleepTimerSnapshot | null {
  if (!browserTimer) return null;
  if (browserTimer.timeout) clearTimeout(browserTimer.timeout);
  if (browserTimer.interval) clearInterval(browserTimer.interval);
  const snapshot = browserTimer.snapshot;
  browserTimer = null;
  return snapshot;
}

function fireBrowserTimer() {
  const snapshot = clearBrowserTimer();
  if (!snapshot) return;

  // The real backend pauses before it emits; mirror that order so the mock
  // deck is already stopping when the tonearm parks.
  useVinylDeckStore.getState().source?.pause();
  notifyChanged(null);
  notifyFired({ mode: snapshot.mode });
}

function trackKeyOf(state: {
  track: string;
  artist: string;
  album: string;
}): string {
  return `${state.track}|${state.artist}|${state.album}`;
}

async function startBrowserSleepTimer(
  mode: SleepTimerMode,
  minutes?: number,
): Promise<SleepTimerSnapshot> {
  const playback = useVinylDeckStore.getState().playback;
  clearBrowserTimer();

  if (mode === "minutes") {
    if (!isValidSleepMinutes(minutes)) {
      throw new Error(
        `Sleep timer minutes must be between ${MIN_SLEEP_MINUTES} and ${MAX_SLEEP_MINUTES}`,
      );
    }

    const snapshot: SleepTimerSnapshot = {
      mode,
      endsAt: Date.now() + minutes * 60_000,
      track: null,
    };
    browserTimer = {
      snapshot,
      timeout: setTimeout(fireBrowserTimer, minutes * 60_000),
      interval: null,
    };
    notifyChanged(snapshot);
    return snapshot;
  }

  if (!playback.track) throw new Error("Nothing is playing");

  const snapshot: SleepTimerSnapshot = {
    mode,
    endsAt: null,
    track: playback.track,
  };
  const baselineKey = trackKeyOf(playback);
  const baselineWasPlaying = playback.isPlaying;
  browserTimer = {
    snapshot,
    timeout: null,
    interval: setInterval(() => {
      const current = useVinylDeckStore.getState().playback;
      const changed =
        trackKeyOf(current) !== baselineKey ||
        (baselineWasPlaying && !current.isPlaying);
      if (changed) fireBrowserTimer();
    }, BROWSER_END_OF_TRACK_POLL_MS),
  };
  notifyChanged(snapshot);
  return snapshot;
}

// ── Public API ────────────────────────────────────────────────

/** Starts a timer and returns the backend's active snapshot. */
export async function startSleepTimer(
  mode: SleepTimerMode,
  minutes?: number,
): Promise<SleepTimerSnapshot> {
  if (!isTauri()) return startBrowserSleepTimer(mode, minutes);

  const raw = await invoke<unknown>(SLEEP_TIMER_START_COMMAND, {
    mode,
    minutes: mode === "minutes" ? minutes ?? null : null,
  });
  const snapshot = normalizeSleepTimer(raw);
  if (!snapshot || snapshot.mode !== mode) {
    throw new Error("Invalid sleep timer response");
  }
  return snapshot;
}

/** Cancels any timer. Safe to call when nothing is running. */
export async function cancelSleepTimer(): Promise<null> {
  if (!isTauri()) {
    if (clearBrowserTimer()) notifyChanged(null);
    return null;
  }

  await invoke(SLEEP_TIMER_CANCEL_COMMAND);
  return null;
}

export async function getSleepTimer(): Promise<SleepTimerSnapshot | null> {
  if (!isTauri()) return browserTimer?.snapshot ?? null;

  try {
    const raw = await invoke<unknown>(SLEEP_TIMER_SNAPSHOT_COMMAND);
    if (raw !== null && !isSleepTimerSnapshot(raw)) {
      logger.warn("[SleepTimer] Snapshot payload rejected:", raw);
      return null;
    }
    return normalizeSleepTimer(raw);
  } catch (error) {
    logger.warn("[SleepTimer] Snapshot failed:", error);
    return null;
  }
}

export async function subscribeToSleepTimer(
  callback: (snapshot: SleepTimerSnapshot | null) => void,
): Promise<() => void> {
  if (!isTauri()) {
    changedListeners.add(callback);
    return () => changedListeners.delete(callback);
  }

  return listen<unknown>(SLEEP_TIMER_CHANGED_EVENT, ({ payload }) => {
    if (payload !== null && !isSleepTimerSnapshot(payload)) {
      logger.warn("[SleepTimer] Changed payload rejected:", payload);
      return;
    }
    callback(normalizeSleepTimer(payload));
  });
}

export async function subscribeToSleepTimerFired(
  callback: (event: SleepTimerFired) => void,
): Promise<() => void> {
  if (!isTauri()) {
    firedListeners.add(callback);
    return () => firedListeners.delete(callback);
  }

  return listen<unknown>(SLEEP_TIMER_FIRED_EVENT, ({ payload }) => {
    const event = normalizeSleepTimerFired(payload);
    if (!event) {
      logger.warn("[SleepTimer] Fired payload rejected:", payload);
      return;
    }
    callback(event);
  });
}

/** Test-only reset for the browser fallback. */
export function resetBrowserSleepTimerForTests() {
  clearBrowserTimer();
  changedListeners.clear();
  firedListeners.clear();
}
