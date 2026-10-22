# VinylDeck: Architectural Decisions Record

## DECISION: Ambient Color Extraction — LOCKED (2026-06-08, FINAL)

**Approach: fast-average-color `simple` algorithm + HSL boost**

- Library: `fast-average-color` ^9.5.2
- Algorithm: `simple` — straight weighted average of all pixels
- Input: HTMLImageElement (loaded with crossOrigin="anonymous")
- Ignored: near-white pixels (threshold 25), near-black pixels (threshold 15)
- Post-process: HSL saturation boosted to min 0.55 (max 0.90), lightness clamped 0.25–0.50
- Near-achromatic result (saturation < 0.05) → `resetAmbientColors()` → theme CSS tokens hold
- Single color → BOTH orbs → uniform cinematic wash (no dual-gradient split)
- Both orbs use `mix-blend-mode: screen` — color blooms luminously on OLED black

**Algorithm history (tested, rejected):**
- `@vibrant/core` — vibrance-first, picks UI-accent color not ambient mood
- `node-vibrant` — Node.js-only; browser adapter broken in Vite/Tauri
- `colorthief` MMCQ — area-dominant; picks dark shadow zones in real photos, not mood
- FAC `dominant` — worst result; coarse bucketing picks arbitrary noise clusters
- FAC `sqrt` — grey-cancellation on complex photos (BIA: blue + gold averaged to grey)
- FAC `simple` ✅ — best across all art types; keeps overall mood hue

**Why single color over dual:**
- Dual orbs with different colors created a visible left-dark/right-bright split that looked like a rendering artifact
- Single uniform wash matches the mock track behavior (Neon Requiem purple reference)

---

## Core Technology Decisions

