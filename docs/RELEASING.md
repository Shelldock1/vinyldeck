# Releasing VinylDeck

Releases are tag-driven. Pushing a `v*` tag runs [`.github/workflows/release.yml`](../.github/workflows/release.yml), builds both platforms, publishes version-free artifact names and writes `SHA256SUMS.txt`.

## Artifact contract

These names are stable forever so `releases/latest/download/<file>` keeps working:

| File | Platform | Built from |
| --- | --- | --- |
| `vinyldeck-setup-windows-x64.exe` | Windows x64 | Tauri NSIS bundle |
| `vinyldeck-windows-x64.msi` | Windows x64 | Tauri MSI (WiX) bundle |
| `vinyldeck-linux-x64.AppImage` | Linux x64 | Tauri AppImage bundle |
| `vinyldeck-linux-x64.deb` | Linux x64 | Tauri DEB bundle |
| `install.sh` | Linux x64 | Repository root, attached for one-line installs |
| `install.ps1` | Windows x64 | Repository root, attached for one-line installs |
| `SHA256SUMS.txt` | all | Generated in the publish job |

Do **not** rename these to include the version. The version lives in the tag, the release title and the app's About screen; the filenames must stay stable for the one-line installers and badges.

## One-line install URLs

```bash
curl -fsSL https://github.com/Shelldock1/vinyldeck/releases/latest/download/install.sh | bash
```

```powershell
irm https://github.com/Shelldock1/vinyldeck/releases/latest/download/install.ps1 | iex
```

Both scripts also accept `VINYLDECK_VERSION=v0.2.0` to pin a release, and `VINYLDECK_RELEASE_BASE` to point at a mirror.

## Version bump checklist

Update all four version fields together:

- `package.json` -> `version`
- `src-tauri/Cargo.toml` -> `[package] version`
- `src-tauri/tauri.conf.json` -> `version`
- `landing/package.json` -> `version`

Then:

```bash
npm install --package-lock-only     # refresh package-lock.json
cargo check --manifest-path src-tauri/Cargo.toml   # refresh Cargo.lock
```

Add a `CHANGELOG.md` section for the new version. The release workflow extracts it with:

```bash
node scripts/changelog-section.mjs > release-notes.md
```

The script fails when the section is missing, which prevents a tag with empty notes.

## Local pre-release gate

```bash
npm ci
npm run lint
npm run build
npm run test:frontend
npm run fmt:rust
npm run clippy:rust
npm run test:rust

# Windows
npm run tauri build -- --bundles nsis,msi

# Linux
npm run tauri build -- --bundles deb,appimage

node scripts/collect-release.mjs windows   # run on Windows
node scripts/collect-release.mjs linux     # run on Linux
```

`release/` should contain the stable names. The collector fails if a required bundle is missing or if an artifact is not x64.

Verify the Linux artifacts:

```bash
dpkg-deb -I release/vinyldeck-linux-x64.deb
chmod +x release/vinyldeck-linux-x64.AppImage
./release/vinyldeck-linux-x64.AppImage --appimage-extract >/dev/null
```

Verify the Windows setup on a clean profile before announcing: install, launch, play/pause from the app, check the Start Menu shortcut and uninstall entry.

## Publishing

```bash
git tag -a v0.2.0 -m "VinylDeck 0.2.0"
git push origin main
git push origin v0.2.0
```

Watch the Release workflow:

- `build-linux` builds and collects the DEB/AppImage.
- `build-windows` builds and collects the NSIS/MSI.
- `publish` merges both artifact sets, writes `SHA256SUMS.txt`, extracts the CHANGELOG section and creates the GitHub Release.

If a job fails, fix the cause, delete the tag locally and remotely, and retag:

```bash
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0
```

Do not re-upload assets by hand unless the workflow itself is broken; hand-made releases drift from the stable-name contract.

## Post-release verification

1. Open <https://github.com/Shelldock1/vinyldeck/releases/latest> and confirm the release is marked **Latest**.
2. Download each stable URL and check the size is non-zero:

   ```bash
   curl -fL -o /tmp/vd.AppImage \
     https://github.com/Shelldock1/vinyldeck/releases/latest/download/vinyldeck-linux-x64.AppImage
   curl -fL -o /tmp/vd.exe \
     https://github.com/Shelldock1/vinyldeck/releases/latest/download/vinyldeck-setup-windows-x64.exe
   ```

3. Compare against `SHA256SUMS.txt`.
4. Run the one-line installer in a throwaway home/prefix:
   - Linux: `VINYLDECK_INSTALL_DIR=/tmp/vd-test VINYLDECK_SKIP_DESKTOP=1 VINYLDECK_NO_PATH_UPDATE=1 bash install.sh`
   - Windows: `$env:VINYLDECK_NO_PATH_UPDATE="1"` before the one-liner, on a test machine.
5. Confirm the README download badges and one-line commands still resolve.

## What CI verifies

- Frontend build, lint, tests and the Rust gate on Ubuntu and Windows for every push and PR.
- A Windows debug bundle on every push.
- Shell/Node syntax for the installers and release scripts; PowerShell parser checks on Windows.
- On a tag: release-mode bundling for NSIS/MSI and DEB/AppImage, artifact collection and checksums.

## What still needs a human

- Code signing. Binaries are unsigned, so SmartScreen/UAC show an unknown publisher.
- A clean Windows 10 and Windows 11 install, including WebView2 bootstrap.
- Interactive playback through SMTC with Spotify, a browser and VLC.
- Tray behavior on GNOME, KDE and a Windows taskbar with scaling.
- Mini Acrylic on real hardware (not a VM or remote session).
- AppImage startup on a machine without FUSE and on common Wayland sessions.
- Uninstall behavior and the Control Panel entry.

## Rollback

If a release is broken, mark it as a pre-release or delete it, then publish a new patch tag with the fix. The `latest` download URLs follow the newest non-prerelease release, so a patched release restores the one-line installers without changing their URLs.
