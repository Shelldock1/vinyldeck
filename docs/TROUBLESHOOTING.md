# Troubleshooting

## No Track Appears

- Use desktop mode: `npm run tauri dev`.
- Start playback in a media app after VinylDeck opens.
- Try Spotify first because it exposes Windows media sessions reliably.
- Check that the media app appears in Windows media controls.
- Browser mode (`npm run dev`) always uses mock playback.

## Controls Are Disabled

VinylDeck follows the capabilities reported by Windows SMTC. Some sources support play/pause but not previous, next, or seek.

Try:

- changing tracks inside the source app
- switching to Spotify for comparison
- restarting VinylDeck after media starts

## Progress Or Artwork Looks Stale

VinylDeck caches artwork and reads timeline state through the Rust SMTC poller. If stale metadata appears:

1. Confirm the source app itself shows the correct track in Windows media controls.
2. Restart playback in the source app.
3. Restart VinylDeck.
4. For development debugging, inspect `src-tauri/src/media/poller.rs` and `src/lib/playback/tauriSource.ts`.

## App Closes To Tray Instead Of Exiting

Quit To Tray is enabled. Turn it off in Settings -> Other if the close button should exit the app.

Explicit exit options:

- tray Quit
- `Ctrl+Q` when shortcuts are enabled
- Settings -> Other -> disable Quit To Tray, then close the window

## Keyboard Shortcuts Do Nothing

Check Settings -> Other -> Keyboard Shortcuts.

When shortcuts are disabled, VinylDeck still allows Escape for closing Settings or leaving fullscreen.

## Mini Transparency Does Not Blur The Desktop

Mini Transparency only affects Mini mode and relies on the native Windows Acrylic effect. Check Settings -> Display -> Mini Transparency, then reopen Mini if needed. On systems or Windows builds where Acrylic is unavailable or disabled, the Mini window still works as a normal shrink-resizable player.

## Browser Mode Shows Mock Tracks

Expected. Browser mode cannot access Windows SMTC, so it uses `MockSource`.

Use desktop mode for real media:

```powershell
npm run tauri dev
```

## WebView2 Issue

VinylDeck needs Microsoft WebView2 on Windows. If the Tauri window does not open or shows a WebView-related failure, install or repair the WebView2 runtime from Microsoft, then restart the app.

## Debug Bundle Warning

Debug bundle builds may warn that the current bundle identifier ends with `.app`. This does not block local development, but identifier naming should be reviewed before a public packaged release.

## Installer Shows Unknown Publisher

Expected for unsigned local builds. Windows UAC shows `Publisher: Unknown` until VinylDeck is code-signed with a trusted certificate. This does not mean the local build is broken; it means Windows cannot verify a publisher identity.

## Tray Playback Menu Differs From Main Controls

The main in-app controls use the current SMTC command path. Tray playback controls should be revalidated before treating tray playback as release-grade.
