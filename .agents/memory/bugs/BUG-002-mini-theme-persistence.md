# BUG-002: Mini Theme Persistence / Cross-Window Settings

Status: fixed, pending manual confirmation.

Date marked pending: 2026-06-11.
Date fixed in code: 2026-06-11.

## Summary

Mini mode theme/customization syncing was broken because the `mini` WebView had write authority over persisted settings. Both `main` and `mini` ran the full `App.tsx` boot path, so mini could subscribe to settings persistence and flush stale/default Zustand state back to disk during unload.

## Evidence

- User observed main localStorage showing selected theme `paper`.
- Mini localStorage showed stale/default theme `noir` with a newer `writtenAt`.
- After main reload, main localStorage also became `noir`, matching the mini timestamp.
- Real Tauri Store file at `C:\Users\rudra\AppData\Roaming\com.vinyldeck.app\settings.json` was inspected and contained `theme: "noir"`, confirming the persisted store had been overwritten by stale/default state.
- Console/Tauri logs showed no frontend errors.

## Fixes Tried Before Root Fix

- Made mini window creation async because Windows/Tauri WebView2 creation hung when building the mini WebView from a synchronous command. User confirmed this fixed blank/white mini creation.
- Moved main-window hide until after mini build completed.
- Added mini UX polish: centered vinyl, controls absolute overlay, hover/touch reveal, return-to-main button, corner snapping, and programmatic drag.
- Destroyed mini window when returning to main/fullscreen so closing main can exit.
- Tried `localStorage` handoff key `vinyldeck:settings-handoff` to pass current settings from main to mini. This was wrong and was removed because separate WebViews can hold stale localStorage and the mini could overwrite the real Tauri Store with default Noir.
- Current settings code uses only `tauri-plugin-store` for desktop persistence, flushes settings before opening mini, and clears the legacy localStorage handoff key during desktop settings load.

## Root Cause

Every Tauri WebView has its own JS/Zustand instance. Mini starts with `DEFAULT_SETTINGS` (`theme: "noir"`) before async hydration resolves. Before the fix, mini also registered `subscribeToSettingsPersistence()`, added a `beforeunload` flush handler, and always called `flushSettingsPersistence()` during React cleanup. If mini was destroyed before hydration completed, cleanup could write default Noir settings to the Tauri Store. Even after hydration, mini and main were concurrent settings writers.

## Root Fix

`src/App.tsx` now makes `main` the only settings authority:

- `mini` still calls `loadSettings()` and `hydrateSettings()` so it renders the correct theme/customizations.
- Only `currentRenderMode === "main"` calls `subscribeToSettingsPersistence()`.
- Only `main` registers the `beforeunload` settings flush handler.
- Cleanup calls `flushSettingsPersistence()` only if the WebView is the settings authority.
- Mini can no longer poison the Tauri Store with default/stale settings.

## Responsible Files

- `src/App.tsx`

## Decision

Keep mini read-only for persisted settings. Future mini settings UI, if any, must send changes to the main/settings authority or a backend-owned settings service instead of writing persistence directly from mini.
