import { describe, expect, it } from "vitest";
import { isMediaPlayer, normalizeMediaPlayers } from "./players";

describe("media players", () => {
  it("validates backend player entries", () => {
    expect(isMediaPlayer({ id: "spotify", name: "Spotify", isPlaying: true })).toBe(true);
    expect(isMediaPlayer({ id: "", name: "Spotify", isPlaying: true })).toBe(false);
    expect(isMediaPlayer({ id: "spotify", name: "Spotify" })).toBe(false);
    expect(isMediaPlayer(null)).toBe(false);
  });

  it("dedupes and sorts playing players first", () => {
    expect(
      normalizeMediaPlayers([
        { id: "vlc", name: "VLC", isPlaying: false },
        { id: "spotify", name: "Spotify", isPlaying: true },
        { id: "spotify", name: "Duplicate", isPlaying: false },
        { id: "chrome", name: "Chrome", isPlaying: false },
        { id: 7, name: "Bad", isPlaying: false },
      ]),
    ).toEqual([
      { id: "spotify", name: "Spotify", isPlaying: true },
      { id: "chrome", name: "Chrome", isPlaying: false },
      { id: "vlc", name: "VLC", isPlaying: false },
    ]);
  });

  it("falls back to the id when a name is blank", () => {
    expect(
      normalizeMediaPlayers([{ id: "org.mpris.MediaPlayer2.vlc", name: "", isPlaying: false }]),
    ).toEqual([
      {
        id: "org.mpris.MediaPlayer2.vlc",
        name: "org.mpris.MediaPlayer2.vlc",
        isPlaying: false,
      },
    ]);
  });
});
