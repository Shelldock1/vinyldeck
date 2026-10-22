import { describe, expect, it } from "vitest";
import {
  canUseSeekControl,
  canUseSkipControls,
  canUseTransportControls,
} from "./capabilities";
import { EMPTY_PLAYBACK } from "./store";
import type { PlaybackState } from "./types";

function playback(partial: Partial<PlaybackState>): PlaybackState {
  return {
    ...EMPTY_PLAYBACK,
    duration: 120,
    canControl: true,
    canSeek: true,
    canSkip: true,
    ...partial,
  };
}

describe("playback capability gates", () => {
  it("allows play and pause while disabling unsupported seek", () => {
    const state = playback({ canControl: true, canSeek: false });

    expect(canUseTransportControls(state)).toBe(true);
    expect(canUseSeekControl(state)).toBe(false);
  });

  it("allows play and pause while disabling unsupported skip", () => {
    const state = playback({ canControl: true, canSkip: false });

    expect(canUseTransportControls(state)).toBe(true);
    expect(canUseSkipControls(state)).toBe(false);
  });

  it("disables transport and skip when the source cannot be controlled", () => {
    const state = playback({ canControl: false, canSeek: true, canSkip: true });

    expect(canUseTransportControls(state)).toBe(false);
    expect(canUseSkipControls(state)).toBe(false);
  });

  it("disables seek for unknown duration even when seek capability is present", () => {
    const state = playback({ canSeek: true, duration: 0 });

    expect(canUseSeekControl(state)).toBe(false);
  });
});
