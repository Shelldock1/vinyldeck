# VinylDeck: Current State

**Current Phase:** Release `0.2.0` shipped — Windows/Linux parity, tag-driven releases, one-line installers, manual update check and docs overhaul.
**Current Stage:** `v0.2.0` is public on GitHub with checksummed Windows and Linux assets; `main` and CI are green. No release follow-up is pending.

## Active Work

Phase 1 (critical fixes + CI), Phase 2 (event-driven platform + artwork transport), and Phase 3 (K–O) are implemented, verified, and committed. Packaging verification is complete: Linux DEB and AppImage bundles build and pass structural checks. No feature work is in flight; wait for a new user-approved scope.

- Phase 3 work: K audio reactivity, L OBS overlay + Discord Rich Presence, M global shortcuts, N monthly Crate Wrapped, O README/Linux bundles/test coverage/state compression.
- Older session history (pre-Phase 3, including the Windows audit remediation) is archived at `.agents/memory/archive/state-2026-10-24-pre-phase-3.md`. Do not re-derive it from this summary.

## Commits

Phase 1:
- `05abe72` settings race
- `cf14620` CI hardening
- `78618fb` ESLint + logger
- `1c04b02` progress-ring ticker gating
- `8d6915b` artwork off the poll path

Phase 2:
- `2938c6d` event-driven platform polling, cached handles
- `83fcf49` artwork URI scheme + bounded cache + WebP/GIF
- `119bd1e` docs

Phase 3:
- `b8af276` M global shortcuts (`Ctrl+Alt+M`, `Ctrl+Alt+Space`)
- `839d82f` K audio reactivity (WASAPI / PipeWire monitor, 3-band DSP)
- `8e4db6d` L OBS overlay (`127.0.0.1:43110`) + Discord Rich Presence
- `fb2689b` N Crate Wrapped (bounded history + monthly aggregation)
- `f9656f2` O Linux docs/bundles, frontend coverage, state archive

Post-roadmap:
- Linux `deb`/`appimage` packaging verified; Tauri npm packages aligned to 2.12.4 (see the release-packaging commit in `git log`).

## Post-roadmap UX pass (2026-10-24, uncommitted until user approves)

- Title bar order: minimize, maximize/exit-fullscreen, close (close last).
- `useFitScale` scales the main deck (natural ~500x728) to fit the window minus `DECK_RESERVE`; ProgressRing seek math now measures the rendered rect. `tauri.conf.json` main window 1000x860; `window::fit_main_to_monitor` clamps to 92% of the work area at launch.
- Source split: `media::model::source_kind` (mirrored by `sourceKindFor` in `records.ts`) buckets players into `app` / `browser`. Records carry `sourceKind`/`sourceName` (music app tag is sticky); `PlayEvent.sourceKind`; legacy rows backfilled from history (empty album = browser). Crate Music/Browser/All filter (localStorage `vinyldeck:crate:source`, default `app`) drives shelf, stats, and `cmd_collection_wrapped { source }`.
- Removed dormant `VaporGrid`, `public/vite.svg`, `public/tauri.svg`.
- Verified: lint, build, 130 frontend tests, 93 Rust tests, clippy, fmt. Not launched as a native window (layout verified in headless Chromium at 700x560, 900x700, 1000x860, 1366x668).

## i18n + streak fix (2026-10-24)

- Settings field `language` (`auto|en|ru`, default `auto`) in Rust `settings/mod.rs` and TS `settings/types.ts`. `src-tauri/src/i18n.rs` resolves auto via `sys-locale`; `tray.rs` relabels the menu through a `watch` channel (`tray::set_language`, called from settings update/reset).
- Frontend: `src/lib/i18n/{en,ru,types,plural,index,switch}.ts`. `en.ts` defines the `Dict` shape; `ru.ts` must match (enforced by type + `i18n.test.ts`). Components use `useT()`; plain modules take a dict slice (e.g. `formatSleepTimerStatus(..., t.sleep)`). `SHORTCUTS[].action` stays English for the README test; the sheet reads `t.shortcuts.actions[id]`.
- Toggle: `.language-trigger` (top-left row, `left: 240px`), `KeyL`, context-menu item, Settings -> Look -> Language.
- Pressing names (e.g. "Blue/Bone White Merge") are generated and persisted in English; not translated.
- Streak: `cmd_collection_play_times(source)` feeds `collectionStreak(records, now, playTimes)`. Wrapped takes `utcOffsetMinutes` and buckets on the local clock.
- Verified: lint, build, 139 frontend tests, 98 Rust tests, clippy, fmt, Windows `cargo check`. Russian UI checked in headless Chromium (main, Crate, Settings, shortcut sheet, L toggle).

