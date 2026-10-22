import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { commitSettings } from "../lib/settings";
import { ART_AMBIENT_MODE, applyVisualMode, resetAmbientColors } from "../lib/themes/applier";
import type { ThemeId } from "../lib/themes/applier";
import { quitApplication } from "../lib/appLifecycle";
import {
  canUseSeekControl,
  canUseSkipControls,
  canUseTransportControls,
} from "../lib/playback/capabilities";
import { useVinylDeckStore } from "../lib/playback/store";
import { setNativeWindowMode } from "../lib/window";
import type { RenderWindowMode, WindowMode } from "../lib/window/types";

const THEMES: ThemeId[] = ["noir", "glass"];
export const KEYBOARD_SEEK_STEP_SECONDS = 5;

interface KeyboardShortcutOptions {
  renderMode: RenderWindowMode;
  isSettingsOpen?: boolean;
  onCloseSettings?: () => void;
  onOpenSettings?: () => void;
  isCrateOpen?: boolean;
  onCloseCrate?: () => void;
  onToggleCrate?: () => void;
  isContextMenuOpen?: boolean;
  onCloseContextMenu?: () => void;
}

export function useKeyboardShortcuts({
  renderMode,
  isSettingsOpen = false,
  onCloseSettings,
  onOpenSettings,
  isCrateOpen = false,
  onCloseCrate,
  onToggleCrate,
  isContextMenuOpen = false,
  onCloseContextMenu,
}: KeyboardShortcutOptions) {
  const optionsRef = useRef({
    renderMode,
    isSettingsOpen,
    onCloseSettings,
    onOpenSettings,
    isCrateOpen,
    onCloseCrate,
    onToggleCrate,
    isContextMenuOpen,
    onCloseContextMenu,
  });

  useEffect(() => {
    optionsRef.current = {
      renderMode,
      isSettingsOpen,
      onCloseSettings,
      onOpenSettings,
      isCrateOpen,
      onCloseCrate,
      onToggleCrate,
      isContextMenuOpen,
      onCloseContextMenu,
    };
  }, [
    renderMode,
    isSettingsOpen,
    onCloseSettings,
    onOpenSettings,
    isCrateOpen,
    onCloseCrate,
    onToggleCrate,
    isContextMenuOpen,
    onCloseContextMenu,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreShortcut(event)) return;
      if (!isShortcutAllowedInMode(optionsRef.current.renderMode, event)) return;

      const { playback, settings, source } = useVinylDeckStore.getState();

      if (!settings.keyboardShortcutsEnabled) {
        if (event.code === "Escape") handleEscape(event, optionsRef);
        return;
      }

      if (event.ctrlKey && event.code === "KeyQ") {
        event.preventDefault();
        void quitApplication().catch((error) => {
          console.warn("[Shortcuts] Quit failed:", error);
        });
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          if (canUseTransportControls(playback)) source?.togglePlayPause();
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (event.shiftKey) {
            seekBy(-KEYBOARD_SEEK_STEP_SECONDS);
          } else if (canUseSkipControls(playback)) {
            useVinylDeckStore
              .getState()
              .markTrackChangeIntent("previous");
            source?.previous();
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (event.shiftKey) {
            seekBy(KEYBOARD_SEEK_STEP_SECONDS);
          } else if (canUseSkipControls(playback)) {
            useVinylDeckStore.getState().markTrackChangeIntent("next");
            source?.next();
          }
          break;
        case "KeyF":
          event.preventDefault();
          void switchWindowMode(nextFullscreenMode()).catch(logShortcutError);
          break;
        case "KeyM":
          event.preventDefault();
          void switchWindowMode(
            optionsRef.current.renderMode === "mini" ? "main" : "mini",
          ).catch(logShortcutError);
          break;
        case "KeyT":
          event.preventDefault();
          void cycleTheme().catch(logShortcutError);
          break;
        case "KeyA":
          event.preventDefault();
          void toggleArtAmbient().catch(logShortcutError);
          break;
        case "KeyS":
          event.preventDefault();
          optionsRef.current.onOpenSettings?.();
          break;
        case "KeyC":
          if (!optionsRef.current.onToggleCrate) break;
          event.preventDefault();
          optionsRef.current.onToggleCrate();
          break;
        case "Escape":
          handleEscape(event, optionsRef);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

// Mini is a glanceable surface: only play/pause and quit stay live there.
export function isShortcutAllowedInMode(
  renderMode: RenderWindowMode,
  event: Pick<KeyboardEvent, "code" | "ctrlKey">,
): boolean {
  if (renderMode !== "mini") return true;
  if (event.code === "Space") return true;
  return event.ctrlKey && event.code === "KeyQ";
}

function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  if (event.altKey || event.metaKey) return true;

  // Escape closes the topmost surface even while one of its controls has focus.
  if (event.code === "Escape") return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select, button")) return true;

  const editable = target.closest("[contenteditable]");
  return editable instanceof HTMLElement && editable.isContentEditable;
}

export type EscapeTarget = "contextMenu" | "crate" | "settings" | "fullscreen";

/** The single Escape policy: the topmost open surface closes first. */
export function resolveEscapeTarget(state: {
  isContextMenuOpen?: boolean;
  isCrateOpen?: boolean;
  isSettingsOpen?: boolean;
  isFullscreen?: boolean;
}): EscapeTarget | null {
  if (state.isContextMenuOpen) return "contextMenu";
  // Crate (z:80) stacks above Settings (z:40).
  if (state.isCrateOpen) return "crate";
  if (state.isSettingsOpen) return "settings";
  if (state.isFullscreen) return "fullscreen";
  return null;
}

function handleEscape(
  event: KeyboardEvent,
  optionsRef: RefObject<KeyboardShortcutOptions>,
) {
  const options = optionsRef.current;
  const target = resolveEscapeTarget({
    ...options,
    isFullscreen:
      useVinylDeckStore.getState().settings.windowMode === "fullscreen",
  });
  if (!target) return;

  event.preventDefault();
  switch (target) {
    case "contextMenu":
      options.onCloseContextMenu?.();
      break;
    case "crate":
      options.onCloseCrate?.();
      break;
    case "settings":
      options.onCloseSettings?.();
      break;
    case "fullscreen":
      void switchWindowMode("main").catch(logShortcutError);
      break;
  }
}

/** Seek target for a relative keyboard step, clamped to the track. */
export function clampSeek(position: number, delta: number, duration: number): number {
  return Math.min(Math.max(position + delta, 0), Math.max(duration, 0));
}

function seekBy(delta: number) {
  const store = useVinylDeckStore.getState();
  if (!canUseSeekControl(store.playback)) return;
  const target = clampSeek(store.getPosition(), delta, store.playback.duration);
  store.beginPendingSeek(target);
  store.source?.seekTo(target);
}

function nextFullscreenMode(): WindowMode {
  return useVinylDeckStore.getState().settings.windowMode === "fullscreen"
    ? "main"
    : "fullscreen";
}

async function switchWindowMode(mode: WindowMode) {
  const settings = await commitSettings({ windowMode: mode });
  useVinylDeckStore.getState().hydrateSettings(settings);
  await setNativeWindowMode(mode);
}

async function cycleTheme() {
  const currentTheme = useVinylDeckStore.getState().theme;
  const currentIndex = THEMES.indexOf(currentTheme);
  const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
  const settings = await commitSettings({ theme: nextTheme });

  useVinylDeckStore.getState().hydrateSettings(settings);
  applyVisualMode(settings.theme, settings.ambientMode);
  if (settings.ambientMode === "off") resetAmbientColors();
}

async function toggleArtAmbient() {
  const currentMode = useVinylDeckStore.getState().ambientMode;
  const nextMode = currentMode === "off" ? ART_AMBIENT_MODE : "off";
  const settings = await commitSettings({
    ambientMode: nextMode,
    artAmbient: nextMode !== "off",
  });

  useVinylDeckStore.getState().hydrateSettings(settings);
  applyVisualMode(settings.theme, settings.ambientMode);
  if (settings.ambientMode === "off") resetAmbientColors();
}

function logShortcutError(error: unknown) {
  console.warn("[Shortcuts] Action failed:", error);
}
