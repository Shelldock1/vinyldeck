// src/views/MainView.tsx
// Final z-stack layout for Stage 2.
// Hierarchy:
//   z:0  AmbientLayer (fixed, behind all)
//   z:0  VaporGrid (fixed, Vapor theme only)
//   z:1  Content container (flex column, centered)
//         vinyl-area (relative) → ProgressRing + VinylRecord + NeedleArm
//         TrackInfo    ← fades on idle
//         Controls     ← fades on idle
//         ThemePicker  ← fades on idle
//   z:2  SourceBadge (fixed, bottom-right)
//
// Phase 7: useIdleMode — 3s inactivity → TrackInfo/Controls/ThemePicker fade out
// Phase 8: ProgressRing receives onSeek for scrub-to-seek

import { useEffect, useMemo, useState } from "react";
import {
  EMPTY_PLAYBACK,
  useVinylDeckStore,
  selectPlayback,
  selectIsPlaying,
  selectArtwork,
  selectTheme,
  selectSettings,
  selectTrackChangeDirection,
  selectTrackChangeNonce,
} from "../lib/playback/store";
import {
  canUseSeekControl,
  canUseSkipControls,
  canUseTransportControls,
} from "../lib/playback/capabilities";

import { AmbientLayer } from "../components/AmbientLayer";
import { VaporGrid } from "../components/VaporGrid";
import { VinylRecord } from "../components/VinylRecord";
import { NeedleArm } from "../components/NeedleArm";
import { ProgressRing } from "../components/ProgressRing";
import { TrackInfo } from "../components/TrackInfo";
import { Controls } from "../components/Controls";
import { ThemePicker } from "../components/ThemePicker";
import { SourceBadge } from "../components/SourceBadge";
import { Settings } from "../components/Settings";
import { AppContextMenu } from "../components/AppContextMenu";
import { Kbd } from "../components/Kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { useColorExtraction } from "../hooks/useColorExtraction";
import { useIdleMode } from "../hooks/useIdleMode";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { quitApplication } from "../lib/appLifecycle";
import { commitSettings } from "../lib/settings";
import {
  ART_AMBIENT_MODE,
  applyVisualMode,
  resetAmbientColors,
} from "../lib/themes/applier";
import { setNativeWindowMode } from "../lib/window";

const VINYL_SIZE = 420;
const RING_SIZE = VINYL_SIZE + 28;

// Shared transition for idle fade in/out
const IDLE_TRANSITION =
  "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), pointer-events 0ms";
const IDLE_RETURN_TRANSITION = "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)";
const IDLE_CENTERPIECE_TRANSITION =
  "transform 900ms cubic-bezier(0.16, 1, 0.3, 1)";

interface PlaybackProgressRingProps {
  duration: number;
  isPlaying: boolean;
  size: number;
  canSeek: boolean;
  onSeek: (positionSeconds: number) => void;
}

function PlaybackProgressRing({
  duration,
  isPlaying,
  size,
  canSeek,
  onSeek,
}: PlaybackProgressRingProps) {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPosition(
        useVinylDeckStore.getState().devForceEmpty
          ? 0
          : useVinylDeckStore.getState().getPosition(),
      );
    }, 500);

    return () => clearInterval(id);
  }, []);

  function handleSeek(positionSeconds: number) {
    setPosition(positionSeconds);
    onSeek(positionSeconds);
  }

  return (
    <ProgressRing
      duration={duration}
      position={position}
      isPlaying={isPlaying}
      size={size}
      onSeek={canSeek ? handleSeek : undefined}
    />
  );
}

