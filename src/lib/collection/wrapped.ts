// Crate Wrapped: monthly listening stats owned by the Rust backend. In the
// browser dev build there is no play history, so the card renders an empty
// current month instead of pretending the localStorage collection has dates.

import { invoke, isTauri } from "@tauri-apps/api/core";
import type { CrateSource, WrappedStats } from "./types";
import { logger } from "../logger";

export async function getCollectionWrapped(
  month?: string,
  source: CrateSource = "all",
): Promise<WrappedStats> {
  if (!isTauri()) return emptyWrapped();

  try {
    return await invoke<WrappedStats>("cmd_collection_wrapped", {
      month: month ?? null,
      source,
    });
  } catch (error) {
    logger.warn("[Crate] Wrapped failed:", error);
    throw error;
  }
}

export function emptyWrapped(now = new Date()): WrappedStats {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return {
    month: `${year}-${month}`,
    label: new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric",
    }).format(now),
    totalPlays: 0,
    uniqueAlbums: 0,
    uniqueArtists: 0,
    uniqueTracks: 0,
    topRecords: [],
    topTrack: null,
    topArtist: null,
    rarest: null,
    busiestDay: null,
    availableMonths: [],
  };
}

/** "2026-10-01" -> localized "Oct 1" (the backend dates are UTC). */
export function formatWrappedDay(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/** "2026-10" -> localized "October 2026", used in the month picker. */
export function formatWrappedMonth(month: string): string {
  const parsed = new Date(`${month}-01T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