## Cross-platform release + docs (2026-10-24)

- Windows parity: `scripts/install-windows.ps1` (build + `%LOCALAPPDATA%\Programs\VinylDeck`, Start Menu shortcut, user PATH), `scripts/collect-release.mjs` (one cross-platform artifact namer), `.gitattributes` (LF source, CRLF PowerShell/NSIS), `.gitignore` (`release/`, `.claude/` still untracked).
- Installers: `install.sh` (AppImage, checksum, desktop entry, PATH) and `install.ps1` (NSIS `/S`, checksum, shortcut, PATH). Both support `VINYLDECK_VERSION`, `VINYLDECK_RELEASE_BASE`; Linux also `VINYLDECK_INSTALL_DIR`, `VINYLDECK_SKIP_DESKTOP`, `VINYLDECK_NO_PATH_UPDATE`.
- CI: `.github/workflows/release.yml` on `v*` tags (NSIS/MSI + DEB/AppImage, stable names, `SHA256SUMS.txt`, CHANGELOG body via `scripts/changelog-section.mjs`); `ci.yml` validates shell/Node/PowerShell scripts.
- NSIS `installMode: currentUser`; stable names `vinyldeck-setup-windows-x64.exe`, `vinyldeck-windows-x64.msi`, `vinyldeck-linux-x64.AppImage`, `vinyldeck-linux-x64.deb`.
- Docs rewritten: `README.md`, `CHANGELOG.md` (0.2.0 + tagged history), new `CONTRIBUTING.md`, `docs/{USER_GUIDE,DEVELOPMENT,ARCHITECTURE,API,TROUBLESHOOTING,RELEASING}.md`, `llms.txt`; `docs/RELEASE_V1.md` renamed to `docs/RELEASING.md`. Landing download links moved to Shelldock1 stable assets and now include Linux.
- Local verification: Linux release binary, `deb` and AppImage built; `collect-release.mjs` produced stable names; `install.sh` installed from a local HTTP mirror with checksum verification; AppImage `--appimage-extract` clean. AppImage bundling needs `PKG_CONFIG_PATH` set but `PKG_CONFIG_SYSROOT_DIR` unset (updated docs); DEB needs the sysroot visible.
- Not verified here at the time: Windows runtime/installer, PowerShell execution, live downloads, code signing. The tag run and live downloads were later verified; see below.

## Release 0.2.0 preparation (2026-10-24)

- Phase 5: `src-tauri/src/update.rs` adds `cmd_update_check` (GitHub latest-release API via universal `ureq`, 10 s timeout, 256 KiB cap, numeric version compare) and `cmd_open_release` (release-URL allowlist, system browser). Settings -> About shows idle/checking/current/available/error states with EN/RU strings; `src/lib/update` validates the payload and has Vitest coverage. No auto-download; updater signing keys are still absent.
- Contributor hygiene: issue forms, PR template, `.claude/` ignored, personal Windows path redacted from BUG-002.
- Restored README `## Controls` table to the exact `SHORTCUTS[].readmeRow` strings; the Phase 3 docs rewrite had broken `shortcuts.test.ts`.
- Version bumped to `0.2.0` in root and landing `package.json`/lockfiles, `src-tauri/Cargo.toml`, `Cargo.lock`, `tauri.conf.json`. Landing download metadata already pointed at 0.2.0.
- Verified after the change: `npm run lint`, `npm run build`, 144 frontend tests / 25 files, `cargo fmt --check`, `cargo clippy -D warnings`, 102 Rust tests, `cargo check --locked`.

