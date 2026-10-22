// src/hooks/useWindowActivity.ts
// True when this window cannot show animation work: the document is hidden
// (backgrounded/minimized) or the native window reports minimized.
// Losing focus to another app while still visible is NOT a suspension.
// Callers use this to stop continuous rAF loops; state is left untouched.

import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function isWindowSuspended(hidden: boolean, minimized: boolean): boolean {
  return hidden || minimized;
}

export function useWindowActivity(): { isSuspended: boolean } {
  const [hidden, setHidden] = useState(() =>
    typeof document === "undefined" ? false : document.hidden,
  );
  const [minimized, setMinimized] = useState(false);

  // Browser/WebKit visibility: covers tab switches, minimize and occlusion.
  useEffect(() => {
    const syncVisibility = () => setHidden(document.hidden);

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  // Native window state: on some compositors the WebView is not told it was
  // iconified, so ask Tauri directly. Re-check on focus and resize.
  useEffect(() => {
    if (!isTauri()) return;

    let alive = true;
    const unlisteners: Array<() => void> = [];
    const currentWindow = getCurrentWindow();

    const syncMinimized = () => {
      void currentWindow
        .isMinimized()
        .then((value) => {
          if (alive) setMinimized(value);
        })
        .catch(() => {
          // Window may already be closing; keep the last known state.
        });
    };

    void (async () => {
      try {
        const [unlistenFocus, unlistenResize] = await Promise.all([
          currentWindow.onFocusChanged(() => syncMinimized()),
          currentWindow.onResized(() => syncMinimized()),
        ]);
        if (!alive) {
          unlistenFocus();
          unlistenResize();
          return;
        }
        unlisteners.push(unlistenFocus, unlistenResize);
        syncMinimized();
      } catch (error) {
        console.warn("[WindowActivity] window listeners failed:", error);
      }
    })();

    return () => {
      alive = false;
      while (unlisteners.length > 0) {
        unlisteners.pop()?.();
      }
    };
  }, []);

  return { isSuspended: isWindowSuspended(hidden, minimized) };
}
