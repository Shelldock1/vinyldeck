# Agent Instructions: VinylDeck

## Operating Mode
- Use caveman full mode by default.
- Read this file first, then rebuild context from `.agents/memory/`.
- Do not read the whole repo unless task demands it; use `rg` and `fd`.
- For visual work, consult `.agents/memory/stitch-ui-designs.txt`, `.agents/memory/top_20_designs.md`, and relevant `.agents/memory/reviews/` files before assuming design.

## Source Of Truth
- Current product state: `.agents/memory/state.md`
- Architecture locks: `.agents/memory/decisions.md`
- Roadmap: `.agents/memory/roadmap.md`
- Vision and stack: `.agents/memory/context.md`
- Visual rules: `.agents/memory/design-guidelines.md`
- Motion rules: `.agents/memory/animation-physics.md`
- UI review index: `.agents/memory/ui-review-map.md`
- User-facing docs: `README.md`, `docs/`, `CHANGELOG.md`, `llms.txt`
- Deprecated: `raw/`, chat exports, root prompt files, root task lists, and `task.md`

## Package Manager
- Use npm.

```text
npm install
npm run tauri dev
npm run tauri build
```

## Fast Verification
| Task | Command |
| --- | --- |
| Frontend build | `npm run build` |
| Frontend tests | `npm run test:frontend` |
| Rust format check | `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` |
| Rust tests | `cargo test --manifest-path src-tauri/Cargo.toml` |
| Whitespace | `git diff --check` |

## Current Locks
- Active shells: Noir and Glass only.
- Legacy Aurora/Vapor/Paper values migrate into current shells; do not describe them as live UI choices.
- Active vinyl renderer: CSS only. Keep `ENABLE_WEBGL_VINYL=false` unless future proof says otherwise.
- No vinyl center spindle hole; do not restore `.vinyl-hole`.
- Settings and playback are Rust-owned authorities; WebViews act as readers/controllers.
- Phase 11 installer/distribution work remains deferred.

## Repo Hygiene
- Keep `.agents/memory/` updated before finishing implementation sessions.
- Keep root prompt/task/chat artifacts out of git.
- `fresh_session_prompt.md` may exist locally, but must stay ignored and untracked.
- Do not restore `raw/`; PRD history now lives through memory and docs.
- Do not stage unrelated local scratch files.

## Commit Attribution
AI commits MUST include:

```text
Co-Authored-By: (the agent model's name and attribution byline)
```
