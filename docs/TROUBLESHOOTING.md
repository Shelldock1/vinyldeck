# Troubleshooting

## Nothing appears on the deck

VinylDeck reads the operating system's current media session. It does not scan your music library.

1. Start playback **after** VinylDeck opens.
2. Confirm the player appears in the system media controls:
   - **Windows:** open the Quick Settings media flyout (or the media keys overlay).
   - **Linux:** run `playerctl -l` (if installed) or `busctl --user list | grep org.mpris.MediaPlayer2`.
3. Open Settings -> Source. If the player is listed, select it explicitly; if it is missing, the app does not publish a media session.
4. Try Spotify, a browser tab playing audio, VLC or mpv as a comparison.

Browser development mode (`npm run dev`) always shows mock tracks. Use `npm run tauri dev` or an installed build for real media.

Some players only publish a session while they are actually playing. Pausing before opening VinylDeck can hide the session.

## Controls are greyed out

VinylDeck follows the capabilities reported by the session. A player can support play/pause but not previous, next or seek.

- Perform the action in the source app to confirm it is possible.
- Try another player.
- Restart playback in the source after VinylDeck is open.

The shuffle and repeat levers are hidden when the player reports no support. On Linux this maps to MPRIS `Shuffle` and `LoopStatus`; on Windows to SMTC shuffle and auto-repeat.

## Artwork or metadata is stale

Covers are cached by source, track, artist, album and duration, and read off the polling thread. If the wrong cover appears:

1. Confirm the source app shows the correct metadata in the system media controls.
2. Skip to another track and back.
3. Restart the source app, then VinylDeck.
4. For development, inspect `src-tauri/src/media/poller.rs`, `artwork.rs` and `src/lib/playback/tauriSource.ts`.

Files with DRM, local `file://` covers outside the allowed size, or unsupported image formats fall back to no artwork.

## The window opens but the WebView is blank (Linux)

