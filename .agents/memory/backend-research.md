# VinylDeck Windows Backend Research Synthesis

**Date:** 2026-06-10  
**Purpose:** Preserve verified backend/Tauri/SMTC findings so future sessions do not repeat research or implement stale PRD snippets.

## Research Rule

Use this document before web search. Treat findings below as current project guidance.

Do not repeat web research for these topics. Search only when:

- An actual compile/runtime error contradicts this document.
- A required API is absent from installed local package/crate sources.
- A genuinely new backend concept is introduced.

When a new search is necessary, prefer official Tauri documentation, Microsoft Learn, and installed crate/package sources.

---

## Verified Environment

- Windows interactive desktop session.
- Node.js: `v24.12.0`
- npm: `11.6.2`
- Rust: `1.96.0`
- Cargo: `1.96.0`
- Tauri CLI: `2.11.2`
- Tauri Rust crate resolved: `2.11.2`
- `@tauri-apps/plugin-store`: `2.4.3`
- Direct `windows` crate: `0.56`
- Existing `cargo check --manifest-path src-tauri/Cargo.toml`: passes.

## Locked Project Decisions

- Windows media integration uses direct Rust `windows` crate SMTC bindings.
- Media polling interval remains 500ms.
- Visual engine communicates only through locked `PlaybackSource` / `PlaybackState`.
- Browser development uses `MockSource`.
- Tauri development and production use real `TauriSource`.
- Current `windows = 0.56` remains pinned unless a verified blocker requires upgrade.
- Main Phase 1 window keeps native Windows decorations.
- Fullscreen and Mini modes are frameless.
- Close hides to tray; explicit Quit terminates.
- Focused-window shortcuts only. System-global hotkeys are out of scope.

---

## Tauri v2 Findings

### WebView2 Shutdown Log

On 2026-06-11, manual B5 verification produced this shutdown log after explicit quit:

```text
Failed to unregister class Chrome_WidgetWin_0. Error = 1412
```

This message is emitted by Chromium/WebView2 during Windows shutdown/teardown and is tracked upstream in Chromium/WebView2/Tauri discussions. Treat it as non-blocking when the app exits cleanly and no process remains. VinylDeck still hardened explicit quit after this finding: backend `cmd_quit` and tray Quit now destroy `mini` and `main` windows before `app.exit(0)` to encourage orderly WebView teardown. If the message persists without a crash or leftover process, do not block backend phases on it.

### Runtime Detection

Use:

```ts
import { isTauri } from "@tauri-apps/api/core";
```

Do not use `import.meta.env.DEV` for source selection. `tauri dev` is development mode but must exercise real SMTC.

Recommended selection:

```ts
const forceMock = import.meta.env.VITE_FORCE_MOCK_SOURCE === "true";
const source = isTauri() && !forceMock ? createTauriSource() : createMockSource();
```

Installed local API confirms `isTauri(): boolean` exists in `@tauri-apps/api/core`.

### Store Plugin

Rust plugin registration:

```rust
.plugin(tauri_plugin_store::Builder::new().build())
```

Frontend API supports:

```ts
import { load } from "@tauri-apps/plugin-store";

const store = await load("settings.json", { autoSave: false });
await store.set("key", value);
await store.save();
```

Store path is relative to app data directory. Validate and merge loaded data with defaults. Persist only stable settings, never playback/runtime QA state.

### Capabilities and Permissions

Tauri v2 frontend API access is capability-gated. Add only required window/event/store permissions and include both `main` and `mini` window labels.

Windows `globalMediaControl` is a Windows package capability, not a Tauri ACL permission. Test SMTC separately in:

1. `npm run tauri dev`
2. Installed release bundle

### Event Listener Cleanup

Tauri event `listen()` returns an unlisten function. `TauriSource` must retain and call all unlisten functions in `stop()`.

Bad:

```ts
await listen("event", handler);
stop() {}
```

Required:

