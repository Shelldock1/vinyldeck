import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { commitSettings } from "../lib/settings";
import { ART_AMBIENT_MODE, applyVisualMode, resetAmbientColors } from "../lib/themes/applier";
import type { ThemeId } from "../lib/themes/applier";
import { quitApplication } from "../lib/appLifecycle";
import { canUseSkipControls, canUseTransportControls } from "../lib/playback/capabilities";
import { useVinylDeckStore } from "../lib/playback/store";
import { setNativeWindowMode } from "../lib/window";
import type { RenderWindowMode, WindowMode } from "../lib/window/types";

const THEMES: ThemeId[] = ["noir", "glass"];

interface KeyboardShortcutOptions {
  renderMode: RenderWindowMode;
  isSettingsOpen?: boolean;
  onCloseSettings?: () => void;
  onOpenSettings?: () => void;
}

export function useKeyboardShortcuts({
  renderMode,
  isSettingsOpen = false,
  onCloseSettings,
  onOpenSettings,
}: KeyboardShortcutOptions) {
  const optionsRef = useRef({
    renderMode,
    isSettingsOpen,
    onCloseSettings,
    onOpenSettings,
  });

  useEffect(() => {
    optionsRef.current = {
      renderMode,
      isSettingsOpen,
      onCloseSettings,
      onOpenSettings,
    };
  }, [renderMode, isSettingsOpen, onCloseSettings, onOpenSettings]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreShortcut(event)) return;

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
          if (canUseSkipControls(playback)) {
            useVinylDeckStore
              .getState()
              .markTrackChangeIntent("previous");
            source?.previous();
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (canUseSkipControls(playback)) {
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
        case "Escape":
          handleEscape(event, optionsRef);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  if (event.altKey || event.metaKey) return true;

  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select, button")) return true;

  const editable = target.closest("[contenteditable]");
  return editable instanceof HTMLElement && editable.isContentEditable;
}

function handleEscape(
  event: KeyboardEvent,
  optionsRef: RefObject<KeyboardShortcutOptions>,
) {
  const { isSettingsOpen, onCloseSettings } = optionsRef.current;
  if (isSettingsOpen) {
    event.preventDefault();
    onCloseSettings?.();
    return;
  }

  if (useVinylDeckStore.getState().settings.windowMode === "fullscreen") {
    event.preventDefault();
    void switchWindowMode("main").catch(logShortcutError);
  }
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