## Release 0.2.0 shipped (2026-10-24)

- `main` at `e03e70e`; annotated tag `v0.2.0` points at the same commit. Release run `40119715636` succeeded (Windows bundles, Linux bundles, publish) and CI run `40119710653` passed all three jobs.
- Published assets: `vinyldeck-setup-windows-x64.exe`, `vinyldeck-windows-x64.msi`, `vinyldeck-linux-x64.AppImage`, `vinyldeck-linux-x64.deb`, `SHA256SUMS.txt`, `install.sh`, `install.ps1`.
- Verified locally: every `releases/latest/download/*` URL returns 200, `sha256sum -c SHA256SUMS.txt` passes for all six files, the AppImage extracts and its libraries resolve, the DEB ships binary/icons/desktop entry, and the published `install.sh` one-liner installs the AppImage into a temp prefix with checksum verification.
- Failure history: the first tag run died in `makensis` (`RestartManager_StartSession` missing; stale NSIS template, fixed in `c7079dc`); the second timed out in `apt-get` on a stalled mirror. Both workflows now bound each apt attempt with `timeout 300`, retry three times, and no longer install the unused `libfuse2` (`e03e70e`).
- Temporary `ci-debug*` branches and their log-capture workflows are deleted locally and remotely; only `main`, `v0.1.1` and `v0.2.0` remain.
- Not verifiable here: Windows installer execution, PowerShell runtime, Acrylic, live Discord IPC. Published `install.ps1` is CRLF because `.gitattributes` pins `*.ps1`; content matches the repo script.

## Phase 3 Implementation Notes

- **K — reactivity:** `src-tauri/src/reactivity/{mod,dsp,linux,windows}.rs`. Linux captures `parec --device=@DEFAULT_MONITOR@`; Windows uses WASAPI loopback behind `windows-rs` features. Capture runs only while playing, emits `audio-reactivity` `{level,bass,mid,treble}` at ~30 Hz, retries after 30 s on failure. Frontend `useAudioReactivity` writes `--audio-level/bass/mid/treble`; `AudioMeter`, needle/headshell jitter, and groove glow read them. No microphone is opened; no FFT dependency.
- **L — overlay/presence:** `src-tauri/src/overlay.rs` is a hand-rolled localhost TCP HTTP server with `/overlay`, `/state`, `/artwork`; `media/artwork.rs` exposes `cached_artwork`/`bytes_for_uri`. `src-tauri/src/presence.rs` speaks Discord IPC framing directly, discovers the socket/named pipe, and polls every 2 s. Settings schema v4 adds `discordClientId` (digits only, ≤32), surfaced in Settings → Other; empty disables presence.
- **M — shortcuts:** `src-tauri/src/shortcuts.rs`, `tauri-plugin-global-shortcut`, best-effort registration; both combos appear in the `?` sheet.
- **N — Wrapped:** `collection/mod.rs` persists bounded play history (10,000 events under `collection.json` key `history`); `collection/wrapped.rs` folds a UTC month into totals, top 5 records, top track/artist, rarest pressing, busiest day, and available months. `cmd_collection_wrapped`; UI is `CrateWrapped.tsx` opened from the Crate header with a month picker. Browser dev shows an empty current-month card.
- **O — packaging/docs:** README lists Windows + Linux, MPRIS, overlay/Discord/Wrapped/global shortcuts, and Linux build/install steps; `tauri.conf.json` bundles `msi`, `nsis`, `deb`, `appimage`. Tests added for `pressingEngine.ts`, `useColorExtraction.ts` (exported `paletteFromPixels`, `buildAmbientFromPalette`), `themes/applier.ts`, and `textureBake.ts` (fake 2D canvas).

## Emulated repeat-one (2026-10-26, uncommitted)

