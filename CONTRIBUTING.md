# Contributing to VinylDeck

Thanks for helping. VinylDeck is a Tauri v2 app with a Rust backend and a React 19 + TypeScript frontend. Windows and Linux are first-class platforms, so changes have to keep both working.

## Before you start

- Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the state-ownership rules.
- Read [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for setup and the local sysroot workaround.
- Search existing issues and pull requests before opening a new one.
- For security problems, do not open a public issue. Contact the maintainer privately.

## Setup

### Windows

Install Node.js 20+ (CI uses 24), Rust stable with the MSVC toolchain, and Visual Studio Build Tools with **Desktop development with C++**. WebView2 is already present on Windows 10/11.

```powershell
npm ci
npm run tauri dev
```

### Linux (Debian/Ubuntu)

```bash
sudo apt install build-essential curl wget file libssl-dev libxdo-dev \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev pkg-config
npm ci
npm run tauri dev
```

For audio reactivity install `pulseaudio-utils` (or the PipeWire Pulse compatibility package). Without a root account, point `pkg-config` at a local sysroot instead; the [Development Guide](./docs/DEVELOPMENT.md) explains the exact variables.

Browser-only visual work uses the mock playback source:

```bash
npm run dev
```

## What to change

- **Platform-neutral React.** Components consume `PlaybackState`, settings and window adapters, never `windows`/D-Bus APIs. Put native differences behind the Rust adapters.
- **Rust owns native state.** Media sessions, durable settings, the Crate and the sleep timer are Rust authorities. WebViews send intent and render approved snapshots.
- **One implementation.** Prefer a shared code path with `#[cfg]` edges over two parallel features. This applies to scripts too: the release collector is a single Node program used by both hosts.
- **Preserve the visual contract.** Noir and Glass remain the live shells; legacy Aurora/Vapor/Paper values are migration inputs only. Keep the CSS vinyl renderer and the missing center spindle hole. Do not remove the custom background theme.
- **Do not break Mini.** Mini stays a separate frameless, always-on-top window capped at 280x280 with a 140x140 floor. Transparency is scoped to `miniTransparentMode`.
- **Accessibility is part of the feature.** Keep focus traps, `aria-*` labels, keyboard paths and the single Escape owner intact. New UI strings need English and Russian entries.

## Verification

Run the smallest useful check while iterating, then the full gate before opening a pull request:

```bash
npm run lint
npm run build
npm run test:frontend
npm run fmt:rust
npm run clippy:rust
npm run test:rust
git diff --check
```

Bundle smoke checks:

```bash
# Windows
npm run tauri build -- --bundles nsis,msi

# Linux
npm run tauri build -- --bundles deb,appimage
```

CI runs the frontend/Rust gates on Ubuntu and Windows, a Windows debug bundle, the landing build, and syntax checks for the install scripts. Do not merge with a red check.

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use for |
| --- | --- |
| `feat:` | user-visible feature |
| `fix:` | bug fix |
| `docs:` | documentation only |
| `ci:` | workflow changes |
| `build:` | installers, packaging, dependencies |
| `perf:` | performance work |
| `refactor:` | behavior-preserving restructuring |
| `test:` | tests only |
| `chore:` | maintenance |

Keep each commit coherent, explain **why** in the body, and reference issues when relevant. AI-assisted commits must include the agent's attribution trailer, for example:

```text
Co-Authored-By: Your Agent <noreply@example.com>
```

Never commit secrets, tokens, signing keys, personal absolute paths, `node_modules/`, `target/`, `dist/` or generated `release/` output.

## Pull requests

1. Branch from `main`.
2. Describe the user-visible change, the platforms you tested and anything you could not verify.
3. Include screenshots or a short recording for visual changes.
4. Update `CHANGELOG.md` under `[Unreleased]` for user-visible changes.
5. Update the relevant docs (`README.md`, `docs/`) when behavior, commands or installation changes.
6. Keep the pull request focused. Unrelated fixes belong in another PR.

## Documentation rules

- `README.md` is for users and new contributors: install, features, usage, build.
- `docs/USER_GUIDE.md` explains the product without implementation detail.
- `docs/ARCHITECTURE.md` and `docs/API.md` may be technical.
- `docs/DEVELOPMENT.md` covers setup and verification.
- `docs/RELEASING.md` covers the tag workflow and artifact names.
- Internal session notes belong in `.agents/memory/`, not in public docs.

## Release process

Maintainers bump `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` and `landing/package.json` together, add a `CHANGELOG.md` section, then push a `v*` tag. The Release workflow builds and publishes the artifacts. See [docs/RELEASING.md](./docs/RELEASING.md).

## License

By contributing you agree that your work is licensed under the [MIT License](./LICENSE).
