# Development Guide

This guide is for contributors working on VinylDeck locally.

## Setup

```powershell
npm install
npm run tauri dev
```

Use browser mode for visual work that does not need Windows media integration:

```powershell
npm run dev
```

### Linux

Install the Tauri v2 system packages (same list CI uses):

```bash
sudo apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev \
  libxdo-dev libssl-dev build-essential pkg-config
```

Then run `npm install` and `npm run tauri dev`. The Linux media backend talks D-Bus (MPRIS) through `zbus`, so no `libdbus` package is needed.

Without root access, unpack the `-dev` packages into a local sysroot instead and point `pkg-config` at it. A checkout-local `.cargo/config.toml` (and `src-tauri/.cargo/config.toml`) can set this for every cargo build:

```toml
[env]
PKG_CONFIG_SYSROOT_DIR = { value = "/path/to/tauri-sysroot", force = true }
PKG_CONFIG_PATH = { value = "/path/to/tauri-sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/path/to/tauri-sysroot/usr/share/pkgconfig:/path/to/tauri-sysroot/usr/lib/pkgconfig", force = true }
```

These files hold machine-specific absolute paths and are gitignored, as are local `linux-env.sh` / `run-tauri.sh` helper scripts. In VMs and containers, set `WEBKIT_DISABLE_DMABUF_RENDERER=1` if the WebView renders blank.

#### User-level install

`src-tauri/target/release/vinyldeck` is replaced on every rebuild, so a launcher that points at it breaks (or runs a half-written file) mid-build. Install a stable copy for the current user instead:

```bash
npm run install:linux
```

The script sources `./linux-env.sh` when present (local sysroot), runs `npm run tauri build -- --no-bundle` (which stops after the release binary), and then installs:

| Item | Path |
| --- | --- |
| Binary (`755`) | `~/.local/bin/vinyldeck` |
| Icon | `~/.local/share/icons/hicolor/256x256/apps/vinyldeck.png` |
| Desktop entry | `~/.local/share/applications/vinyldeck.desktop` |

The desktop entry uses `Exec="$HOME/.local/bin/vinyldeck"`, `Icon=vinyldeck`, and `StartupWMClass=vinyldeck`, so the panel launcher then points at `~/.local/bin/vinyldeck` and keeps working across rebuilds. No sudo is used; `update-desktop-database` and `gtk-update-icon-cache` run only when installed.

To produce Linux installers instead of a bare binary:

```bash
source ./linux-env.sh   # only needed on this machine's local sysroot
npm run tauri build -- --bundles deb
PKG_CONFIG_SYSROOT_DIR= APPIMAGE_EXTRACT_AND_RUN=1 \
  npm run tauri bundle -- --bundles appimage
```

The second step exists because the local sysroot has headers/pkg-config files but no `gtk-3.0` runtime modules; linuxdeploy's GTK plugin reads `PKG_CONFIG_SYSROOT_DIR`, so clearing it for bundling makes the plugin resolve the system module directories. `APPIMAGE_EXTRACT_AND_RUN=1` avoids needing FUSE. With a normal system GTK development install, `npm run tauri build -- --bundles deb,appimage` does both steps.

Outputs land under `src-tauri/target/release/bundle/deb/` and `.../appimage/`. Windows keeps its `msi`/`nsis` targets.

Reuse an existing release binary without rebuilding:

```bash
SKIP_BUILD=1 npm run install:linux
```

Install into a throwaway prefix (useful for testing the script without touching your real launcher):

```bash
VINYLDECK_INSTALL_ROOT=/tmp/vinyldeck-install npm run install:linux
```

Reruns are idempotent: the same three files are overwritten with identical content and the desktop entry is not duplicated.

## Runtime Modes

| Runtime | Playback source |
| --- | --- |
| Browser/Vite | `MockSource` |
| Tauri dev/build | `TauriSource` over Rust SMTC |
| Tauri with `VITE_FORCE_MOCK_SOURCE=true` | `MockSource` |

Set mock mode in PowerShell:

