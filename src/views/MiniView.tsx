import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import {
  currentMonitor,
  getCurrentWindow,
  PhysicalPosition,
} from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { AmbientLayer } from "../components/AmbientLayer";
import { Controls } from "../components/Controls";
import { TrackInfo } from "../components/TrackInfo";
import { VinylRecord } from "../components/VinylRecord";
import { VaporGrid } from "../components/VaporGrid";
import { useColorExtraction } from "../hooks/useColorExtraction";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { setNativeWindowMode } from "../lib/window";
import {
  EMPTY_PLAYBACK,
  selectArtwork,
  selectIsPlaying,
  selectPlayback,
  selectTheme,
  selectTrackChangeDirection,
  selectTrackChangeNonce,
  useVinylDeckStore,
} from "../lib/playback/store";
import "./MiniView.css";

const MINI_CONTROLS_HIDE_MS = 1400;
const MINI_SNAP_THRESHOLD_PX = 28;
const MINI_SNAP_MARGIN_PX = 8;
const MINI_SNAP_SETTLE_MS = 180;
const MINI_BASE_SIZE = 280;
const MINI_BASE_VINYL_SIZE = 172;
const MINI_COMPACT_TRACK_THRESHOLD = 218;

/** Class toggled on <html> only inside the Mini window's own document, so it
 * never leaks into Main/Fullscreen (separate WebView, separate DOM). Lets
 * global.css punch the body/root background fully transparent so the native
 * Windows Acrylic effect behind the WebView is visible. */
const MINI_TRANSPARENT_HTML_CLASS = "mini-transparent-active";

