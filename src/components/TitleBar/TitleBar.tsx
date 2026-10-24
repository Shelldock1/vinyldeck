import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { commitSettings } from "../../lib/settings";
import { useVinylDeckStore } from "../../lib/playback/store";
import { setNativeWindowMode } from "../../lib/window";
import "./TitleBar.css";
import { logger } from "../../lib/logger";

/** Pointer this close to the top edge reveals the fullscreen bar. */
const FULLSCREEN_REVEAL_PX = 64;

interface TitleBarProps {
  visible: boolean;
  /** Fullscreen keeps the controls but tucks the bar away until hovered. */
  fullscreen?: boolean;
}

/**
 * Linux-style custom window chrome.
 *
 * The app runs with native decorations disabled so the window is not wrapped
 * in the desktop's default (light) titlebar. This bar replaces it: it matches
 * the noir surface, owns dragging, and exposes minimize/maximize/close.
 * In fullscreen it auto-hides and maximize becomes "exit fullscreen".
 */
export function TitleBar({ visible, fullscreen = false }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const appWindow = isTauri() ? getCurrentWindow() : null;

  useEffect(() => {
    if (!visible || !isTauri()) return;
    const win = getCurrentWindow();
    let unlisten = () => {};
    let cancelled = false;

    const sync = () => {
      void win.isMaximized().then((value) => {
        if (!cancelled) setIsMaximized(value);
      });
    };
    sync();
    void win.onResized(sync).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !fullscreen) {
      setRevealed(false);
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      setRevealed(event.clientY <= FULLSCREEN_REVEAL_PX);
    }
    function handlePointerLeave() {
      setRevealed(false);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [visible, fullscreen]);

  if (!visible) return null;

  function handleMinimize() {
    void appWindow?.minimize().catch((error) => {
      logger.warn("[TitleBar] Minimize failed:", error);
    });
  }

  function handleToggleMaximize() {
    void appWindow?.toggleMaximize().catch((error) => {
      logger.warn("[TitleBar] Toggle maximize failed:", error);
    });
  }

  function handleExitFullscreen() {
    void commitSettings({ windowMode: "main" })
      .then((settings) => {
        useVinylDeckStore.getState().hydrateSettings(settings);
        return setNativeWindowMode("main");
      })
      .catch((error) => {
        logger.warn("[TitleBar] Exit fullscreen failed:", error);
      });
  }

  function handleClose() {
    void appWindow?.close().catch((error) => {
      logger.warn("[TitleBar] Close failed:", error);
    });
  }

  const className = `titlebar${fullscreen ? " titlebar--fullscreen" : ""}${revealed ? " titlebar--revealed" : ""}`;

  // Double-click maximize is owned by Tauri's injected drag script
  // (`plugin:window|internal_toggle_maximize` on `detail === 2`), which fires
  // for any `data-tauri-drag-region` on Windows/Linux. A React `onDoubleClick`
  // here toggled maximize a second time, so the window maximized and snapped back.
  return (
    <div
      className={className}
      data-tauri-drag-region={fullscreen ? undefined : true}
    >
      <span className="titlebar__brand" data-tauri-drag-region={fullscreen ? undefined : true}>
        VinylDeck
      </span>

      <div className="titlebar__controls">
        <button
          type="button"
          className="titlebar__button titlebar__button--close"
          aria-label="Close window"
          title="Close"
          onClick={handleClose}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7.5 7.5l9 9M16.5 7.5l-9 9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="titlebar__button"
          aria-label="Minimize window"
          title="Minimize"
          onClick={handleMinimize}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        {fullscreen ? (
          <button
            type="button"
            className="titlebar__button"
            aria-label="Exit fullscreen"
            title="Exit fullscreen (Esc)"
            onClick={handleExitFullscreen}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="titlebar__button"
            aria-label={isMaximized ? "Restore window" : "Maximize window"}
            title={isMaximized ? "Restore" : "Maximize"}
            onClick={handleToggleMaximize}
          >
            {isMaximized ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="6" y="9" width="9" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
                <path d="M9 6h7.4A1.6 1.6 0 0 1 18 7.6V15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="6.5" y="6.5" width="11" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            )}
          </button>
        )}

      </div>
    </div>
  );
}