```powershell
$env:VITE_FORCE_MOCK_SOURCE='true'
npm run tauri dev
```

## Verification

Run the smallest useful check for the files you touched, then run the broader gate before committing integration work.

```powershell
npm run build
npm run test:frontend
npm run fmt:rust
npm run clippy:rust
npm run test:rust
git diff --check
```

For debug bundle smoke checks:

```powershell
npm run tauri build -- --debug
```

## Important Paths

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | App boot, settings hydration, playback source setup, render-mode routing |
| `src/views/` | Main and mini player views |
| `src/components/` | Visual and interaction components |
| `src/lib/playback/` | Playback contracts, store, mock source, Tauri source |
| `src/lib/settings/` | Frontend settings adapter/cache |
| `src/lib/window/` | Frontend window adapter |
| `src-tauri/src/media/` | SMTC model, artwork handling, commands, poller |
| `src-tauri/src/settings/` | Rust-owned settings validation and persistence |
| `tauri-plugin-autostart` | Native Start With Windows registration |
| `src-tauri/src/window/` | Window-mode service |
| `src-tauri/src/tray.rs` | Tray menu and close/quit lifecycle |
| `.agents/memory/` | Internal project memory for future agent sessions |

## Content Security Policy

`src-tauri/tauri.conf.json` sets `app.security.csp` to:

```text
default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'
```

- Artwork arrives as `data:` URLs from the backend, so `img-src` allows `data:` and `blob:`. Inline `style` attributes (motion/react, CSS variables) rely on `'unsafe-inline'` in `style-src`.
- Tauri appends hashes for its own injected scripts to `script-src` at build time; do not add inline `<script>` tags to `index.html`.
- Known gaps under this exact policy (tracked, not yet relaxed):
  - Google Fonts `@import` in `src/styles/global.css` is refused (`style-src`), and `fonts.gstatic.com` would be refused by `font-src` falling back to `default-src`. Brand fonts fall back to system fonts until fonts are self-hosted under `public/` or the policy adds `https://fonts.googleapis.com` to `style-src` and `font-src https://fonts.gstatic.com`.
  - No `connect-src`, so Tauri's custom-protocol IPC (`ipc://localhost` on Linux/macOS, `http://ipc.localhost` on Windows) is refused on first call; Tauri logs a warning and falls back to the `postMessage` IPC for the session. Adding `connect-src 'self' ipc: http://ipc.localhost` restores the faster path.
- Desktop `tauri dev` loads `devUrl` directly from Vite, so the policy only applies to bundled builds. Check CSP changes against `npm run build` output, not just dev.
- Never set `csp` back to `null`.

## Architecture Rules

- Keep React platform-neutral. Components consume `PlaybackState`, not Windows APIs.
- In Tauri, Rust commands/events are authoritative for shared playback and settings state.
- Keep browser `MockSource` useful for visual development.
- Use transform/opacity-first animation paths.
- Current exposed shells are Noir and Glass.
- CSS vinyl is the active renderer.
- Do not restore the vinyl center spindle hole.
- Preserve directional track text: next enters from left; previous enters from right.
- Mini mode is a separate shrink-resizable, transparent-capable Tauri WebView. Keep Mini capped at the original `280x280` square, with a `140x140` minimum. Keep Mini Transparency scoped to `miniTransparentMode`, `MiniView`, and the Mini window service; do not make main/fullscreen transparent.

## Documentation Rules

- Public-facing docs should read like product docs, not session logs.
- Internal progress, approvals, and stale work notes belong in `.agents/memory/`.
- `README.md` should orient users and contributors quickly.
- `docs/API.md` and `docs/ARCHITECTURE.md` can use implementation detail.
- `docs/RELEASE_V1.md` and `CHANGELOG.md` hold release/history facts.

## Distribution Notes

Installer-grade validation is separate from local development. The `0.1.0` MSI and NSIS installers were built and smoke-tested on 2026-06-14. Before broader public distribution, recheck WebView2 bootstrap behavior, settings location, bundle identifier naming, player compatibility, and code signing.
