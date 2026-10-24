// src/lib/collection/records.ts
// Pure collection rules shared by the browser fallback and the UI.
// The Tauri backend implements the same press/play rules in Rust.

import type {
  CollectedRecord,
  CrateSource,
  PressInput,
  PressResult,
  RarityTier,
  SourceKind,
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

/** Mirrors `source_kind` in src-tauri/src/media/model.rs. */
const BROWSER_MARKERS = [
  "chrome",
  "chromium",
  "firefox",
  "msedge",
  "microsoftedge",
  "brave",
  "opera",
  "vivaldi",
  "yandex",
  "librewolf",
  "waterfox",
  "floorp",
  "zen",
  "epiphany",
  "falkon",
  "plasma-browser-integration",
  "safari",
  "arc",
];

export function sourceKindFor(sourceId: string, sourceName: string): SourceKind {
  const words = `${sourceId} ${sourceName}`.toLowerCase().split(/[^a-z0-9-]+/);
  const isBrowser = words.some((word) =>
    BROWSER_MARKERS.some(
      (marker) =>
        word === marker || (marker.length > 4 && word.startsWith(marker)),
    ),
  );
  return isBrowser ? "browser" : "app";
}

/** Same rule as the backend: a music app tag is sticky. */
function applySource(
  record: CollectedRecord,
  sourceId: string,
  sourceName: string,
) {
  if (!sourceId.trim() && !sourceName.trim()) return;
  if (record.sourceKind !== "app") {
    record.sourceKind = sourceKindFor(sourceId, sourceName);
  }
  if (sourceName.trim()) record.sourceName = sourceName.trim();
}

/** Untagged legacy records only show under "all". */
export function filterBySource(
  records: readonly CollectedRecord[],
  source: CrateSource,
): CollectedRecord[] {
  if (source === "all") return [...records];
  return records.filter((record) => record.sourceKind === source);
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

// ── Shelf view helpers (search, sort, stats) ──────────────────
// Pure functions so the Crate UI stays declarative and the rules are
// testable without a browser. Nothing here mutates the collection.

export type CrateSort = "recent" | "plays" | "rarity" | "number" | "alpha";

export interface CrateStats {
  totalRecords: number;
  totalPlays: number;
  /** Most played; ties go to the most recently played pressing. */
  topAlbum: CollectedRecord | null;
  /** Consecutive calendar days with at least one counted play. */
  streak: number;
}

/** Last time this pressing was touched; first press when never played. */
function lastTouchedAt(record: CollectedRecord): number {
  return record.lastPlayedAt ?? record.firstPressedAt;
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

/**
 * Case-insensitive search across artist, album, and pressing name.
 * A blank query returns the shelf untouched.
 */
export function filterRecords(
  records: readonly CollectedRecord[],
  query: string,
): CollectedRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...records];

  return records.filter((record) => {
    if (record.artist.toLowerCase().includes(needle)) return true;
    if (record.album.toLowerCase().includes(needle)) return true;
    return Boolean(record.pressingName?.toLowerCase().includes(needle));
  });
}

export function sortRecords(
  records: readonly CollectedRecord[],
  sort: CrateSort,
): CollectedRecord[] {
  const sorted = [...records];
  switch (sort) {
    case "recent":
      return sorted.sort(
        (a, b) =>
          lastTouchedAt(b) - lastTouchedAt(a) ||
          a.pressingNumber - b.pressingNumber,
      );
    case "plays":
      return sorted.sort(
        (a, b) =>
          b.playCount - a.playCount ||
          lastTouchedAt(b) - lastTouchedAt(a) ||
          a.pressingNumber - b.pressingNumber,
      );
    case "rarity":
      return sorted.sort(
        (a, b) =>
          rarityRank(b.recipe) - rarityRank(a.recipe) ||
          b.playCount - a.playCount ||
          lastTouchedAt(b) - lastTouchedAt(a) ||
          a.pressingNumber - b.pressingNumber,
      );
    case "number":
      return sorted.sort((a, b) => a.pressingNumber - b.pressingNumber);
    case "alpha":
      return sorted.sort(
        (a, b) =>
          compareText(
            a.artist.trim() || "Unknown artist",
            b.artist.trim() || "Unknown artist",
          ) ||
          compareText(a.album, b.album) ||
          a.pressingNumber - b.pressingNumber,
      );
  }
}

const DAY_MS = 86_400_000;

/** Stable local-calendar day index (DST-safe: built from Y/M/D, not hours). */
function localDayIndex(timestamp: number): number {
  const date = new Date(timestamp);
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  );
}

