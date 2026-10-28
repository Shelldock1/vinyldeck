# VinylDeck — Windows 11 Full Test Report

- **Date:** 2026-10-26
- **Machine:** Windows 11 Pro, build 26200 (10.0.26200), x64, 11th Gen Intel i7-11700F
- **Display:** 2560×1440
- **WebView2:** 155.0.4283.62
- **Toolchain:** Node 24.22.1, npm 11.19.1, Rust/Cargo 1.98.1, Tauri CLI 2.12.4, `tauri` crate 2.12.5
- **Repo:** `C:\Users\user\Desktop\vinyldeck`
- **Branch:** `test/windows-full-check` (created from `main` at `3fb0f13`)
- **Local commits:** `9d8e5e1`, `dfdc02e` — **not pushed, no PR opened**

## 1. Gate results

| Gate | Result | Details |
| --- | --- | --- |
| `npm install` | **PASS** | 322 packages added; 323 audited; 9 vulnerabilities (**1 low, 3 moderate, 5 high**). No install failure. |
| `npm run build` | **PASS** | `tsc` + Vite succeeded. 535 modules; JS 545.47 kB (gzip 171.56 kB), CSS 189.31 kB. Only the >500 kB chunk-size warning. |
| `npm run lint` | **PASS** | `eslint src --max-warnings 0`, exit 0, 0 warnings. |
| `npm run test:frontend` | **PASS** | **26 files / 148 tests passed** (Vitest 4.1.8). |
| `cargo fmt --check` | **PASS** | Exit 0. |
| `npm run clippy:rust` | **PASS** | `cargo clippy --all-targets -- -D warnings`, exit 0, no warnings. |
| `npm run test:rust` | **PASS** | **124 passed, 0 failed, 0 ignored** (plus empty doc-test harness). |
| `npm run tauri build` | **FAIL (bundler download; compile PASS)** | Release binary compiled; bundling failed because the WiX tool download from GitHub failed/timed out. Exact output in §2. The equivalent compile-only gate passes. |
| `npm run tauri build -- --no-bundle` | **PASS** | Release binary built: `src-tauri\target\release\vinyldeck.exe`, 14,688,768 bytes; release smoke test passed. |

## 2. Release build / bundling

- **Debug build:** `npm run tauri build -- --debug --no-bundle` — **PASS**. Binary: `src-tauri\target\debug\vinyldeck.exe`.
- **Release compile:** **PASS**. `Finished release profile [optimized] target(s) in 2m 20s`; binary: `src-tauri\target\release\vinyldeck.exe`.
- **Bundling:** **FAIL (environmental)**. `%LOCALAPPDATA%\tauri` was empty, so the Tauri CLI had to download the WiX toolset from GitHub. First run:
  `Downloading https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip`
  → `failed to bundle project: Peer disconnected` / `Error failed to bundle project: Peer disconnected` (exit 1).
  A second full run rebuilt the binary and then hung on the same WiX download; it was stopped after the 5-minute command timeout. A direct `HEAD` request to that URL also timed out. The network to GitHub is throttled/unreachable from this machine, so MSI/NSIS bundling could not complete. This is not a compile or code failure.
- **Compile-only gate:** `npm run tauri build -- --no-bundle` — **PASS**, exit 0, release build in 49.48 s.
- **Release smoke test:** **PASS**. Launched `src-tauri\target\release\vinyldeck.exe` directly: process stayed alive, window `VinylDeck` visible, overlay `http://127.0.0.1:43110/state` returned `active:true` for the current Chrome session. The release binary uses the same code path as the debug binary; no CDP arguments are embedded.

## 3. Fixes made on this branch

### 3.1 `9d8e5e1` — test: cover persistence and Halloween rendering

Added automated coverage for the state that must survive a full quit/relaunch:

- `crate_snapshot_survives_a_reload_with_counts_and_removals`
- `play_history_survives_a_reload`
- `removing_a_record_keeps_its_history`
- `persisted_settings_round_trip_without_losing_fields`
- `version_two_settings_file_upgrades_without_losing_values`
- Frontend `SeasonalLayer` tests: full main-window markup (cobwebs, pumpkins, ghost, spider), Mini compact markup (cobwebs only), spider drop/climb animation, hidden unless Halloween.

Final result after both commits: Rust 124 tests, frontend 148 tests.

### 3.2 `dfdc02e` — fix(settings): keep the store authoritative on Windows

Two concrete Windows issues were fixed:

1. **Out-of-order persistence / failed-save divergence.** `update` and `reset` used to commit the new settings to memory before writing the store. With the Main and Mini windows updating concurrently, the older patch could be written last; a failed write left the running state different from the file. The save now happens while the settings lock is held, and memory is committed only after the save succeeds. A save failure at startup is logged and does not abort launch.
2. **Windows autostart.** The autostart plugin writes the `Run` value without quotes, which breaks an install under `C:\Program Files\...`. The Windows path now writes the command itself with a quoted executable path. `StartupApproved` is touched only on an explicit user toggle, so launching the app manually no longer re-enables an entry disabled in Task Manager. Disabling an absent entry is a no-op instead of an error.

