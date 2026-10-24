# Changelog

All notable changes to VinylDeck are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.2.1] - 2026-10-24

### Fixed

- **`install.ps1` no longer closes the PowerShell window on errors.** The one-line installer runs inside the caller's session (`irm | iex`), so `exit` ended the whole session before the error could be read. Errors are now thrown and printed, and the script's preferences and variables no longer leak into the session.
- **Stricter release links in the update check.** `cmd_open_release` accepts only the releases index, `/latest` or `/tag/<tag>`, and Windows opens the page through `rundll32 url.dll` instead of `cmd /C start`, so shell metacharacters cannot reach a command interpreter.
- Broken `0.1.x` comparison links in this changelog and a misleading comment in `.gitattributes`.

## [0.2.0] - 2026-10-24

The cross-platform release: Windows and Linux reach feature parity, both ship
checksummed artifacts from one tag-driven pipeline, and the product gains the
Crate, Wrapped, localization, system-audio reactivity, streaming extras and a
full documentation pass.

### Added

- **Linux desktop support.** MPRIS media sessions over the session D-Bus (`zbus`), PipeWire/Pulse monitor capture for reactivity, DEB and AppImage bundles, and a user-level installer (`npm run install:linux`) that writes `~/.local/bin/vinyldeck`, a hicolor icon and a `.desktop` entry.
- **One-line installers.** `install.sh` installs the latest AppImage for the current user, verifies the release SHA-256 when available, registers the desktop entry and updates `PATH`. `install.ps1` downloads the NSIS setup, verifies its checksum, installs silently for the current user, repairs the Start Menu shortcut and updates the user `PATH`.
- **Tag-driven releases.** `.github/workflows/release.yml` builds NSIS/MSI on `windows-2022` and DEB/AppImage on `ubuntu-24.04`, renames the output to version-free names (`vinyldeck-setup-windows-x64.exe`, `vinyldeck-linux-x64.AppImage`, ...) and publishes the assets plus `SHA256SUMS.txt` on every `v*` tag.
- **Windows developer install.** `npm run install:windows` builds the release binary, copies it to `%LOCALAPPDATA%\Programs\VinylDeck`, creates a Start Menu shortcut and adds the folder to the user `PATH`. `-SkipBuild` reuses an existing build.
- **The Crate.** Each played album becomes a numbered pressing with a deterministic recipe, rarity, first-played date, play count, label thumbnail and visible wear. The Crate adds search, recent/plays/rare/pressing/A-Z sorting, totals, top album and a listening streak. Stored in `collection.json` by the Rust backend.
- **Crate Wrapped.** A monthly recap with total listens, unique records/artists/tracks, the five most played records, top track, top artist, rarest pressing and busiest day, bucketed in the viewer's local time.
- **Music vs browser sources.** Records and listens are tagged as a music app or a browser; a Music / Browser / All switch drives the shelf, stats and Wrapped, and the record card names the player.
- **Player picker.** Settings -> Source follows the active MPRIS/SMTC session automatically or pins a specific player; the choice is persisted by the Rust settings authority and mirrored in the context menu.
- **Shuffle and repeat.** Hardware-style levers next to the transport, backed by MPRIS `LoopStatus`/`Shuffle` and SMTC auto-repeat/shuffle; the tray mirrors both.
- **Sleep timer.** Off, 15/30/45/60 minutes or end of track, started from Settings or the context menu and owned by Rust so it survives mode switches. Firing pauses playback and parks the tonearm.
- **Needle Drop.** The tonearm tracks progress and can be dragged across the grooves to seek with a time preview, or lifted off the record to pause.
- **Global shortcuts.** `Ctrl+Alt+M` toggles Mini and `Ctrl+Alt+Space` toggles playback while another app has focus. Registration is best-effort when the desktop already owns the combination.
- **Shortcut cheat sheet.** `?` opens a glass sheet of every shortcut, grouped Playback / Window / App, with focus trapping and a single Escape owner.
- **System-audio reactivity.** A VU meter, tonearm jitter and groove glow fed by WASAPI loopback on Windows or the PipeWire/Pulse monitor through `parec` on Linux. Three-band envelope at roughly 30 Hz; no microphone is opened.
- **OBS overlay.** A local HTTP server on `127.0.0.1:43110` serves a transparent, self-refreshing `/overlay` browser source, `/state` JSON and `/artwork` for the cached cover. The URL is listed in Settings -> Other.
- **Discord Rich Presence.** Opt-in local IPC presence using a user-supplied Discord application client ID, validated as a snowflake and disabled while empty.
- **Russian localization.** English and Russian dictionaries cover every screen, tooltip, screen-reader label and the tray menu, with Russian plural rules and locale-aware dates. `L`, a round EN/RU button, the context menu and Settings switch it; Auto follows the OS.
- **Manual update check.** Settings -> About asks GitHub for the newest published release, shows the version and publish date, and opens the release page in the system browser. The request runs in Rust so the webview CSP stays closed; nothing is downloaded or installed automatically.
- **Light, Dark and Halloween schemes** layered over Noir and Glass, with interpolated color tokens and a CSS-gated seasonal layer.
- **Single instance.** Launching again focuses the running window instead of starting a second copy.
- **Frontend coverage** for the pressing engine, artwork palette extraction, theme applier and canvas texture baker, plus an ESLint gate with `react-hooks` and `jsx-a11y`.

