import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_PLAYBACK, useVinylDeckStore } from "./store";
import type { PlaybackSource, PlaybackState } from "./types";

function makeSnapshot(track: string): PlaybackState {
  return {
    ...EMPTY_PLAYBACK,
    track,
    artist: "Artist",
    album: "Album",
    duration: 120,
    position: 12,
    isPlaying: true,
    sourceName: "Test",
    sourceId: track,
    canControl: true,
  };
}

function createFakeSource(initialState = EMPTY_PLAYBACK) {
  const listeners = new Set<(state: PlaybackState) => void>();
  const source: PlaybackSource = {
    getState: () => initialState,
    play: () => {},
    pause: () => {},
    togglePlayPause: () => {},
    next: () => {},
    previous: () => {},
    seekTo: () => {},
    onStateChange(callback) {
      listeners.add(callback);
      fake.unsubscribeCount += 1;
      return () => {
        listeners.delete(callback);
        fake.unsubscribeRunCount += 1;
      };
    },
    async start() {
      fake.startCount += 1;
    },
    stop() {
      fake.stopCount += 1;
    },
  };

  const fake = {
    source,
    startCount: 0,
    stopCount: 0,
    unsubscribeCount: 0,
    unsubscribeRunCount: 0,
    listenerCount: () => listeners.size,
    emit(state: PlaybackState) {
      listeners.forEach((listener) => listener(state));
    },
  };

  return fake;
}

afterEach(() => {
  vi.useRealTimers();
  useVinylDeckStore.getState().clearSource();
});

describe("playback store source lifecycle", () => {
  it("subscribes once and ignores duplicate same-source registration", () => {
    const fake = createFakeSource(makeSnapshot("One"));

    useVinylDeckStore.getState().setSource(fake.source);
    useVinylDeckStore.getState().setSource(fake.source);

    expect(fake.startCount).toBe(1);
    expect(fake.stopCount).toBe(0);
    expect(fake.listenerCount()).toBe(1);
    expect(fake.unsubscribeCount).toBe(1);
  });

  it("routes source events into playback state", () => {
    const fake = createFakeSource();
    const nextSnapshot = makeSnapshot("Two");

    useVinylDeckStore.getState().setSource(fake.source);
    fake.emit(nextSnapshot);

    expect(useVinylDeckStore.getState().playback).toEqual(nextSnapshot);
  });

  it("clears the active source with unsubscribe, stop, and empty playback reset", () => {
    const fake = createFakeSource(makeSnapshot("Three"));

    useVinylDeckStore.getState().setSource(fake.source);
    useVinylDeckStore.getState().clearSource(fake.source);

    expect(fake.unsubscribeRunCount).toBe(1);
    expect(fake.stopCount).toBe(1);
    expect(fake.listenerCount()).toBe(0);
    expect(useVinylDeckStore.getState().source).toBeNull();
    expect(useVinylDeckStore.getState().sourceUnsubscribe).toBeNull();
    expect(useVinylDeckStore.getState().playback).toEqual(EMPTY_PLAYBACK);
  });

  it("ignores stale cleanup for a non-current source", () => {
    const stale = createFakeSource(makeSnapshot("Old"));
    const current = createFakeSource(makeSnapshot("New"));

    useVinylDeckStore.getState().setSource(current.source);
    useVinylDeckStore.getState().clearSource(stale.source);

    expect(stale.stopCount).toBe(0);
    expect(current.stopCount).toBe(0);
    expect(useVinylDeckStore.getState().source).toBe(current.source);
  });

  it("stops and unsubscribes the old source on source swap", () => {
    const oldSource = createFakeSource(makeSnapshot("Old"));
    const newSource = createFakeSource(makeSnapshot("New"));

    useVinylDeckStore.getState().setSource(oldSource.source);
    useVinylDeckStore.getState().setSource(newSource.source);

    expect(oldSource.unsubscribeRunCount).toBe(1);
    expect(oldSource.stopCount).toBe(1);
    expect(oldSource.listenerCount()).toBe(0);
    expect(newSource.listenerCount()).toBe(1);
    expect(useVinylDeckStore.getState().source).toBe(newSource.source);
  });
});

describe("playback store scrub and track-change runtime state", () => {
  it("uses pending seek as displayed position immediately", () => {
    const snapshot = makeSnapshot("Seekable");
    useVinylDeckStore.getState().updatePlayback({
      ...snapshot,
      position: 10,
      duration: 180,
    });

    useVinylDeckStore.getState().beginPendingSeek(90);

    expect(useVinylDeckStore.getState().getPosition()).toBe(90);
  });

  it("clears pending seek when backend position settles near target", () => {
    const snapshot = makeSnapshot("Settled");
    useVinylDeckStore.getState().updatePlayback({
      ...snapshot,
      position: 10,
      duration: 180,
    });

    useVinylDeckStore.getState().beginPendingSeek(90);
    useVinylDeckStore.getState().updatePlayback({
      ...snapshot,
      position: 90.5,
      duration: 180,
    });

    expect(useVinylDeckStore.getState().pendingSeekPosition).toBeNull();
  });

  it("ignores stale pending seek after timeout", () => {
    vi.useFakeTimers();
    const snapshot = makeSnapshot("Timeout");
    useVinylDeckStore.getState().updatePlayback({
      ...snapshot,
      position: 10,
      duration: 180,
    });

    useVinylDeckStore.getState().beginPendingSeek(90);
    vi.advanceTimersByTime(1600);

    expect(useVinylDeckStore.getState().getPosition()).not.toBe(90);
  });

  it("uses next intent on the next semantic track change", () => {
    useVinylDeckStore.getState().updatePlayback(makeSnapshot("One"));
    useVinylDeckStore.getState().markTrackChangeIntent("next");
    useVinylDeckStore.getState().updatePlayback(makeSnapshot("Two"));

    expect(useVinylDeckStore.getState().trackChangeDirection).toBe("next");
    expect(useVinylDeckStore.getState().trackChangeNonce).toBeGreaterThan(0);
    expect(useVinylDeckStore.getState().pendingTrackChangeDirection).toBe(
      "unknown",
    );
  });

  it("uses previous intent on the next semantic track change", () => {
    useVinylDeckStore.getState().updatePlayback(makeSnapshot("Two"));
    useVinylDeckStore.getState().markTrackChangeIntent("previous");
    useVinylDeckStore.getState().updatePlayback(makeSnapshot("One"));

    expect(useVinylDeckStore.getState().trackChangeDirection).toBe("previous");
  });

  it("keeps intent until a different track arrives", () => {
    const snapshot = makeSnapshot("Same");
    useVinylDeckStore.getState().updatePlayback(snapshot);
    useVinylDeckStore.getState().markTrackChangeIntent("next");
    useVinylDeckStore.getState().updatePlayback({
      ...snapshot,
      position: 30,
    });

    expect(useVinylDeckStore.getState().pendingTrackChangeDirection).toBe(
      "next",
    );
  });

  it("uses unknown direction for external source-driven track changes", () => {
    useVinylDeckStore.getState().updatePlayback(makeSnapshot("One"));
    useVinylDeckStore.getState().updatePlayback(makeSnapshot("Two"));

    expect(useVinylDeckStore.getState().trackChangeDirection).toBe("unknown");
  });
});
