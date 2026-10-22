# Development Guide

This guide is for contributors working on VinylDeck locally.

## Setup

```powershell
npm install
npm run tauri dev
```

Use browser mode for visual work that does not need Windows media integration:

```powershell
npm run dev
```

## Runtime Modes

| Runtime | Playback source |
| --- | --- |
| Browser/Vite | `MockSource` |
| Tauri dev/build | `TauriSource` over Rust SMTC |
| Tauri with `VITE_FORCE_MOCK_SOURCE=true` | `MockSource` |

Set mock mode in PowerShell:

```powershell
$env:VITE_FORCE_MOCK_SOURCE='true'
npm run tauri dev
```

## Verification

Run the smallest useful check for the files you touched, then run the broader gate before committing integration work.

```powershell
npm run build
npm run test:frontend
npm run fmt:rust
npm run clippy:rust
npm run test:rust
git diff --check
```

For debug bundle smoke checks:

```powershell
npm run tauri build -- --debug
```

## Important Paths

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | App boot, settings hydration, playback source setup, render-mode routing |
| `src/views/` | Main and mini player views |
| `src/components/` | Visual and interaction components |
| `src/lib/playback/` | Playback contracts, store, mock source, Tauri source |
| `src/lib/settings/` | Frontend settings adapter/cache |
| `src/lib/window/` | Frontend window adapter |
| `src-tauri/src/media/` | SMTC model, artwork handling, commands, poller |
| `src-tauri/src/settings/` | Rust-owned settings validation and persistence |
| `tauri-plugin-autostart` | Native Start With Windows registration |
| `src-tauri/src/window/` | Window-mode service |
| `src-tauri/src/tray.rs` | Tray menu and close/quit lifecycle |
| `.agents/memory/` | Internal project memory for future agent sessions |

## Architecture Rules

- Keep React platform-neutral. Components consume `PlaybackState`, not Windows APIs.
- In Tauri, Rust commands/events are authoritative for shared playback and settings state.
- Keep browser `MockSource` useful for visual development.
- Use transform/opacity-first animation paths.
- Current exposed shells are Noir and Glass.
- CSS vinyl is the active renderer.
- Do not restore the vinyl center spindle hole.
- Preserve directional track text: next enters from left; previous enters from right.
- Mini mode is a separate shrink-resizable, transparent-capable Tauri WebView. Keep Mini capped at the original `280x280` square, with a `140x140` minimum. Keep Mini Transparency scoped to `miniTransparentMode`, `MiniView`, and the Mini window service; do not make main/fullscreen transparent.

## Documentation Rules

- Public-facing docs should read like product docs, not session logs.
- Internal progress, approvals, and stale work notes belong in `.agents/memory/`.
- `README.md` should orient users and contributors quickly.
- `docs/API.md` and `docs/ARCHITECTURE.md` can use implementation detail.
- `docs/RELEASE_V1.md` and `CHANGELOG.md` hold release/history facts.

## Distribution Notes

Installer-grade validation is separate from local development. The `0.1.0` MSI and NSIS installers were built and smoke-tested on 2026-06-14. Before broader public distribution, recheck WebView2 bootstrap behavior, settings location, bundle identifier naming, player compatibility, and code signing.
