# User Guide

VinylDeck is a desktop companion for music that is already playing on your computer. It does not stream, download or own your library. Start a track in Spotify, a browser, VLC, mpv or another app that exposes a system media session, and VinylDeck turns that session into a vinyl deck you can control.

The app runs on **Windows 10/11** (SMTC) and **Linux** (MPRIS) with the same interface.

## Install and start

- **Windows:** run `vinyldeck-setup-windows-x64.exe`, or use the one-line installer in the [README](../README.md#install). The setup installs for the current user and creates a Start Menu shortcut.
- **Linux:** run `vinyldeck-linux-x64.AppImage` after `chmod +x`, install the `.deb`, or use the one-line installer.

When VinylDeck starts it shows the active media session. If nothing is playing yet, start a track and the deck fills in.

Browser development mode (`npm run dev` from a source checkout) shows mock tracks by design; it cannot read native media sessions.

## Main player

The main view combines:

- the pressing, with album art as the record label
- a physical tonearm that follows progress
- track, artist and album
- a progress ring with seeking when the source allows it
- play/pause, previous and next
- shuffle and repeat levers when the source exposes them
- the shell and scheme pickers
- the active source badge

Controls disable when the current player does not support an action. Capabilities come from the system session, not from VinylDeck.

### Shuffle and repeat

Two metal levers sit beside the transport:

- **Shuffle** toggles on and off.
- **Repeat** cycles `Off -> All -> One`. The engraved `1` marks repeat-one.

Linux writes MPRIS `Shuffle`/`LoopStatus`; Windows writes SMTC shuffle and auto-repeat. If the player reports no support, the lever is hidden. The tray mirrors both while the window is hidden.

### Needle Drop

The tonearm creeps toward the label as a track plays. Grab the headshell:

- drop it anywhere on the grooves to seek there; playback resumes if it was paused, and the progress ring previews the landing time while you drag
- drop it beyond the rim to lift it onto its rest and pause

Pausing from the controls lifts the arm in place rather than swinging it away. Tracks with an unknown duration keep the arm at a fixed playing position.

### Progress ring

The ring is also a keyboard slider. `Tab` to it, then:

- `Left` / `Right` seek 5 seconds
- `Shift+Left` / `Shift+Right` seek 5 seconds
- `Home` returns to the start

## Window modes

| Mode | What it does |
| --- | --- |
| Main | Standard window, scales to fit small screens |
| Fullscreen | Immersive player with a hover-revealed top bar |
| Mini | Frameless, always-on-top companion at the bottom-right |

Main opens at 1000x860 and shrinks to at most 92% of the monitor working area. The deck scales with it, so the record and controls do not clip at the 700x560 minimum.

Mini starts as a 280x280 square, can shrink to 140x140, and cannot grow past the original square. Track text fades away at compact sizes. Turn on **Mini Transparency** in Settings -> Display:

- **Windows:** native Acrylic blurs the desktop behind the Mini window.
- **Linux:** the window becomes transparent where the compositor supports it; blur depends on the desktop.

Main and fullscreen never become transparent.

Window controls are at the top-right (minimize, maximize/restore, close). Settings, Crate and Mini triggers are in the top-left row.

Closing a window hides VinylDeck to the tray while **Quit To Tray** is on. Use tray -> Quit, `Ctrl+Q`, or turn Quit To Tray off for a normal exit. Starting VinylDeck again focuses the running copy instead of opening a second one.

## The Crate

Every album you play is pressed into your personal collection. Each pressing is deterministic: the same album gets the same material (marble, splatter, clear, smoke, galaxy, ...) and its own pressing number.

Open the Crate with `C`, the crate button in the top-left row, the right-click menu, or the pressing stamp.

- **Play counting:** a listen counts after half the track or 2 minutes of playing time, whichever comes first. Tracks under 30 seconds never count, and paused time is ignored.
- **Wear:** records gather dust, hairline scuffs and a pale label ring as you play them.
- **Rarity:** pressings are graded Uncommon, Rare or Legendary.
- **Search and sort:** search artist, album or pressing name; sort by recent, plays, rare, pressing order or A-Z.
- **Sources:** switch between **Music**, **Browser** and **All**. Records and listens are tagged automatically, and older entries are classified from their history. Records with no history stay under All.
- **Stats:** total records, total plays, top album and current listening streak. The streak counts every listen in the selected source bucket on the local calendar.

The collection is stored as `collection.json` next to your settings and is owned by the Rust backend. A record pressed on Windows opens on Linux and vice versa.

### Crate Wrapped

The **Wrapped** button in the Crate header opens a monthly recap for the selected source filter:

- total listens and unique records, artists and tracks
- the five most played records
- top track and top artist
- the rarest pressing you played
- the busiest day

Months without listens are skipped. Buckets use your local clock, so late-night listening lands on the day you experienced it.

## Settings

Settings persist across Main, Mini and restarts. The Rust backend validates and stores them.

| Tab | Options |
| --- | --- |
| Look | Noir / Glass shell, Light / Dark / Halloween scheme, interface language |
| Vinyl | Art Ambient, vinyl wobble, film grain |
| Display | Window mode, always on top, lean-back, cursor hide, idle timeout, Mini transparency |
| Source | Auto or a specific media session |
| Other | Keyboard shortcuts, quit to tray, start at login, sleep timer, OBS overlay URL, Discord application ID |
| About | Version and app details, update check, empty-state test |

### Updates

Settings -> About -> **Check for updates** asks GitHub for the newest published release. If one is newer than the running build, **View release** opens its page in your browser. VinylDeck never downloads or installs an update on its own: use the one-line installer again, or download the current installer/AppImage from the release page. The check needs `api.github.com`; it is available in the desktop app, not in browser development mode.

### Language

English and Russian are complete translations, including the tray menu, tooltips and screen-reader labels. **Auto** follows the OS locale. Switch with the round EN/RU button, `L`, the right-click menu, or Settings -> Look -> Language.

### Player source

When several media apps are open, Settings -> Source controls which session the deck follows:

- **Auto** follows whichever app starts or resumes playback, then the last one that played, then a paused session.
- Picking a specific app pins it. The choice is remembered even while that app is closed, and the menu shows "Saved source - not running".

The same list appears as **Player source** in the right-click menu.

### Start at login

**Start At Login** uses the native mechanism for your platform: the registry Run key on Windows and an XDG autostart entry on Linux. It is off by default and only starts the app; it does not start playback.

## Keyboard shortcuts

Shortcuts work while a VinylDeck window is focused. Disable them in Settings -> Other; `Escape` stays available.

| Action | Shortcut |
| --- | --- |
| Play / pause | `Space` |
| Play / pause (global) | `Ctrl+Alt+Space` |
| Previous / next | `Left` / `Right` |
| Seek -5 s / +5 s | `Shift+Left` / `Shift+Right` |
| Fullscreen | `F` |
| Mini player | `M` |
| Mini player (global) | `Ctrl+Alt+M` |
| Cycle shell | `T` |
| Settings | `S` |
| Art Ambient | `A` |
| The Crate | `C` |
| Switch language | `L` |
| Shortcut cheat sheet | `?` |
| Close the topmost surface | `Escape` |
| Quit | `Ctrl+Q` |

`?` opens the cheat sheet in Main and Fullscreen; Mini ignores it. Escape closes the topmost surface in this order: cheat sheet, context menu, the Crate, Settings, fullscreen.

The two global shortcuts work while another application has focus. If the desktop already owns a combination, registration is skipped rather than failing the app.

## Context menu

Right-click the deck for playback actions, **Sleep 30 min**, **Sleep after track**, **Cancel sleep timer** (while active), Art Ambient, fullscreen, Mini, Settings, Player source and Quit. Mini shows only the actions that make sense for the compact window.

## Sleep timer

Start a timer from Settings -> Other or the context menu:

- Off, 15, 30, 45 or 60 minutes
- End of track

The timer runs in Rust, so switching between Main, Mini and the tray does not reset it. When it fires, playback pauses and the tonearm lifts and parks. Timers are not persisted across restarts.

## OBS overlay

VinylDeck serves a local overlay at:

```text
http://127.0.0.1:43110/overlay
```

Add it as an OBS **Browser Source** (transparent page, self-refreshing). Also available:

| Path | Content |
| --- | --- |
| `/overlay` | Transparent browser-source page |
| `/state` | Current track/state as JSON, for custom scenes |
| `/artwork` | Cached cover image |

The server binds to localhost only and rejects requests whose `Host` header is not `127.0.0.1:43110` or `localhost:43110`. Other websites cannot read your listening state. The URL is listed in Settings -> Other.

## Discord Rich Presence

Presence is opt-in and off by default. Create a Discord application in the [Discord Developer Portal](https://discord.com/developers/applications), copy its **Application ID**, and paste it into Settings -> Other. VinylDeck validates the numeric ID and mirrors the track, artist, album and elapsed time over the local Discord IPC socket. It only sends when the track or play state changes, and the ID never leaves your machine except to Discord.

Clear the field to turn presence off.

## Visual behavior

- Noir and Glass are the live shells; Light, Dark and Halloween are color schemes layered over them.
- Art Ambient tints the room with the album palette.
- The vinyl material is derived from the cover, and wear is part of the pressing.
- Track changes inside VinylDeck animate directionally: next enters from the left, previous from the right.
- When the window is hidden or playback is paused, the record and animations suspend.

## Troubleshooting

See [Troubleshooting](./TROUBLESHOOTING.md) for media detection, disabled controls, audio reactivity, transparency, updates and installer issues.
