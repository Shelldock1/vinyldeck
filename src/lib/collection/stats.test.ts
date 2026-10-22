import { describe, expect, it } from "vitest";
import {
  collectionStats,
  collectionStreak,
  filterRecords,
  sortRecords,
} from "./records";
import type { CollectedRecord } from "./types";

let sequence = 0;

function record(partial: Partial<CollectedRecord> = {}): CollectedRecord {
  sequence += 1;
  return {
    key: `key-${sequence}`,
    album: "Album",
    artist: "Artist",
    pressingNumber: sequence,
    firstPressedAt: 0,
    lastPlayedAt: null,
    playCount: 0,
    recipe: "audiophile-black",
    pressingType: null,
    pressingName: null,
    colors: null,
    thumbnail: null,
    ...partial,
  };
}

/** Local noon avoids DST edges; the helpers work in local calendar days. */
const at = (day: number, hour = 12) =>
  new Date(2026, 9, day, hour).getTime();
const NOW = at(22);

describe("crate search", () => {
  const violet = record({
    key: "violet",
    artist: "BIA",
    album: "We On Go",
    pressingName: "Violet Galaxy",
  });
  const smoke = record({
    key: "smoke",
    artist: "Kendrick Lamar",
    album: "DAMN.",
    pressingName: "Smoke Clear",
  });
  const plain = record({
    key: "plain",
    artist: "Sade",
    album: "Diamond Life",
    pressingName: null,
  });
  const shelf = [violet, smoke, plain];

  it("matches artist, album, and pressing name case-insensitively", () => {
    expect(filterRecords(shelf, "bia").map((r) => r.key)).toEqual(["violet"]);
    expect(filterRecords(shelf, "GO").map((r) => r.key)).toEqual(["violet"]);
    expect(filterRecords(shelf, "galaxy").map((r) => r.key)).toEqual(["violet"]);
    expect(filterRecords(shelf, "damn").map((r) => r.key)).toEqual(["smoke"]);
    expect(filterRecords(shelf, "clear").map((r) => r.key)).toEqual(["smoke"]);
  });

  it("returns the whole shelf for a blank query and nothing when nothing hits", () => {
    expect(filterRecords(shelf, "")).toHaveLength(3);
    expect(filterRecords(shelf, "   ")).toHaveLength(3);
    expect(filterRecords(shelf, "no such pressing")).toEqual([]);
    expect(filterRecords([], "anything")).toEqual([]);
    expect(shelf).toHaveLength(3);
  });
});

describe("crate sort", () => {
  it("sorts A–Z by artist, then album, ignoring case", () => {
    const beta = record({ key: "beta", artist: "Beta", album: "A" });
    const alphaB = record({ key: "alpha-b", artist: "alpha", album: "B" });
    const alphaA = record({ key: "alpha-a", artist: "alpha", album: "A" });

    expect(
      sortRecords([beta, alphaB, alphaA], "alpha").map((r) => r.key),
    ).toEqual(["alpha-a", "alpha-b", "beta"]);
  });

  it("keeps recent, plays, rarity, and pressing order deterministic", () => {
    const played = record({ key: "played", lastPlayedAt: at(10), pressingNumber: 1 });
    const pressed = record({ key: "pressed", firstPressedAt: at(15), pressingNumber: 2 });
    const rare = record({
      key: "rare",
      recipe: "galaxy",
      playCount: 1,
      lastPlayedAt: at(9),
      pressingNumber: 3,
    });
    const common = record({
      key: "common",
      recipe: "splatter",
      playCount: 9,
      lastPlayedAt: at(8),
      pressingNumber: 4,
    });

    expect(
      sortRecords([played, pressed], "recent").map((r) => r.key),
    ).toEqual(["pressed", "played"]);
    expect(
      sortRecords([rare, common], "plays").map((r) => r.key),
    ).toEqual(["common", "rare"]);
    expect(
      sortRecords([common, rare], "rarity").map((r) => r.key),
    ).toEqual(["rare", "common"]);
    expect(
      sortRecords([played, pressed, rare, common], "number").map((r) => r.key),
    ).toEqual(["played", "pressed", "rare", "common"]);
  });

  it("breaks a play-count tie with the most recent play", () => {
    const older = record({ key: "older", playCount: 3, lastPlayedAt: at(10) });
    const newer = record({ key: "newer", playCount: 3, lastPlayedAt: at(11) });
    const leader = record({ key: "leader", playCount: 5, lastPlayedAt: at(1) });

    expect(
      sortRecords([older, newer, leader], "plays").map((r) => r.key),
    ).toEqual(["leader", "newer", "older"]);
  });
});

describe("crate stats", () => {
  it("reports totals, top album, and an empty top album for an empty crate", () => {
    expect(collectionStats([], NOW)).toEqual({
      totalRecords: 0,
      totalPlays: 0,
      topAlbum: null,
      streak: 0,
    });

    const unplayed = record({ key: "unplayed", playCount: 0, lastPlayedAt: null });
    const stats = collectionStats([unplayed], NOW);
    expect(stats.totalRecords).toBe(1);
    expect(stats.totalPlays).toBe(0);
    expect(stats.topAlbum).toBeNull();
  });

  it("picks the most played album and breaks ties by most recent play", () => {
    const first = record({
      key: "first",
      album: "First",
      playCount: 3,
      lastPlayedAt: at(20),
    });
    const tie = record({
      key: "tie",
      album: "Tie",
      playCount: 3,
      lastPlayedAt: at(21),
    });
    const leader = record({
      key: "leader",
      album: "Leader",
      playCount: 5,
      lastPlayedAt: at(19),
    });

    const stats = collectionStats([first, tie, leader], NOW);
    expect(stats.totalPlays).toBe(11);
    expect(stats.topAlbum?.key).toBe("leader");

    const tied = collectionStats([first, tie], NOW);
    expect(tied.topAlbum?.key).toBe("tie");
  });

  it("counts a streak that includes today", () => {
    const shelf = [
      record({ lastPlayedAt: at(20) }),
      record({ lastPlayedAt: at(21, 8) }),
      record({ lastPlayedAt: at(22, 9) }),
    ];
    expect(collectionStreak(shelf, NOW)).toBe(3);
    expect(collectionStats(shelf, NOW).streak).toBe(3);
  });

  it("anchors to yesterday when today has no play yet", () => {
    const shelf = [
      record({ lastPlayedAt: at(19) }),
      record({ lastPlayedAt: at(20) }),
      record({ lastPlayedAt: at(21) }),
      record({ lastPlayedAt: at(17) }),
    ];
    expect(collectionStreak(shelf, NOW)).toBe(3);
  });

  it("breaks once yesterday and today are both quiet", () => {
    const shelf = [
      record({ lastPlayedAt: at(18) }),
      record({ lastPlayedAt: at(19) }),
      record({ lastPlayedAt: at(20) }),
    ];
    expect(collectionStreak(shelf, NOW)).toBe(0);
    expect(collectionStreak([], NOW)).toBe(0);
  });

  it("counts multiple plays on one day once", () => {
    const shelf = [
      record({ lastPlayedAt: at(22, 8) }),
      record({ lastPlayedAt: at(22, 20) }),
    ];
    expect(collectionStreak(shelf, NOW)).toBe(1);
  });
});