- `src-tauri/src/media/vinyl_loop.rs`: `VinylLoop` (in `PlaybackAuthority`) decorates snapshots from players with no native repeat but control + seek/skip: `canRepeat=true`, `repeatMode` off/one. `cmd_media_set_repeat` routes there first; any non-`off` mode enables it, so the existing lever cycle off->all->one becomes off<->one with no frontend change.
- Poller `LoopWatch`: seek(0) when <=1.5s remain while playing; `previous` when the same source rolled to a new track with <=3.5s left on the old one. Decoration applied in `poll_once`, `collect_artwork`, `cmd_smtc_snapshot`.
- Verified: 151 Rust tests, clippy, fmt, release build installed to `%LOCALAPPDATA%\VinylDeck`. Yandex Music SMTC: seek/next/prev true, no AutoRepeatMode. Loop not yet exercised live.

## Verification

Last full local run:
- `npm run lint` clean, `npm run build` clean.
- Frontend: 125 tests across 22 files (`npm run test:frontend`).
- Rust: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, 88 tests.
- Windows typecheck: `cargo check --target x86_64-pc-windows-msvc --all-targets` clean (recipe below).
- `git diff --check` clean.
- Overlay runtime: real paused MPRIS session returned `/state` JSON and `/overlay` 200 (4191 bytes) from `./target/debug/vinyldeck`.
- Linux monitor capture verified streaming (~328 KB / 2 s); WASAPI loopback and Discord presence are compile/unit verified only (no Discord client/runtime test here).
- Linux packages: `deb` (7.0 MiB) and AppImage (88.2 MiB) built with `tauri` 2.12.5 and npm packages 2.12.4, without `--ignore-version-mismatches`. `dpkg-deb --info/--contents` and the AppImage runtime check passed. Not launched interactively.
- After package alignment: `npm run lint`, `npm run test:frontend` (125 tests / 22 files), and `npm run build` clean.

## Caveats / Not Manually Verified

- Discord Rich Presence never connected to a live Discord client; app id requires a user-owned Discord application.
- Overlay `/artwork` not exercised because the live test session had no cover; `/state`/`/overlay` were.
- Windows runtime build/audio/presence are CI/typecheck only (no Windows host here).
- Wrapped has backend unit coverage but no live UI click-through; history begins collecting with this version, so older listens are absent.
- Phase 2 caveats stand: MPRIS/SMTC event behavior and artwork scheme timing verified by build/unit tests and a live snapshot, not a player matrix.
- Linux packaging targets are configured and both bundles build. AppImage bundling on this machine's local sysroot requires clearing `PKG_CONFIG_SYSROOT_DIR` for the linuxdeploy GTK plugin and `APPIMAGE_EXTRACT_AND_RUN=1` without FUSE; documented in `docs/DEVELOPMENT.md`.

## Locks / Invariants

- `ENABLE_WEBGL_VINYL` stays `false`; the CSS vinyl renderer and the removed center spindle hole (`.vinyl-hole` must stay absent) are locked.
- Only Noir and Glass are live shells; Aurora/Vapor/Paper are legacy migration values mapped into Noir/Glass + ambient mode.
- Track transitions stay in place for the vinyl; no left/right slide of the record.
- Never use destructive flags (`--force`, etc.) in this repository; `.claude/` is untracked and must not be staged.
- `miniWindowPosition` / the Tauri `window-state` plugin stay out; mini opens docked bottom-right and always on top.
- Public docs must stay product-facing; status/handoff detail belongs in `CHANGELOG.md`, release docs, and this memory.

## Environment

- Node.js v24.12.0, npm 11.6.2
- rustc/cargo 1.96.0, tauri-cli 2.12.4
- Windows typecheck recipe from `src-tauri`:
  `PATH="/snap/kf6-core24/64/usr/lib/llvm-19/bin:$PATH" LD_LIBRARY_PATH="/snap/mesa-2404/1839/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH" cargo check --target x86_64-pc-windows-msvc --all-targets`
  (prints a harmless GNU-compiler warning)

## References

- `.agents/memory/backend-research.md` — backend/platform research; do not repeat.
- `.agents/memory/archive/state-2026-10-24-pre-phase-3.md` — full pre-Phase 3 state.
- `.agents/memory/bugs/` — durable bug notes.
- `CHANGELOG.md` — user-facing feature/fix history.