/**
 * Consecutive days with a play, anchored to today when today already has a
 * play, otherwise to yesterday so an evening streak survives the morning.
 * Missing the last two days breaks the streak.
 *
 * `playTimes` is the backend play history (every counted listen). A record's
 * `lastPlayedAt` only remembers its latest day, so without the history one
 * album played every day would count as a one-day streak.
 */
export function collectionStreak(
  records: readonly CollectedRecord[],
  now: number = Date.now(),
  playTimes: readonly number[] = [],
): number {
  const days = new Set<number>();
  const addDay = (timestamp: number | null) => {
    if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
      days.add(localDayIndex(timestamp));
    }
  };
  for (const record of records) addDay(record.lastPlayedAt);
  for (const timestamp of playTimes) addDay(timestamp);

  const today = localDayIndex(now);
  let cursor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (cursor === null) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

export function collectionStats(
  records: readonly CollectedRecord[],
  now: number = Date.now(),
  playTimes: readonly number[] = [],
): CrateStats {
  let totalPlays = 0;
  let topAlbum: CollectedRecord | null = null;

  for (const record of records) {
    totalPlays += record.playCount;
    if (record.playCount <= 0) continue;

    if (!topAlbum) {
      topAlbum = record;
      continue;
    }

    const morePlays = record.playCount - topAlbum.playCount;
    const moreRecent = lastTouchedAt(record) - lastTouchedAt(topAlbum);
    if (
      morePlays > 0 ||
      (morePlays === 0 &&
        (moreRecent > 0 ||
          (moreRecent === 0 &&
            record.pressingNumber < topAlbum.pressingNumber)))
    ) {
      topAlbum = record;
    }
  }

  return {
    totalRecords: records.length,
    totalPlays,
    topAlbum,
    streak: collectionStreak(records, now, playTimes),
  };
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
    applySource(existing, input.sourceId, input.sourceName);
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
  applySource(record, input.sourceId, input.sourceName);
  records.push(record);
  return { record: { ...record }, newlyPressed: true };
}

export function countPlayInto(
  records: CollectedRecord[],
  artist: string,
  album: string,
  track: string,
  now: number,
  source: { id: string; name: string } = { id: "", name: "" },
): CollectedRecord | null {
  const key = recordKey(artist, album, track);
  if (!key) return null;

  const existing = records.find((record) => record.key === key);
  if (existing) {
    existing.playCount += 1;
    existing.lastPlayedAt = now;
    applySource(existing, source.id, source.name);
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
  applySource(record, source.id, source.name);
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
/** A backward position jump larger than this is a restart, not resync jitter. */
const RESTART_JUMP_SECONDS = 3;
/** Resuming playback this close to the start is a restart. */
const RESTART_START_SECONDS = 3;

export interface ListenSample {
  id: string;
  isPlaying: boolean;
  duration: number;
  position: number;
}

export class ListenTracker {
  private id: string | null = null;
  private listenedMs = 0;
  private counted = false;
  private lastTick = 0;
  private lastPosition = 0;
  private wasPlaying = false;

  /**
   * Returns true exactly once per track instance when the play counts. A
   * restart (repeat-one loop, seeking back, resuming from the start) begins a
   * new instance.
   */
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
      this.lastPosition = sample.position;
      this.wasPlaying = sample.isPlaying;
    }

    if (this.isRestart(sample)) {
      this.listenedMs = 0;
      this.counted = false;
    }
    this.lastPosition = sample.position;
    this.wasPlaying = sample.isPlaying;

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

  private isRestart(sample: ListenSample): boolean {
    if (!Number.isFinite(sample.position) || !Number.isFinite(this.lastPosition)) return false;
    const jumpedBack = this.lastPosition - sample.position > RESTART_JUMP_SECONDS;
    const resumedAtStart =
      !this.wasPlaying && sample.isPlaying && sample.position < RESTART_START_SECONDS;
    return jumpedBack || resumedAtStart;
  }
}

export function listenThresholdSeconds(duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) return MAX_THRESHOLD_SECONDS;
  if (duration < MIN_TRACK_SECONDS) return null;
  return Math.min(duration / 2, MAX_THRESHOLD_SECONDS);
}
