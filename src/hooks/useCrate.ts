// src/hooks/useCrate.ts
// The Crate hooks:
//   useCratePressing   — presses the current album once its vinyl pressing is
//                        derived (listens to applyVinylPressing's DOM event).
//   useCurrentRecord   — collection entry + wear for what's playing now.
//   useBrowserListenTracker — browser dev fallback for play counting
//                        (Tauri counts in the Rust poller).

import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  countBrowserPlay,
  pressRecord,
  useCrateStore,
} from "../lib/collection";
import { ListenTracker, recordKey, wearFor } from "../lib/collection/records";
import type { CollectedRecord } from "../lib/collection/types";
import { useVinylDeckStore } from "../lib/playback/store";
import type { PlaybackState } from "../lib/playback/types";
import type { VinylPressing } from "../lib/vinyl/pressingEngine";

const THUMBNAIL_SIZE = 96;
const THUMBNAIL_QUALITY = 0.72;
const LISTEN_POLL_MS = 500;

function albumTitle(playback: PlaybackState): string {
  return playback.album.trim() || playback.track.trim();
}

/** Main window only: every album that gets a pressing lands in the crate. */
export function useCratePressing(playback: PlaybackState) {
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const pressedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    function handlePressing(event: Event) {
      const pressing = (event as CustomEvent<VinylPressing | null>).detail;
      const current = playbackRef.current;
      if (!pressing || !current.artworkDataUrl) return;

      const album = albumTitle(current);
      const key = recordKey(current.artist, album);
      if (!key || pressedKeysRef.current.has(key)) return;
      pressedKeysRef.current.add(key);

      const artwork = current.artworkDataUrl;
      void makeThumbnail(artwork).then((thumbnail) =>
        pressRecord({
          artist: current.artist,
          album,
          recipe: pressing.recipe,
          pressingType: pressing.type,
          pressingName: pressing.pressingName,
          colors: {
            primary: pressing.colors.primary.hex,
            secondary: pressing.colors.secondary.hex,
            accent: pressing.colors.accent.hex,
          },
          thumbnail,
        }).then((result) => {
          // Let a failed press retry on the next pressing event.
          if (!result) pressedKeysRef.current.delete(key);
        }),
      );
    }

    window.addEventListener("vinyldeck:vinyl-pressing", handlePressing);
    return () =>
      window.removeEventListener("vinyldeck:vinyl-pressing", handlePressing);
  }, []);
}

export interface CurrentRecord {
  record: CollectedRecord | null;
  wear: number;
  wearAngle: number;
}

export function useCurrentRecord(playback: PlaybackState): CurrentRecord {
  const key = recordKey(playback.artist, playback.album, playback.track);
  const record = useCrateStore((state) => (key ? state.records[key] : undefined));
  return {
    record: record ?? null,
    wear: record ? wearFor(record.playCount) : 0,
    wearAngle: key ? hashAngle(key) : 0,
  };
}

export function useBrowserListenTracker() {
  useEffect(() => {
    if (isTauri()) return;
    const tracker = new ListenTracker();

    const id = setInterval(() => {
      const { playback, devForceEmpty } = useVinylDeckStore.getState();
      const sample =
        devForceEmpty || !playback.track
          ? null
          : {
              id: `${playback.sourceId}|${playback.track}|${playback.artist}|${playback.album}`,
              isPlaying: playback.isPlaying,
              duration: playback.duration,
              position: playback.position,
            };
      if (tracker.observe(sample, Date.now())) {
        countBrowserPlay(playback.artist, playback.album, playback.track);
      }
    }, LISTEN_POLL_MS);

    return () => clearInterval(id);
  }, []);
}

export function hashAngle(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}

function makeThumbnail(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = THUMBNAIL_SIZE;
        canvas.height = THUMBNAIL_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
        resolve(canvas.toDataURL("image/jpeg", THUMBNAIL_QUALITY));
      } catch {
        resolve(null); // tainted canvas: press without a label image
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