A focused unit test `quotes_an_executable_path_with_spaces` was added.

## 4. Windows parity matrix (live tests)

The application was driven through WebView2 CDP on `127.0.0.1:9222` (temporary debug-only `additionalBrowserArgs`, reverted afterwards) and through the global hotkey. Chrome played a 40-second in-memory tone with Media Session metadata via CDP on `127.0.0.1:9223`.

| Surface | Result | Evidence |
| --- | --- | --- |
| MPRIS → SMTC discovery | **PASS** | Player list: `Chrome`; snapshot track `Windows Parity Test`, artist `VinylDeck QA`, album `SMTC Session`, duration 40 s, source `Chrome`. |
| SMTC transport: pause/play | **PASS** | `afterPause.isPlaying=false`; `afterPlay.isPlaying=true`; Chrome resumed. |
| SMTC next / previous | **PASS** | Chrome counters after commands: `nextCount=1`, `previousCount=1`. |
| SMTC seek | **PASS** | Chrome `seekCount=1`, `lastSeek=21`; app position 21.75 s vs Chrome 21.87 s. |
| SMTC position projection | **PASS** | App 2.134 s vs Chrome 2.24 s (≈0.1 s). Paused position does not advance. |
| SMTC capability flags | **PASS** | `canSeek`, `canSkip`, `canControl` all true for Chrome. |
| Artwork | **PASS** | Backend `vinyldeck://art/17ecacb58ad79b51`; webview `<img src="http://vinyldeck.localhost/17ecacb58ad79b51">`, natural size 150×150; ambient background also uses it. |
| WASAPI loopback (`--audio-level`) | **PASS** | 16/16 non-zero samples, range 0.266–0.618, max 0.618; follows the tone envelope. |
| Crate play counting | **PASS** | QA record play count advanced 22 → 24; persisted across relaunch. |
| Crate press/remove | **PASS** | New pressing persisted; removed record `windows qa\|removed single` absent after relaunch. |
| Tray / close-to-tray | **PASS (window path)** | With `quitToTray=true`, `WM_CLOSE` hid the main window and the process stayed alive; second-instance restore brought it back. The tray menu itself was not clicked. |
| Single instance | **PASS** | Second process exited; existing main window was shown and focused. |
| Always-on-top | **PASS** | `cmd_set_always_on_top(true)` → `WS_EX_TOPMOST=true`; `(false)` → false. |
| Mini window | **PASS** | Global `Ctrl+Alt+M`: title `VinylDeck Mini`, visible, `Topmost=true`, 296×289 outer rect (280×280 client + shadow); main hidden; second hotkey returns to main. |
| Mini compact Halloween | **PASS** | Mini shows cobwebs only; no spider, pumpkins, or ghost. |
| Global shortcut `Ctrl+Alt+M` | **PASS** | Registered and toggled Mini/Main while another app had focus. |
| Global shortcut `Ctrl+Alt+Space` | **ENVIRONMENT BLOCKED** | Registration failed: `HotKey already registered: HotKey { mods: ALT \| CONTROL, key: Space, id: 589886 }`. Another application owns the combination on this PC. The app logs the failure and keeps the other shortcut; not a VinylDeck defect. |
| Autostart on | **PASS** | `HKCU\...\Run\VinylDeck = "C:\...\vinyldeck.exe"` (quoted); `StartupApproved = 02-00-...` (enabled). |
| Task Manager disable preserved | **PASS** | Set `StartupApproved = 03-00-...`, quit, relaunch manually: value remained `03-00-...`. |
| Autostart off | **PASS** | `Run\VinylDeck` and `StartupApproved\VinylDeck` both removed. |
| Reset with autostart absent | **PASS** | `cmd_settings_reset` succeeded and persisted defaults; no "entry not found" error. |
| Read-only settings at startup | **PASS** | Read-only `settings.json`: app launched, loaded Halloween, logged `failed to save normalized settings: ... (os error 5)` instead of aborting. |
| Overlay server | **PASS** | `http://127.0.0.1:43110/state` returned `active:true`, correct track/artist/album/duration/position/source; `/` returned HTTP 200 (4191 bytes); bad `Host: evil.example:43110` returned **403**. |
| Release binary smoke test | **PASS** | `target\release\vinyldeck.exe` launched, window `VinylDeck` visible, overlay returned active state for Chrome. |
| GTK/Wayland code on Windows | **PASS (no-op)** | `GTK_THEME` and `GDK_BACKEND` setup are `#[cfg(target_os = "linux")]` in `src-tauri/src/lib.rs`; `data-soft-render` and `data-platform="linux"` are set only for a Linux WebView UA in `src/main.tsx`. No GTK/Wayland settings are exposed in the Settings UI. |
| Linux soft-render path | **PASS (inactive)** | Windows keeps the full paint stack; the Linux CSS rules do not match. |
| Updater | **CODE-AUDITED, NOT LIVE** | About tab calls GitHub Releases API in Rust; `cmd_open_release` accepts only `https://github.com/Shelldock1/vinyldeck/releases...` and rejects shell metacharacters/other hosts. Network to GitHub was throttled; no live update check was run. |
| External links (release page) | **CODE-AUDITED** | Windows uses `rundll32 url.dll,FileProtocolHandler` with `CREATE_NO_WINDOW` (no `cmd.exe` parsing) and the same release-URL allowlist; Linux uses `xdg-open`, macOS `open`. |
| Discord RPC | **CODE-AUDITED, NOT LIVE** | No Discord client installed. Windows pipe discovery (`\\.\pipe\discord-ipc-N`) and framing exist. See limitation §6.3. |
| Spotify | **NOT TESTED** | Not installed. |
| Sleep timer | **CODE-AUDITED, NOT LIVE** | Shared backend, 5–240 minute validation; no Windows-specific branch. A 1-minute timer was rejected with `Sleep timer minutes must be between 5 and 240`; a 5-minute run was not performed. |

