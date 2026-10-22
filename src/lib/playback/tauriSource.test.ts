import { describe, expect, it } from "vitest";
import { EMPTY_PLAYBACK } from "./store";
import { isBackendMediaSnapshot, mapBackendMediaSnapshot } from "./tauriSource";
import type { BackendMediaSnapshot } from "./tauriSource";

const VALID_SNAPSHOT: BackendMediaSnapshot = {
  track: "Goth Bitch",
  artist: "1NONLY",
  album: "Goth Bitch",
  artworkDataUrl: "data:image/jpeg;base64,AAAA",
  duration: 127,
  position: 42.5,
  isPlaying: true,
  sourceName: "Spotify",
  sourceId: "Spotify.exe",
  canSeek: true,
  canSkip: true,
  canControl: true,
};

describe("TauriSource backend snapshot adapter", () => {
  it("accepts the Rust MediaSnapshot camelCase contract", () => {
    expect(isBackendMediaSnapshot(VALID_SNAPSHOT)).toBe(true);
    expect(mapBackendMediaSnapshot(VALID_SNAPSHOT)).toEqual(VALID_SNAPSHOT);
  });

  it("maps null snapshots to empty playback", () => {
    expect(mapBackendMediaSnapshot(null)).toEqual(EMPTY_PLAYBACK);
    expect(mapBackendMediaSnapshot(undefined)).toEqual(EMPTY_PLAYBACK);
  });

  it("accepts empty metadata, missing artwork, and unknown zero timeline values", () => {
    const sparseSnapshot: BackendMediaSnapshot = {
      ...VALID_SNAPSHOT,
      track: "",
      artist: "",
      album: "",
      artworkDataUrl: null,
      duration: 0,
      position: 0,
    };

    expect(isBackendMediaSnapshot(sparseSnapshot)).toBe(true);
    expect(mapBackendMediaSnapshot(sparseSnapshot)).toEqual(sparseSnapshot);
  });

  it("rejects malformed or unsafe payloads", () => {
    expect(isBackendMediaSnapshot({ ...VALID_SNAPSHOT, duration: Number.NaN })).toBe(false);
    expect(isBackendMediaSnapshot({ ...VALID_SNAPSHOT, duration: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isBackendMediaSnapshot({ ...VALID_SNAPSHOT, position: Number.NaN })).toBe(false);
    expect(isBackendMediaSnapshot({ ...VALID_SNAPSHOT, position: -1 })).toBe(false);
    expect(isBackendMediaSnapshot({ ...VALID_SNAPSHOT, artworkDataUrl: 123 })).toBe(false);
    expect(isBackendMediaSnapshot({ ...VALID_SNAPSHOT, canControl: "yes" })).toBe(false);
    expect(isBackendMediaSnapshot(null)).toBe(false);
  });
});