WebKitGTK may fail to initialize DMA-BUF on some GPUs, VMs and remote desktops. Try:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 vinyldeck
```

For a source checkout, `linux-env.sh` already exports this. Also confirm the GTK/WebKit runtime packages are installed:

```bash
sudo apt install libwebkit2gtk-4.1-0 libayatana-appindicator3-1 librsvg2-2
```

## The AppImage will not start

AppImages need FUSE:

```bash
sudo apt install libfuse2      # Debian/Ubuntu
./vinyldeck-linux-x64.AppImage
```

If FUSE is unavailable (containers, locked-down systems):

```bash
APPIMAGE_EXTRACT_AND_RUN=1 ./vinyldeck-linux-x64.AppImage
```

The one-line installer warns when no `fusermount` binary is found.

## The app is not on PATH after installation

The Linux installer adds `~/.local/bin` to `~/.profile` for future login shells. Apply it now with:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

The Windows installer appends the app folder to the **user** `PATH`. Open a new terminal after installation. The Start Menu shortcut works regardless of `PATH`.

## "Windows protected your PC" or "Unknown publisher"

Release binaries are not code-signed yet. SmartScreen and UAC therefore show an unknown publisher. This is expected.

To check the download, compare its SHA-256 with the release page:

```powershell
Get-FileHash .\vinyldeck-setup-windows-x64.exe -Algorithm SHA256
```

```bash
sha256sum vinyldeck-linux-x64.AppImage
```

The one-line installers verify `SHA256SUMS.txt` automatically when it is published.

## Audio reactivity is flat

Reactivity needs the system output, not a microphone.

- **Windows:** playback must go to the default output device; WASAPI loopback captures it. Exclusive-mode output may bypass capture.
- **Linux:** install `pulseaudio-utils` or the PipeWire Pulse compatibility package so `parec` exists. Check with `command -v parec` and `pactl list short sources`.
- Playback must be active. Capture starts and stops with playback, and a failure leaves the meter still rather than opening a microphone.
- Very quiet tracks produce low levels by design.

## Mini Transparency does nothing

It is Mini-only and must be enabled in Settings -> Display before or while Mini is open.

- **Windows:** requires a Windows build and GPU driver that supports Acrylic. Remote sessions and some VMs disable it.
- **Linux:** the window becomes transparent only where the compositor supports it; blur is desktop-dependent.

Main and fullscreen never use this effect.

## The app hides instead of exiting

**Quit To Tray** is on by default. Use tray -> **Quit**, press `Ctrl+Q`, or turn off Settings -> Other -> Quit To Tray. Closing then exits normally.

## The tray icon or menu is missing (Linux)

The tray needs an AppIndicator host (GNOME needs an extension such as AppIndicator Support; KDE and most other desktops include one). Install `libayatana-appindicator3-1`. Without a host the app still runs; only the tray is unavailable.

## Global shortcuts do not work

`Ctrl+Alt+M` and `Ctrl+Alt+Space` are registered on a best-effort basis. A desktop environment or another app may already own them; registration is then skipped and logged. In-app shortcuts still work while VinylDeck is focused, and can be disabled in Settings -> Other.

Wayland compositors may restrict global shortcut registration; use the in-app controls or your desktop's own shortcut binding.

## Start At Login does not start the app

- **Windows:** the autostart entry is a registry `Run` value written for the current user.
- **Linux:** an XDG autostart entry is written under `~/.config/autostart/`.

Toggle the setting off and on after moving or reinstalling the binary, because the registration points at the executable path. Sandboxed/Flatpak builds may not be allowed to register autostart.

## The OBS overlay is blank or blocked

- Use `http://127.0.0.1:43110/overlay` exactly. The server binds to loopback only.
- Do not proxy the URL through another hostname: the server rejects foreign `Host` headers by design.
- OBS must run on the same machine.
- If another process owns port 43110, the overlay logs a bind error and the rest of the app keeps working. Stop the other process and restart VinylDeck.
- Custom scenes can read `http://127.0.0.1:43110/state` and the cover at `/artwork`.

## Discord Rich Presence does not show

- Rich Presence is off while the Discord application ID field is empty. Paste the **Application ID** from your own app at <https://discord.com/developers/applications>.
- Discord must be running on the same machine. Flatpak Discord is detected through its runtime socket.
- The ID must be numeric. Invalid values are rejected.
- Presence only updates when the track or play state changes.

## Language or dates look wrong

Language **Auto** follows the OS locale. Pick English or Russian explicitly in Settings -> Look, with the EN/RU button, or with `L`. The tray follows the same setting.

## Reset settings or the collection

Settings and the Crate live in the Tauri app data directory:

| Platform | Typical location |
| --- | --- |
| Windows | `%APPDATA%\com.vinyldeck.app\settings.json`, `collection.json` |
| Linux | `~/.local/share/com.vinyldeck.app/settings.json`, `collection.json` |

Close VinylDeck, move the file aside, and reopen the app. Deleting `collection.json` removes the Crate and Wrapped history; deleting `settings.json` restores defaults.

## Installer or build failures

- **Windows build:** install Visual Studio Build Tools with the C++ workload and make sure the Rust MSVC toolchain is selected. WebView2 is required at runtime.
- **Linux build:** install the `-dev` packages from [DEVELOPMENT.md](./DEVELOPMENT.md). A rootless sysroot needs `PKG_CONFIG_SYSROOT_DIR` for cargo and different handling for the AppImage bundler; the development guide shows both commands.
- **`npm run tauri build` fails after a dependency bump:** delete `node_modules/`, run `npm ci`, and update `@tauri-apps/cli` together with the Rust `tauri` crate.
- **Bundle warnings about `com.vinyldeck.app`:** the identifier ends in `.app`, which conflicts with macOS bundle conventions. It is harmless for the Windows/Linux targets and is kept for update continuity.
