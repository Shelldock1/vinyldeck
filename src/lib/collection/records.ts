// src/lib/collection/records.ts
// Pure collection rules shared by the browser fallback and the UI.
// The Tauri backend implements the same press/play rules in Rust.

import type {
  CollectedRecord,
  PressInput,
  PressResult,
  RarityTier,
} from "./types";

const RARITY_BY_RECIPE: Record<string, RarityTier> = {
  "marble-blend": "common",
  splatter: "common",
  "opaque-solid": "uncommon",
  merge: "uncommon",
  "clear-tint": "rare",
  "color-in-color": "rare",
  "smoke-clear": "rare",
  galaxy: "legendary",
  "audiophile-black": "legendary",
};

export const RARITY_ORDER: RarityTier[] = [
  "common",
  "uncommon",
  "rare",
  "legendary",
];

/** Plays at which wear reaches ~63% (1 - 1/e). */
const WEAR_PLAYS = 24;

/** Shared identity with the backend: artist + (album or track), lowercase. */
export function recordKey(
  artist: string,
  album: string,
  track = "",
): string | null {
  const title = (album.trim() || track.trim()).toLowerCase();
  if (!title) return null;
  return `${artist.trim().toLowerCase()}|${title}`;
}

export function rarityFor(recipe: string | null): RarityTier {
  return (recipe && RARITY_BY_RECIPE[recipe]) || "common";
}

export function rarityRank(recipe: string | null): number {
  return RARITY_ORDER.indexOf(rarityFor(recipe));
}

/** 0 = factory fresh, approaches 1 for a well-loved record. */
export function wearFor(playCount: number): number {
  if (!Number.isFinite(playCount) || playCount <= 0) return 0;
  return 1 - Math.exp(-playCount / WEAR_PLAYS);
}

export function formatPressingNumber(value: number): string {
  return `No. ${String(Math.max(0, Math.floor(value))).padStart(3, "0")}`;
}

function nextPressingNumber(records: CollectedRecord[]): number {
  return records.reduce((max, record) => Math.max(max, record.pressingNumber), 0) + 1;
}

export function pressInto(
  records: CollectedRecord[],
  input: PressInput,
  now: number,
): PressResult | null {
  const key = recordKey(input.artist, input.album);
  if (!key) return null;

  const existing = records.find((record) => record.key === key);
  if (existing) {
    const newlyPressed = existing.recipe === null;
    if (newlyPressed) {
      existing.recipe = input.recipe;
      existing.pressingType = input.pressingType;
      existing.pressingName = input.pressingName;
      existing.colors = input.colors;
    }
    existing.thumbnail ??= input.thumbnail;
    return { record: { ...existing }, newlyPressed };
  }

  const record: CollectedRecord = {
    key,
    album: input.album.trim(),
    artist: input.artist.trim(),
    pressingNumber: nextPressingNumber(records),
    firstPressedAt: now,
    lastPlayedAt: null,
    playCount: 0,
    recipe: input.recipe,
    pressingType: input.pressingType,
    pressingName: input.pressingName,
    colors: input.colors,
    thumbnail: input.thumbnail,
  };
  records.push(record);
  return { record: { ...record }, newlyPressed: true };
}

export function countPlayInto(
  records: CollectedRecord[],
  artist: string,
  album: string,
  track: string,
  now: number,
): CollectedRecord | null {
  const key = recordKey(artist, album, track);
  if (!key) return null;

  const existing = records.find((record) => record.key === key);
  if (existing) {
    existing.playCount += 1;
    existing.lastPlayedAt = now;
    return { ...existing };
  }

  const record: CollectedRecord = {
    key,
    album: (album.trim() || track.trim()),
    artist: artist.trim(),
    pressingNumber: nextPressingNumber(records),
    firstPressedAt: now,
    lastPlayedAt: now,
    playCount: 1,
    recipe: null,
    pressingType: null,
    pressingName: null,
    colors: null,
    thumbnail: null,
  };
  records.push(record);
  return { ...record };
}

export function isCollectedRecord(value: unknown): value is CollectedRecord {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.key === "string" &&
    raw.key.length > 0 &&
    typeof raw.album === "string" &&
    typeof raw.artist === "string" &&
    typeof raw.pressingNumber === "number" &&
    typeof raw.firstPressedAt === "number" &&
    typeof raw.playCount === "number"
  );
}

// ── Listen tracking (browser fallback; Tauri counts in the Rust poller) ──

const MIN_TRACK_SECONDS = 30;
const MAX_THRESHOLD_SECONDS = 120;
const MAX_TICK_MS = 2000;

export interface ListenSample {
  id: string;
  isPlaying: boolean;
  duration: number;
}

export class ListenTracker {
  private id: string | null = null;
  private listenedMs = 0;
  private counted = false;
  private lastTick = 0;

  /** Returns true exactly once per track instance when the play counts. */
  observe(sample: ListenSample | null, now: number): boolean {
    if (!sample) {
      this.id = null;
      return false;
    }
    if (sample.id !== this.id) {
      this.id = sample.id;
      this.listenedMs = 0;
      this.counted = false;
      this.lastTick = now;
    }

    const tick = now - this.lastTick;
    this.lastTick = now;
    if (sample.isPlaying && tick >= 0 && tick <= MAX_TICK_MS) {
      this.listenedMs += tick;
    }

    if (this.counted) return false;
    const threshold = listenThresholdSeconds(sample.duration);
    if (threshold === null || this.listenedMs / 1000 < threshold) return false;
    this.counted = true;
    return true;
  }
}

export function listenThresholdSeconds(duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return MAX_THRESHOLD_SECONDS;
  if (duration < MIN_TRACK_SECONDS) return null;
  return Math.min(duration / 2, MAX_THRESHOLD_SECONDS);
}
