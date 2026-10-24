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

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  nextRepeatMode,
  setRepeatMode,
  setShuffle,
} from "../lib/media/controls";

import { AmbientLayer } from "../components/AmbientLayer";
import { SeasonalLayer } from "../components/SeasonalLayer";
import { VaporGrid } from "../components/VaporGrid";
import { VinylRecord } from "../components/VinylRecord";
import { NeedleArm } from "../components/NeedleArm";
import { ProgressRing } from "../components/ProgressRing";
import { TrackInfo } from "../components/TrackInfo";
import { Controls } from "../components/Controls";
import { ThemePicker } from "../components/ThemePicker";
import { ThemeMenu } from "../components/ThemeMenu";
import { SourceBadge } from "../components/SourceBadge";
import { Settings } from "../components/Settings";
import type { SettingsTab } from "../components/Settings";
import { AppContextMenu } from "../components/AppContextMenu";
import type { AppContextMenuHandle } from "../components/AppContextMenu";
import { Crate } from "../components/Crate";
import { CrateStamp } from "../components/Crate/CrateStamp";
import { ShortcutSheet } from "../components/ShortcutSheet";
import { useCratePressing, useCurrentRecord } from "../hooks/useCrate";
import { Kbd } from "../components/Kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { useColorExtraction } from "../hooks/useColorExtraction";
import { logger } from "../lib/logger";
import { useIdleMode } from "../hooks/useIdleMode";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useWindowActivity } from "../hooks/useWindowActivity";
import { quitApplication } from "../lib/appLifecycle";
import { commitSettings } from "../lib/settings";
import {
  ART_AMBIENT_MODE,
  applyVisualMode,
  resetAmbientColors,
} from "../lib/themes/applier";
import { setNativeWindowMode } from "../lib/window";
import {
  cancelSleepTimer,
  getSleepTimer,
  startSleepTimer,
  subscribeToSleepTimer,
  subscribeToSleepTimerFired,
} from "../lib/sleep";
import type {
  SleepTimerMode,
  SleepTimerSnapshot,
} from "../lib/sleep";

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
  suspended: boolean;
  size: number;
  canSeek: boolean;
  onSeek: (positionSeconds: number) => void;
  previewPosition: number | null;
}

function getLivePosition(): number {
  const state = useVinylDeckStore.getState();
  return state.devForceEmpty ? 0 : state.getPosition();
}

