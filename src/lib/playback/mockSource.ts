// src/lib/playback/mockSource.ts
// Auto-cycling mock tracks for Stage 2 development.
// Supports both real artwork URLs (served from /public) and
// canvas-generated color artwork for tracks without real art.
//
// DESIGN DECISION (2026-06-08):
// Ambient orbs follow ALBUM ART, not theme. Theme drives all UI chrome
// (ring color, needle, vinyl material, button accents). Orbs are atmospheric
// lighting — they should react to the music. This matches Apple Music,
// Plexamp, Doppler — all premium music apps converge on this pattern.

import type { PlaybackSource, PlaybackState } from "./types";

// ── Canvas artwork generator (fallback for tracks without real art) ──

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length < 3) return null;
  return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}

function makeArtworkDataUrl(hex: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const rgb = hexToRgb(hex);
  if (!rgb) return "";
  const bright = `rgb(${Math.min(255, rgb.r + 60)},${Math.min(255, rgb.g + 60)},${Math.min(255, rgb.b + 60)})`;
  const dark = `rgb(${Math.max(0, rgb.r - 40)},${Math.max(0, rgb.g - 40)},${Math.max(0, rgb.b - 40)})`;
  const grad = ctx.createRadialGradient(80, 70, 5, 100, 100, 115);
  grad.addColorStop(0, bright);
  grad.addColorStop(0.45, hex);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 200, 200);
  return canvas.toDataURL("image/png");
}

// ── Mock track data ───────────────────────────────────────────

interface MockTrack {
  track: string;
  artist: string;
  album: string;
  duration: number;
  // One of these two must be set:
  artworkUrl?: string;    // real image URL served from /public (preferred)
  artworkColor?: string;  // fallback: vivid hex for canvas generation
}

const MOCK_TRACKS: MockTrack[] = [
  {
    track: "We On Go",
    artist: "BIA",
    album: "We On Go",
    // Real album art: warm amber fur + dark teal background
    // Expected ambient: amber/gold primary, teal secondary
    artworkUrl: "/art-1.jpg",
    duration: 247,
  },
  {
    track: "The Revenge",
    artist: "Shashwat Sachdev",
    album: "Dhurandhar",
    // Real album art: intense orange fire + dark background
    // Expected ambient: vivid orange/amber bloom
    artworkUrl: "/art-2.jpg",
    duration: 312,
  },
  {
    track: "Neon Requiem",
    artist: "Synth Replicant",
    album: "Grid Collapse",
    // Canvas-generated vivid violet
    artworkColor: "#bf5af2",
    duration: 198,
  },
  {
    track: "Warm Static",
    artist: "Analog Ritual",
    album: "Acetate Dreams",
    // Canvas-generated vivid amber
    artworkColor: "#f4a327",
    duration: 354,
  },
];

// ── MockSource implementation ─────────────────────────────────
export function createMockSource(): PlaybackSource {
  let currentIndex = 0;
  let isPlaying = true;
  let position = 0;
  let lastTickTime = Date.now();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const subscribers: Set<(state: PlaybackState) => void> = new Set();

  // Cache canvas-generated data URLs (only used for tracks without artworkUrl)
  const canvasCache = new Map<string, string>();

  function getCanvasArtwork(hex: string): string {
    if (!canvasCache.has(hex)) {
      canvasCache.set(hex, makeArtworkDataUrl(hex));
    }
    return canvasCache.get(hex) ?? "";
  }

  function getTrack(): MockTrack {
    return MOCK_TRACKS[currentIndex % MOCK_TRACKS.length];
  }

  function getArtworkForTrack(t: MockTrack): string {
    // Real image URL wins — useColorExtraction handles it via Vibrant.from(url)
    if (t.artworkUrl) return t.artworkUrl;
    // Fall back to canvas data URL
    if (t.artworkColor) return getCanvasArtwork(t.artworkColor);
    return "";
  }

  function buildState(): PlaybackState {
    const t = getTrack();
    return {
      track: t.track,
      artist: t.artist,
      album: t.album,
      artworkDataUrl: getArtworkForTrack(t),
      duration: t.duration,
      position,
      isPlaying,
      sourceName: "MockSource",
      sourceId: "mock-01",
      canSeek: true,
      canSkip: true,
      canControl: true,
    };
  }

  function emit() {
    const state = buildState();
    subscribers.forEach((cb) => cb(state));
  }

  function tick() {
    if (!isPlaying) return;
    const now = Date.now();
    const delta = (now - lastTickTime) / 1000;
    lastTickTime = now;
    const track = getTrack();
    position = Math.min(position + delta, track.duration);
    if (position >= track.duration) {
      currentIndex = (currentIndex + 1) % MOCK_TRACKS.length;
      position = 0;
      emit();
    }
  }

  return {
    getState: buildState,

    play() {
      isPlaying = true;
      lastTickTime = Date.now();
      emit();
    },

    pause() {
      isPlaying = false;
      emit();
    },

    togglePlayPause() {
      if (isPlaying) this.pause();
      else this.play();
    },

    next() {
      currentIndex = (currentIndex + 1) % MOCK_TRACKS.length;
      position = 0;
      lastTickTime = Date.now();
      emit();
    },

    previous() {
      if (position > 3) {
        position = 0;
      } else {
        currentIndex = (currentIndex - 1 + MOCK_TRACKS.length) % MOCK_TRACKS.length;
        position = 0;
      }
      lastTickTime = Date.now();
      emit();
    },

    seekTo(seconds: number) {
      const track = getTrack();
      position = Math.min(Math.max(seconds, 0), track.duration);
      emit();
    },

    onStateChange(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },

    async start() {
      // Pre-warm canvas cache for tracks that need it (DOM is ready here)
      MOCK_TRACKS.forEach((t) => {
        if (t.artworkColor) getCanvasArtwork(t.artworkColor);
      });

      intervalId = setInterval(tick, 500);
      emit();
    },

    stop() {
      if (intervalId) clearInterval(intervalId);
      subscribers.clear();
      canvasCache.clear();
    },
  };
}