### Changed

- **Windows and Linux share one code path.** Platform differences live behind `cfg` adapters for media, audio capture and Discord IPC; the React UI, settings, tray and window logic are common.
- **Native window chrome.** Window controls sit at the top-right with close last; Settings, Crate and Mini triggers share a top-left row; the title bar no longer double-toggles maximize.
- **Responsive deck.** The main deck is laid out at its natural size and scaled to fit the viewport, so it no longer clips at 900x700 or the 700x560 minimum. The window opens at 1000x860 and is clamped to 92% of the monitor working area.
- **Artwork transport.** Covers travel as short `vinyldeck://art/<hash>` URLs backed by a bounded cache and a Tauri URI scheme instead of multi-megabyte base64 payloads on every event.
- **Event-driven polling.** Linux watches MPRIS `PropertiesChanged` and D-Bus name changes, Windows watches SMTC events, and transport commands wake the poller. The slow interval remains for position and play counting.
- **Off-thread artwork.** Reading and decoding covers no longer blocks the playback poll; metadata appears first and the cover follows.
- **Settings writes are serialized.** `cmd_settings_update` holds the lock across the whole read-modify-write, so Main and Mini cannot overwrite each other.
- **Play counting** now starts after half the track or 120 seconds of real listening, whichever comes first (was half the track capped at 4 minutes).
- **Start At Login** replaces "Start With Windows" because autostart works on Linux too. The backend uses the Tauri autostart plugin (registry Run key on Windows, XDG autostart entry on Linux).
- **Settings -> About** shows the real app version instead of a hard-coded value.
- **Self-hosted fonts.** Sora, Inter, JetBrains Mono, Hanken Grotesk and Geist live under `public/fonts/` with their OFL files, so bundled builds keep the intended typefaces under the CSP.
- **CI** runs on Node 24, lints Windows with `clippy -D warnings`, runs ESLint, retries stalled apt downloads and builds the landing site.
- **Tauri packages** are aligned at 2.12 so release builds no longer need the version-mismatch bypass.

### Fixed

- The Crate streak now uses the full play history instead of each record's latest day, and Wrapped buckets months and busiest days in local time instead of UTC.
- Arrow keys no longer skip tracks while the context menu is open; the menu owns Up/Down/Enter/Space and Escape stays with the topmost-surface handler.
- Double-clicking the custom title bar no longer maximizes and immediately snaps back.
- The progress ring stops its 500 ms ticker while paused, hidden or minimized.
- SMTC snapshots match the shared bridge signature, and same-duration track changes no longer reuse stale metadata or artwork.
- Tauri source teardown removes event listeners and avoids duplicate subscriptions.
- The Mini window no longer re-applies stale transparency or resize bounds after a settings change.
- Artwork accepts WebP and GIF, rejects oversized HTTP covers instead of truncating them, and decodes MPRIS `data:` covers into the same cache.
- Focus stays inside Settings, the Crate and the cheat sheet, and returns to the triggering control on close.
- The progress ring is a keyboard slider with `Left`/`Right`/`Home` support and measures its rendered box so scaling cannot skew the scrub angle.
- Unsupported platform capture leaves the deck still instead of retrying forever.

