# Changelog

## Unreleased

### Added

- The Crate: every album played is pressed into a persistent collection (`collection.json`, backend-owned) with a pressing number, first-pressed date, play count, rarity tier, and label thumbnail. Plays are counted by the backend poller after half the track or 2 minutes of real listening, whichever comes first. Records visibly wear with plays. New bottom-left pressing stamp, crate overlay (`C`, top-right button, context menu), and `cmd_collection_snapshot` / `cmd_collection_press` / `collection-changed` API.
- Needle Drop: the tonearm tracks playback progress across the grooves. Drag the headshell onto the record to seek (and resume if paused) with a live time preview on the progress ring, or off the record to pause.
- Single instance: launching VinylDeck while it is already running focuses the existing window instead of starting a second copy.

### Changed

- Security: bundled builds now ship a Content Security Policy (`default-src 'self'`, images from `self`/`data:`/`blob:`) instead of none.
- Crate play counting: a play now counts after half the track or 120 s of listening, whichever comes first (was half the track, capped at 4 minutes).
- Window controls: the custom title bar now has close, minimize, and maximize/restore, moved to the top-left so they clear the tonearm pivot and the floating triggers. Fullscreen keeps a hover-revealed bar (top edge) with minimize, exit fullscreen, and close. Mini shows minimize and close top-left on hover.
- Pausing lifts the tonearm in place instead of swinging it to a fixed angle; track skips re-cue the arm to the start groove.

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
