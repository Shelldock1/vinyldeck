// src/lib/playback/types.ts
// Core abstraction interfaces. Visual Engine only knows PlaybackState.
// From PRD-01 §6.1 — locked interface, do not modify.

export type RepeatMode = "off" | "all" | "one";

export interface PlaybackState {
  // Track metadata
  track: string;
  artist: string;
  album: string;
  artworkDataUrl: string | null;  // artwork URL (data: or vinyldeck://) or null
  duration: number;               // seconds, 0 if unknown
  position: number;               // seconds, client-side extrapolated
  isPlaying: boolean;

  // Source info
  sourceName: string;             // "Spotify", "Chrome", "VLC", etc.
  sourceId: string;               // OS session ID

  // Capabilities (not all sources support everything)
  canSeek: boolean;
  canSkip: boolean;
  canControl: boolean;
  canRepeat: boolean;
  canShuffle: boolean;

  // Playback modes (backend-owned; never optimistically diverged)
  repeatMode: RepeatMode;
  shuffle: boolean;
}

export interface PlaybackSource {
  // Returns current state snapshot
  getState(): PlaybackState;

  // Command interface — fire and forget, gracefully ignored if unsupported
  play(): void;
  pause(): void;
  togglePlayPause(): void;
  next(): void;
  previous(): void;
  seekTo(seconds: number): void;
  // Hardware modes are optional: browser mocks can update local state.
  setRepeatMode?(mode: RepeatMode): void;
  setShuffle?(enabled: boolean): void;

  // Event subscriptions
  onStateChange(callback: (state: PlaybackState) => void): () => void; // returns unsubscribe fn

  // Lifecycle
  start(): Promise<void>;
  stop(): void;
}