## 5. Persistence across full quit/relaunch

Data location: `%APPDATA%\com.vinyldeck.app`.

### 5.1 Settings

Before quit, the app was set through the backend to:

```json
{
  "version": 4,
  "theme": "glass",
  "scheme": "halloween",
  "ambientMode": "beam",
  "artAmbient": true,
  "vinylWobble": true,
  "filmGrain": true,
  "leanBackMode": true,
  "cursorHide": true,
  "idleTimeoutSeconds": 4,
  "alwaysOnTop": false,
  "keyboardShortcutsEnabled": true,
  "quitToTray": true,
  "startWithWindows": false,
  "windowMode": "main",
  "miniTransparentMode": false,
  "language": "ru"
}
```

After `cmd_quit` and a fresh launch, the probe returned exactly the same values, including `version: 4`. The v2→v4 migration is covered by the new Rust test.

### 5.2 Crate records

- `vinyldeck qa|smtc session` — play count **24**, pressing number 1, thumbnail present.
- `windows qa|persistence ep` — play count 0, pressing number **2**, thumbnail present.
- `windows qa|removed single` — pressed (number 3), then removed; **absent** after relaunch.
- `collection.json` history retained the play events for the kept record.

The removed record's history remains in the internal history (covered by `removing_a_record_keeps_its_history`).

### 5.3 Halloween decorations

After relaunch, DOM probe:

- `webs: 2`, `pumpkins: 3`, `ghosts: 1`, `spider: true`.
- Animations present: `seasonalDrift`, `seasonalFlicker`, `seasonalGlow`, `seasonalSpiderDrop`, `seasonalSpiderSway`, `seasonalSway`, `seasonalThread`.
- Spider bounding-box top at 0 s / 7 s / 14 s: **24.8 px → 337.6 px → 28.7 px**, proving the spider drops down the thread and climbs back.
- Main screenshot: cobwebs top-left/right, spider on the top-right web, three lit jack-o'-lanterns along the bottom.
- Mini screenshot: two corner cobwebs only; no spider/pumpkins/ghost. Mini remains 280×280 and always-on-top.

Screenshots: `C:\Users\user\AppData\Local\Temp\opencode\vinyldeck-harness\shots\halloween-main-2.png` and `halloween-mini-3.png`.

## 6. Audit findings not fixed (no live repro / out of scope)

### 6.1 SMTC sessions keyed only by AUMID

`src-tauri/src/media/smtc.rs` uses the app's AUMID as `source_id` (`session_source_id`) and selects sessions by that string. Two windows/tabs from the same app (e.g., two Chrome windows, both AUMID `Chrome`) have the same key, so selection can pick the wrong session. The picker cannot distinguish them. The live test had a single Chrome session, so this did not fail. A fix needs a stable per-session discriminator or a composite key; not attempted without a repro.

### 6.2 SMTC timeline ignores `StartTime`

`current_lightweight_snapshot_from_session` uses `TimelineProperties.EndTime` for duration and `Position` + `LastUpdatedTime` for projection, but never subtracts `StartTime`. Normal tracks have `StartTime = 0`; live streams or segmented timelines with a non-zero start can report an offset position. The 40 s test track had `StartTime = 0` and matched Chrome within ~0.1 s. No live repro; documented.

### 6.3 Discord IPC does not drain responses

