import { describe, expect, it } from "vitest";
import {
  formatSleepTimerStatus,
  isEpochMillis,
  isSleepTimerFired,
  isSleepTimerSnapshot,
  isValidSleepMinutes,
  normalizeSleepTimer,
  normalizeSleepTimerFired,
  sleepRemainingMinutes,
} from "./sleep";
import type { SleepTimerSnapshot } from "./sleep";

const NOW = 1_800_000_000_000;

function minutesTimer(endsAt: number, track: string | null = null): SleepTimerSnapshot {
  return { mode: "minutes", endsAt, track };
}

describe("sleep timer payload validation", () => {
  it("accepts minute and end-of-track snapshots", () => {
    expect(
      isSleepTimerSnapshot({
        mode: "minutes",
        endsAt: NOW + 30 * 60_000,
        track: null,
      }),
    ).toBe(true);
    expect(
      isSleepTimerSnapshot({
        mode: "endOfTrack",
        endsAt: null,
        track: "Blue Monday",
      }),
    ).toBe(true);
  });

  it("rejects unknown modes, bad epochs, and non-string tracks", () => {
    expect(
      isSleepTimerSnapshot({ mode: "later", endsAt: null, track: null }),
    ).toBe(false);
    expect(
      isSleepTimerSnapshot({ mode: "minutes", endsAt: 0, track: null }),
    ).toBe(false);
    expect(
      isSleepTimerSnapshot({ mode: "minutes", endsAt: NaN, track: null }),
    ).toBe(false);
    expect(
      isSleepTimerSnapshot({ mode: "minutes", endsAt: "soon", track: null }),
    ).toBe(false);
    expect(
      isSleepTimerSnapshot({
        mode: "endOfTrack",
        endsAt: NOW,
        track: null,
      }),
    ).toBe(false);
    expect(
      isSleepTimerSnapshot({
        mode: "minutes",
        endsAt: NOW,
        track: 42,
      }),
    ).toBe(false);
  });

  it("validates epoch milliseconds and the 5..240 minute range", () => {
    expect(isEpochMillis(NOW)).toBe(true);
    expect(isEpochMillis(0)).toBe(false);
    expect(isEpochMillis(1.5)).toBe(false);
    expect(isEpochMillis(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isValidSleepMinutes(5)).toBe(true);
    expect(isValidSleepMinutes(240)).toBe(true);
    expect(isValidSleepMinutes(4)).toBe(false);
    expect(isValidSleepMinutes(241)).toBe(false);
    expect(isValidSleepMinutes(30.5)).toBe(false);
  });

  it("normalizes null and drops empty track labels", () => {
    expect(normalizeSleepTimer(null)).toBeNull();
    expect(normalizeSleepTimer(undefined)).toBeNull();
    expect(normalizeSleepTimer("nope")).toBeNull();
    expect(
      normalizeSleepTimer({
        mode: "endOfTrack",
        endsAt: null,
        track: "",
      }),
    ).toEqual({ mode: "endOfTrack", endsAt: null, track: null });
  });

  it("validates the fired event payload", () => {
    expect(isSleepTimerFired({ mode: "minutes" })).toBe(true);
    expect(normalizeSleepTimerFired({ mode: "endOfTrack" })).toEqual({
      mode: "endOfTrack",
    });
    expect(normalizeSleepTimerFired({ mode: "hours" })).toBeNull();
    expect(normalizeSleepTimerFired(null)).toBeNull();
  });
});

describe("sleep timer status formatting", () => {
  it("reports off for no timer", () => {
    expect(formatSleepTimerStatus(null, NOW)).toBe("Off");
    expect(sleepRemainingMinutes(null, NOW)).toBeNull();
  });

  it("rounds remaining minutes up and clamps at zero", () => {
    expect(sleepRemainingMinutes(minutesTimer(NOW + 30 * 60_000), NOW)).toBe(30);
    expect(sleepRemainingMinutes(minutesTimer(NOW + 30 * 60_000 - 1), NOW)).toBe(30);
    expect(sleepRemainingMinutes(minutesTimer(NOW + 60_000), NOW)).toBe(1);
    expect(sleepRemainingMinutes(minutesTimer(NOW - 1), NOW)).toBe(0);
    expect(formatSleepTimerStatus(minutesTimer(NOW + 45 * 60_000), NOW)).toBe(
      "45 min left",
    );
    expect(formatSleepTimerStatus(minutesTimer(NOW - 1), NOW)).toBe(
      "Pausing now",
    );
  });

  it("names the captured track for end-of-track timers", () => {
    expect(
      formatSleepTimerStatus(
        { mode: "endOfTrack", endsAt: null, track: "Blue Monday" },
        NOW,
      ),
    ).toBe("After Blue Monday");
    expect(
      formatSleepTimerStatus(
        { mode: "endOfTrack", endsAt: null, track: null },
        NOW,
      ),
    ).toBe("After this track");
  });
});
