import { describe, expect, it } from "vitest";
import {
  ListenTracker,
  countPlayInto,
  filterBySource,
  formatPressingNumber,
  listenThresholdSeconds,
  pressInto,
  rarityFor,
  recordKey,
  sourceKindFor,
  wearFor,
} from "./records";
import type { CollectedRecord, PressInput } from "./types";

function input(artist: string, album: string): PressInput {
  return {
    artist,
    album,
    recipe: "galaxy",
    pressingType: "smoke",
    pressingName: "Violet Galaxy",
    colors: { primary: "#111111", secondary: "#222222", accent: "#333333" },
    thumbnail: "data:image/jpeg;base64,AAAA",
    sourceId: "org.mpris.MediaPlayer2.spotify",
    sourceName: "Spotify",
  };
}

describe("crate sources", () => {
  it("splits browsers from music apps like the backend", () => {
    expect(sourceKindFor("org.mpris.MediaPlayer2.firefox.instance_1_42", "Mozilla Firefox")).toBe("browser");
    expect(sourceKindFor("org.mpris.MediaPlayer2.yandex-browser", "Yandex Browser")).toBe("browser");
    expect(sourceKindFor("MSEdge", "Edge")).toBe("browser");
    expect(sourceKindFor("org.mpris.MediaPlayer2.spotify", "Spotify")).toBe("app");
    expect(sourceKindFor("org.mpris.MediaPlayer2.youtube-music", "YouTube Music")).toBe("app");
  });

  it("tags records and keeps a music app tag sticky", () => {
    const records: CollectedRecord[] = [];
    const video = countPlayInto(records, "Channel", "", "Video", 1, { id: "firefox", name: "Firefox" });
    expect(video?.sourceKind).toBe("browser");

    pressInto(records, input("A", "One"), 2);
    const again = countPlayInto(records, "A", "One", "Song", 3, { id: "chromium", name: "Chromium" });
    expect(again?.sourceKind).toBe("app");
    expect(again?.sourceName).toBe("Chromium");

    expect(filterBySource(records, "app").map((record) => record.key)).toEqual(["a|one"]);
    expect(filterBySource(records, "browser").map((record) => record.key)).toEqual(["channel|video"]);
    expect(filterBySource(records, "all")).toHaveLength(2);
  });
});

describe("crate records", () => {
  it("keys match the backend: lowercase artist + album, track fallback", () => {
    expect(recordKey(" BIA ", "We On Go")).toBe("bia|we on go");
    expect(recordKey("BIA", "", "Single")).toBe("bia|single");
    expect(recordKey("BIA", " ", " ")).toBeNull();
  });

  it("numbers first pressings and keeps re-presses idempotent", () => {
    const records: CollectedRecord[] = [];
    expect(pressInto(records, input("A", "One"), 10)?.record.pressingNumber).toBe(1);
    expect(pressInto(records, input("B", "Two"), 20)?.record.pressingNumber).toBe(2);
    const again = pressInto(records, input("a", "ONE"), 30);
    expect(again?.newlyPressed).toBe(false);
    expect(again?.record.firstPressedAt).toBe(10);
    expect(records).toHaveLength(2);
  });

  it("fills a play-count stub when the pressing arrives", () => {
    const records: CollectedRecord[] = [];
    const stub = countPlayInto(records, "A", "One", "Track", 5);
    expect(stub?.recipe).toBeNull();
    const pressed = pressInto(records, input("A", "One"), 6);
    expect(pressed?.newlyPressed).toBe(true);
    expect(pressed?.record.playCount).toBe(1);
    expect(countPlayInto(records, "A", "One", "Other", 7)?.playCount).toBe(2);
  });

  it("grades rarity by recipe and wears with plays", () => {
    expect(rarityFor("galaxy")).toBe("legendary");
    expect(rarityFor("splatter")).toBe("common");
    expect(rarityFor(null)).toBe("common");
    expect(wearFor(0)).toBe(0);
    expect(wearFor(24)).toBeCloseTo(1 - 1 / Math.E, 6);
    expect(wearFor(1000)).toBeLessThanOrEqual(1);
    expect(formatPressingNumber(7)).toBe("No. 007");
  });
});

describe("listen tracker", () => {
  const sample = (id: string, isPlaying = true, duration = 120, position = 0) => ({
    id,
    isPlaying,
    duration,
    position,
  });

  /** Plays from `from` seconds for `secs`, advancing position with time. */
  const playFrom = (tracker: ListenTracker, start: number, from: number, secs: number, duration = 100) => {
    let counted = 0;
    for (let step = 0; step <= secs * 2; step += 1) {
      if (tracker.observe(sample("a", true, duration, from + step * 0.5), start + step * 500)) counted += 1;
    }
    return counted;
  };

  it("counts once after half the track has been heard", () => {
    const tracker = new ListenTracker();
    let counted = 0;
    for (let t = 0; t <= 200_000; t += 500) {
      if (tracker.observe(sample("a"), t)) counted += 1;
      if (t === 59_500) expect(counted).toBe(0);
    }
    expect(counted).toBe(1);
  });

  it("ignores paused time, long gaps, and track switches", () => {
    const tracker = new ListenTracker();
    for (let t = 0; t <= 300_000; t += 500) {
      expect(tracker.observe(sample("a", false), t)).toBe(false);
    }
    tracker.observe(sample("a"), 400_000);
    expect(tracker.observe(sample("a"), 1_000_000)).toBe(false);
    for (let t = 0; t <= 50_000; t += 500) tracker.observe(sample("b"), 2_000_000 + t);
    expect(tracker.observe(sample("c"), 2_100_000)).toBe(false);
  });

  it("counts each pass of a repeat-one loop", () => {
    const tracker = new ListenTracker();
    expect(playFrom(tracker, 0, 0, 99)).toBe(1);
    // Position wraps from ~99s back to 0 while still playing.
    expect(playFrom(tracker, 99_500, 0, 99)).toBe(1);
  });

  it("counts again after a manual restart", () => {
    const tracker = new ListenTracker();
    expect(playFrom(tracker, 0, 0, 60)).toBe(1);
    // Pause, scrub to 0, play.
    tracker.observe(sample("a", false, 100, 60), 61_000);
    tracker.observe(sample("a", false, 100, 0), 70_000);
    expect(playFrom(tracker, 71_000, 0, 60)).toBe(1);
  });

  it("treats resuming at the start as a restart", () => {
    const tracker = new ListenTracker();
    expect(playFrom(tracker, 0, 0, 60)).toBe(1);
    tracker.observe(sample("a", false, 100, 0), 200_000);
    expect(playFrom(tracker, 201_000, 1, 60)).toBe(1);
  });

  it("ignores small backward jitter and mid-track resumes", () => {
    const tracker = new ListenTracker();
    expect(playFrom(tracker, 0, 0, 60)).toBe(1);
    expect(playFrom(tracker, 60_500, 58, 30)).toBe(0);
    tracker.observe(sample("a", false, 100, 88), 95_000);
    expect(playFrom(tracker, 96_000, 88, 10)).toBe(0);
  });

  it("does not credit a forward seek as listening", () => {
    const tracker = new ListenTracker();
    expect(playFrom(tracker, 0, 0, 10)).toBe(0);
    expect(playFrom(tracker, 10_500, 90, 9)).toBe(0);
  });

  it("caps the threshold and skips jingles", () => {
    expect(listenThresholdSeconds(180)).toBe(90);
    expect(listenThresholdSeconds(3600)).toBe(120);
    expect(listenThresholdSeconds(0)).toBe(120);
    expect(listenThresholdSeconds(20)).toBeNull();
  });
});
