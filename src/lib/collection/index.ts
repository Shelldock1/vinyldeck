// src/lib/collection/index.ts
// The Crate adapter. In Tauri the Rust backend owns the collection: it
// persists records, numbers pressings, and counts plays from the media poller.
// WebViews only press (supply the visual identity) and read. In the browser
// dev build a localStorage fallback runs the same rules from ./records.

import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { countPlayInto, isCollectedRecord, pressInto } from "./records";
import type { CollectedRecord, PressInput, PressResult } from "./types";
import { logger } from "../logger";

export const COLLECTION_CHANGED_EVENT = "collection-changed";
/** Payload: keys of the records removed from the Crate. */
export const COLLECTION_REMOVED_EVENT = "collection-removed";

const BROWSER_STORAGE_KEY = "vinyldeck:crate:v1";

interface CrateStore {
  records: Record<string, CollectedRecord>;
  loaded: boolean;
  /** Most recent first pressing seen by this window, for the stamp reveal. */
  lastNewPressing: { key: string; at: number } | null;
  replaceAll: (records: CollectedRecord[]) => void;
  upsert: (record: CollectedRecord) => void;
  removeMany: (keys: string[]) => void;
  markNewPressing: (key: string) => void;
}

export const useCrateStore = create<CrateStore>((set) => ({
  records: {},
  loaded: false,
  lastNewPressing: null,
  replaceAll: (records) =>
    set({
      loaded: true,
      records: Object.fromEntries(records.map((record) => [record.key, record])),
    }),
  upsert: (record) =>
    set((state) => ({ records: { ...state.records, [record.key]: record } })),
  removeMany: (keys) =>
    set((state) => {
      const records = { ...state.records };
      for (const key of keys) delete records[key];
      return { records };
    }),
  markNewPressing: (key) =>
    set({ lastNewPressing: { key, at: Date.now() } }),
}));

/** Loads the collection and keeps this window in sync. Returns unsubscribe. */
export async function initCollection(): Promise<() => void> {
  const store = useCrateStore.getState();

  if (!isTauri()) {
    store.replaceAll(readBrowserRecords());
    return () => {};
  }

  // Subscribe before the snapshot so no change can fall between the two.
  const unlistenChanged = await listen<CollectedRecord>(
    COLLECTION_CHANGED_EVENT,
    ({ payload }) => {
      if (isCollectedRecord(payload)) useCrateStore.getState().upsert(payload);
    },
  );
  const unlistenRemoved = await listen<unknown>(
    COLLECTION_REMOVED_EVENT,
    ({ payload }) => {
      if (isKeyList(payload)) useCrateStore.getState().removeMany(payload);
    },
  );
  const unlisten = () => {
    unlistenChanged();
    unlistenRemoved();
  };

  try {
    const records = await invoke<CollectedRecord[]>("cmd_collection_snapshot");
    store.replaceAll(records.filter(isCollectedRecord));
  } catch (error) {
    logger.warn("[Crate] Snapshot failed:", error);
    store.replaceAll([]);
  }

  return unlisten;
}

export async function pressRecord(input: PressInput): Promise<PressResult | null> {
  let result: PressResult | null;

  if (isTauri()) {
    try {
      result = await invoke<PressResult>("cmd_collection_press", { input });
    } catch (error) {
      logger.warn("[Crate] Press failed:", error);
      return null;
    }
  } else {
    const records = readBrowserRecords();
    result = pressInto(records, input, Date.now());
    if (result) writeBrowserRecords(records);
  }

  if (!result) return null;
  const store = useCrateStore.getState();
  store.upsert(result.record);
  if (result.newlyPressed) store.markNewPressing(result.record.key);
  return result;
}

/**
 * Removes the chosen records for good. Play history is kept, so Wrapped and
 * the streak still count those listens. Resolves to the keys that were removed.
 */
export async function removeRecords(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  let removed: string[];

  if (isTauri()) {
    try {
      const result = await invoke<unknown>("cmd_collection_remove", { keys });
      removed = isKeyList(result) ? result : [];
    } catch (error) {
      logger.warn("[Crate] Remove failed:", error);
      return [];
    }
  } else {
    const chosen = new Set(keys);
    const records = readBrowserRecords();
    removed = records.filter((record) => chosen.has(record.key)).map((record) => record.key);
    writeBrowserRecords(records.filter((record) => !chosen.has(record.key)));
  }

  useCrateStore.getState().removeMany(removed);
  return removed;
}

function isKeyList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((key) => typeof key === "string");
}

/** Browser dev fallback only — Tauri counts plays in the Rust poller. */
export function countBrowserPlay(
  artist: string,
  album: string,
  track: string,
  source: { id: string; name: string },
) {
  if (isTauri()) return;
  const records = readBrowserRecords();
  const record = countPlayInto(records, artist, album, track, Date.now(), source);
  if (!record) return;
  writeBrowserRecords(records);
  useCrateStore.getState().upsert(record);
}

function readBrowserRecords(): CollectedRecord[] {
  try {
    const raw = window.localStorage.getItem(BROWSER_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCollectedRecord) : [];
  } catch {
    return [];
  }
}

function writeBrowserRecords(records: CollectedRecord[]) {
  try {
    window.localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Storage full or blocked: the in-memory store still has the record.
  }
}
