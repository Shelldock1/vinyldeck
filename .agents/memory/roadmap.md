# VinylDeck: Roadmap & Build Sequence

This tracks the overarching phases and the strict build sequence for Phase 1.

## Phases

- **Phase 1:** Windows Desktop MVP (Tauri v2 + SMTC)
- **Phase 2:** Mobile Port (Android + iOS via Tauri v2)
- **Phase 3:** Audio Reactivity (WASAPI loopback for frequency-based pulsing)
- **Phase 4:** Advanced Visuals (WebGL, 3D tonearm, particles)

---

## Phase 1 Build Sequence

_Do not skip ahead. Do not build the media layer before the visual engine looks good._

### [x] Stage 0 & 1 — Project Scaffold ✅ COMPLETE

- [x] Initialize Tauri v2 + React + TS project. (`create-tauri-app`, react-ts template, npm)
- [x] Install dependencies (`motion` v12, `zustand` v5, `fast-average-color` v9, `@tauri-apps/plugin-store` v2, `@types/node`).
- [x] Cargo.toml updated with all PRD-03 §3.1 deps (tauri tray-icon/image-png, tokio, base64, image, windows 0.56 SMTC crate).
- [x] `cargo build` passes. `Finished dev profile in 37.14s`. No errors.
- **Final deps:** motion ^12.40.0, zustand ^5.0.14, fast-average-color ^9.5.2, react ^19.1.0, cargo-tauri v2.11.2

### [x] Stage 2 — Visual Engine with MockSource ✅ COMPLETE

- **Focus:** Build the complete UI with mock data.
- Global CSS & shell system. Current exposed shells are Noir and Glass; Aurora/Vapor/Paper are legacy-migrated values.
- VinylRecord, NeedleArm, AmbientLayer, ProgressRing, TrackInfo, Controls.
- `MockSource` integration and Color Extraction (fast-average-color simple + HSL boost).
- Ambient bloom: mix-blend-mode: screen, single-color uniform wash.
- Settings Modal, Empty State, and Performance/GPU hardening completed and user-approved.
- _Exit criteria:_ ✅ App looks beautiful, physical, animated, and performant in the browser without real media.

### [ ] Stage 3 — Tauri Shell & Window Management

- User confirmed visual satisfaction. Historical task lists are deprecated as git artifacts; use `.agents/memory/` plus current docs for execution context.
- Backend Phase 0 baseline/safety gate, Phase 1 Tauri shell foundation, Phase 2 settings persistence, Phase 3 window modes, and Phase 3 backend-owned playback authority extension are verified.
- Settings persistence has moved to Rust backend authority. WebViews are readers/controllers only; backend validates, persists, and emits `settings-changed`. The old BUG-002 main-only writer fix is superseded by backend ownership.
- Window modes (Main, Fullscreen, Mini always-on-top) are implemented.
- Required gate before tray is complete: Phase 3 extension B3.8-B3.14 moved playback authority to Rust backend so main, mini, tray, shortcuts, and future SMTC all read/control one source of truth.
- User manually approved seamless main/mini playback sync on 2026-06-11.
- Required settings authority gate before tray is implemented and manually approved as B3.15-B3.21. Final bottom ThemePicker persistence bypass was fixed by routing theme/art-ambient changes through backend `commitSettings()`.
- Future dynamic state should use backend-owned command/event authority so no frontend window is a long-term state authority.
- System tray, focused shortcuts, SMTC integration, Backend Phase 10 hardening, opt-in Start With Windows, and Phase 11 installer smoke validation are implemented. Remaining release polish is signing/WebView2/player-matrix cleanup rather than core implementation.

### [ ] Stage 4 — SMTC Media Integration (Windows)

- Rust SMTC reader via `windows` crate.
- 500ms background polling loop.
- Tauri commands and frontend `TauriSource` adapter.
- _Exit criteria:_ App reacts to real Spotify/System music playback.

### [ ] Stage 5 — Polish Pass

- Fine-tune spring stiffness, damping, inertia, glow intensities, and typography.

### [x] Stage 6 — Build and Ship

- Release MSI and NSIS installers compiled and MSI installed successfully on 2026-06-14.