| Date       | Area                 | Decision                           | Reason                                                                                                                                 |
| ---------- | -------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-08 | App Type             | **Standalone Desktop Application** | Universal support for any music player via OS media APIs.                                                                              |
| 2026-06-08 | Media Source         | **OS Media APIs (SMTC)**           | Works with Spotify, YouTube Music, VLC without authentication.                                                                         |
| 2026-06-08 | Desktop Shell        | **Tauri v2**                       | ~6 MB binary, Rust backend, native platform integration, far lighter than Electron.                                                    |
| 2026-06-08 | Frontend             | **React + TypeScript**             | Component architecture maps naturally to VinylDeck visual hierarchy.                                                                   |
| 2026-06-08 | Animation Engine     | **motion/react v12**               | Spring physics + Web Animations API provide physical, tactile motion.                                                                  |
| 2026-06-08 | Theming System       | **CSS Custom Properties**          | Instant runtime theme switching without React re-renders.                                                                              |
| 2026-06-08 | Media Polling        | **500ms Rust Polling Loop**        | SMTC WinRT COM STA events are unreliable; polling is simple and deterministic.                                                         |
| 2026-06-08 | Playback Abstraction | **`PlaybackSource` Interface**     | Visual Engine remains decoupled from Tauri commands; consumes only `PlaybackState`.                                                    |
| 2026-06-08 | Design System        | **Five Cinematic Themes — superseded in current UI** | Original plan was Noir, Glass, Aurora, Vapor, Paper as CSS custom property blocks. Current exposed shells are Noir and Glass only; see 2026-06-14 Active Visual Shells decision. |
| 2026-06-08 | Color Extraction     | **fast-average-color simple**      | Best generalized ambient mood extraction across all album art types. See above.                                                        |
| 2026-06-08 | Ambient Rendering    | **mix-blend-mode: screen**         | Screen blend on OLED black makes any color bloom luminously. Dark orb without it = dark smudge. |
| 2026-06-10 | Perf Exceptions      | **Aurora/Vapor background-position exceptions** | Phase 11 keeps animation paths transform/opacity-first, but Aurora gradient shift and Vapor grid travel intentionally animate `background-position` on isolated background layers because they define those theme identities. |
| 2026-06-11 | Settings Authority | **Rust backend owns persisted settings writes** | Playback authority proved the backend command/event pattern. WebViews are now readers/controllers only; Rust validates, persists, and emits settings snapshots to all windows. Supersedes the temporary main-only writer fix from BUG-002. |
| 2026-06-11 | Multi-Window Dynamic State | **Backend owns playback authority before tray/SMTC** | Main/mini/tray/shortcuts must not rely on window-to-window playback bridges. Rust backend will own playback state/commands; any number of windows subscribe to backend events and invoke backend commands. If this pattern works cleanly, settings and future dynamic state should migrate backend-owned too. |
| 2026-06-11 | V1 Baseline | **Freeze current build as V1 docs baseline; defer Phase 11 distribution** | Backend Phase 10 automated hardening passed and live Spotify sync was approved. Phase 11 installer/distribution validation, bundle identifier cleanup, player matrix, and tray playback SMTC unification are intentionally held for a later pass. |
| 2026-06-13 | Vinyl Pressing Engine | **Deterministic Album-to-Pressing Engine** | Quantizes art to 3 colors (primary/secondary/accent) and maps them to solid/marble/splatter/translucent/smoke/split/audiophile-black. Prevents achromatic covers from collapsing to solid black, applies SVG noise/warp filters for organic physical texture, and controls visually rendering through dynamic CSS properties on HTML root to preserve 60fps without React re-renders. |
| 2026-06-14 | Interaction Toggles | **Keyboard shortcuts and close-to-tray are persisted Rust-owned settings** | `keyboardShortcutsEnabled` disables all focused shortcuts except Escape for Settings/fullscreen; Ctrl+Q is disabled with the rest. `quitToTray=false` makes main/mini close requests quit the app, while explicit Quit always exits. |
| 2026-06-14 | Track Change Motion | **User intent supplies directional transition metadata** | Previous/next controls and shortcuts mark a pending direction in the playback store. The next semantic track change consumes it for text slide direction and vinyl skip impulse; source-driven/external changes fall back to fade-only unknown direction. |
| 2026-06-14 | Active Visual Shells | **Noir and Glass are the only exposed shells** | Aurora, Vapor, and Paper are legacy migration inputs, not current UI choices. `legacyThemeToShell()` maps old saved values into Noir/Glass and legacy ambient values into the current Art Ambient model. |
| 2026-06-14 | Active Vinyl Renderer | **CSS vinyl renderer is active; WebGL remains hard-OFF** | `ENABLE_WEBGL_VINYL=false` in `VinylRecord`. Keep WebGL files as dormant experiment only; do not re-enable without a future material/performance proof. |
| 2026-06-14 | Vinyl Center | **No center spindle hole** | User requested removing the center dot. Do not restore `.vinyl-hole`; album art should remain unobscured at label center. |
| 2026-06-14 | Repo Hygiene | **No raw/chat/root prompt/task artifacts in git** | `raw/` is deprecated. Chat exports, root prompt files, root task lists, and `task.md` are local scratch only. `fresh_session_prompt.md` may remain locally but must stay ignored and untracked. Durable context belongs in `.agents/memory/` and docs. |
| 2026-06-14 | Start With Windows | **Opt-in QOL setting, default OFF** | VinylDeck should not force itself into startup. Users who want a tray-resident companion can enable `startWithWindows`; Rust settings authority syncs the desired state to Tauri autostart. |
| 2026-06-15 | App Icon Identity | **Half-Light Disc `normal-transparent` is the final V1 icon mark** | User selected the richer Half-Light Disc render after comparing IconForge and normal-v2/VD variants. The complete Tauri icon set was regenerated from that source, including Square/Store/icns/png/mobile scale assets. Windows uses a single installer-safe multi-size `icons/icon.ico`; keep one consistent icon identity across app, taskbar, tray, shortcuts, and installer contexts. |
| 2026-06-15 | Windows Installer Templates | **Keep tracked WiX/NSIS templates for icon and uninstall behavior** | Tauri defaults did not put `ProductIcon` on every shortcut and did not provide the desired NSIS folder cleanup behavior. `src-tauri/installer/main.wxs` and `installer.nsi` are intentional release assets: MSI shortcuts use `ProductIcon`, NSIS installer/uninstaller use `icons/icon.ico`, NSIS shortcuts use the installed exe icon, and NSIS uninstall can remove app data/settings through its checkbox. If Explorer shows an old exe/shortcut icon while extracted exe resources are correct, treat it as Windows icon cache or a cached old shortcut. |
| 2026-06-15 | Window Position Persistence | **Reverted from V1 scope** | The attempted `miniWindowPosition` settings path and Tauri `window-state` plugin integration regressed mini-mode behavior. Keep the prior window-mode flow: entering mini builds/shows mini and hides main; returning main destroys mini and restores main. Revisit main/mini position persistence only with a separate proof pass. |
| 2026-06-15 | Mini Context Menu | **Disabled in mini mode** | Mini is a minimal companion surface. Keep the custom right-click context menu on main only; mini should expose hover controls, keyboard shortcuts, tray behavior, and the return button without an in-window context menu. |
| 2026-06-15 | Devtools In Release | **Explicitly denied** | Release builds should not expose WebView devtools. Keep `core:webview:deny-internal-toggle-devtools` in capabilities and do not enable Tauri's devtools feature for public builds. |
| 2026-07-03 | Mini Transparency | **Mini-only Acrylic mode, default OFF** | Mini is a separate transparent-capable Tauri WebView and may apply native Windows Acrylic when `miniTransparentMode` is enabled. The Mini document toggles transparent backgrounds only in its own WebView; main/fullscreen stay opaque. Mini is shrink-resizable from `280x280` down to a `140x140` floor and must not expand beyond the original square. |

---

## Architectural Principles

1. The Visual Engine must remain independent of platform-specific APIs.
2. All media information must flow through the `PlaybackSource` abstraction layer, with Tauri `PlaybackSource` acting only as a backend proxy.
3. Runtime theme switching must never require component remounting.
4. All animations must use spring-based motion rather than linear easing.
5. The application must remain lightweight, native-feeling, and hardware-efficient.
6. New media providers should be added behind the backend media authority without modifying the Visual Engine.

---

## ⚠️ Critical Safety Lock

**NEVER use `--force`, `--yes` combined with destructive scaffold tools, or any flag that overwrites/clears an existing non-empty directory in `c:\Coding\vinyldeck\`.** On 2026-06-08, `npx create-tauri-app . --force` destroyed all pre-existing files. User restored from backup. Always scaffold into a clean temp directory and copy only what is needed.

**Last Updated:** 2026-07-03