export function MainView() {
  const playback = useVinylDeckStore(selectPlayback);
  const rawIsPlaying = useVinylDeckStore(selectIsPlaying);
  const rawArtworkDataUrl = useVinylDeckStore(selectArtwork);
  const theme = useVinylDeckStore(selectTheme);
  const settings = useVinylDeckStore(selectSettings);
  const trackChangeDirection = useVinylDeckStore(selectTrackChangeDirection);
  const trackChangeNonce = useVinylDeckStore(selectTrackChangeNonce);
  const source = useVinylDeckStore((s) => s.source);
  const beginPendingSeek = useVinylDeckStore((s) => s.beginPendingSeek);
  const markTrackChangeIntent = useVinylDeckStore(
    (s) => s.markTrackChangeIntent,
  );
  const devForceEmpty = useVinylDeckStore((s) => s.devForceEmpty);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const effectivePlayback = devForceEmpty ? EMPTY_PLAYBACK : playback;
  const isPlaying = devForceEmpty ? false : rawIsPlaying;
  const artworkDataUrl = devForceEmpty ? null : rawArtworkDataUrl;

  useKeyboardShortcuts({
    renderMode: "main",
    isSettingsOpen,
    onCloseSettings: () => setIsSettingsOpen(false),
    onOpenSettings: () => setIsSettingsOpen(true),
  });

  // Album art extraction now drives the vinyl pressing on every theme.
  // Ambient tinting is gated by the Art Ambient toggle in both shells.
  useColorExtraction(artworkDataUrl, {
    ambientEnabled: settings.ambientMode !== "off",
    seed: `${effectivePlayback.album || effectivePlayback.track || "Unknown Album"}|${effectivePlayback.artist || "Unknown Artist"}`,
  });

  // Phase 7: Idle detection — only when playing
  const isIdle = useIdleMode(isPlaying, {
    enabled: settings.leanBackMode,
    hideCursor: settings.cursorHide,
    timeoutMs: settings.idleTimeoutSeconds * 1000,
  });

  useEffect(() => {
    if (!isSettingsOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsSettingsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsOpen]);

  // Controls handlers — delegate to source
  function handlePlay() {
    source?.play();
  }
  function handlePause() {
    source?.pause();
  }
  function handleNext() {
    markTrackChangeIntent("next");
    source?.next();
  }
  function handlePrevious() {
    markTrackChangeIntent("previous");
    source?.previous();
  }

  // Phase 8: Seek handler — delegates to source
  function handleSeek(positionSeconds: number) {
    beginPendingSeek(positionSeconds);
    source?.seekTo(positionSeconds);
  }

  function applyCommittedSettings(nextSettings: typeof settings) {
    useVinylDeckStore.getState().hydrateSettings(nextSettings);
    applyVisualMode(nextSettings.theme, nextSettings.ambientMode);
    if (nextSettings.ambientMode === "off") resetAmbientColors();
  }

  function handleWindowModeSelect(mode: "main" | "fullscreen" | "mini") {
    void commitSettings({ windowMode: mode })
      .then((nextSettings) => {
        applyCommittedSettings(nextSettings);
        return setNativeWindowMode(mode);
      })
      .catch((error) => {
        console.warn("[ContextMenu] Window mode failed:", error);
      });
  }

  function handleArtAmbientToggle() {
    const nextMode = settings.ambientMode === "off" ? ART_AMBIENT_MODE : "off";
    if (nextMode === "off") resetAmbientColors();
    void commitSettings({
      ambientMode: nextMode,
      artAmbient: nextMode !== "off",
    })
      .then(applyCommittedSettings)
      .catch((error) => {
        console.warn("[ContextMenu] Art Ambient failed:", error);
      });
  }

  const contextMenuActions = useMemo(
    () => [
      {
        id: "play-pause",
        label: isPlaying ? "Pause" : "Play",
        kbd: "Space",
        disabled: !canUseTransportControls(effectivePlayback),
        onSelect: isPlaying ? handlePause : handlePlay,
      },
      {
        id: "previous",
        label: "Previous",
        kbd: "Left",
        disabled: !canUseSkipControls(effectivePlayback),
        onSelect: handlePrevious,
      },
      {
        id: "next",
        label: "Next",
        kbd: "Right",
        disabled: !canUseSkipControls(effectivePlayback),
        onSelect: handleNext,
      },
      {
        id: "art-ambient",
        label:
          settings.ambientMode === "off" ? "Art Ambient On" : "Art Ambient Off",
        kbd: "A",
        onSelect: handleArtAmbientToggle,
      },
      {
        id: "fullscreen",
        label:
          settings.windowMode === "fullscreen" ? "Exit Fullscreen" : "Fullscreen",
        kbd: "F",
        onSelect: () =>
          handleWindowModeSelect(
            settings.windowMode === "fullscreen" ? "main" : "fullscreen",
          ),
      },
      {
        id: "mini",
        label: "Mini Player",
        kbd: "M",
        onSelect: () => handleWindowModeSelect("mini"),
      },
      {
        id: "settings",
        label: "Settings",
        onSelect: () => setIsSettingsOpen(true),
      },
      {
        id: "quit",
        label: "Quit",
        kbd: "Ctrl Q",
        destructive: true,
        onSelect: () => {
          void quitApplication().catch((error) => {
            console.warn("[ContextMenu] Quit failed:", error);
          });
        },
      },
    ],
    [effectivePlayback, isPlaying, settings.ambientMode, settings.windowMode],
  );

  // Idle UI style — shared across Controls / TrackInfo / ThemePicker
  const idleHideStyle = {
    opacity: isIdle ? 0 : 1,
    pointerEvents: isIdle ? ("none" as const) : ("auto" as const),
    transition: isIdle ? IDLE_TRANSITION : IDLE_RETURN_TRANSITION,
  };

  const idleVinylAreaStyle = {
    transform: isIdle
      ? "translate3d(0, clamp(72px, 8.8vh, 96px), 0) scale(1.22)"
      : "translate3d(0, 0, 0) scale(1)",
    transformOrigin: "center center",
    transition: IDLE_CENTERPIECE_TRANSITION,
    willChange: isPlaying ? ("transform" as const) : undefined,
  };

  return (
    <>
      {/* z:0 — Ambient background */}
      <AmbientLayer
        filmGrain={settings.filmGrain}
        mode={settings.ambientMode}
        theme={theme}
      />

      {/* z:0 — Vapor grid floor */}
      <VaporGrid />

      {/* z:1 — Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "28px",
          padding: "40px 24px",
        }}
      >
        {/* Vinyl area */}
        <Tooltip maxVisibleMs={1800}>
          <TooltipTrigger>
            <div
              style={{
                position: "relative",
                width: `${RING_SIZE}px`,
                height: `${RING_SIZE}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                ...idleVinylAreaStyle,
              }}
            >
              {/* Progress ring — Phase 8: receives onSeek */}
              {/* Phase 7: ring fades with rest of UI on idle */}
              <div style={idleHideStyle}>
                <PlaybackProgressRing
                  duration={effectivePlayback.duration}
                  isPlaying={isPlaying}
                  size={RING_SIZE}
                  canSeek={canUseSeekControl(effectivePlayback)}
                  onSeek={handleSeek}
                />
              </div>

              {/* Vinyl record */}
              <div style={{ position: "relative", zIndex: 2 }}>
                <VinylRecord
                  isPlaying={isPlaying}
                  vinylWobble={settings.vinylWobble}
                  artworkDataUrl={artworkDataUrl}
                  trackTitle={effectivePlayback.track}
                  size={VINYL_SIZE}
                  trackChangeDirection={trackChangeDirection}
                  trackChangeNonce={trackChangeNonce}
                />
              </div>

              {/* Needle arm */}
              <NeedleArm
                isPlaying={isPlaying}
                trackKey={effectivePlayback.track}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Drag to seek</TooltipContent>
        </Tooltip>

        {/* Track info — Phase 7: fades on idle */}
        <div style={idleHideStyle}>
          <TrackInfo
            track={effectivePlayback.track || "Nothing Playing"}
            artist={effectivePlayback.artist}
            album={effectivePlayback.album}
            direction={trackChangeDirection}
          />
        </div>

        {/* Controls — Phase 7: fades on idle */}
        <div style={idleHideStyle}>
          <Controls
            isPlaying={isPlaying}
            canControl={effectivePlayback.canControl}
            canSkip={effectivePlayback.canSkip}
            onPlay={handlePlay}
            onPause={handlePause}
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        </div>

        {/* Theme picker — Phase 7: fades on idle */}
        <div style={idleHideStyle}>
          <ThemePicker />
        </div>
      </div>

      {/* z:2 — Source badge */}
      <SourceBadge sourceName={effectivePlayback.sourceName} />

      <AppContextMenu actions={contextMenuActions} />

      {/* z:90 — Settings trigger */}
      <Tooltip side="bottom">
        <TooltipTrigger>
          <button
            type="button"
            className="settings-trigger"
            aria-label="Open settings"
            aria-haspopup="dialog"
            aria-expanded={isSettingsOpen}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsSettingsOpen(true);
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4.5 7.25h5.25"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
              />
              <path
                d="M13.75 7.25h5.75"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
              />
              <path
                d="M4.5 12h9.25"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
              />
              <path
                d="M17.75 12h1.75"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
              />
              <path
                d="M4.5 16.75h2.75"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
              />
              <path
                d="M11.25 16.75h8.25"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
              />
              <circle
                cx="11.75"
                cy="7.25"
                r="2"
                stroke="currentColor"
                strokeWidth="1.55"
              />
              <circle
                cx="15.75"
                cy="12"
                r="2"
                stroke="currentColor"
                strokeWidth="1.55"
              />
              <circle
                cx="9.25"
                cy="16.75"
                r="2"
                stroke="currentColor"
                strokeWidth="1.55"
              />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Settings <Kbd>S</Kbd>
        </TooltipContent>
      </Tooltip>

      {/* z:40 — Settings overlay */}
      <Settings
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