```ts
const unlisten = await listen("event", handler);
unlisteners.push(unlisten);

stop() {
  for (const unlisten of unlisteners.splice(0)) unlisten();
}
```

This prevents duplicate listeners during source swaps, HMR, or multi-window lifecycle changes.

### Close and Tray Lifecycle

Tauri v2 close is a close-request flow. Implement close-to-tray carefully:

- Main/mini close request hides window.
- Explicit tray Quit exits process.
- Avoid recursively calling close while intercepting close.
- Tray left click shows/focuses main.
- Reuse one window-mode service for tray and frontend commands.

### Window Modes

Recommended:

- `main`: existing native-decorated main window.
- `fullscreen`: same main window, fullscreen, mini hidden.
- `mini`: separate `280×280`, always-on-top, frameless, non-resizable, skip taskbar; main hidden.

Do not create duplicate Mini windows. Reuse existing label.

Installed Tauri 2.11.2 source warning: `WebviewWindowBuilder::new(...).build()` has a known Windows/WebView2 deadlock risk when used in synchronous commands or event handlers. If mini creation opens a blank/white window or hangs, convert the window-mode command path to an async command or spawn creation off the sync command path before trying visual/CSS fixes.

### Windows Installer

Tauri supports:

```json
"bundle": {
  "windows": {
    "webviewInstallMode": {
      "type": "downloadBootstrapper"
    }
  }
}
```

This keeps installer small and downloads WebView2 when needed. Validate installer on the actual target environment.

---

## Microsoft SMTC Findings

### Session Manager

`GlobalSystemMediaTransportControlsSessionManager::RequestAsync()` requests manager access. `GetCurrentSession()` returns the session Windows considers most relevant to control.

SMTC must run in an interactive user session. Do not design it as a Windows service/SYSTEM process.

### Session Information

Relevant APIs:

- `GetPlaybackInfo()`
- `GetTimelineProperties()`
- `TryGetMediaPropertiesAsync()`
- `SourceAppUserModelId()`
- `Thumbnail()`

Thumbnail is an `IRandomAccessStreamReference`. Read it with a strict byte limit and convert to a data URL. Missing/invalid artwork must return `None`, never crash.

### Playback Commands Return Bool

These APIs return `IAsyncOperation<bool>`:

- `TryPlayAsync`
- `TryPauseAsync`
- `TryTogglePlayPauseAsync`
- `TrySkipNextAsync`
- `TrySkipPreviousAsync`
- `TryChangePlaybackPositionAsync`

Awaiting without checking the returned boolean is incorrect. `false` means request rejected or unsupported and must become a graceful error/result.

### Seek Units

`TryChangePlaybackPositionAsync` accepts signed 64-bit ticks. One second is `10_000_000` ticks.

Validate input:

- finite
- non-negative
- safely convertible to `i64`

### Capabilities

Use playback controls to determine whether actions are enabled, including `IsPlaybackPositionEnabled`.

Capabilities differ per source. Spotify, browsers, and VLC may expose different subsets. Never assume seek/skip/control availability.

### Polling Strategy

Poll every 500ms, but split expensive and lightweight work:

- Every poll: current session, playback status, timeline, capability changes.
- Every poll must also refresh cheap media-property text identity (`Title`, `Artist`, `AlbumTitle`) before deciding whether cached metadata/artwork is still valid. Do not identify a track by `source_id + duration` alone; Spotify can serve different tracks with the same/similar duration, causing stale previous-song artwork/title. Use a semantic cache key such as `source_id + title + artist + album + duration`.
- Only on session/track semantic identity change: read/decode artwork stream.
- Emit immediate semantic changes.
- Emit periodic position resyncs.
- Emit one session-ended/empty transition.
- Rate-limit repeated errors.

Do not read and base64-encode artwork every 500ms.