### Security

- Bundled builds ship a Content Security Policy (`default-src 'self'`, image sources limited to `self`/`data:`/`blob:`/the artwork scheme) and explicitly allow Tauri IPC through `connect-src`.
- The overlay server no longer sends `Access-Control-Allow-Origin: *`. It rejects requests whose `Host` is not `127.0.0.1:43110` or `localhost:43110`, which blocks DNS rebinding while OBS keeps working.
- Settings updates are validated and clamped by Rust before persistence; WebViews are controllers, not storage authorities.
- Audit remediation covered single-instance enforcement, focus trapping, one Escape owner and Windows-only SMTC compilation with an explicit fallback.

### Removed

- The dormant `VaporGrid` component, unused Vite/Tauri template icons and dead SMTC/artwork code.
- The legacy mock-backed `cmd_media_*` commands; the tray and UI now use the real platform bridge.
- The "Nothing Playing" sentinel that `TrackInfo` had to special-case.

### Deferred

- Code signing for Windows (SmartScreen still shows an unknown publisher).
- Automatic in-app updates. The About tab now offers a manual check that opens the release page; downloading and installing still goes through the installers, and updater signing keys are not part of the pipeline.
- ARM64 Windows/Linux artifacts (x64 only for now).

## [0.1.1] - 2026-07-03

### Added

- Opt-in Start With Windows setting backed by Tauri autostart.
- Resizable Mini player window with optional Mini Transparency backed by native Windows Acrylic.
- Mini player shrink range from `280x280` down to `140x140`, with proportional vinyl/control scaling and compact track text fade-out.

### Changed

- Public documentation describes VinylDeck as a product instead of an internal progress report; implementation status moved to maintainer and release docs.

### Verified

- Built the release MSI and NSIS installers.
- Installed the MSI successfully on Windows, including a custom install location and the Control Panel entry.

## [0.1.0] - 2026-06-14

### Added

- Windows Tauri shell for VinylDeck.
- Real SMTC media snapshots, artwork, capabilities and in-app controls.
- Cached SMTC polling bridge with semantic-change events and position resyncs.
- Backend-owned settings authority with cross-window sync.
- Main, fullscreen and mini window modes.
- Tray lifecycle and focused keyboard shortcuts.
- Noir and Glass visual shells.
- Album-art ambient color extraction.
- CSS vinyl deck renderer with animated record, tonearm, progress and controls.
- Tooltips, keycap hints, context menu, directional track text and in-place vinyl skip impulse.
- Standard documentation set: README, architecture, API, development guide, user guide, troubleshooting, release notes, changelog and `llms.txt`.

### Changed

- Active visual shells are Noir and Glass.
- Persisted legacy shell values migrate into the current shell model.
- CSS vinyl renderer is the active renderer.

### Fixed

- Same-duration track changes no longer reuse stale artwork or metadata.
- Tauri source lifecycle cleans event listeners and avoids duplicate source subscriptions.
- Controls and shortcuts respect source capabilities.
- Settings sync correctly across main and mini windows through the Rust backend.

### Deferred

- Public installer validation.
- Tray playback command-path revalidation.
- Shortcut editing UI.
- Start-with-Windows/autostart.
- Splash screen.
- Active WebGL vinyl renderer.

[Unreleased]: https://github.com/Shelldock1/vinyldeck/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/Shelldock1/vinyldeck/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Shelldock1/vinyldeck/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Shelldock1/vinyldeck/releases/tag/v0.1.1