export function MiniView() {
  const playback = useVinylDeckStore(selectPlayback);
  const rawIsPlaying = useVinylDeckStore(selectIsPlaying);
  const rawArtworkDataUrl = useVinylDeckStore(selectArtwork);
  const theme = useVinylDeckStore(selectTheme);
  const trackChangeDirection = useVinylDeckStore(selectTrackChangeDirection);
  const trackChangeNonce = useVinylDeckStore(selectTrackChangeNonce);
  const source = useVinylDeckStore((s) => s.source);
  const markTrackChangeIntent = useVinylDeckStore(
    (s) => s.markTrackChangeIntent,
  );
  const devForceEmpty = useVinylDeckStore((s) => s.devForceEmpty);
  const settings = useVinylDeckStore((s) => s.settings);
  const isTransparent = settings.miniTransparentMode;

  useKeyboardShortcuts({ renderMode: "mini" });

  const effectivePlayback = devForceEmpty ? EMPTY_PLAYBACK : playback;
  const isPlaying = devForceEmpty ? false : rawIsPlaying;
  const artworkDataUrl = devForceEmpty ? null : rawArtworkDataUrl;
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const miniMetrics = useMiniResizeMetrics();
  const miniStyle = {
    "--mini-scale": miniMetrics.scale,
    "--mini-track-offset": `${100 * miniMetrics.scale}px`,
    "--mini-track-width": `${230 * miniMetrics.scale}px`,
    "--mini-track-gutter": `${26 * miniMetrics.scale}px`,
    "--mini-track-scale": 0.72 * miniMetrics.scale,
    "--mini-track-compact-scale": 0.64 * miniMetrics.scale,
    "--mini-controls-scale": 0.68 * miniMetrics.scale,
    "--mini-control-bottom": `${13 * miniMetrics.scale}px`,
    "--mini-control-translate": `${14 * miniMetrics.scale}px`,
    "--mini-control-pad-y": `${8 * miniMetrics.scale}px`,
    "--mini-control-pad-x": `${14 * miniMetrics.scale}px`,
    "--mini-return-size": `${30 * miniMetrics.scale}px`,
    "--mini-return-icon-size": `${16 * miniMetrics.scale}px`,
    "--mini-return-offset": `${10 * miniMetrics.scale}px`,
  } as CSSProperties;

  function revealControls() {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      MINI_CONTROLS_HIDE_MS,
    );
  }

  function handleMouseDown(event: MouseEvent<HTMLElement>) {
    revealControls();
    if (event.button !== 0 || !isTauri()) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, .mini-view__controls, .mini-view__return"))
      return;

    void getCurrentWindow()
      .startDragging()
      .catch((error) => {
        console.warn("[Window] Mini drag failed:", error);
      });
  }

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // Mini Transparency is exclusive to this window: toggle a class on this
  // document's <html> so global.css can drop body/#root to fully transparent
  // while the setting is on, revealing the native Acrylic effect applied by
  // the Rust backend. Always cleaned up on unmount/toggle-off.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(MINI_TRANSPARENT_HTML_CLASS, isTransparent);
    return () => {
      root.classList.remove(MINI_TRANSPARENT_HTML_CLASS);
    };
  }, [isTransparent]);

  useColorExtraction(artworkDataUrl, {
    ambientEnabled: settings.ambientMode !== "off",
    seed: `${effectivePlayback.album || effectivePlayback.track || "Unknown Album"}|${effectivePlayback.artist || "Unknown Artist"}`,
  });
  useMiniCornerSnap();

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

  return (
    <main
      className={`mini-view${isTransparent ? " mini-view--transparent" : ""}${miniMetrics.isCompact ? " mini-view--compact" : ""}`}
      style={miniStyle}
      onMouseMove={revealControls}
      onMouseDown={handleMouseDown}
      onContextMenu={(event) => event.preventDefault()}
      onTouchStart={revealControls}
    >
      <AmbientLayer
        filmGrain={settings.filmGrain}
        mode={settings.ambientMode}
        theme={theme}
      />
      <VaporGrid />

      <section className="mini-view__centerpiece" aria-label="Mini player">
        <VinylRecord
          isPlaying={isPlaying}
          vinylWobble={settings.vinylWobble}
          artworkDataUrl={artworkDataUrl}
          trackTitle={effectivePlayback.track}
          size={miniMetrics.vinylSize}
          trackChangeDirection={trackChangeDirection}
          trackChangeNonce={trackChangeNonce}
        />
      </section>

      <div className="mini-view__track">
        <TrackInfo
          track={effectivePlayback.track || "Nothing Playing"}
          artist={effectivePlayback.artist}
          album={effectivePlayback.album}
          direction={trackChangeDirection}
          showTooltip={false}
        />
      </div>

      <div
        className={`mini-view__controls${controlsVisible ? " mini-view__controls--visible" : ""}`}
      >
        <Controls
          isPlaying={isPlaying}
          canControl={effectivePlayback.canControl}
          canSkip={effectivePlayback.canSkip}
          onPlay={handlePlay}
          onPause={handlePause}
          onNext={handleNext}
          onPrevious={handlePrevious}
          showTooltips={false}
        />
      </div>

      <button
        className={`mini-view__return${controlsVisible ? " mini-view__return--visible" : ""}`}
        type="button"
        aria-label="Return to main window"
        onClick={(event) => {
          event.stopPropagation();
          void setNativeWindowMode("main");
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 4H4v4M4 4l6.5 6.5M16 20h4v-4M20 20l-6.5-6.5M20 8V4h-4M20 4l-6.5 6.5M4 16v4h4M4 20l6.5-6.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </main>
  );
}

function useMiniResizeMetrics() {
  const [metrics, setMetrics] = useState(readMiniResizeMetrics);

  useEffect(() => {
    function updateMetrics() {
      setMetrics(readMiniResizeMetrics());
    }

    updateMetrics();
    window.addEventListener("resize", updateMetrics);
    return () => window.removeEventListener("resize", updateMetrics);
  }, []);

  return metrics;
}

function readMiniResizeMetrics() {
  if (typeof window === "undefined") {
    return {
      scale: 1,
      vinylSize: MINI_BASE_VINYL_SIZE,
      isCompact: false,
    };
  }

  const side = Math.min(window.innerWidth, window.innerHeight, MINI_BASE_SIZE);
  const scale = side / MINI_BASE_SIZE;

  return {
    scale,
    vinylSize: Math.round(MINI_BASE_VINYL_SIZE * scale),
    isCompact: side < MINI_COMPACT_TRACK_THRESHOLD,
  };
}

function useMiniCornerSnap() {
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snappingRef = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;

    const appWindow = getCurrentWindow();
    if (appWindow.label !== "mini") return;

    let unlisten: (() => void) | undefined;

    async function installMovedListener() {
      unlisten = await appWindow.onMoved(() => {
        if (snappingRef.current) return;
        if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
        snapTimerRef.current = setTimeout(() => {
          void snapNearCorner();
        }, MINI_SNAP_SETTLE_MS);
      });
    }

    async function snapNearCorner() {
      const monitor = await currentMonitor();
      if (!monitor) return;

      const position = await appWindow.outerPosition();
      const size = await appWindow.outerSize();
      const area = monitor.workArea;
      const left = area.position.x + MINI_SNAP_MARGIN_PX;
      const top = area.position.y + MINI_SNAP_MARGIN_PX;
      const right =
        area.position.x + area.size.width - size.width - MINI_SNAP_MARGIN_PX;
      const bottom =
        area.position.y + area.size.height - size.height - MINI_SNAP_MARGIN_PX;
      const snapX =
        Math.abs(position.x - left) <= MINI_SNAP_THRESHOLD_PX
          ? left
          : Math.abs(position.x - right) <= MINI_SNAP_THRESHOLD_PX
            ? right
            : null;
      const snapY =
        Math.abs(position.y - top) <= MINI_SNAP_THRESHOLD_PX
          ? top
          : Math.abs(position.y - bottom) <= MINI_SNAP_THRESHOLD_PX
            ? bottom
            : null;

      if (snapX === null || snapY === null) return;

      snappingRef.current = true;
      try {
        await appWindow.setPosition(new PhysicalPosition(snapX, snapY));
      } finally {
        window.setTimeout(() => {
          snappingRef.current = false;
        }, MINI_SNAP_SETTLE_MS);
      }
    }

    void installMovedListener();

    return () => {
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
      unlisten?.();
    };
  }, []);
}