`src-tauri/src/presence.rs` defines `read_frame` but marks it `#[allow(dead_code)]`; `Ipc::connect` sends the handshake and `send` writes updates, but no response is read. Discord answers each frame; a chatty client can fill the pipe buffer. No Discord client is installed here, so this is a code-audit risk only. Fix would require a reader thread or non-blocking drain.

### 6.4 WASAPI format coverage

`src-tauri/src/reactivity/windows.rs` treats `FORMAT_EXTENSIBLE`/`FORMAT_IEEE_FLOAT` with `wBitsPerSample == 32` as float, and 16-bit PCM as `i16`; 24-bit packed and 32-bit PCM are ignored (no samples pushed). Shared-mode mix is normally 32-bit float and the live test passed, but exotic device formats would silently produce no audio level. No such device on this PC; documented.

### 6.5 MSI uninstall does not remove the HKCU Run value

The Windows autostart entry is written to `HKCU\...\Run\VinylDeck` by the app (by design, to quote the path). Neither the MSI template (`src-tauri/installer/main.wxs`) nor the NSIS template removes that value, so an uninstall can leave a stale Run value pointing at a deleted executable. A clean fix needs a bundle custom action or an uninstall-time cleanup; not attempted.

### 6.6 `install.ps1` architecture detection

`install.ps1` reads `$env:PROCESSOR_ARCHITECTURE` and rejects `x86`. Under 32-bit PowerShell on 64-bit Windows (WoW64), that variable is `x86`, so the script aborts even though the OS is 64-bit; it does not consult `PROCESSOR_ARCHITEW6432`. It accepts `ARM64` but the release asset selection may still choose an x64 artifact. Not exercised here (the app was built from source).

### 6.7 Fit-to-monitor can undercut the 700×560 minimum

`fit_main_to_monitor` clamps to 92% of the monitor work area via `fit_within` but does not enforce the configured `minWidth/minHeight` (700×560). On a small/high-DPI work area the programmatic resize can go below the minimum, making the deck controls cramped. At 2560×1440 the window opened at 1016×869, so this was not reproduced.

### 6.8 UTF-8 BOM in `settings.json`

During harness work, a manual `settings.json` edit written with a UTF-8 BOM (Windows PowerShell `Set-Content -Encoding UTF8`) was rejected by the store and the app normalized to defaults (`noir`/`dark`), overwriting the edited file. App-generated settings are BOM-less and the normal path is unaffected. This is a low-probability robustness issue for users who hand-edit the file with a BOM-writing editor; not fixed in this pass.

### 6.9 Updater is release-page based

The app intentionally does not download/install updates; it checks the latest GitHub release and opens the release page in the browser. This is cross-platform and the URL allowlist is unit-tested. A live check was not possible because GitHub access was throttled.

### 6.10 Sleep timer live run

The timer minimum is 5 minutes. The 1-minute attempt was correctly rejected; a full 5-minute live run was not completed. Validation and scheduling code are shared with Linux and covered by existing tests. No Windows-specific branch was found.

## 7. Test harness notes

- WebView2 ignores `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` because wry always sets its own additional args. For live inspection, `additionalBrowserArgs` was temporarily added to the `main` window in `src-tauri/tauri.conf.json`, the debug build was rebuilt, and the change was reverted before the final build. The release build does **not** contain the CDP argument.
- With that temporary CDP argument, creating the Mini webview hung at `show_mini: building mini window ...`; without the argument, the same Mini build succeeded (`mini window ready`, `shown`, `focused`) and was tested through the global hotkey. This is a harness/debugger interaction, not an app defect.
- The BOM false negative in §6.8 initially made the Mini look as if it had no cobwebs. Re-testing with a BOM-less `settings.json` (`scheme=halloween`) showed the cobwebs and no spider. The app's own persistence path writes BOM-less JSON.
- Chrome's `SetPositionState` occasionally lags one poll; the first probe saw 7.0 s while Chrome was at 15.6 s, but the next probe matched within 0.1 s. No reproducible drift bug.

## 8. Final workspace state

- Branch: `test/windows-full-check`; local commits `9d8e5e1`, `dfdc02e`; **not pushed**.
- Working tree: only `WINDOWS_TEST_REPORT.md` is untracked (this report). No source changes from the harness remain; `tauri.conf.json` is reverted.
- Real app data: backed up before testing to
  `C:\Users\user\AppData\Local\Temp\opencode\vinyldeck-appdata-backup-20261026-144811`
  and restored afterwards. Restored file: `settings.json`, 418 bytes, SHA-256
  `2CA3633EF624C224954582D3972040805B9A1AFF65337D6C657F4C0648361134`.
  The test-created `collection.json` was removed.
- Autostart test entries were removed; `HKCU\...\Run\VinylDeck` and
  `StartupApproved\VinylDeck` are absent.
- Scratch files (`cargo-metadata.json`, `cargo-metadata.err`, `missing-crates.txt`) were removed.