Use `GlobalSystemMediaTransportControlsSessionTimelineProperties.LastUpdatedTime()` with `Position()` to project current position at emit time when media is playing. This avoids emitting stale timeline positions and reduces apparent frontend progress drift/backward jumps.

### Snapshot/Command Robustness

- Reacquire current session for commands rather than storing fragile session state.
- Missing session returns typed/graceful error.
- Missing metadata uses empty strings.
- Missing duration/position uses `0`.
- Missing artwork uses `None`.
- No WinRT error may panic or terminate poller.

---

## Current Repo Status and Corrections Required

Already corrected through Backend Phase 3:

- Tauri product/title/identifier/window labels are VinylDeck-specific.
- `greet` scaffold command and opener plugin were removed.
- Least-privilege capabilities cover `main` and `mini` windows plus window/event needs.
- Settings adapter now proxies backend settings commands/events; Rust backend persists settings through `tauri-plugin-store`.
- Window service exists for main/fullscreen/mini modes.
- Functional `MiniView` exists.

Still outstanding after Backend Phase 3:

- Mini/main cross-WebView theme/settings authority fix from BUG-002 is superseded: Rust backend now owns persisted settings writes, and every WebView is a reader/controller through backend commands/events.
- Phase 3 extension B3.8-B3.14 implemented backend-owned playback authority with a backend mock provider and a thin frontend `TauriSource` proxy. This avoids window-to-window bridges and gives tray/shortcuts/SMTC one state/command authority.
- Phase 3 settings authority extension B3.15-B3.21 implemented backend-owned settings authority with `cmd_settings_snapshot`, `cmd_settings_update`, `cmd_settings_reset`, and `settings-changed`.
- Final Phase 3 settings bug fixed: bottom `ThemePicker` must commit theme/art-ambient changes through backend `commitSettings()`. Do not use direct local `setTheme` / `setArtAmbient` store actions for persisted UI controls.
- Real SMTC adapter is not implemented yet; it should replace the backend mock provider behind the same backend authority contract.
- No tray module, close-to-tray lifecycle, focused shortcuts, or installer hardening are implemented yet.

## Primary References

- Tauri Store plugin: https://v2.tauri.app/plugin/store/
- Tauri Store API: https://v2.tauri.app/reference/javascript/store/
- Tauri capabilities: https://v2.tauri.app/security/capabilities/
- Tauri permissions: https://v2.tauri.app/security/permissions/
- Tauri system tray: https://v2.tauri.app/learn/system-tray/
- Tauri window customization: https://v2.tauri.app/learn/window-customization/
- Tauri window API: https://v2.tauri.app/reference/javascript/api/namespacewindow/
- Tauri Windows installer: https://v2.tauri.app/distribute/windows-installer/
- Microsoft GSMTC manager: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager
- Microsoft GSMTC session: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession
- Microsoft GSMTC seek: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssession.trychangeplaybackpositionasync
- Microsoft GSMTC media properties: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmediaproperties
- Microsoft thumbnail property: https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmediaproperties.thumbnail
- Microsoft `globalMediaControl`: https://learn.microsoft.com/en-us/windows/uwp/schemas/appxpackage/uapmanifestschema/element-uap7-capability

---

## Audio Reactivity Feasibility (2026-10-22)

Research-only spike. No code or dependency changes. Question: can a reactive glow be fed by system audio on Linux and Windows without regressing the soft-render budget?

### Linux: monitor tap

Verified on this machine (2026-10-22): PipeWire 1.6.2 with PulseAudio compat (`pactl info` → "PulseAudio (on PipeWire 1.6.2)"), default sink `alsa_output.pci-0000_00_1f.3.analog-stereo`, monitor source `<sink>.monitor`, monitor ports `<sink>:monitor_FL/FR`, default sample spec `float32le 2ch 48000`.

