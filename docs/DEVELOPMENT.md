# Development Guide

This guide covers local setup, verification and packaging for VinylDeck. Windows and Linux are both supported; CI builds both on every push.

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | 20+ (CI and releases use 24) |
| npm | ships with Node |
| Rust | stable (`rustup`) |
| Platform toolchain | see below |

### Windows

- Visual Studio Build Tools with **Desktop development with C++** (MSVC linker, Windows SDK).
- Microsoft WebView2 Runtime. Windows 10/11 already include it.
- Rust target `x86_64-pc-windows-msvc` (the default from rustup on Windows).

If PowerShell blocks the local install script, run it with `-ExecutionPolicy Bypass`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-windows.ps1
```

### Linux (Debian/Ubuntu)

```bash
sudo apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev \
  libxdo-dev libssl-dev build-essential pkg-config
```

MPRIS uses D-Bus through `zbus`; no separate `libdbus` development package is required. Audio reactivity reads the default monitor with `parec`, which ships with `pulseaudio-utils` or the PipeWire Pulse compatibility package.

## First run

```bash
git clone https://github.com/Shelldock1/vinyldeck.git
cd vinyldeck
npm ci
npm run tauri dev
```

For visual work that does not need native media integration:

```bash
npm run dev
```

Browser mode uses `MockSource`. Tauri mode uses `TauriSource` over the Rust media bridge.

| Runtime | Playback source |
| --- | --- |
| `npm run dev` | `MockSource` |
| `npm run tauri dev` / bundled app | `TauriSource` over SMTC or MPRIS |
| Tauri with `VITE_FORCE_MOCK_SOURCE=true` | `MockSource` |

```powershell
$env:VITE_FORCE_MOCK_SOURCE='true'
npm run tauri dev
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with mock playback |
| `npm run build` | Type-check and build the frontend |
| `npm run lint` | ESLint (`react-hooks`, `jsx-a11y`, zero warnings) |
| `npm run test:frontend` | Vitest frontend suite |
| `npm run tauri dev` | Desktop app with native media |
| `npm run check:rust` | `cargo check` |
| `npm run fmt:rust` | rustfmt check |
| `npm run clippy:rust` | Clippy with `-D warnings` |
| `npm run test:rust` | Rust tests |
| `npm run install:linux` | Build and install for the current Linux user |
| `npm run install:windows` | Build and install for the current Windows user |
| `npm run release:collect -- <os>` | Map bundle output to stable release names |

Full gate before a pull request:

```bash
npm run lint
npm run build
npm run test:frontend
npm run fmt:rust
npm run clippy:rust
npm run test:rust
git diff --check
```

## Rootless Linux sysroot

Some machines and containers have the GTK/WebKit runtime but not the `-dev` packages, and no root access. Unpack the headers and `.pc` files into a local sysroot and point pkg-config at it. A checkout-local `.cargo/config.toml` applies the variables to every cargo invocation:

```toml
[env]
PKG_CONFIG_SYSROOT_DIR = { value = "/path/to/tauri-sysroot", force = true }
PKG_CONFIG_PATH = { value = "/path/to/tauri-sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/path/to/tauri-sysroot/usr/share/pkgconfig", force = true }
```

`PKG_CONFIG_SYSROOT_DIR` makes cargo find headers and libraries. The AppImage bundler is different: `linuxdeploy` and its GTK plugin must resolve the host's module directories, while the Tauri CLI still has to detect `ayatana-appindicator3-0.1`. Set `PKG_CONFIG_PATH` but leave the sysroot empty for that step:

```bash
# DEB: sysroot visible
PKG_CONFIG_SYSROOT_DIR=/path/to/tauri-sysroot \
PKG_CONFIG_PATH=/path/to/tauri-sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/path/to/tauri-sysroot/usr/share/pkgconfig \
  npm run tauri bundle -- --bundles deb

# AppImage: pkg-config paths only, no sysroot redirection
env -u PKG_CONFIG_SYSROOT_DIR \
  PKG_CONFIG_PATH=/path/to/tauri-sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/path/to/tauri-sysroot/usr/share/pkgconfig \
  APPIMAGE_EXTRACT_AND_RUN=1 \
  npm run tauri bundle -- --bundles appimage
```

`APPIMAGE_EXTRACT_AND_RUN=1` avoids a FUSE dependency while packing. On a normal system with the `-dev` packages installed, `npm run tauri build -- --bundles deb,appimage` does both steps.

These files are machine-specific and gitignored: `.cargo/config.toml`, `src-tauri/.cargo/config.toml`, `linux-env.sh`, `run-tauri.sh` and `launch-vinyldeck.sh`. Never commit absolute home paths.

## User-level installs

### Linux

```bash
npm run install:linux
```

Builds the release binary, then installs:

| Item | Path |
| --- | --- |
| Binary (`755`) | `~/.local/bin/vinyldeck` |
| Icon | `~/.local/share/icons/hicolor/256x256/apps/vinyldeck.png` |
| Desktop entry | `~/.local/share/applications/vinyldeck.desktop` |

`SKIP_BUILD=1` reuses an existing binary; `VINYLDECK_INSTALL_ROOT=/tmp/test` installs into a sandbox. The desktop entry points at the stable copy, not the build tree, so rebuilds do not break the launcher.

### Windows

```powershell
npm run install:windows
```

Builds the release binary, then installs:

