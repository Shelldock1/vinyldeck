# VinylDeck: Current State

**Current Phase:** Optimization roadmap Phase 3 (K–O) implemented and verified; awaiting user confirmation of Phase 3.
**Current Stage:** Windows + Linux desktop app at `0.1.1`, feature-complete for the approved roadmap. No new phase starts without confirmation.

## Active Work

Phase 1 (critical fixes + CI), Phase 2 (event-driven platform + artwork transport), and Phase 3 (K–O) are implemented. Phase 3 is committed; the final docs/tests/packaging commit is the only open item before the Phase 3 report.

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
- O tests/docs/packaging: committed with the Phase 3 close-out.

## Phase 3 Implementation Notes

- **K — reactivity:** `src-tauri/src/reactivity/{mod,dsp,linux,windows}.rs`. Linux captures `parec --device=@DEFAULT_MONITOR@`; Windows uses WASAPI loopback behind `windows-rs` features. Capture runs only while playing, emits `audio-reactivity` `{level,bass,mid,treble}` at ~30 Hz, retries after 30 s on failure. Frontend `useAudioReactivity` writes `--audio-level/bass/mid/treble`; `AudioMeter`, needle/headshell jitter, and groove glow read them. No microphone is opened; no FFT dependency.
- **L — overlay/presence:** `src-tauri/src/overlay.rs` is a hand-rolled localhost TCP HTTP server with `/overlay`, `/state`, `/artwork`; `media/artwork.rs` exposes `cached_artwork`/`bytes_for_uri`. `src-tauri/src/presence.rs` speaks Discord IPC framing directly, discovers the socket/named pipe, and polls every 2 s. Settings schema v4 adds `discordClientId` (digits only, ≤32), surfaced in Settings → Other; empty disables presence.
- **M — shortcuts:** `src-tauri/src/shortcuts.rs`, `tauri-plugin-global-shortcut`, best-effort registration; both combos appear in the `?` sheet.
- **N — Wrapped:** `collection/mod.rs` persists bounded play history (10,000 events under `collection.json` key `history`); `collection/wrapped.rs` folds a UTC month into totals, top 5 records, top track/artist, rarest pressing, busiest day, and available months. `cmd_collection_wrapped`; UI is `CrateWrapped.tsx` opened from the Crate header with a month picker. Browser dev shows an empty current-month card.
- **O — packaging/docs:** README lists Windows + Linux, MPRIS, overlay/Discord/Wrapped/global shortcuts, and Linux build/install steps; `tauri.conf.json` bundles `msi`, `nsis`, `deb`, `appimage`. Tests added for `pressingEngine.ts`, `useColorExtraction.ts` (exported `paletteFromPixels`, `buildAmbientFromPalette`), `themes/applier.ts`, and `textureBake.ts` (fake 2D canvas).

## Verification

Last full local run:
- `npm run lint` clean, `npm run build` clean.
- Frontend: 125 tests across 22 files (`npm run test:frontend`).
- Rust: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, 88 tests.
- Windows typecheck: `cargo check --target x86_64-pc-windows-msvc --all-targets` clean (recipe below).
- `git diff --check` clean.
- Overlay runtime: real paused MPRIS session returned `/state` JSON and `/overlay` 200 (4191 bytes) from `./target/debug/vinyldeck`.
- Linux monitor capture verified streaming (~328 KB / 2 s); WASAPI loopback and Discord presence are compile/unit verified only (no Discord client/runtime test here).

## Caveats / Not Manually Verified

- Discord Rich Presence never connected to a live Discord client; app id requires a user-owned Discord application.
- Overlay `/artwork` not exercised because the live test session had no cover; `/state`/`/overlay` were.
- Windows runtime build/audio/presence are CI/typecheck only (no Windows host here).
- Wrapped has backend unit coverage but no live UI click-through; history begins collecting with this version, so older listens are absent.
- Phase 2 caveats stand: MPRIS/SMTC event behavior and artwork scheme timing verified by build/unit tests and a live snapshot, not a player matrix.
- Linux packaging targets are configured but `deb`/`appimage` bundles were not produced locally in this phase.

## Locks / Invariants

- `ENABLE_WEBGL_VINYL` stays `false`; the CSS vinyl renderer and the removed center spindle hole (`.vinyl-hole` must stay absent) are locked.
- Only Noir and Glass are live shells; Aurora/Vapor/Paper are legacy migration values mapped into Noir/Glass + ambient mode.
- Track transitions stay in place for the vinyl; no left/right slide of the record.
- Never use destructive flags (`--force`, etc.) in this repository; `.claude/` is untracked and must not be staged.
- `miniWindowPosition` / the Tauri `window-state` plugin stay out; mini opens docked bottom-right and always on top.
- Public docs must stay product-facing; status/handoff detail belongs in `CHANGELOG.md`, release docs, and this memory.

## Environment

- Node.js v24.12.0, npm 11.6.2
- rustc/cargo 1.96.0, tauri-cli 2.11.2
- Windows typecheck recipe from `src-tauri`:
  `PATH="/snap/kf6-core24/64/usr/lib/llvm-19/bin:$PATH" LD_LIBRARY_PATH="/snap/mesa-2404/1839/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH" cargo check --target x86_64-pc-windows-msvc --all-targets`
  (prints a harmless GNU-compiler warning)

## References

- `.agents/memory/backend-research.md` — backend/platform research; do not repeat.
- `.agents/memory/archive/state-2026-10-24-pre-phase-3.md` — full pre-Phase 3 state.
- `.agents/memory/bugs/` — durable bug notes.
- `CHANGELOG.md` — user-facing feature/fix history.
