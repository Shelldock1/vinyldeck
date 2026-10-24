// src/lib/collection/types.ts
// The Crate: persistent collection of every album VinylDeck has pressed.
// Mirrors src-tauri/src/collection/mod.rs payloads (camelCase).

import type { VinylPressingRecipe } from "../vinyl/pressingEngine";

export interface PressingColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface CollectedRecord {
  key: string;
  album: string;
  artist: string;
  pressingNumber: number;
  /** Unix epoch milliseconds. */
  firstPressedAt: number;
  lastPlayedAt: number | null;
  playCount: number;
  /** null until the pressing is derived (a play can be counted first). */
  recipe: string | null;
  pressingType: string | null;
  pressingName: string | null;
  colors: PressingColors | null;
  thumbnail: string | null;
}

export interface PressInput {
  artist: string;
  album: string;
  recipe: VinylPressingRecipe;
  pressingType: string;
  pressingName: string;
  colors: PressingColors;
  thumbnail: string | null;
}

export interface PressResult {
  record: CollectedRecord;
  newlyPressed: boolean;
}

export type RarityTier = "common" | "uncommon" | "rare" | "legendary";

export interface WrappedAlbum {
  key: string;
  artist: string;
  album: string;
  plays: number;
  pressingNumber: number | null;
}

export interface WrappedTrack {
  track: string;
  artist: string;
  plays: number;
}

export interface WrappedArtist {
  artist: string;
  plays: number;
}

export interface WrappedDay {
  /** YYYY-MM-DD (UTC). */
  date: string;
  plays: number;
}

export interface WrappedStats {
  /** YYYY-MM (UTC). */
  month: string;
  label: string;
  totalPlays: number;
  uniqueAlbums: number;
  uniqueArtists: number;
  uniqueTracks: number;
  topRecords: WrappedAlbum[];
  topTrack: WrappedTrack | null;
  topArtist: WrappedArtist | null;
  rarest: WrappedAlbum | null;
  busiestDay: WrappedDay | null;
  availableMonths: string[];
}
