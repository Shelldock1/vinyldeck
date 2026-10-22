# VinylDeck 0.1.1 Release Notes

VinylDeck `0.1.1` is the current Windows desktop release. Ready-to-use MSI and NSIS installers are available on the GitHub Releases page.

## Included

- Tauri v2 Windows desktop shell
- React 19 visual engine
- Real Windows SMTC media snapshots
- In-app play/pause, previous, next, and seek commands when supported
- Main, fullscreen, and resizable mini-player windows
- Tray lifecycle with explicit quit
- Backend-owned persisted settings
- Opt-in Start With Windows setting
- Optional Mini Transparency using native Windows Acrylic
- Noir and Glass visual shells
- Album-art ambient color extraction
- Animated CSS vinyl deck with physical tonearm
- Keyboard shortcuts, tooltips, keycap hints, and context menu
- Frontend and Rust regression tests

## Build Metadata

| Item | Value |
| --- | --- |
| App version | `0.1.1` |
| Package name | `vinyldeck` |
| Product name | `VinylDeck` |
| Tauri identifier | `com.vinyldeck.app` |
| Bundle targets | MSI, NSIS |

## 0.1.1 Highlights

- Mini player can shrink from `280x280` down to `140x140` and cannot expand beyond the original square.
- Mini vinyl and hover controls scale proportionally while shrinking.
- Track text fades away at compact Mini sizes so the record remains clear.
- Optional Mini Transparency uses native Windows Acrylic behind the Mini player.
- Download links now point at the `v0.1.1` GitHub release assets.

## Verification

Use these commands for the release baseline:

```powershell
npm run build
npm run test:frontend
npm run fmt:rust
npm run clippy:rust
npm run test:rust
npm run tauri build -- --debug
```

Original `0.1.0` release installers built on 2026-06-14:

| Installer | Size | Notes |
| --- | ---: | --- |
| `VinylDeck_0.1.0_x64_en-US.msi` | 3.82 MiB | Installed successfully; appears in Control Panel |
| `VinylDeck_0.1.0_x64-setup.exe` | 2.61 MiB | NSIS installer output |

Installed-app validation:

- MSI install completed successfully.
- Default install location is acceptable.
- Custom install location `C:\Apps\VinylDeck` worked.
- App appeared in Windows Control Panel.
- User verified expected app behavior after installation.
- Installer size is accepted as optimal for this release.

## Known Release Work

Before a public packaged release, complete or recheck:

- WebView2 bootstrap validation
- settings-location verification
- player compatibility matrix
- bundle identifier review
- tray playback command-path revalidation
- code signing to replace Windows UAC `Publisher: Unknown`

## Out Of Scope

- shortcut editing UI
- splash screen
- active WebGL vinyl renderer
- mobile builds