| Item | Path |
| --- | --- |
| Binary | `%LOCALAPPDATA%\Programs\VinylDeck\VinylDeck.exe` |
| Shortcut | `%APPDATA%\Microsoft\Windows\Start Menu\Programs\VinylDeck.lnk` |
| PATH | app folder appended to the user `PATH` |

`-SkipBuild` reuses an existing build; `-InstallRoot D:\Apps` changes the parent folder. No administrator rights are used.

## Packaging

Release bundles use the Tauri CLI:

```bash
# Windows
npm run tauri build -- --bundles nsis,msi

# Linux
npm run tauri build -- --bundles deb,appimage
```

Outputs land under `src-tauri/target/release/bundle/`. `node scripts/collect-release.mjs windows|linux` copies them to `release/` with version-free names (`vinyldeck-setup-windows-x64.exe`, `vinyldeck-linux-x64.AppImage`, ...) plus `install.sh` and `install.ps1`. See [RELEASING.md](./RELEASING.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Boot, settings hydration, playback source, mode routing |
| `src/views/` | Main and Mini views |
| `src/components/` | Visual and interaction components |
| `src/lib/playback/` | Playback contract, store, mock source, Tauri source |
| `src/lib/settings/` | Frontend settings adapter and defaults |
| `src/lib/collection/` | Crate records, stats and Wrapped selectors |
| `src/lib/i18n/` | English/Russian dictionaries and plural rules |
| `src-tauri/src/media/` | Platform adapters, registry, poller, artwork cache |
| `src-tauri/src/settings/` | Rust-owned settings authority |
| `src-tauri/src/collection/` | Crate persistence, play history and Wrapped |
| `src-tauri/src/window/` | Window modes, fitting, Mini placement and effects |
| `src-tauri/src/overlay.rs` | Localhost overlay server |
| `src-tauri/src/presence.rs` | Discord IPC presence |
| `src-tauri/src/reactivity/` | WASAPI / PipeWire capture and three-band analysis |
| `src-tauri/tauri.conf.json` | Window, CSP and bundle config |
| `scripts/` | Local installers and release tooling |
| `.agents/memory/` | Internal notes for agent sessions (not user docs) |

## Architecture rules

- Keep React platform-neutral. Components consume `PlaybackState`, settings and window adapters, not `windows` or D-Bus.
- Rust is authoritative for shared playback state, settings, the Crate, sleep timers and window lifecycle.
- Browser `MockSource` stays useful for visual development.
- Prefer transform/opacity animation. Suspend work when the window is hidden or playback is paused.
- Active shells are Noir and Glass; Aurora/Vapor/Paper are migration inputs only.
- The CSS vinyl renderer is active; keep `ENABLE_WEBGL_VINYL=false`.
- Do not restore the vinyl center spindle hole.
- Preserve directional track text: next enters from the left, previous from the right.
- Mini is a separate frameless, always-on-top WebView capped at 280x280 with a 140x140 floor. Keep transparency scoped to `miniTransparentMode`.
- Do not remove the custom background theme.

## Update check

The About tab exposes a manual update check. It is intentionally not the Tauri updater plugin: the release pipeline does not hold update signing keys yet, and an unsigned auto-updater would be worse than a clear manual path.

- `src-tauri/src/update.rs` calls the GitHub Releases API with `ureq` (10-second timeout, 256 KiB cap), compares the tag's numeric core with `CARGO_PKG_VERSION`, and returns `UpdateStatus`.
- `src/lib/update/index.ts` validates that payload before React sees it and invokes `cmd_open_release` for the release page. Browser mode reports that checks are desktop-only.
- The HTTP request lives in Rust so `connect-src` stays closed to `api.github.com`.
- The check is read-only. Do not add download or install behaviour without adding updater signing keys and documenting the trust model.
- `cmd_open_release` rejects URLs outside `https://github.com/Shelldock1/vinyldeck/releases`.

## Content Security Policy

`src-tauri/tauri.conf.json` sets:

```text
default-src 'self'; img-src 'self' data: blob: vinyldeck: http://vinyldeck.localhost; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost
```

- Artwork arrives through the `vinyldeck://art/<hash>` scheme, so `img-src` allows `vinyldeck:` (and `http://vinyldeck.localhost` for the Windows form).
- Inline style attributes from `motion/react` and CSS variables need `'unsafe-inline'` in `style-src`. Scripts do not.
- Tauri injects its own script hashes; do not add inline `<script>` tags to `index.html`.
- Tauri IPC needs `connect-src 'self' ipc: http://ipc.localhost`.
- The policy applies to bundled builds. `tauri dev` loads Vite directly.
- Never set `csp` back to `null`.

## Line endings

`.gitattributes` stores text as LF and checks out Windows-only tooling (PowerShell, batch, NSIS, WiX) as CRLF. Do not renormalize the whole repository in a feature commit. If Git reports whitespace changes without content changes, check `core.autocrlf` and the attributes file before committing.

## Documentation rules

- Public docs read like product and contributor docs, not session logs.
- `README.md` orients users quickly; `docs/USER_GUIDE.md` explains the product.
- `docs/API.md` and `docs/ARCHITECTURE.md` may use implementation detail.
- `docs/RELEASING.md` and `CHANGELOG.md` hold release facts.
- Internal progress, reviews and stale work notes belong in `.agents/memory/`.