function PlaybackProgressRing({
  duration,
  isPlaying,
  suspended,
  size,
  canSeek,
  onSeek,
  previewPosition,
}: PlaybackProgressRingProps) {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    // Sync once on play/pause or visibility change, then only tick while the
    // record is actually spinning on a visible window.
    setPosition(getLivePosition());
    if (!isPlaying || suspended) return;

    const id = setInterval(() => {
      setPosition(getLivePosition());
    }, 500);

    return () => clearInterval(id);
  }, [isPlaying, suspended]);

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
      previewPosition={previewPosition}
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
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("LOOK");
  const [needlePreview, setNeedlePreview] = useState<number | null>(null);
  const [isCrateOpen, setIsCrateOpen] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerSnapshot | null>(null);
  const [parkRequest, setParkRequest] = useState(0);
  const { isSuspended } = useWindowActivity();
  const contextMenuRef = useRef<AppContextMenuHandle>(null);
  const effectivePlayback = devForceEmpty ? EMPTY_PLAYBACK : playback;
  const isPlaying = devForceEmpty ? false : rawIsPlaying;
  const artworkDataUrl = devForceEmpty ? null : rawArtworkDataUrl;

  useKeyboardShortcuts({
    renderMode: "main",
    isSettingsOpen,
    onCloseSettings: () => setIsSettingsOpen(false),
    onOpenSettings: () => {
      setSettingsTab("LOOK");
      setIsSettingsOpen(true);
    },
    isCrateOpen,
    onCloseCrate: () => setIsCrateOpen(false),
    onToggleCrate: () => setIsCrateOpen((open) => !open),
    isContextMenuOpen,
    onCloseContextMenu: () => contextMenuRef.current?.close(),
    isShortcutsOpen,
    onOpenShortcuts: () => setIsShortcutsOpen(true),
    onCloseShortcuts: () => setIsShortcutsOpen(false),
    onToggleShortcuts: () => setIsShortcutsOpen((open) => !open),
  });

  // Sleep timer: read the backend's ephemeral state, then follow its events.
  // The fired event only parks the tonearm; Rust already sent the pause.
  useEffect(() => {
    let alive = true;
    let unlistenChanged: (() => void) | undefined;
    let unlistenFired: (() => void) | undefined;

    void subscribeToSleepTimer((snapshot) => {
      if (alive) setSleepTimer(snapshot);
    })
      .then((unlisten) => {
        if (!alive) {
          unlisten();
          return;
        }
        unlistenChanged = unlisten;
        // Snapshot after subscribing so no change can slip between the two.
        void getSleepTimer().then((snapshot) => {
          if (alive) setSleepTimer(snapshot);
        });
      })
      .catch((error) => {
        logger.warn("[SleepTimer] Subscribe failed:", error);
      });
    void subscribeToSleepTimerFired(() => {
      if (alive) setParkRequest((request) => request + 1);
    })
      .then((unlisten) => {
        if (alive) unlistenFired = unlisten;
        else unlisten();
      })
      .catch((error) => {
        logger.warn("[SleepTimer] Fired subscribe failed:", error);
      });

    return () => {
      alive = false;
      unlistenChanged?.();
      unlistenFired?.();
    };
  }, []);

  // The Crate: press this album into the collection; wear follows play count.
  useCratePressing(effectivePlayback);
  const currentRecord = useCurrentRecord(effectivePlayback);

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
  function handleToggleShuffle() {
    if (!effectivePlayback.canShuffle) return;
    void setShuffle(!effectivePlayback.shuffle);
  }
  function handleToggleRepeat() {
    if (!effectivePlayback.canRepeat) return;
    void setRepeatMode(nextRepeatMode(effectivePlayback.repeatMode));
  }

  // Phase 8: Seek handler — delegates to source
  function handleSeek(positionSeconds: number) {
    beginPendingSeek(positionSeconds);
    source?.seekTo(positionSeconds);
  }

  function applyCommittedSettings(nextSettings: typeof settings) {
    useVinylDeckStore.getState().hydrateSettings(nextSettings);
    applyVisualMode(nextSettings.theme, nextSettings.ambientMode, nextSettings.scheme);
    if (nextSettings.ambientMode === "off") resetAmbientColors();
  }

  function handleWindowModeSelect(mode: "main" | "fullscreen" | "mini") {
    void commitSettings({ windowMode: mode })
      .then((nextSettings) => {
        applyCommittedSettings(nextSettings);
        return setNativeWindowMode(mode);
      })
      .catch((error) => {
        logger.warn("[ContextMenu] Window mode failed:", error);
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
        logger.warn("[ContextMenu] Art Ambient failed:", error);
      });
  }

  function handleSleepStart(mode: SleepTimerMode, minutes?: number) {
    void startSleepTimer(mode, minutes)
      .then((snapshot) => setSleepTimer(snapshot))
      .catch((error) => {
        logger.warn("[ContextMenu] Sleep timer failed:", error);
      });
  }

  function handleSleepCancel() {
    void cancelSleepTimer()
      .then(() => setSleepTimer(null))
      .catch((error) => {
        logger.warn("[ContextMenu] Sleep timer cancel failed:", error);
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
        id: "crate",
        label: "The Crate",
        kbd: "C",
        onSelect: () => setIsCrateOpen(true),
      },
      {
        id: "settings",
        label: "Settings",
        onSelect: () => {
          setSettingsTab("LOOK");
          setIsSettingsOpen(true);
        },
      },
      {
        id: "player-source",
        label: "Player source\u2026",
        onSelect: () => {
          setSettingsTab("SOURCE");
          setIsSettingsOpen(true);
        },
      },
      {
        id: "sleep-30",
        label: "Sleep 30 min",
        onSelect: () => handleSleepStart("minutes", 30),
      },
      {
        id: "sleep-track",
        label: "Sleep after track",
        onSelect: () => handleSleepStart("endOfTrack"),
      },
      ...(sleepTimer
        ? [
            {
              id: "sleep-cancel",
              label: "Cancel sleep timer",
              onSelect: handleSleepCancel,
            },
          ]
        : []),
      {
        id: "quit",
        label: "Quit",
        kbd: "Ctrl Q",
        destructive: true,
        onSelect: () => {
          void quitApplication().catch((error) => {
            logger.warn("[ContextMenu] Quit failed:", error);
          });
        },
      },
    ],
    // Handlers are recreated every render; including them would rebuild the
    // menu constantly. The listed values capture everything the labels need.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      effectivePlayback,
      isPlaying,
      settings.ambientMode,
      settings.windowMode,
      sleepTimer,
    ],
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

      {/* z:0 — Halloween decoration, shown only by data-scheme CSS */}
      <SeasonalLayer />

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
                  suspended={isSuspended}
                  size={RING_SIZE}
                  canSeek={canUseSeekControl(effectivePlayback)}
                  onSeek={handleSeek}
                  previewPosition={needlePreview}
                />
              </div>

              {/* Vinyl record */}
              <div style={{ position: "relative", zIndex: 2 }}>
                <VinylRecord
                  isPlaying={isPlaying}
                  suspended={isSuspended}
                  vinylWobble={settings.vinylWobble}
                  artworkDataUrl={artworkDataUrl}
                  trackTitle={effectivePlayback.track}
                  size={VINYL_SIZE}
                  trackChangeDirection={trackChangeDirection}
                  trackChangeNonce={trackChangeNonce}
                  wear={currentRecord.wear}
                  wearAngle={currentRecord.wearAngle}
                />
              </div>

              {/* Needle arm */}
              {/* Needle Drop: drag the headshell to seek, off the record to pause */}
              <NeedleArm
                isPlaying={isPlaying}
                trackKey={effectivePlayback.track}
                duration={effectivePlayback.duration}
                getPosition={getLivePosition}
                canSeek={canUseSeekControl(effectivePlayback)}
                canControl={canUseTransportControls(effectivePlayback)}
                onSeek={handleSeek}
                onPlay={handlePlay}
                onPause={handlePause}
                onScrubPreview={setNeedlePreview}
                parkRequest={parkRequest}
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
            canRepeat={effectivePlayback.canRepeat}
            canShuffle={effectivePlayback.canShuffle}
            repeatMode={effectivePlayback.repeatMode}
            shuffle={effectivePlayback.shuffle}
            onToggleRepeat={handleToggleRepeat}
            onToggleShuffle={handleToggleShuffle}
          />
        </div>

        {/* Theme picker — Phase 7: fades on idle */}
        <div style={idleHideStyle}>
          <ThemePicker />
        </div>
      </div>

      {/* z:2 — Source badge */}
      <SourceBadge sourceName={effectivePlayback.sourceName} />

      {/* z:50 — Pressing stamp for the record on the deck */}
      <div style={idleHideStyle}>
        <CrateStamp
          record={currentRecord.record}
          onOpenCrate={() => setIsCrateOpen(true)}
        />
      </div>

      <AppContextMenu
        ref={contextMenuRef}
        actions={contextMenuActions}
        onOpenChange={setIsContextMenuOpen}
      />

      {/* z:90 — Crate trigger */}
      <Tooltip side="bottom">
        <TooltipTrigger>
          <button
            type="button"
            className="settings-trigger crate-trigger"
            aria-label="Open the crate"
            aria-haspopup="dialog"
            aria-expanded={isCrateOpen}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsCrateOpen(true);
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="9.5" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.55" />
              <circle cx="14.5" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.55" />
              <path
                d="M3.75 13.25h16.5v4.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2v-4.5Z"
                fill="var(--surface-bg, #111)"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinejoin="round"
              />
              <path d="M9.5 16.5h5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          The Crate <Kbd>C</Kbd>
        </TooltipContent>
      </Tooltip>

      {/* z:90 — Mini player trigger */}
      <Tooltip side="bottom">
        <TooltipTrigger>
          <button
            type="button"
            className="settings-trigger mini-trigger"
            aria-label="Open mini player"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleWindowModeSelect("mini");
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="3.25"
                y="4.75"
                width="17.5"
                height="14.5"
                rx="3.25"
                stroke="currentColor"
                strokeWidth="1.55"
              />
              <path
                d="M10 14 17.5 6.5M17.5 6.5h-4.4M17.5 6.5v4.4"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.6 17.2h4.2a1.5 1.5 0 0 0 1.5-1.5v-2"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Mini Player <Kbd>M</Kbd>
        </TooltipContent>
      </Tooltip>

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
              setSettingsTab("LOOK");
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

      {/* z:90 — Theme (scheme) menu */}
      <ThemeMenu />

      {/* z:80 — The Crate overlay */}
      <Crate
        open={isCrateOpen}
        onClose={() => setIsCrateOpen(false)}
        focusKey={currentRecord.record?.key ?? null}
      />

      {/* z:93 — Keyboard shortcuts cheat sheet (above Crate, below title bar) */}
      <ShortcutSheet
        open={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* z:40 — Settings overlay */}
      <Settings
        open={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