Discover the tap:
- `pactl get-default-sink` → sink name; the monitor source is exactly `<sink>.monitor`.
- `pactl list short sources | grep monitor` → confirms the source and its sample spec.
- `pw-cli ls Node | grep -i monitor` or `pw-link -o | grep monitor` → native PipeWire node/port names.
- `pw-dump | grep -A3 'Audio/Sink'` → node ids if linking by id.

Capture routes, in order of project fit:

| route | crate | notes |
| --- | --- | --- |
| Pulse compat | `libpulse-binding` 2.30.1 | `ServerInfo.default_sink_name` → `.monitor`, or enumerate `SourceInfo.monitor_of_sink`. Builds through `libpulse-sys` + `pkg-config`; libpulse headers are **not installed here** (`pkg-config libpulse` empty), so `libpulse-dev` is needed on machines/CI. |
| Native PipeWire | `pipewire` 0.10.1 | `StreamFlags::AUTOCONNECT` + `MAP_BUFFERS` + `RT_PROCESS`, `TARGET_OBJECT=<sink node.name>`, `STREAM_CAPTURE_SINK="true"` (confirmed in upstream `audio-capture.rs`). Needs `libpipewire-0.3` dev headers — **also absent here**. |
| Zero-crate probe | none | spawn `parec --device=<sink>.monitor --format=float32le --rate=48000 --channels=2 --latency-msec=40` or `pw-record --target <sink> --latency 40ms -`. Depends on an external binary; fine for a spike, not for shipping. |

Naming trap: crates.io `pulse` 0.5.3 is an unrelated 2016 async-wake crate, not PulseAudio. Use `libpulse-binding` if this route is approved. `cpal` 0.18.2 is not a fit: no loopback/monitor concept, and its Linux default backend is ALSA, so monitor sources are not enumerable; master 0.19 adds optional `pipewire`/`pulseaudio` features but still models devices, not sink monitors [unverified whether it lists monitors].

Format/latency: request F32 48 kHz stereo; PipeWire quantum 1024 ≈ 21 ms, so set node latency 20–50 ms. A 2048-sample analysis window is 43 ms — fine for glow, not for beat-sync. Handle default-sink changes (`pactl subscribe` or PipeWire registry `global`/`remove`) by re-targeting; on loss emit flat bands rather than erroring.

Flatpak/portal: VinylDeck currently ships deb/rpm/AppImage (unconfined), so no portal applies. If Flatpak is added, `--socket=pulseaudio` is documented to grant sound input; whether monitor sources remain visible through the sandbox proxy is **unverified** and needs a test. There is no dedicated "audio monitor" portal.

### Windows: WASAPI loopback

Existing `windows = 0.56` already carries `Media`, `Media_Control`, `Foundation`. Loopback needs only feature additions to that same crate: `Win32_Media_Audio`, `Win32_System_Com`, `Win32_System_Threading`, `Win32_Foundation` (the WinRT `Foundation` feature is a different thing). No new crate.

Flow: `CoInitializeEx(MTA)` → `IMMDeviceEnumerator::GetDefaultAudioEndpoint(eRender, eConsole)` → `IAudioClient::Initialize(SHARED, LOOPBACK | EVENTCALLBACK, 0, 0, mix_format)` → `SetEventHandle` → `GetService::<IAudioCaptureClient>` → `Start` → `WaitForSingleObject` → `GetNextPacketSize`/`GetBuffer`/`ReleaseBuffer`.

- Event-driven loopback is supported on Windows 10 1703+; the old "signal the render stream" workaround is not needed (Microsoft Learn, Loopback Recording).
- Shared mode requires the endpoint mix format from `GetMixFormat` (usually 48 kHz f32 stereo, `WAVEFORMATEXTENSIBLE`); use it verbatim or pass `AUTOCONVERTPCM`. Handle `AUDCLNT_BUFFERFLAGS_SILENT` and `AUDCLNT_E_DEVICE_INVALIDATED` (rebuild on default-device change).
- `wasapi` 0.26 supports loopback and event-driven capture, but depends on `windows 0.62` → pulls a second copy of the bindings; avoid while 0.56 is pinned. `cpal` has no loopback.
- Permissions: MSI/NSIS Win32 app, so no manifest capability and no consent prompt. It captures the full endpoint mix (other apps, notifications), not per-app; DRM-protected or exclusive-mode audio may be silent/absent. Per-app capture needs Win10 2004 process loopback and is out of scope. [unverified: whether mic-privacy settings affect render loopback; MS docs treat loopback as render-side]

