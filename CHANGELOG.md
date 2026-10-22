# Changelog

## Unreleased

### Added

- The Crate: every album played is pressed into a persistent collection (`collection.json`, backend-owned) with a pressing number, first-pressed date, play count, rarity tier, and label thumbnail. Plays are counted by the backend poller after half the track or 2 minutes of real listening, whichever comes first. Records visibly wear with plays. New bottom-left pressing stamp, crate overlay (`C`, top-left button, context menu), and `cmd_collection_snapshot` / `cmd_collection_press` / `collection-changed` API.
- Needle Drop: the tonearm tracks playback progress across the grooves. Drag the headshell onto the record to seek (and resume if paused) with a live time preview on the progress ring, or off the record to pause.
- Single instance: launching VinylDeck while it is already running focuses the existing window instead of starting a second copy.
- Settings now shows a visible close button at the top-right of the panel; Escape and clicking outside still close it too.

### Changed

- Security: bundled builds now ship a Content Security Policy (`default-src 'self'`, images from `self`/`data:`/`blob:`) instead of none.
- Crate play counting: a play now counts after half the track or 120 s of listening, whichever comes first (was half the track, capped at 4 minutes).
- Window controls: close, minimize, and maximize/restore now sit at the top-right, and the floating Settings, Crate, and Mini triggers moved to a single top-left row. This reverses the earlier top-left placement; the 40px titlebar strip was re-measured at 700x560, 900x700, and maximized so neither the controls nor the triggers intersect the tonearm pivot or counterweight (narrow windows stack the controls down the right edge instead of crossing the arm). Fullscreen keeps the hover-revealed top-edge bar with the controls on the same side, and Mini shows its hover controls top-right with the return control top-left.
- Pausing lifts the tonearm in place instead of swinging it to a fixed angle; track skips re-cue the arm to the start groove.

### Fixed

- Arrow keys no longer skip tracks or seek while the context menu is open. The focused menu container let Left/Right leak to the global shortcuts; the menu now owns the keyboard (Escape still routes through the single topmost-surface handler), so Up/Down, Enter and Space act only on the menu item.
- Double-clicking the custom title bar no longer maximizes and immediately snaps back; the bar kept a React double-click handler on top of Tauri's built-in drag-region maximize, so both toggled the window. Double-click maximize now runs through Tauri's script alone.

## 0.1.1 - 2026-07-03

### Changed

- Reframed public documentation so `README.md` and user-facing docs describe VinylDeck as a product instead of an internal progress report.
- Moved implementation status language into maintainer and release documentation where it belongs.
- Mini player is now shrink-resizable from `280x280` down to `140x140`, with proportional vinyl/control scaling and compact track text fade-out.

### Added

- Opt-in Start With Windows setting backed by Tauri autostart.
- Resizable Mini player window with optional Mini Transparency backed by native Windows Acrylic.

### Verified

- Built release MSI and NSIS installers.
- Installed MSI successfully on Windows.
- Confirmed Control Panel entry and custom install location.

## 0.1.0 - 2026-06-14

### Added

- Windows Tauri shell for VinylDeck.
- Real SMTC media snapshots, artwork, capabilities, and in-app controls.
- Cached SMTC polling bridge with semantic-change events and position resyncs.
- Backend-owned settings authority with cross-window sync.
- Main, fullscreen, and mini window modes.
- Tray lifecycle and focused keyboard shortcuts.
- Noir and Glass visual shells.
- Album-art ambient color extraction.
- CSS vinyl deck renderer with animated record, tonearm, progress, and controls.
- Tooltips, keycap hints, context menu, directional track text, and in-place vinyl skip impulse.
- Standard documentation set: README, architecture, API, development guide, user guide, troubleshooting, release notes, changelog, and `llms.txt`.

### Fixed

- Same-duration track changes no longer reuse stale artwork or metadata.
- Tauri source lifecycle cleans event listeners and avoids duplicate source subscriptions.
- Controls and shortcuts respect source capabilities.
- Settings sync correctly across main and mini windows through the Rust backend.

### Changed

- Active visual shells are Noir and Glass.
- Persisted legacy shell values migrate into the current shell model.
- CSS vinyl renderer is the active renderer.

### Deferred

- Public installer validation.
- Tray playback command-path revalidation.
- Shortcut editing UI.
- Start-with-Windows/autostart.
- Splash screen.
- Active WebGL vinyl renderer.
