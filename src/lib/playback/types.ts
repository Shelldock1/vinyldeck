// src/lib/playback/types.ts
// Core abstraction interfaces. Visual Engine only knows PlaybackState.
// From PRD-01 §6.1 — locked interface, do not modify.

export interface PlaybackState {
  // Track metadata
  track: string;
  artist: string;
  album: string;
  artworkDataUrl: string | null;  // base64 data URI or null
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

  // Event subscriptions
  onStateChange(callback: (state: PlaybackState) => void): () => void; // returns unsubscribe fn

  // Lifecycle
  start(): Promise<void>;
  stop(): void;
}