### Shared: FFT, bands, IPC, paint budget

FFT candidates — all would be **new** dependencies (none are in `src-tauri/Cargo.toml`):
- `rustfft` 6.4.1 — fastest, runtime AVX/SSE/NEON detection; complex output.
- `realfft` 3.5.0 — real-input wrapper over rustfft; ideal for audio, roughly 2× cheaper.
- `microfft` 0.6.0 — `no_std`, fixed sizes, no SIMD; smaller but stale (2024) and no desktop benefit.
- Zero-dependency alternative: 8 fixed Goertzel filters or a small radix-2 FFT over 2048 samples (~33k mul-add per update), enough for 8 bands.

Sizing: 48 kHz, 2048-sample Hann window, update every 33–50 ms. 1024 gives 46.9 Hz bins (too coarse for bass); 2048 gives 23.4 Hz. Suggested log edges: 32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz → 9 bands, collapsed to 8 for IPC. Per-band AGC with slow decay, attack ≈0.35 / release ≈0.08 per update, gamma ≈0.7.

Cost estimate (not measured): one 2048-point real FFT ≈ 10–60 µs on this i7-11700F depending on SIMD; at 30–60 Hz that is <4 ms of CPU per second (<0.2% of one core). Capture wakeups dominate over FFT. The real 30–60 fps budget is paint, not DSP.

IPC: keep the 500 ms metadata poller untouched; audio runs on its own thread and its own 20 Hz `audio-levels` event (`{ rms: u8, bands: [u8;8] }`, <200 B). Do not push levels through `PlaybackAuthority`/watch (would wake tray and sleep-timer consumers). Emit to the main window only; skip while paused/silent/hidden/mini. Frontend listens once and writes one CSS custom property via ref — no React state or store write per event.

Paint: opacity only, on an existing cheap layer. `.ambient-layer__base::after` survives soft render, but `soft-render.css` pins its `transform` to `none`, so animate `opacity`/colour only. No `filter`, `box-shadow`, `backdrop-filter`, or blend. Gate: off by default when `data-soft-render="1"`; if enabled there, cap at 10–15 Hz and measure. `prefers-reduced-motion: reduce` and existing animation settings force a static/off state. Budget headroom: disc spin is already 34–40 ms/frame (25–33 fps), idle 21–28 ms; the feature must add <1–2 ms/frame or it is not shippable.

### Recommendation

**Needs dependency approval; feasible now.** DSP and capture are cheap; the risks are Linux system build deps, packaging, and the soft-render paint budget.

Minimal first slice (no FFT crate, no new crate on Windows):
1. Settings v4 `audioReactive` (default off) + intensity, Rust-owned like other settings.
2. Windows-only: WASAPI loopback thread (windows-crate feature additions only), Goertzel 8 bands + RMS, 20 Hz `audio-levels`.
3. Frontend: one opacity variable on the ambient layer, 15 Hz lerp, reduced-motion and soft-render gates, hard off when paused.
4. Linux: probe only via `parec`/`pw-record`; production path deferred until `libpulse-binding` or `pipewire` plus dev headers are approved.

Risks: new system build deps and CI apt packages (Linux); duplicate `windows` crate if `wasapi` is chosen; default-device hot-swap churn; system sounds/notifications polluting the signal; DRM/exclusive-mode silence; "always listening" perception (needs off-by-default and no recording); soft-render regression if anything beyond opacity animates. Fullscreen and Mini render the same layers, so cost doubles if both are visible.
