# VinylDeck: Project Context

## What This Is

**VinylDeck** is a standalone desktop application that wraps the system's currently-playing audio in a cinematic, vinyl-record visual experience. It reads whatever is playing through the OS media API and renders it as an immersive, animated turntable.
**Tagline:** _A cinematic vinyl experience for everything playing on your computer._

## Architecture

- **Visual Engine (React):** Responsible for the cinematic UI. Knows nothing about the media source. Communicates exclusively via a `PlaybackState` interface.
- **Adapter Layer (Zustand):** Frontend cache for React components. In Tauri it is not the authority for multi-window dynamic state.
- **Backend (Tauri/Rust):** Owns cross-window dynamic state, durable settings, native window lifecycle, and real SMTC commands/events. Any number of windows can subscribe to the same backend-approved source of truth.

## Multi-Window Authority Direction

- Browser development can keep `MockSource`.
- Tauri main and mini read playback from Rust via `cmd_smtc_*` and `media-state-changed`, not from separate frontend sources.
- Avoid window-to-window bridges for core state. Windows are views/controllers; backend is authority.
- Settings have migrated to backend ownership: Rust validates, persists, and emits `settings-changed`; frontend windows are readers/controllers only.
- V1 release installers were built and MSI installed successfully in the 2026-06-14 distribution smoke pass. Remaining public-release polish is signing, WebView2 bootstrap recheck, settings-location note, bundle identifier review, and player matrix.

## Technology Stack

- **Desktop Shell:** Tauri v2 (Rust backend)
- **Frontend:** React 19 + TypeScript
- **Animation:** `motion/react` v12 (formerly framer-motion)
- **State Management:** Zustand v5
- **Color Extraction:** `fast-average-color` v9 — simple algorithm + HSL boost
- **Theming:** CSS Custom Properties. Current exposed shells: Noir and Glass. Legacy Aurora, Vapor, and Paper values migrate into Noir/Glass plus Art Ambient.
- **Ambient Bloom:** Two CSS orbs with `mix-blend-mode: screen`, single extracted color, uniform wash

## Current Visual Locks

- CSS vinyl renderer is active; WebGL vinyl code is dormant and hard-OFF.
- Vinyl has no center spindle hole.
- Track direction mapping: next enters from left and exits right; previous enters from right and exits left.
- VinylRecord must stay anchored on track changes and may only use in-place rotational skip impulse.
- Shortcut editing UI and splash screen are cancelled/not-current. Start With Windows is implemented as an opt-in setting, default off.
